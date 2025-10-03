// Express API server wrapping MCP functionality for web UI

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { EnhancedMCPServer } from '../server/enhanced-mcp-server';
import { AppConfig } from '../types';
import { createAppConfig } from '../config/environment';
import { getLogger } from '../utils/logger';
import { PDFGenerator } from '../utils/pdf-generator';
import { securityHeaders, sanitizeRequest, rateLimitConfig, validateRequestSize } from '../middleware/validation';

export class WebAPIServer {
  private app: express.Application;
  private mcpServer: EnhancedMCPServer;
  private config: AppConfig;
  private logger: any;
  private pdfGenerator: PDFGenerator;

  constructor() {
    this.app = express();
    this.mcpServer = new EnhancedMCPServer();
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
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          frameSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS with strict configuration
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://your-domain.com']
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      exposedHeaders: ['Content-Disposition'],
    }));

    // Rate limiting with configuration
    const limiter = rateLimit(rateLimitConfig);
    this.app.use('/api/', limiter);

    // Request size validation
    this.app.use(validateRequestSize(10 * 1024 * 1024)); // 10MB limit

    // Request sanitization
    this.app.use(sanitizeRequest);

    // Compression and parsing with security limits
    this.app.use(compression());
    this.app.use(express.json({
      limit: '10mb',
      strict: true,
      type: 'application/json'
    }));
    this.app.use(express.urlencoded({
      extended: true,
      limit: '10mb',
      parameterLimit: 1000
    }));

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
        userAgent: req.get('User-Agent')
      });
      next();
    });

    // Static files (for built React app)
    this.app.use(express.static('dist/web'));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get("/api/health", async (_req, res) => {
      try {
        const health = await this.mcpServer.getHealthStatus();
        res.json(health);
      } catch (error) {
        res.status(500).json({ error: 'Health check failed' });
      }
    });

    // Get server info
    this.app.get('/api/info', (_req, res) => {
      try {
        const info = this.mcpServer.getServerInfo();
        res.json(info);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get server info' });
      }
    });

    // Performance metrics
    this.app.get('/api/metrics', (_req, res) => {
      try {
        const metrics = this.mcpServer.getPerformanceMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get metrics' });
      }
    });

    // System status (Jira, GitHub, Cache health)
    this.app.get('/api/system-status', async (_req, res) => {
      try {
        type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy';

        const status: {
          jira: { status: ServiceStatus; latency: number; error?: string };
          github: { status: ServiceStatus; latency: number; error?: string };
          cache: { status: ServiceStatus; hitRate: number; size: number; error?: string };
        } = {
          jira: { status: 'healthy', latency: 0 },
          github: { status: 'healthy', latency: 0 },
          cache: { status: 'healthy', hitRate: 0, size: 0 }
        };

        // Test Jira connection
        try {
          const jiraStart = Date.now();
          await this.callMCPTool('jira_get_sprints', {
            board_id: '6306',
            state: 'active'
          });
          status.jira.latency = Date.now() - jiraStart;
          status.jira.status = status.jira.latency < 1000 ? 'healthy' : 'degraded';
        } catch (error) {
          status.jira.status = 'unhealthy';
          status.jira.error = error instanceof Error ? error.message : 'Connection failed';
        }

        // Test GitHub connection (if configured)
        if (process.env.GITHUB_TOKEN) {
          try {
            const ghStart = Date.now();
            // Use a known public repo for health check to avoid 404 errors
            await this.callMCPTool('github_get_commits', {
              owner: 'octocat',
              repo: 'hello-world',
              max_results: 1
            }).catch(() => {
              // Silently ignore errors, just testing connection
            });
            status.github.latency = Date.now() - ghStart;
            status.github.status = status.github.latency < 2000 ? 'healthy' : 'degraded';
          } catch (error) {
            status.github.status = 'degraded';
            status.github.error = 'Rate limited or configuration issue';
          }
        } else {
          status.github.status = 'unhealthy';
          status.github.error = 'GitHub token not configured';
        }

        // Get cache metrics
        try {
          const metrics = this.mcpServer.getPerformanceMetrics();
          if (metrics.summary?.cacheHitRate !== undefined) {
            status.cache.hitRate = metrics.summary.cacheHitRate;
            status.cache.status = metrics.summary.cacheHitRate > 0.5 ? 'healthy' : 'degraded';
          }
        } catch (error) {
          status.cache.status = 'degraded';
          status.cache.error = 'Unable to retrieve cache metrics';
        }

        res.json(status);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get system status',
          jira: { status: 'unhealthy' as 'healthy' | 'degraded' | 'unhealthy', latency: 0 },
          github: { status: 'unhealthy' as 'healthy' | 'degraded' | 'unhealthy', latency: 0 },
          cache: { status: 'unhealthy' as 'healthy' | 'degraded' | 'unhealthy', hitRate: 0, size: 0 }
        });
      }
    });

    // Get boards
    this.app.get('/api/boards', (_req, res) => {
      try {
        // Return hardcoded board for now
        // TODO: Add proper MCP tool for getting all boards
        res.json([{
          id: '6306',
          name: 'SCNT Board',
          type: 'scrum'
        }]);
      } catch (error) {
        this.handleAPIError(error, res, 'Failed to get boards');
      }
    });

    // Sprint management
    this.app.get('/api/sprints', async (req, res) => {
      try {
        const { board_id, state = 'active' } = req.query;

        if (!board_id) {
          return res.status(400).json({ error: 'board_id is required' });
        }

        const result = await this.callMCPTool('jira_get_sprints', {
          board_id: board_id as string,
          state: state as string
        });

        return res.json(result);
      } catch (error) {
        return this.handleAPIError(error, res, 'Failed to get sprints');
      }
    });

    // Sprint issues
    this.app.get('/api/sprints/:sprintId/issues', async (req, res) => {
      try {
        const { sprintId } = req.params;
        const { fields, max_results = 100 } = req.query;

        const result = await this.callMCPTool('jira_get_sprint_issues', {
          sprint_id: sprintId,
          fields: fields ? (fields as string).split(',') : undefined,
          max_results: parseInt(max_results as string)
        });

        res.json(result);
      } catch (error) {
        this.handleAPIError(error, res, 'Failed to get sprint issues');
      }
    });

    // Sprint metrics
    this.app.get('/api/sprints/:sprintId/metrics', async (req, res) => {
      try {
        const { sprintId } = req.params;
        const { include_velocity = false, include_burndown = false } = req.query;

        const result = await this.callMCPTool('get_sprint_metrics', {
          sprint_id: sprintId,
          include_velocity: include_velocity === 'true',
          include_burndown: include_burndown === 'true'
        });

        res.json(result);
      } catch (error) {
        this.handleAPIError(error, res, 'Failed to get sprint metrics');
      }
    });

    // Generate sprint report
    this.app.post('/api/reports/sprint', async (req, res) => {
      try {
        const {
          sprint_id,
          github_owner,
          github_repo,
          format = 'html',
          include_commits = false,
          include_prs = false,
          include_velocity = false,
          include_burndown = false,
          theme = 'default'
        } = req.body;

        if (!sprint_id) {
          return res.status(400).json({ error: 'sprint_id is required' });
        }

        const result = await this.callMCPTool('generate_sprint_report', {
          sprint_id,
          github_owner,
          github_repo,
          format,
          include_commits,
          include_prs,
          include_velocity,
          include_burndown,
          theme
        });

        // Set appropriate content type
        if (format === 'html') {
          res.set('Content-Type', 'text/html');
        } else if (format === 'csv') {
          res.set('Content-Type', 'text/csv');
          res.set('Content-Disposition', `attachment; filename="sprint-${sprint_id}.csv"`);
        } else if (format === 'json') {
          res.set('Content-Type', 'application/json');
        } else {
          res.set('Content-Type', 'text/plain');
        }

        return res.send(result);
      } catch (error) {
        return this.handleAPIError(error, res, 'Failed to generate sprint report');
      }
    });

    // GitHub repository info
    this.app.get('/api/github/repos/:owner/:repo/commits', async (req, res) => {
      try {
        const { owner, repo } = req.params;
        const { since, until, author, max_results, per_page = 30, page = 1 } = req.query;

        // Support both max_results (from web UI) and per_page (standard pagination)
        const perPage = max_results ? parseInt(max_results as string) : parseInt(per_page as string);

        const result = await this.callMCPTool('github_get_commits', {
          owner,
          repo,
          since: since as string,
          until: until as string,
          author: author as string,
          per_page: perPage,
          page: parseInt(page as string)
        });

        res.json(result);
      } catch (error) {
        this.handleAPIError(error, res, 'Failed to get commits');
      }
    });

    // GitHub pull requests
    this.app.get('/api/github/repos/:owner/:repo/pulls', async (req, res) => {
      try {
        const { owner, repo } = req.params;
        const { state = 'all', max_results, per_page = 30, page = 1 } = req.query;

        // Support both max_results (from web UI) and per_page (standard pagination)
        const perPage = max_results ? parseInt(max_results as string) : parseInt(per_page as string);

        const result = await this.callMCPTool('github_get_pull_requests', {
          owner,
          repo,
          state: state as string,
          per_page: perPage,
          page: parseInt(page as string)
        });

        res.json(result);
      } catch (error) {
        this.handleAPIError(error, res, 'Failed to get pull requests');
      }
    });

    // Find commits with Jira references
    this.app.post('/api/github/:owner/:repo/commits/jira', async (req, res) => {
      try {
        const { owner, repo } = req.params;
        const { issue_keys, since, until, max_commits_per_issue = 20 } = req.body;

        if (!issue_keys || !Array.isArray(issue_keys)) {
          res.status(400).json({ error: 'issue_keys array is required' });
          return;
        }

        const result = await this.callMCPTool('github_find_commits_with_jira_references', {
          owner,
          repo,
          issue_keys,
          since,
          until,
          max_commits_per_issue
        });

        res.json(result);
        return;
      } catch (error) {
        this.handleAPIError(error, res, 'Failed to find commits with Jira references');
        return;
      }
    });

    // Velocity endpoint with multi-layer caching
    this.app.get('/api/velocity/:boardId', async (req, res) => {
      try {
        const { boardId } = req.params;
        const sprintCount = parseInt(req.query.sprints as string) || 5;

        // Check cache first (15 minute TTL for better performance)
        const cacheKey = `velocity:${boardId}:${sprintCount}`;
        const cacheManager = this.mcpServer.getContext().cacheManager;

        const cachedData = await cacheManager.get(cacheKey);
        if (cachedData) {
          this.logger.info('Velocity data served from cache', { boardId, sprintCount });
          return res.json(cachedData);
        }

        // Calculate fresh data with optimized caching
        const velocityData = await this.calculateVelocityDataOptimized(boardId, sprintCount);

        // Cache for 15 minutes (closed sprints don't change often)
        await cacheManager.set(cacheKey, velocityData, { ttl: 900000 });

        this.logger.info('Velocity data calculated and cached', { boardId, sprintCount });
        return res.json(velocityData);
      } catch (error) {
        return this.handleAPIError(error, res, 'Failed to get velocity data');
      }
    });

    // Cache management
    this.app.post('/api/cache/warm', async (req, res) => {
      try {
        const { sprintIds, repositories, issueKeys } = req.body;

        await this.mcpServer.warmCache({ sprintIds, repositories, issueKeys });

        res.json({ message: 'Cache warming completed successfully' });
      } catch (error) {
        this.handleAPIError(error, res, 'Failed to warm cache');
      }
    });

    this.app.post('/api/cache/optimize', async (_, res) => {
      try {
        const result = await this.mcpServer.optimizeCache();
        res.json(result);
      } catch (error) {
        this.handleAPIError(error, res, 'Failed to optimize cache');
      }
    });

    // Fallback for React Router (SPA) - Express 5 compatible
    // Comment out for now as it causes routing issues
    // this.app.get('/:path(.*)', (_, res) => {
    //   res.sendFile('index.html', { root: 'dist/web' });
    // });

    // Global error handler (Express 5 requires 4 parameters)
    this.app.use((error: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      this.logger.logError(error, 'api_error', {
        method: req.method,
        path: req.path,
        body: req.body
      });

      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });
  }

  private async callMCPTool(toolName: string, args: any): Promise<any> {
    try {
      const context = this.mcpServer.getContext();
      // Simulate MCP tool call via tool registry
      const toolRegistry = (this.mcpServer as any).toolRegistry;
      const result = await toolRegistry.executeTool(toolName, args, context);

      // Extract content from MCP response
      if (result.content && result.content[0] && result.content[0].text) {
        try {
          return JSON.parse(result.content[0].text);
        } catch {
          return result.content[0].text;
        }
      }

      return result;
    } catch (error) {
      this.logger.logError(error as Error, `mcp_tool_${toolName}`, { args });
      throw error;
    }
  }

  private handleAPIError(error: any, res: express.Response, message: string): void {
    this.logger.logError(error, 'api_error');

    const statusCode = error.statusCode || error.status || 500;
    const errorMessage = error.userMessage || error.message || message;

    res.status(statusCode).json({
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }

  async initialize(): Promise<void> {
    // Initialize MCP server
    await this.mcpServer.initialize();

    this.logger.info('Web API Server initialized', {
      type: 'api_server_init',
      port: this.config.server.port,
      host: this.config.server.host
    });

    // Analytics endpoints
    this.app.get('/api/analytics/commit-trends/:owner/:repo', async (req, res) => {
      try {
        const { owner, repo } = req.params;
        const { period = '6months' } = req.query;

        // Check cache first (10 minute TTL for commit trends)
        const cacheKey = `commit-trends:${owner}:${repo}:${period}`;
        const cacheManager = this.mcpServer.getContext().cacheManager;

        const cachedData = await cacheManager.get(cacheKey);
        if (cachedData) {
          this.logger.info('Commit trends served from cache', { owner, repo, period });
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

        const commits = await this.callMCPTool('github_get_commits', {
          owner,
          repo,
          since: startDate.toISOString(),
          until: endDate.toISOString()
        });

        // Aggregate commits by month
        const trends = this.aggregateCommitsByMonth(commits);

        // Cache for 10 minutes
        await cacheManager.set(cacheKey, trends, { ttl: 600000 });

        this.logger.info('Commit trends calculated and cached', { owner, repo, period });
        return res.json(trends);
      } catch (error) {
        return this.handleAPIError(error, res, 'Failed to get commit trends');
      }
    });

    this.app.get('/api/analytics/team-performance/:boardId', async (req, res) => {
      try {
        const { boardId } = req.params;
        const sprintCount = parseInt(req.query.sprints as string) || 10;

        // Check cache first (5 minute TTL)
        const cacheKey = `team-performance:${boardId}:${sprintCount}`;
        const cacheManager = this.mcpServer.getContext().cacheManager;

        const cachedData = await cacheManager.get(cacheKey);
        if (cachedData) {
          this.logger.info('Team performance served from cache', { boardId, sprintCount });
          return res.json(cachedData);
        }

        const performance = await this.calculateTeamPerformance(boardId, sprintCount);

        // Cache for 5 minutes
        await cacheManager.set(cacheKey, performance, { ttl: 300000 });

        this.logger.info('Team performance calculated and cached', { boardId, sprintCount });
        return res.json(performance);
      } catch (error) {
        return this.handleAPIError(error, res, 'Failed to get team performance data');
      }
    });

    this.app.get('/api/analytics/issue-types/:boardId', async (req, res) => {
      try {
        const { boardId } = req.params;
        const sprintCount = parseInt(req.query.sprints as string) || 6;

        // Check cache first (10 minute TTL)
        const cacheKey = `issue-types:${boardId}:${sprintCount}`;
        const cacheManager = this.mcpServer.getContext().cacheManager;

        const cachedData = await cacheManager.get(cacheKey);
        if (cachedData) {
          this.logger.info('Issue type distribution served from cache', { boardId, sprintCount });
          return res.json(cachedData);
        }

        const issueTypes = await this.calculateIssueTypeDistribution(boardId, sprintCount);

        // Cache for 10 minutes
        await cacheManager.set(cacheKey, issueTypes, { ttl: 600000 });

        this.logger.info('Issue type distribution calculated and cached', { boardId, sprintCount });
        return res.json(issueTypes);
      } catch (error) {
        return this.handleAPIError(error, res, 'Failed to get issue type distribution');
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

        const pdfBuffer = await this.pdfGenerator.generateSprintReportPDF(reportData, options);

        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="sprint-report-${reportData.sprint?.name || 'unknown'}.pdf"`,
          'Content-Length': pdfBuffer.length.toString()
        });

        res.send(pdfBuffer);
        return;
      } catch (error) {
        this.handleAPIError(error, res, 'Failed to generate PDF report');
        return;
      }
    });

    this.app.post('/api/export/analytics/pdf', async (req, res) => {
      try {
        const { analyticsData, options = {} } = req.body;

        if (!analyticsData) {
          res.status(400).json({ error: 'Analytics data is required' });
          return;
        }

        const pdfBuffer = await this.pdfGenerator.generateAnalyticsPDF(analyticsData, options);

        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="analytics-report.pdf"',
          'Content-Length': pdfBuffer.length.toString()
        });

        res.send(pdfBuffer);
        return;
      } catch (error) {
        this.handleAPIError(error, res, 'Failed to generate analytics PDF');
        return;
      }
    });
  }

  private aggregateCommitsByMonth(commits: any[]): any[] {
    const monthlyData: { [key: string]: { commits: number; prs: number } } = {};

    commits.forEach(commit => {
      // Handle both raw GitHub API response and our transformed response
      const commitDate = commit.date || commit.commit?.committer?.date;
      const commitMessage = commit.message || commit.commit?.message || '';

      if (!commitDate) {
        return; // Skip commits without dates
      }

      const date = new Date(commitDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { commits: 0, prs: 0 };
      }

      monthlyData[monthKey].commits++;
      // Simple heuristic: count merge commits as PRs
      if (commitMessage.toLowerCase().includes('merge') ||
          commitMessage.toLowerCase().includes('pull request')) {
        monthlyData[monthKey].prs++;
      }
    });

    return Object.entries(monthlyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // OPTIMIZED: Multi-layer caching with batch operations
  private async calculateVelocityDataOptimized(boardId: string, sprintCount: number): Promise<any> {
    try {
      const cacheManager = this.mcpServer.getContext().cacheManager;

      // Layer 1: Check for cached closed sprints list (30 min TTL - rarely changes)
      const sprintsListKey = `sprints:closed:${boardId}`;
      let sprints = await cacheManager.get(sprintsListKey);

      if (!sprints) {
        sprints = await this.callMCPTool('jira_get_sprints', {
          board_id: boardId,
          state: 'closed'
        });
        await cacheManager.set(sprintsListKey, sprints, { ttl: 1800000 }); // 30 minutes
      }

      // Sort by start date descending (newest first) before slicing
      const sortedSprints = (sprints as any[]).sort((a: any, b: any) => {
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      });

      const recentSprints = sortedSprints.slice(0, sprintCount);

      // Layer 2: Check cache for individual sprint issues (batch operation)
      const sprintIssueKeys = recentSprints.map((sprint: any) => `sprint:${sprint.id}:issues`);
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
          this.callMCPTool('jira_get_sprint_issues', { sprint_id: sprintId })
            .then(issuesResult => ({
              sprintId,
              issues: Array.isArray(issuesResult) ? issuesResult : []
            }))
        );

        const missingIssuesData = await Promise.all(missingIssuesPromises);

        // Cache the newly fetched issues (batch operation)
        const cacheEntries = missingIssuesData.map(({ sprintId, issues }) => {
          sprintIssuesMap.set(sprintId, issues);
          return {
            key: `sprint:${sprintId}:issues`,
            value: issues,
            ttl: 1800 // 30 minutes (closed sprint data rarely changes)
          };
        });

        await cacheManager.setMany(cacheEntries);
      }

      // Calculate velocity metrics
      const sprintData = [];
      let totalVelocity = 0;

      for (const sprint of recentSprints) {
        const issues = sprintIssuesMap.get(sprint.id) || [];

        const completed = issues.filter((issue: any) =>
          issue?.status?.toLowerCase() === 'done' ||
          issue?.status?.toLowerCase() === 'closed' ||
          issue?.status?.toLowerCase() === 'resolved'
        );

        const committedPoints = issues.reduce((sum: number, issue: any) =>
          sum + (issue?.storyPoints || 0), 0);

        const completedPoints = completed.reduce((sum: number, issue: any) =>
          sum + (issue?.storyPoints || 0), 0);

        const velocity = completedPoints;
        totalVelocity += velocity;

        sprintData.push({
          id: sprint.id,
          name: sprint.name,
          velocity,
          commitment: committedPoints,
          completed: completedPoints
        });
      }

      // Calculate trend
      const average = sprintData.length > 0 ? totalVelocity / sprintData.length : 0;
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';

      if (sprintData.length >= 3) {
        const firstHalf = sprintData.slice(0, Math.floor(sprintData.length / 2));
        const secondHalf = sprintData.slice(Math.floor(sprintData.length / 2));

        const firstAvg = firstHalf.reduce((sum, s) => sum + s.velocity, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, s) => sum + s.velocity, 0) / secondHalf.length;

        if (secondAvg > firstAvg * 1.1) trend = 'increasing';
        else if (secondAvg < firstAvg * 0.9) trend = 'decreasing';
      }

      return {
        sprints: sprintData, // Return reverse chronological order (newest first)
        average,
        trend
      };
    } catch (error) {
      this.logger.logError(error as Error, 'calculate_velocity_data_optimized');
      throw error;
    }
  }

  private async calculateTeamPerformance(boardId: string, sprintCount: number): Promise<any[]> {
    try {
      const cacheManager = this.mcpServer.getContext().cacheManager;

      // Reuse cached closed sprints list (same as velocity endpoint)
      const sprintsListKey = `sprints:closed:${boardId}`;
      let sprints = await cacheManager.get(sprintsListKey);

      if (!sprints) {
        sprints = await this.callMCPTool('jira_get_sprints', {
          board_id: boardId,
          state: 'closed'
        });
        await cacheManager.set(sprintsListKey, sprints, { ttl: 1800000 }); // 30 minutes
      }

      // Sort by start date descending (newest first) before slicing
      const sortedSprints = (sprints as any[]).sort((a: any, b: any) => {
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      });

      const recentSprints = sortedSprints.slice(0, sprintCount);

      // Reuse cached sprint issues (batch operation)
      const sprintIssueKeys = recentSprints.map((sprint: any) => `sprint:${sprint.id}:issues`);
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
          this.callMCPTool('jira_get_sprint_issues', { sprint_id: sprintId })
            .then(issuesResult => ({
              sprintId,
              issues: Array.isArray(issuesResult) ? issuesResult : []
            }))
        );

        const missingIssuesData = await Promise.all(missingIssuesPromises);

        // Cache the newly fetched issues (batch operation)
        const cacheEntries = missingIssuesData.map(({ sprintId, issues }) => {
          sprintIssuesMap.set(sprintId, issues);
          return {
            key: `sprint:${sprintId}:issues`,
            value: issues,
            ttl: 1800 // 30 minutes
          };
        });

        await cacheManager.setMany(cacheEntries);
      }

      // Calculate performance metrics
      const performance = recentSprints.map((sprint: any) => {
        const issues = sprintIssuesMap.get(sprint.id) || [];

        const completed = issues.filter((issue: any) =>
          issue.status?.toLowerCase() === 'done' ||
          issue.status?.toLowerCase() === 'closed' ||
          issue.status?.toLowerCase() === 'resolved'
        );

        const plannedPoints = issues.reduce((sum: number, issue: any) =>
          sum + (issue?.storyPoints || 0), 0);

        const completedPoints = completed.reduce((sum: number, issue: any) =>
          sum + (issue?.storyPoints || 0), 0);

        return {
          name: sprint.name,
          planned: plannedPoints,
          completed: completedPoints,
          velocity: completedPoints
        };
      });

      return performance; // Return reverse chronological order (newest first)
    } catch (error) {
      this.logger.logError(error as Error, 'calculate_team_performance');
      return [];
    }
  }

  private async calculateIssueTypeDistribution(boardId: string, sprintCount: number): Promise<any[]> {
    try {
      const cacheManager = this.mcpServer.getContext().cacheManager;

      // Reuse cached closed sprints list
      const sprintsListKey = `sprints:closed:${boardId}`;
      let sprints = await cacheManager.get(sprintsListKey);

      if (!sprints) {
        sprints = await this.callMCPTool('jira_get_sprints', {
          board_id: boardId,
          state: 'closed'
        });
        await cacheManager.set(sprintsListKey, sprints, { ttl: 1800000 }); // 30 minutes
      }

      // Sort by start date descending (newest first) before slicing
      const sortedSprints = (sprints as any[]).sort((a: any, b: any) => {
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      });

      const recentSprints = sortedSprints.slice(0, sprintCount);

      // Reuse cached sprint issues (batch operation)
      const sprintIssueKeys = recentSprints.map((sprint: any) => `sprint:${sprint.id}:issues`);
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
        'Story': '#3b82f6',
        'Bug': '#ef4444',
        'Task': '#f59e0b',
        'Epic': '#8b5cf6',
        'Sub-task': '#06b6d4',
        'Improvement': '#10b981',
        'Unknown': '#6b7280'
      };

      // Convert to array format for pie chart
      return Object.entries(issueTypeCounts)
        .map(([name, value]) => ({
          name,
          value,
          color: colorMap[name] || '#6b7280'
        }))
        .sort((a, b) => b.value - a.value); // Sort by count descending
    } catch (error) {
      this.logger.logError(error as Error, 'calculate_issue_type_distribution');
      return [];
    }
  }

  async start(): Promise<void> {
    await this.initialize();

    const server = this.app.listen(this.config.server.port, this.config.server.host, () => {
      this.logger.info(`Web API Server listening`, {
        type: 'api_server_start',
        port: this.config.server.port,
        host: this.config.server.host,
        url: `http://${this.config.server.host}:${this.config.server.port}`
      });
    });

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