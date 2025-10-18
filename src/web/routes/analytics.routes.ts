// Analytics routes (commit trends, team performance, issue types)
import { Router } from 'express';

import { AnalyticsController } from '../controllers/analytics.controller';

/**
 * Create analytics routes using AnalyticsController
 */
export function createAnalyticsRouter(
  analyticsController: AnalyticsController
): Router {
  const router = Router();

  // Commit trends analytics
  router.get(
    '/commit-trends/:owner/:repo',
    analyticsController.getCommitTrends.bind(analyticsController)
  );

  // Team performance analytics
  router.get(
    '/team-performance/:boardId',
    analyticsController.getTeamPerformance.bind(analyticsController)
  );

  // Issue type distribution analytics
  router.get(
    '/issue-types/:boardId',
    analyticsController.getIssueTypeDistribution.bind(analyticsController)
  );

  return router;
}
