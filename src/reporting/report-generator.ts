import { SprintService } from '../services/sprint-service.js';
import { ReportTemplateEngine, SprintReportData, TemplateConfig } from '../templates/report-templates.js';
import { Logger } from '../utils/logger.js';
import {
  SprintReport,
  SprintReportRequest,
  ReportStorage
} from '../types/index.js';

export class ReportGenerator {
  private logger: Logger;
  private reports: Map<string, ReportStorage> = new Map();

  constructor(
    private sprintService: SprintService
  ) {
    this.logger = new Logger('ReportGenerator');
  }

  /**
   * Generate sprint report in specified format
   */
  async generateReport(
    request: SprintReportRequest
  ): Promise<{ id: string; content: string | Buffer; contentType: string }> {
    this.logger.info('Generating sprint report', {
      sprintId: request.sprint_id,
      format: request.format
    });

    try {
      // Get sprint data from service
      const reportData = await this.sprintService.generateSprintReport(request);

      // Generate content based on format
      let content: string | Buffer;
      let contentType: string;

      switch (request.format) {
        case 'html':
          content = this.generateHTML(reportData, request.theme);
          contentType = 'text/html';
          break;

        case 'markdown':
          content = this.generateMarkdown(reportData);
          contentType = 'text/markdown';
          break;

        case 'json':
          content = JSON.stringify(reportData, null, 2);
          contentType = 'application/json';
          break;

        case 'csv':
          content = this.generateCSV(reportData);
          contentType = 'text/csv';
          break;

        default:
          throw new Error(`Unsupported format: ${request.format}`);
      }

      // Store report
      const reportId = this.generateReportId(request);
      const reportStorage: ReportStorage = {
        id: reportId,
        sprint_id: request.sprint_id,
        format: request.format,
        content: typeof content === 'string' ? content : (content as Buffer).toString('base64'),
        contentType,
        created_at: new Date().toISOString(),
        size: Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, 'utf8')
      };

      this.reports.set(reportId, reportStorage);

      this.logger.info('Sprint report generated successfully', {
        reportId,
        format: request.format,
        size: reportStorage.size
      });

      return { id: reportId, content, contentType };
    } catch (error) {
      this.logger.logError(error as Error, 'generate_report', { request });
      throw error;
    }
  }

  /**
   * Get stored report by ID
   */
  getReport(reportId: string): ReportStorage | undefined {
    return this.reports.get(reportId);
  }

  /**
   * Get all stored reports
   */
  getAllReports(): Omit<ReportStorage, 'content'>[] {
    return Array.from(this.reports.values()).map(({ content, ...report }) => report);
  }

  /**
   * Delete report by ID
   */
  deleteReport(reportId: string): boolean {
    return this.reports.delete(reportId);
  }

  /**
   * Generate HTML report
   */
  private generateHTML(report: SprintReport, theme: string = 'default'): string {
    // Convert SprintReport to SprintReportData format expected by template engine
    const templateData: SprintReportData = {
      sprint: {
        id: report.sprint.id,
        name: report.sprint.name,
        startDate: report.sprint.startDate || '',
        endDate: report.sprint.endDate || '',
        state: report.sprint.state as 'ACTIVE' | 'CLOSED' | 'FUTURE',
        boardId: parseInt(report.sprint.boardId, 10)
      },
      issues: report.sprint.issues || [], // Get issues from sprint
      commits: report.commits?.map(c => ({
        issueKey: '',
        commits: [{
          sha: c.sha,
          message: c.message,
          author: c.author.name,
          date: c.date,
          url: c.url
        }]
      })),
      pullRequests: report.pullRequests?.map(pr => ({
        issueKey: '',
        prs: [{
          number: pr.number,
          title: pr.title,
          state: pr.state,
          author: pr.author,
          createdAt: pr.createdAt,
          url: ''
        }]
      })),
      metrics: {
        totalIssues: report.metrics.totalIssues,
        completedIssues: report.metrics.completedIssues,
        inProgressIssues: 0,
        todoIssues: 0,
        completionRate: report.metrics.completionRate,
        totalStoryPoints: report.metrics.storyPoints,
        completedStoryPoints: report.metrics.completedStoryPoints,
        storyPointsCompletionRate: (report.metrics.completedStoryPoints / report.metrics.storyPoints) * 100 || 0,
        issueTypeBreakdown: report.metrics.issuesByType,
        ...(report.velocity ? {
          velocityData: {
            previousSprints: report.velocity.sprints.map(s => ({
              sprintName: s.name,
              completedPoints: s.completed,
              plannedPoints: s.commitment
            })),
            averageVelocity: report.velocity.average,
            currentSprintProjection: report.velocity.average
          }
        } : {}),
        ...(report.burndown ? {
          burndownData: report.burndown.days.map(d => ({
            date: d.date,
            remainingPoints: d.remaining,
            idealRemaining: d.ideal
          }))
        } : {})
      },
      generatedAt: report.metadata.generatedAt
    };

    const config: TemplateConfig = {
      format: 'html' as const,
      includeCommits: !!report.commits,
      includePullRequests: !!report.pullRequests,
      includeVelocity: !!report.velocity,
      includeBurndown: !!report.burndown,
      theme: theme as 'default' | 'dark' | 'corporate'
    };

    return ReportTemplateEngine.generateHTMLReport(templateData, config);
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdown(report: SprintReport): string {
    const { sprint, metrics, commits, pullRequests, velocity, burndown } = report;

    let markdown = `# Sprint Report: ${sprint.name}\n\n`;

    // Sprint overview
    markdown += `## Sprint Overview\n\n`;
    markdown += `- **Sprint ID**: ${sprint.id}\n`;
    markdown += `- **Start Date**: ${sprint.startDate}\n`;
    markdown += `- **End Date**: ${sprint.endDate}\n`;
    markdown += `- **State**: ${sprint.state}\n\n`;

    // Metrics section
    markdown += `## Metrics\n\n`;
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total Issues | ${metrics.totalIssues} |\n`;
    markdown += `| Completed Issues | ${metrics.completedIssues} |\n`;
    markdown += `| Completion Rate | ${metrics.completionRate}% |\n`;
    markdown += `| Total Story Points | ${metrics.storyPoints} |\n`;
    markdown += `| Completed Story Points | ${metrics.completedStoryPoints} |\n`;
    markdown += `| Velocity | ${metrics.velocity} |\n\n`;

    // Issues section
    if (sprint.issues && sprint.issues.length > 0) {
      markdown += `## Issues\n\n`;
      markdown += `| Key | Summary | Type | Status | Story Points |\n`;
      markdown += `|-----|---------|------|--------|-------------|\n`;

      sprint.issues.forEach(issue => {
        markdown += `| ${issue.key} | ${issue.summary} | ${issue.issueType || 'N/A'} | ${issue.status} | ${issue.storyPoints || '-'} |\n`;
      });
      markdown += '\n';
    }

    // Development activity
    if (commits && commits.length > 0) {
      markdown += `## Development Activity\n\n`;
      markdown += `### Commits (${commits.length} total)\n\n`;

      commits.slice(0, 10).forEach(commit => {
        markdown += `- **${commit.sha.substring(0, 8)}** by ${commit.author} on ${new Date(commit.date).toLocaleDateString()}\n`;
        markdown += `  ${commit.message}\n\n`;
      });

      if (commits.length > 10) {
        markdown += `*... and ${commits.length - 10} more commits*\n\n`;
      }
    }

    if (pullRequests && pullRequests.length > 0) {
      markdown += `### Pull Requests (${pullRequests.length} total)\n\n`;

      pullRequests.slice(0, 10).forEach(pr => {
        markdown += `- **#${pr.number}** ${pr.title} by ${pr.author} (${pr.state})\n`;
      });

      if (pullRequests.length > 10) {
        markdown += `*... and ${pullRequests.length - 10} more pull requests*\n\n`;
      }
    }

    // Velocity section
    if (velocity) {
      markdown += `## Velocity Analysis\n\n`;
      markdown += `- **Average Velocity**: ${velocity.average} story points\n`;
      markdown += `- **Trend**: ${velocity.trend}\n\n`;

      if (velocity.sprints.length > 0) {
        markdown += `### Recent Sprints\n\n`;
        markdown += `| Sprint | Velocity | Commitment | Completed |\n`;
        markdown += `|--------|----------|------------|----------|\n`;

        velocity.sprints.forEach(sprint => {
          markdown += `| ${sprint.name} | ${sprint.velocity} | ${sprint.commitment} | ${sprint.completed} |\n`;
        });
        markdown += '\n';
      }
    }

    // Burndown section
    if (burndown && burndown.days.length > 0) {
      markdown += `## Burndown\n\n`;
      markdown += `| Date | Remaining | Ideal | Completed |\n`;
      markdown += `|------|-----------|-------|----------|\n`;

      burndown.days.forEach(day => {
        markdown += `| ${day.date} | ${day.remaining} | ${day.ideal} | ${day.completed} |\n`;
      });
      markdown += '\n';
    }

    // Footer
    markdown += `---\n\n`;
    markdown += `*Generated by NextReleaseMCP on ${new Date(report.metadata.generatedAt).toLocaleString()}*\n`;

    return markdown;
  }

  /**
   * Generate CSV report
   */
  private generateCSV(report: SprintReport): string {
    const { sprint, metrics } = report;

    let csv = 'Type,Key,Value\n';

    // Sprint info
    csv += `Sprint,ID,${sprint.id}\n`;
    csv += `Sprint,Name,${sprint.name}\n`;
    csv += `Sprint,Start Date,${sprint.startDate}\n`;
    csv += `Sprint,End Date,${sprint.endDate}\n`;
    csv += `Sprint,State,${sprint.state}\n`;

    // Metrics
    csv += `Metric,Total Issues,${metrics.totalIssues}\n`;
    csv += `Metric,Completed Issues,${metrics.completedIssues}\n`;
    csv += `Metric,Completion Rate,${metrics.completionRate}\n`;
    csv += `Metric,Total Story Points,${metrics.storyPoints}\n`;
    csv += `Metric,Completed Story Points,${metrics.completedStoryPoints}\n`;
    csv += `Metric,Velocity,${metrics.velocity}\n`;

    // Issues
    if (sprint.issues && sprint.issues.length > 0) {
      csv += '\nIssue Key,Summary,Type,Status,Story Points\n';
      sprint.issues.forEach(issue => {
        const summary = (issue.summary || '').replace(/"/g, '""'); // Escape quotes
        csv += `"${issue.key}","${summary}","${issue.issueType || 'N/A'}","${issue.status}","${issue.storyPoints || ''}"\n`;
      });
    }

    return csv;
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(request: SprintReportRequest): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const hash = this.simpleHash(JSON.stringify(request));
    return `report-${timestamp}-${hash}`;
  }

  /**
   * Simple hash function for generating IDs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clean up old reports (keep last 100)
   */
  cleanupOldReports(): void {
    const reports = Array.from(this.reports.entries())
      .sort(([, a], [, b]) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (reports.length > 100) {
      const toDelete = reports.slice(100);
      toDelete.forEach(([id]) => {
        this.reports.delete(id);
      });

      this.logger.info('Cleaned up old reports', {
        deleted: toDelete.length,
        remaining: this.reports.size
      });
    }
  }
}