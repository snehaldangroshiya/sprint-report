/**
 * Report Controller
 * Handles PDF export routes for sprint reports and analytics
 */

import { Request, Response } from 'express';

import { getLogger } from '../../utils/logger';
import { PDFGenerator } from '../../utils/pdf-generator';

export class ReportController {
  private pdfGenerator: PDFGenerator;
  private logger: any;

  constructor() {
    this.pdfGenerator = new PDFGenerator();
    this.logger = getLogger();
  }

  /**
   * POST /api/export/sprint-report/pdf
   */
  async exportSprintReportPDF(req: Request, res: Response): Promise<void> {
    try {
      const { reportData, options = {} } = req.body;

      if (!reportData) {
        res.status(400).json({ error: 'Report data is required' });
        return;
      }

      const pdfBuffer = await this.pdfGenerator.generateSprintReportPDF(
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
      this.handleError(error, res, 'Failed to generate PDF report');
    }
  }

  /**
   * POST /api/export/analytics/pdf
   */
  async exportAnalyticsPDF(req: Request, res: Response): Promise<void> {
    try {
      const { analyticsData, options = {} } = req.body;

      if (!analyticsData) {
        res.status(400).json({ error: 'Analytics data is required' });
        return;
      }

      const pdfBuffer = await this.pdfGenerator.generateAnalyticsPDF(
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
      this.handleError(error, res, 'Failed to generate analytics PDF');
    }
  }

  private handleError(error: any, res: Response, message: string): void {
    this.logger.logError(error, 'report_controller_error');

    const statusCode = error.statusCode || error.status || 500;
    const errorMessage = error.userMessage || error.message || message;

    res.status(statusCode).json({
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
}
