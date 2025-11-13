/**
 * Report Controller
 * Handles PDF export routes for sprint reports and analytics
 */

import { Request, Response } from 'express';

export class ReportController {
  // Logger removed - PDF generation disabled
  constructor() {
    // No initialization needed
  }

  /**
   * POST /api/export/sprint-report/pdf
   * @deprecated PDF generation disabled - Puppeteer removed
   */
  async exportSprintReportPDF(_req: Request, res: Response): Promise<void> {
    res.status(501).json({
      error: 'PDF generation is not available',
      message:
        'Puppeteer has been removed. Use HTML or Markdown export instead.',
    });
  }

  /**
   * POST /api/export/analytics/pdf
   * @deprecated PDF generation disabled - Puppeteer removed
   */
  async exportAnalyticsPDF(_req: Request, res: Response): Promise<void> {
    res.status(501).json({
      error: 'PDF generation is not available',
      message:
        'Puppeteer has been removed. Use HTML or Markdown export instead.',
    });
  }
}
