import { SprintReport, AnalyticsReport } from '../types/index.js';

export interface ExportOptions {
  format?: 'A4' | 'A3' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  displayHeaderFooter?: boolean;
  margins?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

export class ExportService {
  // Logger removed - PDF generation disabled
  constructor() {
    // No initialization needed
  }

  /**
   * Export sprint report to PDF
   * @deprecated PDF generation disabled - Puppeteer removed
   */
  async exportSprintReportToPDF(
    _reportData: SprintReport,
    _options: ExportOptions = {}
  ): Promise<Buffer> {
    throw new Error(
      'PDF generation is not available - Puppeteer has been removed'
    );
  }

  /**
   * Export analytics to PDF
   * @deprecated PDF generation disabled - Puppeteer removed
   */
  async exportAnalyticsToPDF(
    _analyticsData: AnalyticsReport,
    _options: ExportOptions = {}
  ): Promise<Buffer> {
    throw new Error(
      'PDF generation is not available - Puppeteer has been removed'
    );
  }
}
