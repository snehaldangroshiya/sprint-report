import puppeteer, { Browser, Page } from 'puppeteer';

import { Logger } from '../utils/logger';

export interface PDFGenerationOptions {
  format?: 'A4' | 'A3' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  margins?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  headerTemplate?: string;
  footerTemplate?: string;
  displayHeaderFooter?: boolean;
  title?: string;
}

export class PDFGenerator {
  private logger: Logger;
  private browser?: Browser;

  constructor() {
    this.logger = new Logger('PDFGenerator');
  }

  async initialize(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });
      this.logger.info('PDF Generator initialized');
    } catch (error) {
      this.logger.logError(error as Error, 'pdf_generator_init');
      throw error;
    }
  }

  async generateFromHTML(
    html: string,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    if (!this.browser) {
      await this.initialize();
    }

    let page: Page | undefined;

    try {
      page = await this.browser!.newPage();

      // Set content
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // Configure PDF options
      const pdfOptions = {
        format: options.format || ('A4' as const),
        landscape: options.orientation === 'landscape',
        margin: options.margins || {
          top: '1in',
          right: '1in',
          bottom: '1in',
          left: '1in',
        },
        printBackground: true,
        displayHeaderFooter: options.displayHeaderFooter || false,
        headerTemplate: options.headerTemplate || '',
        footerTemplate:
          options.footerTemplate ||
          `
          <div style="font-size: 10px; margin: 0 auto; color: #666;">
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>
        `,
      };

      // Generate PDF
      const pdfBuffer = await page.pdf(pdfOptions);

      this.logger.info('PDF generated successfully', {
        type: 'pdf_generated',
        size: pdfBuffer.length,
        format: options.format,
      });

      return pdfBuffer;
    } catch (error) {
      this.logger.logError(error as Error, 'pdf_generation');
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async generateSprintReportPDF(
    reportData: any,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    const html = this.generateSprintReportHTML(reportData);
    return this.generateFromHTML(html, {
      ...options,
      title: `Sprint Report - ${reportData.sprint?.name || 'Unknown'}`,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 12px; margin: 0 auto; padding: 10px; border-bottom: 1px solid #eee;">
          <strong>Sprint Report: ${reportData.sprint?.name || 'Unknown'}</strong>
        </div>
      `,
    });
  }

  async generateAnalyticsPDF(
    analyticsData: any,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    const html = this.generateAnalyticsHTML(analyticsData);
    return this.generateFromHTML(html, {
      ...options,
      title: 'Sprint Analytics Report',
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 12px; margin: 0 auto; padding: 10px; border-bottom: 1px solid #eee;">
          <strong>Sprint Analytics Report</strong>
        </div>
      `,
    });
  }

  private generateSprintReportHTML(reportData: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Sprint Report - ${reportData.sprint?.name || 'Unknown'}</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #007bff;
            }
            .header h1 {
              color: #007bff;
              margin: 0;
            }
            .header .subtitle {
              color: #666;
              margin-top: 5px;
            }
            .section {
              margin-bottom: 30px;
            }
            .section h2 {
              color: #007bff;
              border-bottom: 1px solid #eee;
              padding-bottom: 10px;
            }
            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 20px;
              margin: 20px 0;
            }
            .metric-card {
              padding: 15px;
              background: #f8f9fa;
              border-radius: 8px;
              border-left: 4px solid #007bff;
            }
            .metric-value {
              font-size: 24px;
              font-weight: bold;
              color: #007bff;
            }
            .metric-label {
              color: #666;
              font-size: 14px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            th {
              background-color: #f8f9fa;
              font-weight: bold;
              color: #007bff;
            }
            .status-badge {
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: bold;
            }
            .status-done { background-color: #d4edda; color: #155724; }
            .status-progress { background-color: #fff3cd; color: #856404; }
            .status-todo { background-color: #f8d7da; color: #721c24; }
            @media print {
              body { padding: 0; }
              .section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Sprint Report</h1>
            <div class="subtitle">${reportData.sprint?.name || 'Unknown Sprint'}</div>
            <div class="subtitle">Generated on ${new Date().toLocaleDateString()}</div>
          </div>

          <div class="section">
            <h2>Sprint Overview</h2>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-value">${reportData.metrics?.totalIssues || 0}</div>
                <div class="metric-label">Total Issues</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${reportData.metrics?.completedIssues || 0}</div>
                <div class="metric-label">Completed Issues</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${reportData.metrics?.velocity || 0}</div>
                <div class="metric-label">Story Points</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${reportData.metrics?.completionRate || 0}%</div>
                <div class="metric-label">Completion Rate</div>
              </div>
            </div>
          </div>

          ${
            reportData.issues
              ? `
          <div class="section">
            <h2>Sprint Issues</h2>
            <table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Summary</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Assignee</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.issues
                  .map(
                    (issue: any) => `
                  <tr>
                    <td><strong>${issue.key}</strong></td>
                    <td>${issue.fields.summary}</td>
                    <td>${issue.fields.issuetype.name}</td>
                    <td>
                      <span class="status-badge status-${issue.fields.status.name.toLowerCase().replace(' ', '-')}">
                        ${issue.fields.status.name}
                      </span>
                    </td>
                    <td>${issue.fields.assignee?.displayName || 'Unassigned'}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          `
              : ''
          }

          ${
            reportData.commits
              ? `
          <div class="section">
            <h2>Code Activity</h2>
            <p><strong>Total Commits:</strong> ${reportData.commits.length}</p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Author</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.commits
                  .slice(0, 10)
                  .map(
                    (commit: any) => `
                  <tr>
                    <td>${new Date(commit.commit.committer.date).toLocaleDateString()}</td>
                    <td>${commit.commit.author.name}</td>
                    <td>${commit.commit.message.split('\n')[0]}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          `
              : ''
          }
        </body>
      </html>
    `;
  }

  private generateAnalyticsHTML(analyticsData: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Sprint Analytics Report</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #007bff;
            }
            .header h1 {
              color: #007bff;
              margin: 0;
            }
            .section {
              margin-bottom: 30px;
            }
            .section h2 {
              color: #007bff;
              border-bottom: 1px solid #eee;
              padding-bottom: 10px;
            }
            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 20px;
              margin: 20px 0;
            }
            .metric-card {
              padding: 15px;
              background: #f8f9fa;
              border-radius: 8px;
              border-left: 4px solid #007bff;
            }
            .metric-value {
              font-size: 24px;
              font-weight: bold;
              color: #007bff;
            }
            .metric-label {
              color: #666;
              font-size: 14px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            th {
              background-color: #f8f9fa;
              font-weight: bold;
              color: #007bff;
            }
            .chart-placeholder {
              height: 200px;
              background: #f8f9fa;
              border: 2px dashed #dee2e6;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #666;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Sprint Analytics Report</h1>
            <div class="subtitle">Generated on ${new Date().toLocaleDateString()}</div>
          </div>

          <div class="section">
            <h2>Key Metrics</h2>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-value">${analyticsData.averageVelocity || 0}</div>
                <div class="metric-label">Average Velocity</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${analyticsData.sprintsAnalyzed || 0}</div>
                <div class="metric-label">Sprints Analyzed</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${analyticsData.completionRate || 0}%</div>
                <div class="metric-label">Average Completion Rate</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${analyticsData.velocityTrend || 'Stable'}</div>
                <div class="metric-label">Velocity Trend</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Performance Trends</h2>
            <div class="chart-placeholder">
              Velocity and Performance Charts
              <br>
              <small>(Charts would be rendered here in full implementation)</small>
            </div>
          </div>

          ${
            analyticsData.sprintComparison
              ? `
          <div class="section">
            <h2>Sprint Comparison</h2>
            <table>
              <thead>
                <tr>
                  <th>Sprint</th>
                  <th>Planned</th>
                  <th>Completed</th>
                  <th>Velocity</th>
                  <th>Success Rate</th>
                </tr>
              </thead>
              <tbody>
                ${analyticsData.sprintComparison
                  .map(
                    (sprint: any) => `
                  <tr>
                    <td><strong>${sprint.name}</strong></td>
                    <td>${sprint.planned}</td>
                    <td>${sprint.completed}</td>
                    <td>${sprint.velocity}</td>
                    <td>${((sprint.completed / sprint.planned) * 100).toFixed(1)}%</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          `
              : ''
          }
        </body>
      </html>
    `;
  }

  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.logger.info('PDF Generator shut down');
    }
  }
}
