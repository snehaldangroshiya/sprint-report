// Sprint management routes
import { Router } from 'express';

import { EnhancedServerContext } from '@/server/enhanced-mcp-server';

/**
 * Create sprint management routes
 */
export function createSprintRouter(
  getContext: () => EnhancedServerContext,
  callMCPTool: (toolName: string, args: any) => Promise<any>,
  getSprintCacheTTL: (sprintId: string, cacheManager: any) => Promise<number>,
  generateComprehensiveReport: (
    sprintId: string,
    toolParams: any,
    cacheManager: any
  ) => Promise<any>,
  scheduleBackgroundRefresh: (
    cacheKey: string,
    refreshFunction: () => Promise<any>,
    ttl: number
  ) => Promise<void>,
  handleAPIError: (error: any, res: any, message: string) => void
): Router {
  const router = Router();

  // Get boards
  router.get('/boards', (_req, res) => {
    try {
      // Return hardcoded board
      // Note: Full board listing requires Jira Admin API access
      res.json([
        {
          id: '6306',
          name: 'SCNT Board',
          type: 'scrum',
        },
      ]);
    } catch (error) {
      handleAPIError(error, res, 'Failed to get boards');
    }
  });

  // Get sprints
  router.get('/sprints', async (req, res) => {
    try {
      const { board_id, state = 'active' } = req.query;

      if (!board_id) {
        return res.status(400).json({ error: 'board_id is required' });
      }

      // Handle 'all' state by fetching all sprint types
      if (state === 'all') {
        const [active, closed, future] = await Promise.all([
          callMCPTool('jira_get_sprints', {
            board_id: board_id as string,
            state: 'active',
          }).catch(() => []),
          callMCPTool('jira_get_sprints', {
            board_id: board_id as string,
            state: 'closed',
          }).catch(() => []),
          callMCPTool('jira_get_sprints', {
            board_id: board_id as string,
            state: 'future',
          }).catch(() => []),
        ]);

        // Combine and sort by start date (newest first)
        const allSprints = [...active, ...closed, ...future].sort(
          (a: any, b: any) => {
            if (!a.startDate) return 1;
            if (!b.startDate) return -1;
            return (
              new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
            );
          }
        );

        return res.json(allSprints);
      }

      // Single state request
      const result = await callMCPTool('jira_get_sprints', {
        board_id: board_id as string,
        state: state as string,
      });

      return res.json(result);
    } catch (error) {
      return handleAPIError(error, res, 'Failed to get sprints');
    }
  });

  // Sprint issues with pagination
  router.get('/sprints/:sprintId/issues', async (req, res) => {
    try {
      const { sprintId } = req.params;
      const { fields, max_results = 50, page = 1, per_page = 20 } = req.query;

      const pageNum = parseInt(page as string);
      const perPage = Math.min(parseInt(per_page as string), 100); // Max 100 per page
      const maxResults = parseInt(max_results as string);

      // Check cache for full issue list first
      const fullCacheKey = `sprint:${sprintId}:issues:full:${fields || 'all'}`;
      const { cacheManager, logger } = getContext();

      const cachedIssues = await cacheManager.get(fullCacheKey);
      let allIssues: any[] = Array.isArray(cachedIssues) ? cachedIssues : [];

      if (allIssues.length === 0) {
        // Fetch all issues if not cached
        const result = await callMCPTool('jira_get_sprint_issues', {
          sprint_id: sprintId,
          fields: fields ? (fields as string).split(',') : undefined,
          max_results: maxResults,
        });

        allIssues = Array.isArray(result) ? result : [];

        // Determine TTL based on sprint state
        const ttl = await getSprintCacheTTL(sprintId, cacheManager);

        // Cache the full list with dynamic TTL
        await cacheManager.set(fullCacheKey, allIssues, { ttl });

        logger.info('Sprint issues fetched and cached', {
          sprintId,
          totalIssues: allIssues.length,
          ttl,
        });
      } else {
        logger.info('Sprint issues served from cache', {
          sprintId,
          totalIssues: allIssues.length,
        });
      }

      // Calculate pagination
      const totalIssues = allIssues.length;
      const totalPages = Math.ceil(totalIssues / perPage);
      const startIndex = (pageNum - 1) * perPage;
      const endIndex = startIndex + perPage;
      const paginatedIssues = allIssues.slice(startIndex, endIndex);

      // Return paginated response
      return res.json({
        issues: paginatedIssues,
        pagination: {
          page: pageNum,
          per_page: perPage,
          total_issues: totalIssues,
          total_pages: totalPages,
          has_next: pageNum < totalPages,
          has_prev: pageNum > 1,
        },
      });
    } catch (error) {
      return handleAPIError(error, res, 'Failed to get sprint issues');
    }
  });

  // Sprint metrics
  router.get('/sprints/:sprintId/metrics', async (req, res) => {
    try {
      const { sprintId } = req.params;
      const { include_velocity = false, include_burndown = false } = req.query;

      // Check cache first with dynamic TTL
      const cacheKey = `sprint:${sprintId}:metrics:${include_velocity}:${include_burndown}`;
      const { cacheManager, logger } = getContext();

      const cachedData = await cacheManager.get(cacheKey);
      if (cachedData) {
        logger.info('Sprint metrics served from cache', { sprintId });
        return res.json(cachedData);
      }

      const result = await callMCPTool('get_sprint_metrics', {
        sprint_id: sprintId,
        include_velocity: include_velocity === 'true',
        include_burndown: include_burndown === 'true',
      });

      // Determine TTL based on sprint state
      const ttl = await getSprintCacheTTL(sprintId, cacheManager);

      // Cache with dynamic TTL
      await cacheManager.set(cacheKey, result, { ttl });

      logger.info('Sprint metrics calculated and cached', { sprintId, ttl });
      return res.json(result);
    } catch (error) {
      return handleAPIError(error, res, 'Failed to get sprint metrics');
    }
  });

  // Comprehensive sprint report with all tiers
  router.get('/sprints/:sprintId/comprehensive', async (req, res) => {
    try {
      const { sprintId } = req.params;
      const {
        github_owner,
        github_repo,
        include_tier1 = 'true',
        include_tier2 = 'true',
        include_tier3 = 'true',
        include_forward_looking = 'true',
        include_enhanced_github = 'true',
      } = req.query;

      const toolParams = {
        sprint_id: sprintId,
        github_owner: github_owner as string,
        github_repo: github_repo as string,
        format: 'json',
        include_commits: !!github_owner && !!github_repo,
        include_prs: !!github_owner && !!github_repo,
        include_velocity: true,
        include_burndown: true,
        theme: 'default',
        include_tier1: include_tier1 === 'true',
        include_tier2: include_tier2 === 'true',
        include_tier3: include_tier3 === 'true',
        include_forward_looking: include_forward_looking === 'true',
        include_enhanced_github: include_enhanced_github === 'true',
      };

      // Check cache first with dynamic TTL based on sprint state
      const cacheKey = `comprehensive:${sprintId}:${github_owner}:${github_repo}:${include_tier1}:${include_tier2}:${include_tier3}:${include_forward_looking}:${include_enhanced_github}`;
      const { cacheManager, logger } = getContext();

      const cachedData = await cacheManager.get(cacheKey);
      if (cachedData) {
        logger.info('Comprehensive sprint report served from cache', {
          sprintId,
          github_owner,
          github_repo,
        });
        // Background refresh for popular sprints (if cache is more than 50% expired)
        scheduleBackgroundRefresh(
          cacheKey,
          async () => {
            return await generateComprehensiveReport(
              sprintId,
              toolParams,
              cacheManager
            );
          },
          await getSprintCacheTTL(sprintId, cacheManager)
        ).catch((err: Error) =>
          logger.warn('Background refresh failed', { error: err.message })
        );
        return res.json(cachedData);
      }

      console.log('[COMPREHENSIVE] Calling MCP tool with params:', {
        include_tier1: toolParams.include_tier1,
        include_tier2: toolParams.include_tier2,
        include_tier3: toolParams.include_tier3,
        include_forward_looking: toolParams.include_forward_looking,
        include_enhanced_github: toolParams.include_enhanced_github,
      });

      const result = await callMCPTool('generate_sprint_report', toolParams);
      console.log('[COMPREHENSIVE] MCP tool raw result type:', typeof result);
      console.log(
        '[COMPREHENSIVE] MCP tool result keys:',
        result && typeof result === 'object' ? Object.keys(result) : 'N/A'
      );

      // Extract content from MCP tool result
      let reportData;
      if (
        typeof result === 'object' &&
        result !== null &&
        'content' in result
      ) {
        const content = result.content;
        // If content is already an object, use it directly; otherwise parse the JSON string
        reportData =
          typeof content === 'string' ? JSON.parse(content) : content;
      } else if (typeof result === 'string') {
        reportData = JSON.parse(result);
      } else {
        // If result is already an object, use it directly
        reportData = result;
      }

      // Debug: Log what we received
      console.log(
        '[COMPREHENSIVE] Keys in reportData:',
        Object.keys(reportData)
      );
      console.log('[COMPREHENSIVE] Has sprintGoal?', !!reportData.sprintGoal);
      console.log('[COMPREHENSIVE] Has blockers?', !!reportData.blockers);
      console.log(
        '[COMPREHENSIVE] Has epicProgress?',
        !!reportData.epicProgress
      );

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
          reportData.epicProgress ||
          reportData.technicalDebt ||
          reportData.risks
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
              code_review_stats:
                reportData.enhancedGitHubMetrics.codeReviewStats,
            }
          : undefined,
      };

      // Remove undefined fields
      Object.keys(response).forEach(key => {
        if (response[key] === undefined) {
          delete response[key];
        }
      });

      // Cache the response with dynamic TTL based on sprint state
      const ttl = await getSprintCacheTTL(sprintId, cacheManager);
      await cacheManager.set(cacheKey, response, { ttl });

      logger.info('Comprehensive sprint report calculated and cached', {
        sprintId,
        github_owner,
        github_repo,
        ttl,
      });
      return res.json(response);
    } catch (error) {
      return handleAPIError(
        error,
        res,
        'Failed to get comprehensive sprint report'
      );
    }
  });

  return router;
}
