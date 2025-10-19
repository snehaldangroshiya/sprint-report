import { Request, Response } from 'express';

import { PDFGenerator } from '@/utils/pdf-generator';
import { ReportController } from '@/web/controllers/report.controller';

// Mock dependencies
jest.mock('@/utils/logger', () => ({
  getLogger: (): unknown => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logError: jest.fn(),
  }),
}));

jest.mock('@/utils/pdf-generator');

describe('ReportController', () => {
  let reportController: ReportController;
  let mockPDFGenerator: jest.Mocked<PDFGenerator>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock PDF generator
    mockPDFGenerator = {
      generateSprintReportPDF: jest.fn(),
      generateAnalyticsPDF: jest.fn(),
    } as any;

    // Mock PDFGenerator constructor
    (PDFGenerator as jest.MockedClass<typeof PDFGenerator>).mockImplementation(
      () => mockPDFGenerator
    );

    // Create controller instance
    reportController = new ReportController();

    // Mock Express request and response
    mockReq = {
      body: {},
    };

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('exportSprintReportPDF', () => {
    it('should generate and return sprint report PDF', async () => {
      const mockReportData = {
        sprint: { name: 'Sprint 1', id: '123' },
        metrics: { velocity: 10 },
      };
      const mockPDFBuffer = Buffer.from('mock pdf content');

      mockReq.body = { reportData: mockReportData, options: {} };
      mockPDFGenerator.generateSprintReportPDF.mockResolvedValue(mockPDFBuffer);

      await reportController.exportSprintReportPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockPDFGenerator.generateSprintReportPDF).toHaveBeenCalledWith(
        mockReportData,
        {}
      );
      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'attachment; filename="sprint-report-Sprint 1.pdf"',
        'Content-Length': mockPDFBuffer.length.toString(),
      });
      expect(mockRes.send).toHaveBeenCalledWith(mockPDFBuffer);
    });

    it('should handle missing sprint name in filename', async () => {
      const mockReportData = {
        sprint: {}, // No name
        metrics: { velocity: 10 },
      };
      const mockPDFBuffer = Buffer.from('mock pdf');

      mockReq.body = { reportData: mockReportData };
      mockPDFGenerator.generateSprintReportPDF.mockResolvedValue(mockPDFBuffer);

      await reportController.exportSprintReportPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Disposition':
            'attachment; filename="sprint-report-unknown.pdf"',
        })
      );
    });

    it('should use default options when not provided', async () => {
      const mockReportData = {
        sprint: { name: 'Sprint 2' },
      };
      const mockPDFBuffer = Buffer.from('mock pdf');

      mockReq.body = { reportData: mockReportData }; // No options
      mockPDFGenerator.generateSprintReportPDF.mockResolvedValue(mockPDFBuffer);

      await reportController.exportSprintReportPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockPDFGenerator.generateSprintReportPDF).toHaveBeenCalledWith(
        mockReportData,
        {} // Default empty options
      );
    });

    it('should pass custom options to PDF generator', async () => {
      const mockReportData = {
        sprint: { name: 'Sprint 3' },
      };
      const customOptions = {
        includeCharts: true,
        pageSize: 'A4',
      };
      const mockPDFBuffer = Buffer.from('mock pdf');

      mockReq.body = { reportData: mockReportData, options: customOptions };
      mockPDFGenerator.generateSprintReportPDF.mockResolvedValue(mockPDFBuffer);

      await reportController.exportSprintReportPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockPDFGenerator.generateSprintReportPDF).toHaveBeenCalledWith(
        mockReportData,
        customOptions
      );
    });

    it('should return 400 when report data is missing', async () => {
      mockReq.body = {}; // No reportData

      await reportController.exportSprintReportPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Report data is required',
      });
      expect(mockPDFGenerator.generateSprintReportPDF).not.toHaveBeenCalled();
    });

    it('should handle PDF generation errors', async () => {
      const mockReportData = {
        sprint: { name: 'Sprint 4' },
      };
      const error = new Error('PDF generation failed');

      mockReq.body = { reportData: mockReportData };
      mockPDFGenerator.generateSprintReportPDF.mockRejectedValue(error);

      await reportController.exportSprintReportPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'PDF generation failed',
        })
      );
    });

    it('should handle errors with custom status code', async () => {
      const mockReportData = {
        sprint: { name: 'Sprint 5' },
      };
      const error: any = new Error('Validation error');
      error.statusCode = 422;
      error.userMessage = 'Invalid sprint data';

      mockReq.body = { reportData: mockReportData };
      mockPDFGenerator.generateSprintReportPDF.mockRejectedValue(error);

      await reportController.exportSprintReportPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid sprint data',
        })
      );
    });
  });

  describe('exportAnalyticsPDF', () => {
    it('should generate and return analytics PDF', async () => {
      const mockAnalyticsData = {
        velocity: [{ sprint: 'S1', value: 10 }],
        issueTypes: [{ name: 'Story', count: 5 }],
      };
      const mockPDFBuffer = Buffer.from('mock analytics pdf');

      mockReq.body = { analyticsData: mockAnalyticsData, options: {} };
      mockPDFGenerator.generateAnalyticsPDF.mockResolvedValue(mockPDFBuffer);

      await reportController.exportAnalyticsPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockPDFGenerator.generateAnalyticsPDF).toHaveBeenCalledWith(
        mockAnalyticsData,
        {}
      );
      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="analytics-report.pdf"',
        'Content-Length': mockPDFBuffer.length.toString(),
      });
      expect(mockRes.send).toHaveBeenCalledWith(mockPDFBuffer);
    });

    it('should use default options when not provided', async () => {
      const mockAnalyticsData = {
        teamPerformance: [{ sprint: 'S1', velocity: 12 }],
      };
      const mockPDFBuffer = Buffer.from('mock pdf');

      mockReq.body = { analyticsData: mockAnalyticsData }; // No options
      mockPDFGenerator.generateAnalyticsPDF.mockResolvedValue(mockPDFBuffer);

      await reportController.exportAnalyticsPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockPDFGenerator.generateAnalyticsPDF).toHaveBeenCalledWith(
        mockAnalyticsData,
        {} // Default empty options
      );
    });

    it('should pass custom options to PDF generator', async () => {
      const mockAnalyticsData = {
        commitTrends: [{ month: '2024-01', commits: 50 }],
      };
      const customOptions = {
        orientation: 'landscape',
        includeCharts: false,
      };
      const mockPDFBuffer = Buffer.from('mock pdf');

      mockReq.body = {
        analyticsData: mockAnalyticsData,
        options: customOptions,
      };
      mockPDFGenerator.generateAnalyticsPDF.mockResolvedValue(mockPDFBuffer);

      await reportController.exportAnalyticsPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockPDFGenerator.generateAnalyticsPDF).toHaveBeenCalledWith(
        mockAnalyticsData,
        customOptions
      );
    });

    it('should return 400 when analytics data is missing', async () => {
      mockReq.body = {}; // No analyticsData

      await reportController.exportAnalyticsPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Analytics data is required',
      });
      expect(mockPDFGenerator.generateAnalyticsPDF).not.toHaveBeenCalled();
    });

    it('should handle PDF generation errors', async () => {
      const mockAnalyticsData = {
        velocity: [{ sprint: 'S1', value: 10 }],
      };
      const error = new Error('Chart rendering failed');

      mockReq.body = { analyticsData: mockAnalyticsData };
      mockPDFGenerator.generateAnalyticsPDF.mockRejectedValue(error);

      await reportController.exportAnalyticsPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Chart rendering failed',
        })
      );
    });

    it('should handle errors with custom user message', async () => {
      const mockAnalyticsData = {
        issueTypes: [{ name: 'Bug', count: 3 }],
      };
      const error: any = new Error('Internal error');
      error.userMessage = 'Unable to process analytics data';

      mockReq.body = { analyticsData: mockAnalyticsData };
      mockPDFGenerator.generateAnalyticsPDF.mockRejectedValue(error);

      await reportController.exportAnalyticsPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unable to process analytics data',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should include stack trace in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      mockReq.body = { reportData: { sprint: { name: 'Test' } } };
      mockPDFGenerator.generateSprintReportPDF.mockRejectedValue(error);

      await reportController.exportSprintReportPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');
      mockReq.body = { analyticsData: { velocity: [] } };
      mockPDFGenerator.generateAnalyticsPDF.mockRejectedValue(error);

      await reportController.exportAnalyticsPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.not.objectContaining({
          stack: expect.any(String),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should use default error message when none provided', async () => {
      const error: any = {}; // No message
      mockReq.body = { reportData: { sprint: {} } };
      mockPDFGenerator.generateSprintReportPDF.mockRejectedValue(error);

      await reportController.exportSprintReportPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to generate PDF report',
        })
      );
    });

    it('should prefer userMessage over error.message', async () => {
      const error: any = new Error('Generic error');
      error.userMessage = 'User-friendly error message';

      mockReq.body = { analyticsData: { data: [] } };
      mockPDFGenerator.generateAnalyticsPDF.mockRejectedValue(error);

      await reportController.exportAnalyticsPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'User-friendly error message',
        })
      );
    });

    it('should use error.status if error.statusCode is not available', async () => {
      const error: any = new Error('Not found');
      error.status = 404; // Using .status instead of .statusCode

      mockReq.body = { reportData: { sprint: {} } };
      mockPDFGenerator.generateSprintReportPDF.mockRejectedValue(error);

      await reportController.exportSprintReportPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('Response Headers', () => {
    it('should set correct Content-Length for sprint report PDF', async () => {
      const mockPDFBuffer = Buffer.from('a'.repeat(5000));
      mockReq.body = { reportData: { sprint: { name: 'Test' } } };
      mockPDFGenerator.generateSprintReportPDF.mockResolvedValue(mockPDFBuffer);

      await reportController.exportSprintReportPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Length': '5000',
        })
      );
    });

    it('should set correct Content-Length for analytics PDF', async () => {
      const mockPDFBuffer = Buffer.from('b'.repeat(3000));
      mockReq.body = { analyticsData: { data: [] } };
      mockPDFGenerator.generateAnalyticsPDF.mockResolvedValue(mockPDFBuffer);

      await reportController.exportAnalyticsPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Length': '3000',
        })
      );
    });

    it('should set Content-Type to application/pdf for sprint reports', async () => {
      const mockPDFBuffer = Buffer.from('pdf');
      mockReq.body = { reportData: { sprint: {} } };
      mockPDFGenerator.generateSprintReportPDF.mockResolvedValue(mockPDFBuffer);

      await reportController.exportSprintReportPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
        })
      );
    });

    it('should set Content-Type to application/pdf for analytics reports', async () => {
      const mockPDFBuffer = Buffer.from('pdf');
      mockReq.body = { analyticsData: {} };
      mockPDFGenerator.generateAnalyticsPDF.mockResolvedValue(mockPDFBuffer);

      await reportController.exportAnalyticsPDF(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
        })
      );
    });
  });
});
