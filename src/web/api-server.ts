// Express API server wrapping MCP functionality for web UI

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { createAppConfig } from '../config/environment';
import {
  securityHeaders,
  sanitizeRequest,
  rateLimitConfig,
  validateRequestSize,
} from '../middleware/validation';
import { EnhancedMCPServer } from '../server/enhanced-mcp-server';
import { AppConfig } from '../types';
import { getLogger } from '../utils/logger';
import { PDFGenerator } from '../utils/pdf-generator';

import {
  createHealthRouter,
  createCacheRouter,
  createSprintRouter,
  createGitHubRouter,
  createAnalyticsRouter,
  createReportRouter,
  createVelocityRouter,
} from './routes';

export class WebAPIServer {
  private app: express.Application;
  private mcpServer: EnhancedMCPServer;
  private config: AppConfig;
  private logger: any;
  private pdfGenerator: PDFGenerator;

  constructor() {
    this.app = express();
    // HTTP mode: use frequent health checks (30 seconds) for web API monitoring
    this.mcpServer = new EnhancedMCPServer({ healthCheckIntervalMs: 30 * 1000 });
    this.config = createAppConfig();
    this.logger = getLogger(this.config.logging);
    this.pdfGenerator = new PDFGenerator();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security headers
    this.app.use(securityHeaders);

    // Helmet security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            frameSrc: ["'self'"],
          },
        },
        crossOriginEmbedderPolicy: false,
      })
    );

    // CORS with strict configuration
    this.app.use(
      cors({
        origin:
          process.env.NODE_ENV === 'production'
            ? process.env.ALLOWED_ORIGINS?.split(',') || [
                'https://your-domain.com',
              ]
            : [
                'http://localhost:3000',
                'http://localhost:3001',
                'http://localhost:3002',
                'http://localhost:5173',
              ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
        exposedHeaders: ['Content-Disposition'],
      })
    );

    // Rate limiting with configuration
    const limiter = rateLimit(rateLimitConfig);
    this.app.use('/api/', limiter);

    // Request size validation
    this.app.use(validateRequestSize(10 * 1024 * 1024)); // 10MB limit

    // Request sanitization
    this.app.use(sanitizeRequest);

    // Compression and parsing with security limits
    this.app.use(compression());
    this.app.use(
      express.json({
        limit: '10mb',
        strict: true,
        type: 'application/json',
      })
    );
    this.app.use(
      express.urlencoded({
        extended: true,
        limit: '10mb',
        parameterLimit: 1000,
      })
    );

    // Trust proxy for rate limiting (if behind reverse proxy)
    if (process.env.NODE_ENV === 'production') {
      this.app.set('trust proxy', 1);
    }

    // Request logging
    this.app.use((req, _res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        type: 'api_request',
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });

    // Static files (for built React app)
    this.app.use(express.static('dist/web'));
  }

  private setupRoutes(): void {
    // Helper to get server context
    const getContext = () => this.mcpServer.getContext();
    const getMCPServer = () => this.mcpServer;

    // Mount modular routers
    // Health routes (/api/health, /api/info, /api/metrics, /api/system-status)
    const healthRouter = createHealthRouter(getContext, getMCPServer);
    this.app.use('/api', healthRouter);

    // Cache routes (/api/cache/stats, /api/cache/warm, /api/cache/warm-sprint/:id, /api/webhooks/jira/*, /api/cache/optimize)
    const cacheRouter = createCacheRouter(
      getContext,
      getMCPServer,
      this.warmSprintCache.bind(this),
      this.invalidateSprintCache.bind(this),
      this.invalidateIssueCache.bind(this)
    );
    this.app.use('/api', cacheRouter);

    // Sprint routes (/api/boards, /api/sprints, /api/sprints/:id/issues, /api/sprints/:id/metrics, /api/sprints/:id/comprehensive)
    const sprintRouter = createSprintRouter(
      getContext,
      this.callMCPTool.bind(this),
      this.getSprintCacheTTL.bind(this),
      this.generateComprehensiveReport.bind(this),
      this.scheduleBackgroundRefresh.bind(this),
      this.handleAPIError.bind(this)
    );
    this.app.use('/api', sprintRouter);

    // GitHub routes (/api/github/repos/:owner/:repo/commits, /api/github/repos/:owner/:repo/pulls, /api/github/:owner/:repo/commits/jira)
    const githubRouter = createGitHubRouter(
      this.callMCPTool.bind(this),
      this.handleAPIError.bind(this)
    );
    this.app.use('/api/github', githubRouter);

    // Analytics routes (/api/analytics/commit-trends/:owner/:repo, /api/analytics/team-performance/:boardId, /api/analytics/issue-types/:boardId)
    const analyticsRouter = createAnalyticsRouter(
      getContext,
      this.callMCPTool.bind(this),
      this.aggregateCommitsByMonth.bind(this),
      this.calculateTeamPerformance.bind(this),
      this.calculateIssueTypeDistribution.bind(this),
      this.handleAPIError.bind(this)
    );
    this.app.use('/api/analytics', analyticsRouter);

    // Report routes (/api/reports/sprint, /api/export/sprint-report/pdf, /api/export/analytics/pdf)
    const reportRouter = createReportRouter(
      this.callMCPTool.bind(this),
      this.handleAPIError.bind(this)
    );
    this.app.use('/api', reportRouter);

    // Velocity routes (/api/velocity/:boardId)
    const velocityRouter = createVelocityRouter(
      getContext,
      this.calculateVelocityDataOptimized.bind(this),
      this.handleAPIError.bind(this)
    );
    this.app.use('/api/velocity', velocityRouter);

    // Fallback for React Router (SPA) - Express 5 compatible
    // Comment out for now as it causes routing issues
    // this.app.get('/:path(.*)', (_, res) => {
    //   res.sendFile('index.html', { root: 'dist/web' });
    // });

    // Global error handler (Express 5 requires 4 parameters)
    this.app.use(
      (
        error: any,
        req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        this.logger.logError(error, 'api_error', {
          method: req.method,
          path: req.path,
          body: req.body,
        });

        res.status(500).json({
          error: 'Internal server error',
          message:
            process.env.NODE_ENV === 'development'
              ? error.message
              : 'Something went wrong',
        });
      }
    );
  }

  private async callMCPTool(toolName: string, args: any): Promise<any> {
    try {
      const context = this.mcpServer.getContext();
      // Simulate MCP tool call via tool registry
      console.log(
        '[CALL-MCP-TOOL] Executing tool:',
        toolName,
        'with args keys:',
        Object.keys(args)
      );
      const toolRegistry = (this.mcpServer as any).toolRegistry;
      const result = await toolRegistry.executeTool(toolName, args, context);
      console.log('[CALL-MCP-TOOL] Tool result type:', typeof result);
      console.log(
        '[CALL-MCP-TOOL] Tool result keys:',
        result && typeof result === 'object' ? Object.keys(result) : 'N/A'
      );

      // Extract content from MCP response
      if (result.content?.[0]?.text) {
        console.log(
          '[CALL-MCP-TOOL] Extracting from content[0].text, length:',
          result.content[0].text.length
        );
        try {
          const parsed = JSON.parse(result.content[0].text);
          console.log('[CALL-MCP-TOOL] Parsed JSON keys:', Object.keys(parsed));
          console.log(
            '[CALL-MCP-TOOL] Has metadata in parsed?',
            !!parsed.metadata
          );
          console.log(
            '[CALL-MCP-TOOL] Has sprintGoal in parsed?',
            !!parsed.sprintGoal
          );
          return parsed;
        } catch {
          return result.content[0].text;
        }
      }

      console.log(
        '[CALL-MCP-TOOL] Returning result directly (no content[0].text)'
      );
      return result;
    } catch (error) {
      this.logger.logError(error as Error, `mcp_tool_${toolName}`, { args });
      throw error;
    }
  }

  private handleAPIError(
    error: any,
    res: express.Response,
    message: string
  ): void {
    this.logger.logError(error, 'api_error');

    const statusCode = error.statusCode || error.status || 500;
    const errorMessage = error.userMessage || error.message || message;

    res.status(statusCode).json({
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }

  async initialize(): Promise<void> {
    // Initialize MCP server
    await this.mcpServer.initialize();

    this.logger.info('Web API Server initialized', {
      type: 'api_server_init',
      port: this.config.server.port,
      host: this.config.server.host,
    });

    // Analytics endpoints
    this.app.get(
      '/api/analytics/commit-trends/:owner/:repo',
      async (req, res) => {
        try {
          const { owner, repo } = req.params;
          const { period = '6months' } = req.query;

          // Check cache first (10 minute TTL for commit trends)
          // Cache version v4: fetches all pages (up to 1000 commits/PRs)
          const cacheKey = `commit-trends:v4:${owner}:${repo}:${period}`;
          const cacheManager = this.mcpServer.getContext().cacheManager;

          const cachedData = await cacheManager.get(cacheKey);
          if (cachedData) {
            this.logger.info('Commit trends served from cache', {
              owner,
              repo,
              period,
            });
            return res.json(cachedData);
          }

          // Calculate date range based on period
          const endDate = new Date();
          const startDate = new Date();

          switch (period) {
            case '1month':
              startDate.setMonth(endDate.getMonth() - 1);
              break;
            case '3months':
              startDate.setMonth(endDate.getMonth() - 3);
              break;
            case '6months':
              startDate.setMonth(endDate.getMonth() - 6);
              break;
            case '1year':
              startDate.setFullYear(endDate.getFullYear() - 1);
              break;
          }

          // Fetch both commits and pull requests
          // For active repos, we need to fetch all pages to cover the entire time period
          const fetchAllCommits = async () => {
            const allCommits = [];
            let page = 1;
            let hasMore = true;

            while (hasMore && page <= 10) {
              // Limit to 10 pages (1000 commits max)
              const commits = await this.callMCPTool('github_get_commits', {
                owner,
                repo,
                since: startDate.toISOString(),
                until: endDate.toISOString(),
                per_page: 100,
                page,
              });

              if (commits && commits.length > 0) {
                allCommits.push(...commits);
                hasMore = commits.length === 100; // If we got 100, there might be more
                page++;
              } else {
                hasMore = false;
              }
            }

            return allCommits;
          };

          const fetchAllPRs = async () => {
            const allPRs = [];
            let page = 1;
            let hasMore = true;

            while (hasMore && page <= 10) {
              // Limit to 10 pages (1000 PRs max)
              try {
                const prs = await this.callMCPTool('github_get_pull_requests', {
                  owner,
                  repo,
                  state: 'all',
                  since: startDate.toISOString(),
                  until: endDate.toISOString(),
                  per_page: 100,
                  page,
                });

                if (prs && prs.length > 0) {
                  allPRs.push(...prs);
                  hasMore = prs.length === 100;
                  page++;
                } else {
                  hasMore = false;
                }
              } catch (err) {
                this.logger.warn('Failed to fetch pull requests page', {
                  page,
                  error: (err as Error).message,
                });
                hasMore = false;
              }
            }

            return allPRs;
          };

          const [commits, pullRequests] = await Promise.all([
            fetchAllCommits(),
            fetchAllPRs(),
          ]);

          // Aggregate commits and PRs by month, filling in missing months with zeros
          const trends = this.aggregateCommitsByMonth(
            commits,
            pullRequests,
            startDate,
            endDate
          );

          // Cache for 10 minutes
          await cacheManager.set(cacheKey, trends, { ttl: 600000 });

          this.logger.info('Commit trends calculated and cached', {
            owner,
            repo,
            period,
          });
          return res.json(trends);
        } catch (error) {
          return this.handleAPIError(error, res, 'Failed to get commit trends');
        }
      }
    );

    this.app.get(
      '/api/analytics/team-performance/:boardId',
      async (req, res) => {
        try {
          const { boardId } = req.params;
          const sprintCount = parseInt(req.query.sprints as string) || 10;

          // Check cache first (5 minute TTL)
          const cacheKey = `team-performance:${boardId}:${sprintCount}`;
          const cacheManager = this.mcpServer.getContext().cacheManager;

          const cachedData = await cacheManager.get(cacheKey);
          if (cachedData) {
            this.logger.info('Team performance served from cache', {
              boardId,
              sprintCount,
            });
            return res.json(cachedData);
          }

          const performance = await this.calculateTeamPerformance(
            boardId,
            sprintCount
          );

          // Only cache non-empty results
          if (performance && performance.length > 0) {
            await cacheManager.set(cacheKey, performance, { ttl: 300000 });
            this.logger.info('Team performance calculated and cached', {
              boardId,
              sprintCount,
              count: performance.length,
            });
          } else {
            this.logger.warn('Team performance returned empty, not caching', {
              boardId,
              sprintCount,
            });
          }

          return res.json(performance);
        } catch (error) {
          return this.handleAPIError(
            error,
            res,
            'Failed to get team performance data'
          );
        }
      }
    );

    this.app.get('/api/analytics/issue-types/:boardId', async (req, res) => {
      try {
        const { boardId } = req.params;
        const sprintCount = parseInt(req.query.sprints as string) || 6;

        // Check cache first (10 minute TTL)
        const cacheKey = `issue-types:${boardId}:${sprintCount}`;
        const cacheManager = this.mcpServer.getContext().cacheManager;

        const cachedData = await cacheManager.get(cacheKey);
        if (cachedData) {
          this.logger.info('Issue type distribution served from cache', {
            boardId,
            sprintCount,
          });
          return res.json(cachedData);
        }

        const issueTypes = await this.calculateIssueTypeDistribution(
          boardId,
          sprintCount
        );

        // Cache for 10 minutes
        await cacheManager.set(cacheKey, issueTypes, { ttl: 600000 });

        this.logger.info('Issue type distribution calculated and cached', {
          boardId,
          sprintCount,
        });
        return res.json(issueTypes);
      } catch (error) {
        return this.handleAPIError(
          error,
          res,
          'Failed to get issue type distribution'
        );
      }
    });

    // PDF export endpoints
    this.app.post('/api/export/sprint-report/pdf', async (req, res) => {
      try {
        const { reportData, options = {} } = req.body;

        if (!reportData) {
          res.status(400).json({ error: 'Report data is required' });
          return;
        }

        const pdfBuffer = await this.pdfGenerator.generateSprintReportPDF(
          reportData,
          options
        );

        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="sprint-report-${reportData.sprint?.name || 'unknown'}.pdf"`,
          'Content-Length': pdfBuffer.length.toString(),
        });

        res.send(pdfBuffer);
      } catch (error) {
        this.handleAPIError(error, res, 'Failed to generate PDF report');
      }
    });

    this.app.post('/api/export/analytics/pdf', async (req, res) => {
      try {
        const { analyticsData, options = {} } = req.body;

        if (!analyticsData) {
          res.status(400).json({ error: 'Analytics data is required' });
          return;
        }

        const pdfBuffer = await this.pdfGenerator.generateAnalyticsPDF(
          analyticsData,
          options
        );

        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="analytics-report.pdf"',
          'Content-Length': pdfBuffer.length.toString(),
        });

        res.send(pdfBuffer);
      } catch (error) {
        this.handleAPIError(error, res, 'Failed to generate analytics PDF');
      }
    });
  }

  private aggregateCommitsByMonth(
    commits: any[],
    pullRequests: any[] = [],
    startDate?: Date,
    endDate?: Date
  ): any[] {
    const monthlyData: { [key: string]: { commits: number; prs: number } } = {};

    // Initialize all months in the range with zeros if dates provided
    if (startDate && endDate) {
      const current = new Date(startDate);
      current.setDate(1); // Start from first day of month
      const end = new Date(endDate);

      while (current <= end) {
        const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[monthKey] = { commits: 0, prs: 0 };
        current.setMonth(current.getMonth() + 1);
      }
    }

    // Aggregate commits
    commits.forEach(commit => {
      // Handle both raw GitHub API response and our transformed response
      const commitDate = commit.date || commit.commit?.committer?.date;

      if (!commitDate) {
        return; // Skip commits without dates
      }

      const date = new Date(commitDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { commits: 0, prs: 0 };
      }

      monthlyData[monthKey].commits++;
    });

    // Aggregate pull requests
    pullRequests.forEach(pr => {
      // Use created_at for PR date (or closed_at/merged_at if available)
      // Handle both snake_case (API response) and camelCase (transformed data)
      const prDate =
        pr.mergedAt ||
        pr.merged_at ||
        pr.closedAt ||
        pr.closed_at ||
        pr.createdAt ||
        pr.created_at;

      if (!prDate) {
        return; // Skip PRs without dates
      }

      const date = new Date(prDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { commits: 0, prs: 0 };
      }

      monthlyData[monthKey].prs++;
    });

    return Object.entries(monthlyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // OPTIMIZED: Multi-layer caching with batch operations
  private async calculateVelocityDataOptimized(
    boardId: string,
    sprintCount: number
  ): Promise<any> {
    try {
      const cacheManager = this.mcpServer.getContext().cacheManager;

      // Layer 1: Check for cached closed sprints list (30 min TTL - rarely changes)
      const sprintsListKey = `sprints:closed:${boardId}`;
      let sprints = await cacheManager.get(sprintsListKey);

      if (!sprints) {
        sprints = await this.callMCPTool('jira_get_sprints', {
          board_id: boardId,
          state: 'closed',
        });
        await cacheManager.set(sprintsListKey, sprints, { ttl: 1800000 }); // 30 minutes
      }

      // Sort by start date descending (newest first) before slicing
      const sortedSprints = (sprints as any[]).sort((a: any, b: any) => {
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return (
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );
      });

      const recentSprints = sortedSprints.slice(0, sprintCount);

      // Layer 2: Check cache for individual sprint issues (batch operation)
      const sprintIssueKeys = recentSprints.map(
        (sprint: any) => `sprint:${sprint.id}:issues`
      );
      const cachedIssues = await cacheManager.getMany(sprintIssueKeys);

      // Layer 3: Fetch missing sprint issues in parallel
      const missingSprintIds: string[] = [];
      const sprintIssuesMap = new Map<string, any[]>();

      for (let i = 0; i < recentSprints.length; i++) {
        const sprint = recentSprints[i];
        if (!sprint) continue;

        const cacheKey = sprintIssueKeys[i];
        if (!cacheKey) continue;

        const cachedIssue = cachedIssues.get(cacheKey);

        if (cachedIssue && Array.isArray(cachedIssue)) {
          sprintIssuesMap.set(sprint.id, cachedIssue);
        } else {
          missingSprintIds.push(sprint.id);
        }
      }

      // Fetch missing issues in parallel
      if (missingSprintIds.length > 0) {
        const missingIssuesPromises = missingSprintIds.map(sprintId =>
          this.callMCPTool('jira_get_sprint_issues', {
            sprint_id: sprintId,
          }).then(issuesResult => ({
            sprintId,
            issues: Array.isArray(issuesResult) ? issuesResult : [],
          }))
        );

        const missingIssuesData = await Promise.all(missingIssuesPromises);

        // Cache the newly fetched issues (batch operation)
        const cacheEntries = missingIssuesData.map(({ sprintId, issues }) => {
          sprintIssuesMap.set(sprintId, issues);
          return {
            key: `sprint:${sprintId}:issues`,
            value: issues,
            ttl: 1800, // 30 minutes (closed sprint data rarely changes)
          };
        });

        await cacheManager.setMany(cacheEntries);
      }

      // Calculate velocity metrics
      const sprintData = [];
      let totalVelocity = 0;

      for (const sprint of recentSprints) {
        const issues = sprintIssuesMap.get(sprint.id) || [];

        const completed = issues.filter(
          (issue: any) =>
            issue?.status?.toLowerCase() === 'done' ||
            issue?.status?.toLowerCase() === 'closed' ||
            issue?.status?.toLowerCase() === 'resolved'
        );

        const committedPoints = issues.reduce(
          (sum: number, issue: any) => sum + (issue?.storyPoints || 0),
          0
        );

        const completedPoints = completed.reduce(
          (sum: number, issue: any) => sum + (issue?.storyPoints || 0),
          0
        );

        const velocity = completedPoints;
        totalVelocity += velocity;

        sprintData.push({
          id: sprint.id,
          name: sprint.name,
          velocity,
          commitment: committedPoints,
          completed: completedPoints,
        });
      }

      // Calculate trend
      const average =
        sprintData.length > 0 ? totalVelocity / sprintData.length : 0;
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';

      if (sprintData.length >= 3) {
        const firstHalf = sprintData.slice(
          0,
          Math.floor(sprintData.length / 2)
        );
        const secondHalf = sprintData.slice(Math.floor(sprintData.length / 2));

        const firstAvg =
          firstHalf.reduce((sum, s) => sum + s.velocity, 0) / firstHalf.length;
        const secondAvg =
          secondHalf.reduce((sum, s) => sum + s.velocity, 0) /
          secondHalf.length;

        if (secondAvg > firstAvg * 1.1) trend = 'increasing';
        else if (secondAvg < firstAvg * 0.9) trend = 'decreasing';
      }

      return {
        sprints: sprintData, // Return reverse chronological order (newest first)
        average,
        trend,
      };
    } catch (error) {
      this.logger.logError(error as Error, 'calculate_velocity_data_optimized');
      throw error;
    }
  }

  private async calculateTeamPerformance(
    boardId: string,
    sprintCount: number
  ): Promise<any[]> {
    try {
      const cacheManager = this.mcpServer.getContext().cacheManager;

      // Reuse cached closed sprints list (same as velocity endpoint)
      const sprintsListKey = `sprints:closed:${boardId}`;
      let sprints = await cacheManager.get(sprintsListKey);

      if (!sprints) {
        sprints = await this.callMCPTool('jira_get_sprints', {
          board_id: boardId,
          state: 'closed',
        });
        await cacheManager.set(sprintsListKey, sprints, { ttl: 1800000 }); // 30 minutes
      }

      // Sort by start date descending (newest first) before slicing
      const sortedSprints = (sprints as any[]).sort((a: any, b: any) => {
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return (
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );
      });

      const recentSprints = sortedSprints.slice(0, sprintCount);

      this.logger.info('Team Performance - Sprint data', {
        boardId,
        requestedCount: sprintCount,
        availableSprints: sortedSprints.length,
        recentSprintsCount: recentSprints.length,
        sprintNames: recentSprints.map((s: any) => s.name),
      });

      // If no sprints available, return empty array early
      if (recentSprints.length === 0) {
        this.logger.warn('Team Performance - No sprints available', {
          boardId,
          sprintCount,
        });
        return [];
      }

      // Reuse cached sprint issues (batch operation)
      const sprintIssueKeys = recentSprints.map(
        (sprint: any) => `sprint:${sprint.id}:issues`
      );
      const cachedIssues = await cacheManager.getMany(sprintIssueKeys);

      // Fetch missing sprint issues in parallel
      const missingSprintIds: string[] = [];
      const sprintIssuesMap = new Map<string, any[]>();

      for (let i = 0; i < recentSprints.length; i++) {
        const sprint = recentSprints[i];
        if (!sprint) continue;

        const cacheKey = sprintIssueKeys[i];
        if (!cacheKey) continue;

        const cachedIssue = cachedIssues.get(cacheKey);

        if (cachedIssue && Array.isArray(cachedIssue)) {
          sprintIssuesMap.set(sprint.id, cachedIssue);
        } else {
          missingSprintIds.push(sprint.id);
        }
      }

      // Fetch missing issues in parallel
      if (missingSprintIds.length > 0) {
        const missingIssuesPromises = missingSprintIds.map(sprintId =>
          this.callMCPTool('jira_get_sprint_issues', {
            sprint_id: sprintId,
          }).then(issuesResult => ({
            sprintId,
            issues: Array.isArray(issuesResult) ? issuesResult : [],
          }))
        );

        const missingIssuesData = await Promise.all(missingIssuesPromises);

        // Cache the newly fetched issues (batch operation)
        const cacheEntries = missingIssuesData.map(({ sprintId, issues }) => {
          sprintIssuesMap.set(sprintId, issues);
          return {
            key: `sprint:${sprintId}:issues`,
            value: issues,
            ttl: 1800, // 30 minutes
          };
        });

        await cacheManager.setMany(cacheEntries);
      }

      // Calculate performance metrics
      const performance = recentSprints.map((sprint: any) => {
        const issues = sprintIssuesMap.get(sprint.id) || [];

        const completed = issues.filter(
          (issue: any) =>
            issue.status?.toLowerCase() === 'done' ||
            issue.status?.toLowerCase() === 'closed' ||
            issue.status?.toLowerCase() === 'resolved'
        );

        const plannedPoints = issues.reduce(
          (sum: number, issue: any) => sum + (issue?.storyPoints || 0),
          0
        );

        const completedPoints = completed.reduce(
          (sum: number, issue: any) => sum + (issue?.storyPoints || 0),
          0
        );

        return {
          name: sprint.name,
          planned: plannedPoints,
          completed: completedPoints,
          velocity: completedPoints,
        };
      });

      this.logger.info('Team Performance - Calculated', {
        boardId,
        sprintCount,
        performanceCount: performance.length,
        sprints: performance.map(p => `${p.name}: ${p.completed}/${p.planned}`),
      });

      return performance; // Return reverse chronological order (newest first)
    } catch (error) {
      this.logger.logError(error as Error, 'calculate_team_performance');
      return [];
    }
  }

  private async calculateIssueTypeDistribution(
    boardId: string,
    sprintCount: number
  ): Promise<any[]> {
    try {
      const cacheManager = this.mcpServer.getContext().cacheManager;

      // Reuse cached closed sprints list
      const sprintsListKey = `sprints:closed:${boardId}`;
      let sprints = await cacheManager.get(sprintsListKey);

      if (!sprints) {
        sprints = await this.callMCPTool('jira_get_sprints', {
          board_id: boardId,
          state: 'closed',
        });
        await cacheManager.set(sprintsListKey, sprints, { ttl: 1800000 }); // 30 minutes
      }

      // Sort by start date descending (newest first) before slicing
      const sortedSprints = (sprints as any[]).sort((a: any, b: any) => {
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return (
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );
      });

      const recentSprints = sortedSprints.slice(0, sprintCount);

      // Reuse cached sprint issues (batch operation)
      const sprintIssueKeys = recentSprints.map(
        (sprint: any) => `sprint:${sprint.id}:issues`
      );
      const cachedIssues = await cacheManager.getMany(sprintIssueKeys);

      // Fetch missing sprint issues in parallel
      const missingSprintIds: string[] = [];
      const allIssues: any[] = [];

      for (let i = 0; i < recentSprints.length; i++) {
        const sprint = recentSprints[i];
        if (!sprint) continue;

        const cacheKey = sprintIssueKeys[i];
        if (!cacheKey) continue;

        const cachedIssue = cachedIssues.get(cacheKey);

        if (cachedIssue && Array.isArray(cachedIssue)) {
          allIssues.push(...cachedIssue);
        } else {
          missingSprintIds.push(sprint.id);
        }
      }

      // Fetch missing issues in parallel
      if (missingSprintIds.length > 0) {
        const missingIssuesPromises = missingSprintIds.map(sprintId =>
          this.callMCPTool('jira_get_sprint_issues', { sprint_id: sprintId })
        );

        const missingIssuesData = await Promise.all(missingIssuesPromises);
        missingIssuesData.forEach(issues => {
          if (Array.isArray(issues)) {
            allIssues.push(...issues);
          }
        });
      }

      // Count issue types
      const issueTypeCounts: { [key: string]: number } = {};
      allIssues.forEach((issue: any) => {
        const issueType = issue?.issueType || issue?.type || 'Unknown';
        issueTypeCounts[issueType] = (issueTypeCounts[issueType] || 0) + 1;
      });

      // Define colors for common issue types
      const colorMap: { [key: string]: string } = {
        Story: '#3b82f6',
        Bug: '#ef4444',
        Task: '#f59e0b',
        Epic: '#8b5cf6',
        'Sub-task': '#06b6d4',
        Improvement: '#10b981',
        Unknown: '#6b7280',
      };

      // Convert to array format for pie chart
      return Object.entries(issueTypeCounts)
        .map(([name, value]) => ({
          name,
          value,
          color: colorMap[name] || '#6b7280',
        }))
        .sort((a, b) => b.value - a.value); // Sort by count descending
    } catch (error) {
      this.logger.logError(error as Error, 'calculate_issue_type_distribution');
      return [];
    }
  }

  /**
   * Get dynamic cache TTL based on sprint state
   * Active sprints: 5 minutes (frequently changing)
   * Closed sprints: 2 hours (rarely changes)
   * Future sprints: 15 minutes (may change during planning)
   */
  private async getSprintCacheTTL(
    sprintId: string,
    cacheManager: any
  ): Promise<number> {
    try {
      // Check if we have sprint state in cache
      const sprintStateKey = `sprint:${sprintId}:state`;
      let sprintState = await cacheManager.get(sprintStateKey);

      if (!sprintState) {
        // Fetch sprint details to determine state
        try {
          const sprint = await this.callMCPTool('jira_get_sprint', {
            sprint_id: sprintId,
          });
          if (sprint) {
            sprintState = sprint.state;
            // Cache sprint state for 1 hour
            await cacheManager.set(sprintStateKey, sprintState, {
              ttl: 3600000,
            });
          }
        } catch (error) {
          this.logger.warn('Failed to fetch sprint state', {
            sprintId,
            error: (error as Error).message,
          });
        }
      }

      // Return TTL based on state
      switch (sprintState) {
        case 'active':
          return 300000; // 5 minutes - active sprints change frequently
        case 'closed':
          return 2592000000; // 30 days - closed sprints are immutable, cache for a long time
        case 'future':
          return 900000; // 15 minutes - future sprints may change during planning
        default:
          return 600000; // 10 minutes - default fallback
      }
    } catch (error) {
      this.logger.warn('Failed to get sprint state for TTL, using default', {
        sprintId,
      });
      return 600000; // 10 minutes default
    }
  }

  /**
   * Generate comprehensive report (extracted for reuse)
   */
  private async generateComprehensiveReport(
    _sprintId: string,
    toolParams: any,
    _cacheManager: any
  ): Promise<any> {
    const result = await this.callMCPTool('generate_sprint_report', toolParams);

    // Extract content from MCP tool result
    let reportData;
    if (typeof result === 'object' && result !== null && 'content' in result) {
      const content = result.content;
      reportData = typeof content === 'string' ? JSON.parse(content) : content;
    } else if (typeof result === 'string') {
      reportData = JSON.parse(result);
    } else {
      reportData = result;
    }

    // Reorganize data to match frontend expectations
    const response: any = {
      ...reportData,
      tier1:
        reportData.sprintGoal ||
        reportData.scopeChanges ||
        reportData.spilloverAnalysis
          ? {
              sprint_goal: reportData.sprintGoal,
              scope_changes: reportData.scopeChanges,
              spillover_analysis: reportData.spilloverAnalysis,
            }
          : undefined,
      tier2:
        reportData.blockers ||
        reportData.bugMetrics ||
        reportData.cycleTimeMetrics ||
        reportData.teamCapacity
          ? {
              blockers: reportData.blockers,
              bug_metrics: reportData.bugMetrics,
              cycle_time_metrics: reportData.cycleTimeMetrics,
              team_capacity: reportData.teamCapacity,
            }
          : undefined,
      tier3:
        reportData.epicProgress || reportData.technicalDebt || reportData.risks
          ? {
              epic_progress: reportData.epicProgress,
              technical_debt: reportData.technicalDebt,
              risks: reportData.risks,
            }
          : undefined,
      forward_looking:
        reportData.nextSprintForecast || reportData.carryoverItems
          ? {
              next_sprint_forecast: reportData.nextSprintForecast,
              carryover_items: reportData.carryoverItems,
            }
          : undefined,
      enhanced_github: reportData.enhancedGitHubMetrics
        ? {
            commit_activity: reportData.enhancedGitHubMetrics.commitActivity,
            pull_request_stats:
              reportData.enhancedGitHubMetrics.pullRequestStats,
            code_change_stats: reportData.enhancedGitHubMetrics.codeChanges,
            pr_to_issue_traceability:
              reportData.enhancedGitHubMetrics.prToIssueTraceability,
            code_review_stats: reportData.enhancedGitHubMetrics.codeReviewStats,
          }
        : undefined,
    };

    // Remove undefined fields
    Object.keys(response).forEach(key => {
      if (response[key] === undefined) {
        delete response[key];
      }
    });

    return response;
  }

  /**
   * Schedule background refresh for popular cached items
   * Refreshes cache when it's 50% through its TTL
   */
  private async scheduleBackgroundRefresh(
    cacheKey: string,
    refreshFunction: () => Promise<any>,
    ttl: number
  ): Promise<void> {
    // Only refresh if cache is more than 50% expired
    const cacheManager = this.mcpServer.getContext().cacheManager;
    const cacheMetadata = (await cacheManager.get(
      `${cacheKey}:metadata`
    )) as any;

    if (
      cacheMetadata &&
      typeof cacheMetadata === 'object' &&
      'createdAt' in cacheMetadata
    ) {
      const age = Date.now() - cacheMetadata.createdAt;
      const halfLife = ttl / 2;

      if (age > halfLife) {
        // Schedule refresh in background (don't await)
        setImmediate(async () => {
          try {
            this.logger.info('Background refresh started', { cacheKey });
            const freshData = await refreshFunction();
            await cacheManager.set(cacheKey, freshData, { ttl });
            this.logger.info('Background refresh completed', { cacheKey });
          } catch (error) {
            this.logger.warn('Background refresh failed', {
              cacheKey,
              error: (error as Error).message,
            });
          }
        });
      }
    }
  }

  /**
   * Warm cache for all sprint-related data after sprint completion
   */
  private async warmSprintCache(
    sprintId: string,
    githubOwner: string,
    githubRepo: string
  ): Promise<void> {
    const cacheManager = this.mcpServer.getContext().cacheManager;

    this.logger.info('Warming sprint cache', {
      sprintId,
      githubOwner,
      githubRepo,
    });

    try {
      // Warm issues cache
      const issues = await this.callMCPTool('jira_get_sprint_issues', {
        sprint_id: sprintId,
      });
      await cacheManager.set(`sprint:${sprintId}:issues:all:100`, issues, {
        ttl: 7200000,
      }); // 2 hours for closed

      // Warm comprehensive report cache
      const comprehensiveParams = {
        sprint_id: sprintId,
        github_owner: githubOwner,
        github_repo: githubRepo,
        format: 'json',
        include_commits: true,
        include_prs: true,
        include_velocity: true,
        include_burndown: true,
        theme: 'default',
        include_tier1: true,
        include_tier2: true,
        include_tier3: true,
        include_forward_looking: true,
        include_enhanced_github: true,
      };

      const comprehensiveReport = await this.generateComprehensiveReport(
        sprintId,
        comprehensiveParams,
        cacheManager
      );
      const cacheKey = `comprehensive:${sprintId}:${githubOwner}:${githubRepo}:true:true:true:true:true`;
      await cacheManager.set(cacheKey, comprehensiveReport, { ttl: 7200000 }); // 2 hours

      this.logger.info('Sprint cache warmed successfully', { sprintId });
    } catch (error) {
      this.logger.logError(error as Error, 'warm_sprint_cache', { sprintId });
      throw error;
    }
  }

  /**
   * Invalidate cache for specific issue and related sprints
   */
  private async invalidateIssueCache(
    issue: any,
    changelog: any
  ): Promise<void> {
    try {
      // Find all sprints this issue belongs to
      const sprintIds: string[] = [];

      if (issue.fields?.sprint) {
        sprintIds.push(issue.fields.sprint.id);
      }

      // Check changelog for sprint changes
      if (changelog?.items) {
        for (const item of changelog.items) {
          if (item.field === 'Sprint' && item.to) {
            sprintIds.push(item.to);
          }
          if (item.field === 'Sprint' && item.from) {
            sprintIds.push(item.from);
          }
        }
      }

      // Invalidate cache for all affected sprints
      for (const sprintId of [...new Set(sprintIds)]) {
        await this.invalidateSprintCache(sprintId);
      }

      this.logger.info('Issue cache invalidated', {
        issueKey: issue.key,
        sprintIds,
      });
    } catch (error) {
      this.logger.logError(error as Error, 'invalidate_issue_cache', {
        issueKey: issue.key,
      });
    }
  }

  /**
   * Invalidate all cache entries for a specific sprint
   */
  private async invalidateSprintCache(sprintId: string): Promise<void> {
    const cacheManager = this.mcpServer.getContext().cacheManager;

    try {
      // Invalidate all sprint-related cache keys
      const patterns = [
        `sprint:${sprintId}:issues:*`,
        `sprint:${sprintId}:metrics:*`,
        `comprehensive:${sprintId}:*`,
        `sprint:${sprintId}:state`,
      ];

      // Delete each pattern (cache manager should support pattern deletion)
      for (const pattern of patterns) {
        // Try to delete - some cache managers support pattern matching
        try {
          await cacheManager.delete(pattern);
        } catch (err) {
          // If pattern deletion not supported, log and continue
          this.logger.debug('Pattern deletion not supported or failed', {
            pattern,
          });
        }
      }

      this.logger.info('Sprint cache invalidated', { sprintId, patterns });
    } catch (error) {
      this.logger.logError(error as Error, 'invalidate_sprint_cache', {
        sprintId,
      });
    }
  }

  async start(): Promise<void> {
    await this.initialize();

    const server = this.app.listen(
      this.config.server.port,
      this.config.server.host,
      () => {
        this.logger.info(`Web API Server listening`, {
          type: 'api_server_start',
          port: this.config.server.port,
          host: this.config.server.host,
          url: `http://${this.config.server.host}:${this.config.server.port}`,
        });
      }
    );

    // Graceful shutdown
    const gracefulShutdown = async () => {
      this.logger.info('Web API Server shutting down...');

      server.close(async () => {
        await this.mcpServer.shutdown();
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  }

  getApp(): express.Application {
    return this.app;
  }
}

// CLI entry point
if (require.main === module) {
  const server = new WebAPIServer();
  server.start().catch(error => {
    console.error('Failed to start Web API Server:', error);
    process.exit(1);
  });
}
