import { ReportGenerator } from '../reporting/report-generator.js';
import { AnalyticsService } from '../services/analytics-service.js';
import { ExportService } from '../services/export-service.js';
import { SprintService } from '../services/sprint-service.js';
import { Logger } from '../utils/logger.js';
import { ValidationUtils, MCPToolSchemas } from '../utils/validation.js';

export class ReportTools {
  private logger: Logger;

  constructor(
    private sprintService: SprintService,
    private analyticsService: AnalyticsService,
    private exportService: ExportService,
    private reportGenerator: ReportGenerator
  ) {
    this.logger = new Logger('ReportTools');
  }

  /**
   * Generate sprint report
   */
  async generateSprintReport(args: any): Promise<any> {
    this.logger.debug(
      'generateSprintReport called with args:',
      { argKeys: Object.keys(args) }
    );
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.generateSprintReport,
      args
    );
    this.logger.debug('After validation, params:', {
      sprint_id: params.sprint_id,
      format: params.format,
      include_tier1: params.include_tier1,
      include_tier2: params.include_tier2,
      include_tier3: params.include_tier3,
    });
    this.logger.info('Generating sprint report', {
      sprintId: params.sprint_id,
      format: params.format,
    });

    try {
      this.logger.debug('Calling reportGenerator.generateReport');
      const result = await this.reportGenerator.generateReport(params as any);
      this.logger.debug('Report generated, result keys:', {
        resultKeys: Object.keys(result)
      });

      this.logger.info('Successfully generated sprint report', {
        reportId: result.id,
        format: params.format,
        contentType: result.contentType,
      });

      return {
        id: result.id,
        content: result.content,
        contentType: result.contentType,
        format: params.format,
        sprint_id: params.sprint_id,
      };
    } catch (error) {
      this.logger.error(error as Error, 'generate_sprint_report', { params });
      throw error;
    }
  }

  /**
   * Get stored reports
   */
  async getReports(): Promise<any> {
    this.logger.info('Getting stored reports');

    try {
      const reports = this.reportGenerator.getAllReports();

      this.logger.info('Successfully retrieved reports', {
        count: reports.length,
      });

      return reports;
    } catch (error) {
      this.logger.error(error as Error, 'get_reports');
      throw error;
    }
  }

  /**
   * Get specific report
   */
  async getReport(args: { report_id: string }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.getReport,
      args
    );
    this.logger.info('Getting report', { reportId: params.report_id });

    try {
      const report = this.reportGenerator.getReport(params.report_id);

      if (!report) {
        throw new Error(`Report not found: ${params.report_id}`);
      }

      this.logger.info('Successfully retrieved report', {
        reportId: params.report_id,
        format: report.format,
      });

      return report;
    } catch (error) {
      this.logger.error(error as Error, 'get_report', {
        reportId: params.report_id,
      });
      throw error;
    }
  }

  /**
   * Delete report
   */
  async deleteReport(args: { report_id: string }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.deleteReport,
      args
    );
    this.logger.info('Deleting report', { reportId: params.report_id });

    try {
      const deleted = this.reportGenerator.deleteReport(params.report_id);

      if (!deleted) {
        throw new Error(`Report not found: ${params.report_id}`);
      }

      this.logger.info('Successfully deleted report', {
        reportId: params.report_id,
      });

      return { success: true };
    } catch (error) {
      this.logger.error(error as Error, 'delete_report', {
        reportId: params.report_id,
      });
      throw error;
    }
  }

  /**
   * Export sprint report to PDF
   */
  async exportSprintReportToPDF(args: {
    reportData: any;
    options?: {
      format?: 'A4' | 'A3' | 'Letter';
      orientation?: 'portrait' | 'landscape';
    };
  }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.exportSprintReportToPDF,
      args
    );
    this.logger.info('Exporting sprint report to PDF', {
      reportId: params.report_id,
      format: params.format,
    });

    try {
      const report = await this.reportGenerator.getReport(params.report_id);
      if (!report) {
        throw new Error(`Report not found: ${params.report_id}`);
      }

      // Regenerate the report for export
      // Note: Full report data storage would require additional database infrastructure
      const sprintData = await this.sprintService.getSprintDetails(
        report.sprint_id
      );
      const pdfBuffer = await this.exportService.exportSprintReportToPDF(
        sprintData as any,
        { format: params.format as any }
      );

      this.logger.info('Successfully exported sprint report to PDF', {
        reportId: params.report_id,
        size: pdfBuffer.length,
      });

      return {
        content: pdfBuffer,
        contentType: 'application/pdf',
        size: pdfBuffer.length,
      };
    } catch (error) {
      this.logger.error(error as Error, 'export_sprint_report_pdf', {
        reportId: params.report_id,
      });
      throw error;
    }
  }

  /**
   * Export analytics to PDF
   */
  async exportAnalyticsToPDF(args: {
    analyticsData: any;
    options?: {
      format?: 'A4' | 'A3' | 'Letter';
      orientation?: 'portrait' | 'landscape';
    };
  }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.exportAnalyticsToPDF,
      args
    );
    this.logger.info('Exporting analytics to PDF', {
      sprintId: params.sprint_id,
      format: params.format,
    });

    try {
      const analyticsData = await this.analyticsService.getAnalyticsReport(
        params.sprint_id
      );
      const pdfBuffer = await this.exportService.exportAnalyticsToPDF(
        analyticsData,
        { format: params.format as any }
      );

      this.logger.info('Successfully exported analytics to PDF', {
        sprintId: params.sprint_id,
        size: pdfBuffer.length,
      });

      return {
        content: pdfBuffer,
        contentType: 'application/pdf',
        size: pdfBuffer.length,
      };
    } catch (error) {
      this.logger.error(error as Error, 'export_analytics_pdf', {
        sprintId: params.sprint_id,
      });
      throw error;
    }
  }

  /**
   * Get analytics report
   */
  async getAnalyticsReport(args: {
    board_id: string;
    owner?: string;
    repo?: string;
    period?: '1month' | '3months' | '6months' | '1year';
  }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.getAnalyticsReport,
      args
    );
    this.logger.info('Generating analytics report', {
      boardId: params.board_id,
      owner: params.owner,
      repo: params.repo,
      period: params.period,
    });

    try {
      const report = await this.analyticsService.getAnalyticsReport(
        params.board_id,
        params.owner,
        params.repo,
        params.period
      );

      this.logger.info('Successfully generated analytics report', {
        boardId: params.board_id,
        period: params.period,
        summary: report.summary,
      });

      return report;
    } catch (error) {
      this.logger.error(error as Error, 'get_analytics_report', { params });
      throw error;
    }
  }

  /**
   * Get velocity data
   */
  async getVelocityData(args: {
    board_id: string;
    sprint_count?: number;
  }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.getVelocityData,
      args
    );
    this.logger.info('Getting velocity data', {
      boardId: params.board_id,
      sprintCount: params.sprint_count,
    });

    try {
      const velocityData = await this.sprintService.getVelocityData(
        params.board_id,
        params.sprint_count
      );

      this.logger.info('Successfully retrieved velocity data', {
        boardId: params.board_id,
        average: velocityData.average,
        trend: velocityData.trend,
      });

      return velocityData;
    } catch (error) {
      this.logger.error(error as Error, 'get_velocity_data', { params });
      throw error;
    }
  }

  /**
   * Get burndown data
   */
  async getBurndownData(args: {
    board_id: string;
    sprints?: number;
  }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.getBurndownData,
      args
    );
    this.logger.info('Getting burndown data', { boardId: params.board_id });

    try {
      const burndownData = await this.sprintService.getBurndownData(
        params.board_id
      );

      this.logger.info('Successfully retrieved burndown data', {
        boardId: params.board_id,
        sprints: params.sprints,
      });

      return burndownData;
    } catch (error) {
      this.logger.error(error as Error, 'get_burndown_data', { params });
      throw error;
    }
  }

  /**
   * Get team performance data
   */
  async getTeamPerformanceData(args: {
    board_id: string;
    sprints?: number;
  }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.getTeamPerformanceData,
      args
    );
    this.logger.info('Getting team performance data', {
      boardId: params.board_id,
      sprints: params.sprints,
    });

    try {
      const performanceData = await this.sprintService.getTeamPerformanceData(
        params.board_id,
        params.sprints
      );

      this.logger.info('Successfully retrieved team performance data', {
        boardId: params.board_id,
        sprints: performanceData.length,
      });

      return performanceData;
    } catch (error) {
      this.logger.error(error as Error, 'get_team_performance_data', {
        params,
      });
      throw error;
    }
  }

  /**
   * Get dashboard metrics
   */
  async getDashboardMetrics(): Promise<any> {
    this.logger.info('Getting dashboard metrics');

    try {
      const metrics = await this.analyticsService.getDashboardMetrics();

      this.logger.info('Successfully retrieved dashboard metrics', {
        cacheHitRate: metrics.cacheHitRate,
      });

      return metrics;
    } catch (error) {
      this.logger.error(error as Error, 'get_dashboard_metrics');
      throw error;
    }
  }

  /**
   * Get cache optimization recommendations
   */
  async getCacheOptimizations(): Promise<any> {
    this.logger.info('Getting cache optimization recommendations');

    try {
      const optimizations = await this.analyticsService.getCacheOptimizations();

      this.logger.info('Successfully retrieved cache optimizations', {
        recommendations: optimizations.recommendations.length,
      });

      return optimizations;
    } catch (error) {
      this.logger.error(error as Error, 'get_cache_optimizations');
      throw error;
    }
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<any> {
    this.logger.info('Performing comprehensive health check');

    try {
      const healthResult = await this.sprintService.healthCheck();

      this.logger.info('Health check completed', {
        healthy: healthResult.healthy,
        services: Object.keys(healthResult.services),
      });

      return {
        status: healthResult.healthy ? 'healthy' : 'unhealthy',
        uptime: process.uptime() * 1000, // Convert to milliseconds
        services: healthResult.services,
      };
    } catch (error) {
      this.logger.error(error as Error, 'health_check');

      return {
        status: 'unhealthy',
        uptime: process.uptime() * 1000,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Cleanup old reports
   */
  async cleanupReports(): Promise<any> {
    this.logger.info('Cleaning up old reports');

    try {
      this.reportGenerator.cleanupOldReports();

      this.logger.info('Successfully cleaned up old reports');

      return { success: true };
    } catch (error) {
      this.logger.error(error as Error, 'cleanup_reports');
      throw error;
    }
  }
}
