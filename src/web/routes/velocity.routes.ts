// Velocity tracking and analysis routes
import { Router } from 'express';
import { EnhancedServerContext } from '@/server/enhanced-mcp-server';

/**
 * Create velocity tracking routes
 * These routes provide sprint velocity data with multi-layer caching
 */
export function createVelocityRouter(
  getContext: () => EnhancedServerContext,
  calculateVelocityDataOptimized: (boardId: string, sprintCount: number) => Promise<any>,
  handleAPIError: (error: any, res: any, message: string) => void
): Router {
  const router = Router();

  // Velocity endpoint with multi-layer caching
  router.get('/:boardId', async (req, res) => {
    try {
      const { boardId } = req.params;
      const sprintCount = parseInt(req.query.sprints as string) || 5;
      const { logger, cacheManager } = getContext();

      // Check cache first (15 minute TTL for better performance)
      const cacheKey = `velocity:${boardId}:${sprintCount}`;

      const cachedData = await cacheManager.get(cacheKey);
      if (cachedData) {
        logger.info('Velocity data served from cache', { boardId, sprintCount });
        return res.json(cachedData);
      }

      // Calculate fresh data with optimized caching
      const velocityData = await calculateVelocityDataOptimized(boardId, sprintCount);

      // Cache for 15 minutes (closed sprints don't change often)
      await cacheManager.set(cacheKey, velocityData, { ttl: 900000 });

      logger.info('Velocity data calculated and cached', { boardId, sprintCount });
      return res.json(velocityData);
    } catch (error) {
      return handleAPIError(error, res, 'Failed to get velocity data');
    }
  });

  return router;
}
