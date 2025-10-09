// Analytics routes (commit trends, team performance, issue types)
import { Router } from 'express';
import { EnhancedServerContext } from '@/server/enhanced-mcp-server';

/**
 * Create analytics routes
 * These routes provide analytics data for dashboards and reports
 */
export function createAnalyticsRouter(
  getContext: () => EnhancedServerContext,
  callMCPTool: (toolName: string, args: any) => Promise<any>,
  aggregateCommitsByMonth: (commits: any[], pullRequests: any[], startDate?: Date, endDate?: Date) => any[],
  calculateTeamPerformance: (boardId: string, sprintCount: number) => Promise<any[]>,
  calculateIssueTypeDistribution: (boardId: string, sprintCount: number) => Promise<any[]>,
  handleAPIError: (error: any, res: any, message: string) => void
): Router {
  const router = Router();

  // Commit trends analytics with pagination
  router.get('/commit-trends/:owner/:repo', async (req, res) => {
    try {
      const { owner, repo } = req.params;
      const { period = '6months' } = req.query;

      // Check cache first (10 minute TTL for commit trends)
      // Cache version v4: fetches all pages (up to 1000 commits/PRs)
      const cacheKey = `commit-trends:v4:${owner}:${repo}:${period}`;
      const { cacheManager, logger } = getContext();

      const cachedData = await cacheManager.get(cacheKey);
      if (cachedData) {
        logger.info('Commit trends served from cache', { owner, repo, period });
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

        while (hasMore && page <= 10) { // Limit to 10 pages (1000 commits max)
          const commits = await callMCPTool('github_get_commits', {
            owner,
            repo,
            since: startDate.toISOString(),
            until: endDate.toISOString(),
            per_page: 100,
            page
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

        while (hasMore && page <= 10) { // Limit to 10 pages (1000 PRs max)
          try {
            const prs = await callMCPTool('github_get_pull_requests', {
              owner,
              repo,
              state: 'all',
              since: startDate.toISOString(),
              until: endDate.toISOString(),
              per_page: 100,
              page
            });

            if (prs && prs.length > 0) {
              allPRs.push(...prs);
              hasMore = prs.length === 100;
              page++;
            } else {
              hasMore = false;
            }
          } catch (err) {
            logger.warn('Failed to fetch pull requests page', { page, error: (err as Error).message });
            hasMore = false;
          }
        }

        return allPRs;
      };

      const [commits, pullRequests] = await Promise.all([
        fetchAllCommits(),
        fetchAllPRs()
      ]);

      // Aggregate commits and PRs by month, filling in missing months with zeros
      const trends = aggregateCommitsByMonth(commits, pullRequests, startDate, endDate);

      // Cache for 10 minutes
      await cacheManager.set(cacheKey, trends, { ttl: 600000 });

      logger.info('Commit trends calculated and cached', { owner, repo, period });
      return res.json(trends);
    } catch (error) {
      return handleAPIError(error, res, 'Failed to get commit trends');
    }
  });

  // Team performance analytics
  router.get('/team-performance/:boardId', async (req, res) => {
    try {
      const { boardId } = req.params;
      const sprintCount = parseInt(req.query.sprints as string) || 10;

      // Check cache first (5 minute TTL)
      const cacheKey = `team-performance:${boardId}:${sprintCount}`;
      const { cacheManager, logger } = getContext();

      const cachedData = await cacheManager.get(cacheKey);
      if (cachedData) {
        logger.info('Team performance served from cache', { boardId, sprintCount });
        return res.json(cachedData);
      }

      const performance = await calculateTeamPerformance(boardId, sprintCount);

      // Only cache non-empty results
      if (performance && performance.length > 0) {
        await cacheManager.set(cacheKey, performance, { ttl: 300000 });
        logger.info('Team performance calculated and cached', { boardId, sprintCount, count: performance.length });
      } else {
        logger.warn('Team performance returned empty, not caching', { boardId, sprintCount });
      }

      return res.json(performance);
    } catch (error) {
      return handleAPIError(error, res, 'Failed to get team performance data');
    }
  });

  // Issue type distribution analytics
  router.get('/issue-types/:boardId', async (req, res) => {
    try {
      const { boardId } = req.params;
      const sprintCount = parseInt(req.query.sprints as string) || 6;

      // Check cache first (10 minute TTL)
      const cacheKey = `issue-types:${boardId}:${sprintCount}`;
      const { cacheManager, logger } = getContext();

      const cachedData = await cacheManager.get(cacheKey);
      if (cachedData) {
        logger.info('Issue type distribution served from cache', { boardId, sprintCount });
        return res.json(cachedData);
      }

      const issueTypes = await calculateIssueTypeDistribution(boardId, sprintCount);

      // Cache for 10 minutes
      await cacheManager.set(cacheKey, issueTypes, { ttl: 600000 });

      logger.info('Issue type distribution calculated and cached', { boardId, sprintCount });
      return res.json(issueTypes);
    } catch (error) {
      return handleAPIError(error, res, 'Failed to get issue type distribution');
    }
  });

  return router;
}
