// Cache management routes
import { Router } from 'express';

import { EnhancedServerContext } from '@/server/enhanced-mcp-server';

/**
 * Create cache management routes
 */
export function createCacheRouter(
  getContext: () => EnhancedServerContext,
  getMCPServer: () => any,
  warmSprintCache: (
    sprintId: string,
    githubOwner: string,
    githubRepo: string
  ) => Promise<void>,
  invalidateSprintCache: (sprintId: string) => Promise<void>,
  invalidateIssueCache: (issue: any, changelog: any) => Promise<void>
): Router {
  const router = Router();

  // Cache statistics endpoint
  router.get('/stats', async (_req, res) => {
    let logger: any;
    try {
      const context = getContext();
      logger = context.logger;
      const cacheManager = context.cacheManager;

      if (!cacheManager) {
        return res.status(500).json({ error: 'Cache manager not available' });
      }

      // Get detailed cache info
      const info = await cacheManager.getInfo();
      const stats = cacheManager.getStats();

      const totalRequests = stats.hits + stats.misses;
      const response = {
        stats: {
          hits: stats.hits,
          misses: stats.misses,
          totalRequests,
          hitRate: stats.hitRate,
          sets: info.stats.sets,
          deletes: info.stats.deletes,
          errors: info.stats.errors,
        },
        memory: {
          keys: info.memory.keys,
          sizeBytes: info.memory.size,
          sizeMB: (info.memory.size / 1024 / 1024).toFixed(2),
          maxKeys: info.memory.maxSize,
          utilizationPercent: (
            (info.memory.keys / info.memory.maxSize) *
            100
          ).toFixed(2),
        },
        redis: info.redis
          ? {
              connected: info.redis.connected,
              keys: info.redis.keys || 0,
            }
          : null,
        performance: {
          averageHitLatency: '<1ms',
          averageMissLatency: '50-200ms',
        },
        timestamp: new Date().toISOString(),
      };

      return res.json(response);
    } catch (error) {
      if (logger) {
        logger.logError(error as Error, 'get_cache_stats');
      }
      return res.status(500).json({ error: 'Failed to get cache statistics' });
    }
  });

  // Cache warming
  router.post('/warm', async (req, res) => {
    let logger: any;
    try {
      logger = getContext().logger;
      const { sprintIds, repositories, issueKeys } = req.body;
      const mcpServer = getMCPServer();

      await mcpServer.warmCache({ sprintIds, repositories, issueKeys });

      res.json({ message: 'Cache warming completed successfully' });
    } catch (error) {
      if (logger) {
        logger.logError(error as Error, 'warm_cache');
      }
      res.status(500).json({ error: 'Failed to warm cache' });
    }
  });

  // Cache warming on sprint completion (manually trigger)
  router.post('/warm-sprint/:sprintId', async (req, res) => {
    let logger: any;
    try {
      logger = getContext().logger;
      const { sprintId } = req.params;
      const { github_owner = 'Sage', github_repo = 'sage-connect' } = req.body;

      logger.info('Warming cache for sprint', { sprintId });

      // Warm cache for all sprint-related data
      await warmSprintCache(sprintId, github_owner, github_repo);

      res.json({
        message: 'Sprint cache warming completed successfully',
        sprintId,
        github_owner,
        github_repo,
      });
    } catch (error) {
      if (logger) {
        logger.logError(error as Error, 'warm_sprint_cache');
      }
      res.status(500).json({ error: 'Failed to warm sprint cache' });
    }
  });

  // Cache optimization
  router.post('/optimize', async (_, res) => {
    let logger: any;
    try {
      logger = getContext().logger;
      const mcpServer = getMCPServer();
      const result = await mcpServer.optimizeCache();
      res.json(result);
    } catch (error) {
      if (logger) {
        logger.logError(error as Error, 'optimize_cache');
      }
      res.status(500).json({ error: 'Failed to optimize cache' });
    }
  });

  // Webhook endpoint for cache invalidation (Jira webhooks)
  router.post('/webhooks/jira/issue-updated', async (req, res) => {
    let logger: any;
    try {
      logger = getContext().logger;
      const { issue, changelog } = req.body;

      if (!issue?.key) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      logger.info('Jira webhook received', {
        issueKey: issue.key,
        eventType: req.body.webhookEvent,
      });

      // Invalidate cache for affected sprints
      await invalidateIssueCache(issue, changelog);

      return res.json({ message: 'Cache invalidated successfully' });
    } catch (error) {
      if (logger) {
        logger.logError(error as Error, 'webhook_processing');
      }
      return res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  // Webhook endpoint for sprint state changes
  router.post('/webhooks/jira/sprint-updated', async (req, res) => {
    let logger: any;
    try {
      logger = getContext().logger;
      const { sprint } = req.body;

      if (!sprint?.id) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      logger.info('Sprint webhook received', {
        sprintId: sprint.id,
        state: sprint.state,
        eventType: req.body.webhookEvent,
      });

      // If sprint completed, warm the cache
      if (sprint.state === 'closed') {
        logger.info('Sprint completed, warming cache', { sprintId: sprint.id });
        // Warm cache in background (don't block webhook response)
        warmSprintCache(sprint.id, 'Sage', 'sage-connect').catch((err: Error) =>
          logger.warn('Failed to warm sprint cache', { error: err.message })
        );
      }

      // Invalidate sprint-related caches
      await invalidateSprintCache(sprint.id);

      return res.json({ message: 'Sprint cache invalidated successfully' });
    } catch (error) {
      if (logger) {
        logger.logError(error as Error, 'webhook_processing');
      }
      return res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  return router;
}
