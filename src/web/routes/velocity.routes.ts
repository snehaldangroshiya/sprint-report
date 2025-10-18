// Velocity tracking and analysis routes
import { Router } from 'express';

import { AnalyticsController } from '../controllers/analytics.controller';

/**
 * Create velocity tracking routes using AnalyticsController
 */
export function createVelocityRouter(
  analyticsController: AnalyticsController
): Router {
  const router = Router();

  // Velocity endpoint
  router.get(
    '/:boardId',
    analyticsController.getVelocityData.bind(analyticsController)
  );

  return router;
}
