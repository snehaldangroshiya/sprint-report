// Report generation and export routes
import { Router } from 'express';

import { ReportController } from '../controllers/report.controller';

/**
 * Create report generation routes using ReportController
 */
export function createReportRouter(
  reportController: ReportController,
  callMCPTool: (toolName: string, args: any) => Promise<any>,
  handleAPIError: (error: any, res: any, message: string) => void
): Router {
  const router = Router();

  // Generate sprint report in various formats
  router.post('/sprint', async (req, res) => {
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
        theme = 'default',
      } = req.body;

      if (!sprint_id) {
        return res.status(400).json({ error: 'sprint_id is required' });
      }

      const result = await callMCPTool('generate_sprint_report', {
        sprint_id,
        github_owner,
        github_repo,
        format,
        include_commits,
        include_prs,
        include_velocity,
        include_burndown,
        theme,
      });

      // Set appropriate content type
      if (format === 'html') {
        res.set('Content-Type', 'text/html');
      } else if (format === 'csv') {
        res.set('Content-Type', 'text/csv');
        res.set(
          'Content-Disposition',
          `attachment; filename="sprint-${sprint_id}.csv"`
        );
      } else if (format === 'json') {
        res.set('Content-Type', 'application/json');
      } else {
        res.set('Content-Type', 'text/plain');
      }

      return res.send(result);
    } catch (error) {
      return handleAPIError(error, res, 'Failed to generate sprint report');
    }
  });

  // Export sprint report as PDF
  router.post(
    '/export/sprint-report/pdf',
    reportController.exportSprintReportPDF.bind(reportController)
  );

  // Export analytics data as PDF
  router.post(
    '/export/analytics/pdf',
    reportController.exportAnalyticsPDF.bind(reportController)
  );

  return router;
}
