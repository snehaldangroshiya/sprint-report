import { PDFGenerator } from '../utils/pdf-generator.js';
import { Logger } from '../utils/logger.js';
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
  private logger: Logger;
  private pdfGenerator: PDFGenerator;

  constructor() {
    this.logger = new Logger('ExportService');
    this.pdfGenerator = new PDFGenerator();
  }

  /**
   * Export sprint report to PDF
   */
  async exportSprintReportToPDF(
    reportData: SprintReport,
    options: ExportOptions = {}
  ): Promise<Buffer> {
    this.logger.info('Exporting sprint report to PDF', {
      sprintId: reportData.sprint.id,
      format: options.format
    });

    try {
      const html = this.generateSprintReportHTML(reportData);
      const pdfBuffer = await this.pdfGenerator.generateFromHTML(html, {
        format: options.format || 'A4',
        orientation: options.orientation || 'portrait',
        displayHeaderFooter: options.displayHeaderFooter || true,
        margins: options.margins || {
          top: '1in',
          right: '0.75in',
          bottom: '1in',
          left: '0.75in'
        }
      });

      this.logger.info('Sprint report PDF generated successfully', {
        sprintId: reportData.sprint.id,
        size: pdfBuffer.length
      });

      return pdfBuffer;
    } catch (error) {
      this.logger.logError(error as Error, 'export_sprint_report_pdf', { reportData });
      throw error;
    }
  }

  /**
   * Export analytics to PDF
   */
  async exportAnalyticsToPDF(
    analyticsData: AnalyticsReport,
    options: ExportOptions = {}
  ): Promise<Buffer> {
    this.logger.info('Exporting analytics to PDF', {
      boardId: analyticsData.boardId,
      format: options.format
    });

    try {
      const html = this.generateAnalyticsHTML(analyticsData);
      const pdfBuffer = await this.pdfGenerator.generateFromHTML(html, {
        format: options.format || 'A4',
        orientation: options.orientation || 'portrait',
        displayHeaderFooter: options.displayHeaderFooter || true,
        margins: options.margins || {
          top: '1in',
          right: '0.75in',
          bottom: '1in',
          left: '0.75in'
        }
      });

      this.logger.info('Analytics PDF generated successfully', {
        boardId: analyticsData.boardId,
        size: pdfBuffer.length
      });

      return pdfBuffer;
    } catch (error) {
      this.logger.logError(error as Error, 'export_analytics_pdf', { analyticsData });
      throw error;
    }
  }

  /**
   * Generate HTML for sprint report
   */
  private generateSprintReportHTML(report: SprintReport): string {
    const { sprint, metrics, commits, pullRequests, velocity, burndown: _burndown, teamPerformance: _teamPerformance } = report;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Sprint Report - ${sprint.name}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            border-bottom: 3px solid #007acc;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        .header h1 {
            margin: 0;
            color: #007acc;
            font-size: 28px;
        }

        .header .subtitle {
            color: #666;
            font-size: 16px;
            margin-top: 5px;
        }

        .section {
            margin-bottom: 30px;
        }

        .section h2 {
            color: #007acc;
            border-bottom: 2px solid #e1e5e9;
            padding-bottom: 8px;
            margin-bottom: 15px;
            font-size: 20px;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .metric-card {
            background: #f8f9fa;
            border: 1px solid #e1e5e9;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
        }

        .metric-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #007acc;
            margin-bottom: 5px;
        }

        .metric-card .label {
            color: #666;
            font-size: 14px;
        }

        .table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }

        .table th,
        .table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e1e5e9;
        }

        .table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }

        .table tr:hover {
            background: #f8f9fa;
        }

        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }

        .status-done {
            background: #d4edda;
            color: #155724;
        }

        .status-in-progress {
            background: #d1ecf1;
            color: #0c5460;
        }

        .status-todo {
            background: #f8d7da;
            color: #721c24;
        }

        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e1e5e9;
            text-align: center;
            color: #666;
            font-size: 12px;
        }

        .chart-placeholder {
            background: #f8f9fa;
            border: 2px dashed #dee2e6;
            border-radius: 8px;
            padding: 40px;
            text-align: center;
            color: #6c757d;
            margin: 20px 0;
        }

        @media print {
            body { margin: 0; }
            .section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Sprint Report</h1>
        <div class="subtitle">
            ${sprint.name} • ${sprint.startDate} to ${sprint.endDate} •
            Generated on ${new Date(report.metadata.generatedAt).toLocaleDateString()}
        </div>
    </div>

    <div class="section">
        <h2>Sprint Overview</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="value">${metrics.totalIssues}</div>
                <div class="label">Total Issues</div>
            </div>
            <div class="metric-card">
                <div class="value">${metrics.completedIssues}</div>
                <div class="label">Completed</div>
            </div>
            <div class="metric-card">
                <div class="value">${metrics.completionRate}%</div>
                <div class="label">Completion Rate</div>
            </div>
            <div class="metric-card">
                <div class="value">${metrics.velocity}</div>
                <div class="label">Velocity (SP)</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Sprint Issues</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>Issue Key</th>
                    <th>Summary</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Story Points</th>
                </tr>
            </thead>
            <tbody>
                ${sprint.issues?.map(issue => `
                    <tr>
                        <td><strong>${issue.key}</strong></td>
                        <td>${issue.summary}</td>
                        <td>${issue.issueType || 'N/A'}</td>
                        <td>
                            <span class="status-badge ${this.getStatusClass(issue.status)}">
                                ${issue.status}
                            </span>
                        </td>
                        <td>${issue.storyPoints || '-'}</td>
                    </tr>
                `).join('') || '<tr><td colspan="5">No issues found</td></tr>'}
            </tbody>
        </table>
    </div>

    ${commits && commits.length > 0 ? `
    <div class="section">
        <h2>Development Activity</h2>
        <p><strong>${commits.length}</strong> commits during sprint period</p>
        <table class="table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Author</th>
                    <th>Message</th>
                    <th>SHA</th>
                </tr>
            </thead>
            <tbody>
                ${commits.slice(0, 10).map(commit => `
                    <tr>
                        <td>${new Date(commit.date).toLocaleDateString()}</td>
                        <td>${commit.author}</td>
                        <td>${commit.message.substring(0, 60)}${commit.message.length > 60 ? '...' : ''}</td>
                        <td><code>${commit.sha.substring(0, 8)}</code></td>
                    </tr>
                `).join('')}
                ${commits.length > 10 ? `<tr><td colspan="4"><em>... and ${commits.length - 10} more commits</em></td></tr>` : ''}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${pullRequests && pullRequests.length > 0 ? `
    <div class="section">
        <h2>Pull Requests</h2>
        <p><strong>${pullRequests.length}</strong> pull requests during sprint period</p>
        <table class="table">
            <thead>
                <tr>
                    <th>PR #</th>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${pullRequests.slice(0, 10).map(pr => `
                    <tr>
                        <td><strong>#${pr.number}</strong></td>
                        <td>${pr.title}</td>
                        <td>${pr.author}</td>
                        <td>
                            <span class="status-badge ${pr.state === 'open' ? 'status-in-progress' : 'status-done'}">
                                ${pr.state}
                            </span>
                        </td>
                    </tr>
                `).join('')}
                ${pullRequests.length > 10 ? `<tr><td colspan="4"><em>... and ${pullRequests.length - 10} more pull requests</em></td></tr>` : ''}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${velocity ? `
    <div class="section">
        <h2>Velocity Analysis</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="value">${velocity.average}</div>
                <div class="label">Average Velocity</div>
            </div>
            <div class="metric-card">
                <div class="value">${velocity.trend}</div>
                <div class="label">Trend</div>
            </div>
        </div>
        <div class="chart-placeholder">
            Velocity Chart: ${velocity.sprints.map(s => s.name + ' (' + s.velocity + ' SP)').join(', ')}
        </div>
    </div>
    ` : ''}

    <div class="footer">
        Generated by NextReleaseMCP • ${new Date().toISOString()}
    </div>
</body>
</html>`;
  }

  /**
   * Generate HTML for analytics report
   */
  private generateAnalyticsHTML(analytics: AnalyticsReport): string {
    const { velocity: _velocity, teamPerformance, commitTrends, summary } = analytics;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Analytics Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            border-bottom: 3px solid #007acc;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        .header h1 {
            margin: 0;
            color: #007acc;
            font-size: 28px;
        }

        .header .subtitle {
            color: #666;
            font-size: 16px;
            margin-top: 5px;
        }

        .section {
            margin-bottom: 30px;
        }

        .section h2 {
            color: #007acc;
            border-bottom: 2px solid #e1e5e9;
            padding-bottom: 8px;
            margin-bottom: 15px;
            font-size: 20px;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .metric-card {
            background: #f8f9fa;
            border: 1px solid #e1e5e9;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
        }

        .metric-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #007acc;
            margin-bottom: 5px;
        }

        .metric-card .label {
            color: #666;
            font-size: 14px;
        }

        .table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }

        .table th,
        .table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e1e5e9;
        }

        .table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }

        .chart-placeholder {
            background: #f8f9fa;
            border: 2px dashed #dee2e6;
            border-radius: 8px;
            padding: 40px;
            text-align: center;
            color: #6c757d;
            margin: 20px 0;
        }

        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e1e5e9;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Analytics Report</h1>
        <div class="subtitle">
            Board: ${analytics.boardId} • Period: ${analytics.period} •
            Generated on ${new Date(analytics.generatedAt).toLocaleDateString()}
        </div>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="value">${summary.averageVelocity}</div>
                <div class="label">Average Velocity</div>
            </div>
            <div class="metric-card">
                <div class="value">${summary.completionRate}%</div>
                <div class="label">Completion Rate</div>
            </div>
            <div class="metric-card">
                <div class="value">${summary.velocityTrend}</div>
                <div class="label">Velocity Trend</div>
            </div>
            <div class="metric-card">
                <div class="value">${summary.totalSprints}</div>
                <div class="label">Sprints Analyzed</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Team Performance</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>Sprint</th>
                    <th>Planned (SP)</th>
                    <th>Completed (SP)</th>
                    <th>Velocity</th>
                    <th>Completion %</th>
                </tr>
            </thead>
            <tbody>
                ${teamPerformance.map(sprint => {
                  const completionPercent = sprint.planned > 0 ? Math.round((sprint.completed / sprint.planned) * 100) : 0;
                  return `
                    <tr>
                        <td><strong>${sprint.name}</strong></td>
                        <td>${sprint.planned}</td>
                        <td>${sprint.completed}</td>
                        <td>${sprint.velocity}</td>
                        <td>${completionPercent}%</td>
                    </tr>
                  `;
                }).join('')}
            </tbody>
        </table>
    </div>

    ${commitTrends ? `
    <div class="section">
        <h2>Code Activity Trends</h2>
        <div class="chart-placeholder">
            Commit Trends: ${commitTrends.map(trend => trend.date + ' (' + trend.commits + ' commits, ' + trend.prs + ' PRs)').join(', ')}
        </div>
        <table class="table">
            <thead>
                <tr>
                    <th>Month</th>
                    <th>Commits</th>
                    <th>Pull Requests</th>
                </tr>
            </thead>
            <tbody>
                ${commitTrends.map(trend => `
                    <tr>
                        <td>${trend.date}</td>
                        <td>${trend.commits}</td>
                        <td>${trend.prs}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <div class="footer">
        Generated by NextReleaseMCP Analytics • ${new Date().toISOString()}
    </div>
</body>
</html>`;
  }

  /**
   * Get CSS class for issue status
   */
  private getStatusClass(status: string): string {
    const lowerStatus = status.toLowerCase();
    if (['done', 'closed', 'resolved'].includes(lowerStatus)) {
      return 'status-done';
    } else if (['in progress', 'in-progress', 'development'].includes(lowerStatus)) {
      return 'status-in-progress';
    } else {
      return 'status-todo';
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // PDFGenerator cleanup if needed in the future
  }
}