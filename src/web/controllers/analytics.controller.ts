/**
 * Analytics Controller
 * Handles all analytics-related routes (commit trends, team performance, issue types, velocity)
 */

import { Request, Response } from 'express';

import { EnhancedMCPServer } from '../../server/enhanced-mcp-server';
import { getLogger } from '../../utils/logger';
import { AnalyticsAggregator } from '../services/analytics-aggregator.service';
import { MCPBridge } from '../services/mcp-bridge.service';

export class AnalyticsController {
  private mcpServer: EnhancedMCPServer;
  private mcpBridge: MCPBridge;
  private analyticsAggregator: AnalyticsAggregator;
  private logger: any;

  constructor(
    mcpServer: EnhancedMCPServer,
    mcpBridge: MCPBridge,
    analyticsAggregator: AnalyticsAggregator
  ) {
    this.mcpServer = mcpServer;
    this.mcpBridge = mcpBridge;
    this.analyticsAggregator = analyticsAggregator;
    this.logger = getLogger();
  }

  /**
   * GET /api/analytics/commit-trends/:owner/:repo
   */
  async getCommitTrends(req: Request, res: Response): Promise<void> {
    try {
      const { owner, repo } = req.params;
      const period = (req.query.period as string) || '6months';

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
        res.json(cachedData);
        return;
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

      // Fetch both commits and pull requests (all pages)
      const fetchAllCommits = async () => {
        const allCommits = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 10) {
          const commits = await this.mcpBridge.callTool('github_get_commits', {
            owner,
            repo,
            since: startDate.toISOString(),
            until: endDate.toISOString(),
            per_page: 100,
            page,
          });

          if (commits && commits.length > 0) {
            allCommits.push(...commits);
            hasMore = commits.length === 100;
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
          try {
            const prs = await this.mcpBridge.callTool(
              'github_get_pull_requests',
              {
                owner,
                repo,
                state: 'all',
                since: startDate.toISOString(),
                until: endDate.toISOString(),
                per_page: 100,
                page,
              }
            );

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

      // Aggregate commits and PRs by month
      const trends = this.analyticsAggregator.aggregateCommitsByMonth(
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
      res.json(trends);
    } catch (error) {
      this.handleError(error, res, 'Failed to get commit trends');
    }
  }

  /**
   * GET /api/analytics/team-performance/:boardId
   */
  async getTeamPerformance(req: Request, res: Response): Promise<void> {
    try {
      const boardId = req.params.boardId!;
      const sprintCount = parseInt((req.query.sprints as string) || '10');

      // Check cache first (5 minute TTL)
      const cacheKey = `team-performance:${boardId}:${sprintCount}`;
      const cacheManager = this.mcpServer.getContext().cacheManager;

      const cachedData = await cacheManager.get(cacheKey);
      if (cachedData) {
        this.logger.info('Team performance served from cache', {
          boardId,
          sprintCount,
        });
        res.json(cachedData);
        return;
      }

      const performance =
        await this.analyticsAggregator.calculateTeamPerformance(
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

      res.json(performance);
    } catch (error) {
      this.handleError(error, res, 'Failed to get team performance data');
    }
  }

  /**
   * GET /api/analytics/issue-types/:boardId
   */
  async getIssueTypeDistribution(req: Request, res: Response): Promise<void> {
    try {
      const boardId = req.params.boardId!;
      const sprintCount = parseInt((req.query.sprints as string) || '6');

      // Check cache first (10 minute TTL)
      const cacheKey = `issue-types:${boardId}:${sprintCount}`;
      const cacheManager = this.mcpServer.getContext().cacheManager;

      const cachedData = await cacheManager.get(cacheKey);
      if (cachedData) {
        this.logger.info('Issue type distribution served from cache', {
          boardId,
          sprintCount,
        });
        res.json(cachedData);
        return;
      }

      const issueTypes =
        await this.analyticsAggregator.calculateIssueTypeDistribution(
          boardId,
          sprintCount
        );

      // Cache for 10 minutes
      await cacheManager.set(cacheKey, issueTypes, { ttl: 600000 });

      this.logger.info('Issue type distribution calculated and cached', {
        boardId,
        sprintCount,
      });
      res.json(issueTypes);
    } catch (error) {
      this.handleError(error, res, 'Failed to get issue type distribution');
    }
  }

  /**
   * GET /api/velocity/:boardId
   */
  async getVelocityData(req: Request, res: Response): Promise<void> {
    try {
      const boardId = req.params.boardId!;
      const sprintCount = parseInt((req.query.sprints as string) || '10');

      // Check cache first (5 minute TTL)
      const cacheKey = `velocity:${boardId}:${sprintCount}`;
      const cacheManager = this.mcpServer.getContext().cacheManager;

      const cachedData = await cacheManager.get(cacheKey);
      if (cachedData) {
        this.logger.info('Velocity data served from cache', {
          boardId,
          sprintCount,
        });
        res.json(cachedData);
        return;
      }

      const velocityData = await this.analyticsAggregator.calculateVelocityData(
        boardId,
        sprintCount
      );

      // Cache for 5 minutes
      await cacheManager.set(cacheKey, velocityData, { ttl: 300000 });

      this.logger.info('Velocity data calculated and cached', {
        boardId,
        sprintCount,
      });
      res.json(velocityData);
    } catch (error) {
      this.handleError(error, res, 'Failed to get velocity data');
    }
  }

  private handleError(error: any, res: Response, message: string): void {
    this.logger.logError(error, 'analytics_controller_error');

    const statusCode = error.statusCode || error.status || 500;
    const errorMessage = error.userMessage || error.message || message;

    res.status(statusCode).json({
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
}
