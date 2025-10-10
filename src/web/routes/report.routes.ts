// Report generation and export routes
import { Router } from 'express';

import { PDFGenerator } from '@/utils/pdf-generator';

/**
 * Create report generation routes
 * These routes handle sprint report generation and PDF exports
 */
export function createReportRouter(
  callMCPTool: (toolName: string, args: any) => Promise<any>,
  handleAPIError: (error: any, res: any, message: string) => void
): Router {
  const router = Router();
  const pdfGenerator = new PDFGenerator();

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
  router.post('/export/sprint-report/pdf', async (req, res) => {
    try {
      const { reportData, options = {} } = req.body;

      if (!reportData) {
        res.status(400).json({ error: 'Report data is required' });
        return;
      }

      const pdfBuffer = await pdfGenerator.generateSprintReportPDF(
        reportData,
        options
      );

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="sprint-report-${reportData.sprint?.name || 'unknown'}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      });

      res.send(pdfBuffer);
    } catch (error) {
      handleAPIError(error, res, 'Failed to generate PDF report');
    }
  });

  // Export analytics data as PDF
  router.post('/export/analytics/pdf', async (req, res) => {
    try {
      const { analyticsData, options = {} } = req.body;

      if (!analyticsData) {
        res.status(400).json({ error: 'Analytics data is required' });
        return;
      }

      const pdfBuffer = await pdfGenerator.generateAnalyticsPDF(
        analyticsData,
        options
      );

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="analytics-report.pdf"',
        'Content-Length': pdfBuffer.length.toString(),
      });

      res.send(pdfBuffer);
    } catch (error) {
      handleAPIError(error, res, 'Failed to generate analytics PDF');
    }
  });

  return router;
}
