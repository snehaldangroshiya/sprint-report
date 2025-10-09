// Health, info, and metrics routes
import { Router } from 'express';
import { EnhancedServerContext } from '@/server/enhanced-mcp-server';

/**
 * Create health and info routes
 * No business logic dependencies - simple server status endpoints
 */
export function createHealthRouter(getContext: () => EnhancedServerContext, getMCPServer: () => any): Router {
  const router = Router();

  // Health check
  router.get('/health', async (_req, res) => {
    try {
      const mcpServer = getMCPServer();
      const health = await mcpServer.getHealthStatus();
      res.json(health);
    } catch (error) {
      res.status(500).json({ error: 'Health check failed' });
    }
  });

  // Get server info
  router.get('/info', (_req, res) => {
    try {
      const mcpServer = getMCPServer();
      const info = mcpServer.getServerInfo();
      res.json(info);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get server info' });
    }
  });

  // Performance metrics
  router.get('/metrics', (_req, res) => {
    try {
      const mcpServer = getMCPServer();
      const metrics = mcpServer.getPerformanceMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  });

  // System status (Jira, GitHub, Cache health)
  router.get('/system-status', async (_req, res) => {
    try {
      const { cacheManager, logger } = getContext();
      const mcpServer = getMCPServer();

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
        const toolRegistry = (mcpServer as any).toolRegistry;
        await toolRegistry.executeTool('jira_get_sprints', {
          board_id: '6306',
          state: 'active'
        }, getContext());
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
          const toolRegistry = (mcpServer as any).toolRegistry;
          await toolRegistry.executeTool('github_get_commits', {
            owner: 'octocat',
            repo: 'hello-world',
            max_results: 1
          }, getContext()).catch(() => {
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

      // Get cache metrics from cache manager
      try {
        if (cacheManager && typeof cacheManager.getStats === 'function') {
          const cacheStats = cacheManager.getStats();
          status.cache.hitRate = cacheStats.hitRate / 100; // Convert percentage to decimal (0-1)
          status.cache.size = cacheStats.keys || 0;
          status.cache.status = cacheStats.hitRate > 50 ? 'healthy' : cacheStats.hitRate > 20 ? 'degraded' : 'unhealthy';

          logger.debug('Cache stats retrieved', {
            hitRate: cacheStats.hitRate,
            hits: cacheStats.hits,
            misses: cacheStats.misses,
            keys: cacheStats.keys
          });
        } else {
          // Fallback to performance metrics if getStats not available
          const metrics = mcpServer.getPerformanceMetrics();
          if (metrics.summary?.cacheHitRate !== undefined) {
            status.cache.hitRate = metrics.summary.cacheHitRate;
            status.cache.status = metrics.summary.cacheHitRate > 0.5 ? 'healthy' : 'degraded';
          }
        }
      } catch (error) {
        status.cache.status = 'degraded';
        status.cache.error = 'Unable to retrieve cache metrics';
        logger.warn('Failed to get cache stats', { error: (error as Error).message });
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

  return router;
}
