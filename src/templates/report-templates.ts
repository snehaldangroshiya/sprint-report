// Template system for generating various report formats

import { Issue, SprintData } from '@/types';

export interface SprintReportData {
  sprint: SprintData;
  issues: Issue[];
  commits?:
    | Array<{
        issueKey: string;
        commits: Array<{
          sha: string;
          message: string;
          author: string;
          date: string;
          url: string;
        }>;
      }>
    | undefined;
  pullRequests?:
    | Array<{
        issueKey: string;
        prs: Array<{
          number: number;
          title: string;
          state: string;
          author: string;
          createdAt: string;
          mergedAt?: string | undefined;
          url: string;
        }>;
      }>
    | undefined;
  metrics: {
    totalIssues: number;
    completedIssues: number;
    inProgressIssues: number;
    todoIssues: number;
    completionRate: number;
    totalStoryPoints: number;
    completedStoryPoints: number;
    storyPointsCompletionRate: number;
    issueTypeBreakdown: Record<string, number>;
    velocityData?:
      | {
          previousSprints: Array<{
            sprintName: string;
            completedPoints: number;
            plannedPoints: number;
          }>;
          averageVelocity: number;
          currentSprintProjection: number;
        }
      | undefined;
    burndownData?:
      | Array<{
          date: string;
          remainingPoints: number;
          idealRemaining: number;
        }>
      | undefined;
  };
  generatedAt: string;
}

export interface TemplateConfig {
  format: 'markdown' | 'html' | 'json' | 'csv';
  includeCommits?: boolean | undefined;
  includePullRequests?: boolean | undefined;
  includeCharts?: boolean | undefined;
  includeVelocity?: boolean | undefined;
  includeBurndown?: boolean | undefined;
  maxCommitsPerIssue?: number | undefined;
  maxPRsPerIssue?: number | undefined;
  theme?: 'default' | 'dark' | 'corporate' | undefined;
}

export class ReportTemplateEngine {
  private static readonly MARKDOWN_TEMPLATE = `
# Sprint Report: {{sprint.name}}

## Sprint Overview
- **Sprint ID**: {{sprint.id}}
- **Start Date**: {{sprint.startDate}}
- **End Date**: {{sprint.endDate}}
- **State**: {{sprint.state}}
{{#if sprint.goal}}
- **Sprint Goal**: {{sprint.goal}}
{{/if}}

## Sprint Metrics
- **Total Issues**: {{metrics.totalIssues}}
- **Completed Issues**: {{metrics.completedIssues}}
- **In Progress**: {{metrics.inProgressIssues}}
- **To Do**: {{metrics.todoIssues}}
- **Completion Rate**: {{metrics.completionRate}}%

### Story Points
- **Total Points**: {{metrics.totalStoryPoints}}
- **Completed Points**: {{metrics.completedStoryPoints}}
- **Points Completion Rate**: {{metrics.storyPointsCompletionRate}}%

{{#if metrics.velocityData}}
### Velocity Analysis
- **Average Velocity**: {{metrics.velocityData.averageVelocity}} points
- **Current Sprint Projection**: {{metrics.velocityData.currentSprintProjection}} points

#### Previous Sprints Performance
{{#each metrics.velocityData.previousSprints}}
- **{{sprintName}}**: {{completedPoints}}/{{plannedPoints}} points
{{/each}}
{{/if}}

## Issue Breakdown by Type
{{#each metrics.issueTypeBreakdown}}
- **{{@key}}**: {{this}} issues
{{/each}}

## Issues Summary
{{#each issues}}
### {{key}}: {{summary}}
- **Status**: {{status}}
- **Assignee**: {{assignee}}
- **Type**: {{issueType}}
- **Priority**: {{priority}}
{{#if storyPoints}}
- **Story Points**: {{storyPoints}}
{{/if}}
{{#if labels.length}}
- **Labels**: {{#each labels}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

{{/each}}

{{#if commits}}
## Related Commits
{{#each commits}}
### {{issueKey}}
{{#each commits}}
- [{{sha}}]({{url}}): {{message}} ({{author}}, {{date}})
{{/each}}

{{/each}}
{{/if}}

{{#if pullRequests}}
## Related Pull Requests
{{#each pullRequests}}
### {{issueKey}}
{{#each prs}}
- [#{{number}}]({{url}}): {{title}} - {{state}} by {{author}}
  - Created: {{createdAt}}
  {{#if mergedAt}}
  - Merged: {{mergedAt}}
  {{/if}}
{{/each}}

{{/each}}
{{/if}}

---
*Report generated on {{generatedAt}}*
`;

  private static readonly HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sprint Report: {{sprint.name}}</title>
    <style>
        {{>css}}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Sprint Report: {{sprint.name}}</h1>
            <div class="sprint-meta">
                <span class="meta-item"><strong>Sprint ID:</strong> {{sprint.id}}</span>
                <span class="meta-item"><strong>Start:</strong> {{sprint.startDate}}</span>
                <span class="meta-item"><strong>End:</strong> {{sprint.endDate}}</span>
                <span class="meta-item status-{{sprint.state}}"><strong>State:</strong> {{sprint.state}}</span>
            </div>
            {{#if sprint.goal}}
            <div class="sprint-goal">
                <h3>Sprint Goal</h3>
                <p>{{sprint.goal}}</p>
            </div>
            {{/if}}
        </header>

        <section class="metrics-overview">
            <h2>Sprint Metrics</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>{{metrics.totalIssues}}</h3>
                    <p>Total Issues</p>
                </div>
                <div class="metric-card success">
                    <h3>{{metrics.completedIssues}}</h3>
                    <p>Completed</p>
                </div>
                <div class="metric-card warning">
                    <h3>{{metrics.inProgressIssues}}</h3>
                    <p>In Progress</p>
                </div>
                <div class="metric-card pending">
                    <h3>{{metrics.todoIssues}}</h3>
                    <p>To Do</p>
                </div>
            </div>

            <div class="completion-rate">
                <h3>Completion Rate: {{metrics.completionRate}}%</h3>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {{metrics.completionRate}}%"></div>
                </div>
            </div>

            <div class="story-points">
                <h3>Story Points</h3>
                <p><strong>Completed:</strong> {{metrics.completedStoryPoints}} / {{metrics.totalStoryPoints}} points</p>
                <p><strong>Points Completion Rate:</strong> {{metrics.storyPointsCompletionRate}}%</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {{metrics.storyPointsCompletionRate}}%"></div>
                </div>
            </div>
        </section>

        {{#if metrics.velocityData}}
        <section class="velocity-section">
            <h2>Velocity Analysis</h2>
            <div class="velocity-stats">
                <p><strong>Average Velocity:</strong> {{metrics.velocityData.averageVelocity}} points</p>
                <p><strong>Current Sprint Projection:</strong> {{metrics.velocityData.currentSprintProjection}} points</p>
            </div>

            <h3>Previous Sprints Performance</h3>
            <table class="velocity-table">
                <thead>
                    <tr>
                        <th>Sprint</th>
                        <th>Completed Points</th>
                        <th>Planned Points</th>
                        <th>Achievement Rate</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each metrics.velocityData.previousSprints}}
                    <tr>
                        <td>{{sprintName}}</td>
                        <td>{{completedPoints}}</td>
                        <td>{{plannedPoints}}</td>
                        <td>{{#if plannedPoints}}{{math completedPoints '/' plannedPoints '*' 100}}%{{/if}}</td>
                    </tr>
                    {{/each}}
                </tbody>
            </table>
        </section>
        {{/if}}

        <section class="issue-types">
            <h2>Issue Breakdown by Type</h2>
            <div class="type-grid">
                {{#each metrics.issueTypeBreakdown}}
                <div class="type-card">
                    <h3>{{this}}</h3>
                    <p>{{@key}}</p>
                </div>
                {{/each}}
            </div>
        </section>

        <section class="issues-list">
            <h2>Issues Summary</h2>
            {{#each issues}}
            <div class="issue-card">
                <h3>{{key}}: {{summary}}</h3>
                <div class="issue-meta">
                    <span class="status status-{{status}}">{{status}}</span>
                    <span class="assignee">{{assignee}}</span>
                    <span class="type">{{issueType}}</span>
                    <span class="priority priority-{{priority}}">{{priority}}</span>
                    {{#if storyPoints}}
                    <span class="story-points">{{storyPoints}} pts</span>
                    {{/if}}
                </div>
                {{#if labels.length}}
                <div class="labels">
                    {{#each labels}}
                    <span class="label">{{this}}</span>
                    {{/each}}
                </div>
                {{/if}}
            </div>
            {{/each}}
        </section>

        {{#if commits}}
        <section class="commits-section">
            <h2>Related Commits</h2>
            {{#each commits}}
            <div class="commit-group">
                <h3>{{issueKey}}</h3>
                {{#each commits}}
                <div class="commit-item">
                    <a href="{{url}}" target="_blank" class="commit-sha">{{sha}}</a>
                    <span class="commit-message">{{message}}</span>
                    <span class="commit-author">by {{author}}</span>
                    <span class="commit-date">{{date}}</span>
                </div>
                {{/each}}
            </div>
            {{/each}}
        </section>
        {{/if}}

        {{#if pullRequests}}
        <section class="prs-section">
            <h2>Related Pull Requests</h2>
            {{#each pullRequests}}
            <div class="pr-group">
                <h3>{{issueKey}}</h3>
                {{#each prs}}
                <div class="pr-item">
                    <a href="{{url}}" target="_blank" class="pr-number">#{{number}}</a>
                    <span class="pr-title">{{title}}</span>
                    <span class="pr-state state-{{state}}">{{state}}</span>
                    <span class="pr-author">by {{author}}</span>
                    <div class="pr-dates">
                        <span>Created: {{createdAt}}</span>
                        {{#if mergedAt}}
                        <span>Merged: {{mergedAt}}</span>
                        {{/if}}
                    </div>
                </div>
                {{/each}}
            </div>
            {{/each}}
        </section>
        {{/if}}

        <footer>
            <p><em>Report generated on {{generatedAt}}</em></p>
        </footer>
    </div>
</body>
</html>
`;

  private static readonly CSS_STYLES = `
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        background-color: #f5f7fa;
    }

    .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        background-color: white;
        box-shadow: 0 0 20px rgba(0,0,0,0.1);
    }

    header {
        border-bottom: 3px solid #007acc;
        padding-bottom: 20px;
        margin-bottom: 30px;
    }

    h1 {
        color: #007acc;
        margin-bottom: 15px;
    }

    h2 {
        color: #2c3e50;
        border-bottom: 2px solid #ecf0f1;
        padding-bottom: 10px;
        margin: 30px 0 20px;
    }

    .sprint-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        margin-bottom: 15px;
    }

    .meta-item {
        padding: 8px 12px;
        background-color: #ecf0f1;
        border-radius: 5px;
        font-size: 14px;
    }

    .status-ACTIVE { background-color: #2ecc71; color: white; }
    .status-CLOSED { background-color: #95a5a6; color: white; }
    .status-FUTURE { background-color: #3498db; color: white; }

    .sprint-goal {
        margin-top: 20px;
        padding: 15px;
        background-color: #e8f6ff;
        border-left: 4px solid #007acc;
    }

    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin: 20px 0;
    }

    .metric-card {
        text-align: center;
        padding: 20px;
        border-radius: 10px;
        background-color: #f8f9fa;
        border: 2px solid #dee2e6;
    }

    .metric-card.success { border-color: #28a745; background-color: #d4edda; }
    .metric-card.warning { border-color: #ffc107; background-color: #fff3cd; }
    .metric-card.pending { border-color: #6c757d; background-color: #f8f9fa; }

    .metric-card h3 {
        font-size: 2.5em;
        margin-bottom: 5px;
        color: #2c3e50;
    }

    .progress-bar {
        width: 100%;
        height: 20px;
        background-color: #ecf0f1;
        border-radius: 10px;
        overflow: hidden;
        margin-top: 10px;
    }

    .progress-fill {
        height: 100%;
        background-color: #2ecc71;
        transition: width 0.3s ease;
    }

    .type-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        margin: 20px 0;
    }

    .type-card {
        text-align: center;
        padding: 15px;
        border-radius: 8px;
        background-color: #f8f9fa;
        border: 1px solid #dee2e6;
    }

    .issue-card {
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 20px;
        margin: 15px 0;
        background-color: #fff;
    }

    .issue-card h3 {
        color: #2c3e50;
        margin-bottom: 10px;
    }

    .issue-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 10px 0;
    }

    .issue-meta span {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
    }

    .status { background-color: #6c757d; color: white; }
    .assignee { background-color: #007acc; color: white; }
    .type { background-color: #28a745; color: white; }
    .priority { background-color: #ffc107; color: black; }
    .story-points { background-color: #e83e8c; color: white; }

    .priority-Highest, .priority-High { background-color: #dc3545; color: white; }
    .priority-Medium { background-color: #ffc107; color: black; }
    .priority-Low, .priority-Lowest { background-color: #28a745; color: white; }

    .labels {
        margin-top: 10px;
    }

    .label {
        display: inline-block;
        padding: 2px 6px;
        margin: 2px;
        background-color: #17a2b8;
        color: white;
        border-radius: 3px;
        font-size: 11px;
    }

    .velocity-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
    }

    .velocity-table th,
    .velocity-table td {
        padding: 10px;
        text-align: left;
        border-bottom: 1px solid #dee2e6;
    }

    .velocity-table th {
        background-color: #f8f9fa;
        font-weight: bold;
    }

    .commit-group, .pr-group {
        margin: 20px 0;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 15px;
    }

    .commit-item, .pr-item {
        padding: 10px 0;
        border-bottom: 1px solid #eee;
    }

    .commit-item:last-child,
    .pr-item:last-child {
        border-bottom: none;
    }

    .commit-sha, .pr-number {
        font-family: 'Courier New', monospace;
        background-color: #f8f9fa;
        padding: 2px 6px;
        border-radius: 3px;
        text-decoration: none;
        color: #007acc;
    }

    .commit-sha:hover, .pr-number:hover {
        background-color: #007acc;
        color: white;
    }

    .pr-state.state-merged { color: #6f42c1; }
    .pr-state.state-closed { color: #dc3545; }
    .pr-state.state-open { color: #28a745; }

    footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid #dee2e6;
        text-align: center;
        color: #6c757d;
    }

    @media (max-width: 768px) {
        .container { padding: 10px; }
        .metrics-grid { grid-template-columns: 1fr 1fr; }
        .type-grid { grid-template-columns: 1fr 1fr; }
        .sprint-meta { flex-direction: column; }
        .issue-meta { flex-direction: column; align-items: flex-start; }
    }
`;

  public static generateMarkdownReport(
    data: SprintReportData,
    config: TemplateConfig
  ): string {
    return this.renderTemplate(this.MARKDOWN_TEMPLATE, data, config);
  }

  public static generateHTMLReport(
    data: SprintReportData,
    config: TemplateConfig
  ): string {
    const template = this.HTML_TEMPLATE.replace('{{>css}}', this.CSS_STYLES);
    return this.renderTemplate(template, data, config);
  }

  public static generateJSONReport(
    data: SprintReportData,
    _config: TemplateConfig
  ): string {
    return JSON.stringify(data, null, 2);
  }

  public static generateCSVReport(
    data: SprintReportData,
    _config: TemplateConfig
  ): string {
    const headers = [
      'Key',
      'Summary',
      'Status',
      'Assignee',
      'Type',
      'Priority',
      'Story Points',
      'Labels',
    ];
    const rows = [headers.join(',')];

    for (const issue of data.issues) {
      const row = [
        this.escapeCSV(issue.key),
        this.escapeCSV(issue.summary),
        this.escapeCSV(issue.status),
        this.escapeCSV(issue.assignee),
        this.escapeCSV(issue.issueType),
        this.escapeCSV(issue.priority),
        issue.storyPoints?.toString() || '',
        this.escapeCSV(issue.labels.join('; ')),
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  private static renderTemplate(
    template: string,
    data: SprintReportData,
    _config: TemplateConfig
  ): string {
    let rendered = template;

    // Simple template replacement (in production, use a proper template engine like Handlebars)
    rendered = rendered.replace(/\{\{sprint\.(\w+)\}\}/g, (_match, prop) => {
      const value = (data.sprint as any)[prop];
      return value !== undefined ? String(value) : '';
    });

    rendered = rendered.replace(/\{\{metrics\.(\w+)\}\}/g, (_match, prop) => {
      const value = (data.metrics as any)[prop];
      return value !== undefined ? String(value) : '';
    });

    rendered = rendered.replace(/\{\{generatedAt\}\}/g, data.generatedAt);

    // Handle conditional blocks (simplified)
    rendered = rendered.replace(
      /\{\{#if sprint\.goal\}\}(.*?)\{\{\/if\}\}/gs,
      (_match, content) => {
        return data.sprint.goal ? content : '';
      }
    );

    rendered = rendered.replace(
      /\{\{#if metrics\.velocityData\}\}(.*?)\{\{\/if\}\}/gs,
      (_match, content) => {
        return data.metrics.velocityData ? content : '';
      }
    );

    rendered = rendered.replace(
      /\{\{#if commits\}\}(.*?)\{\{\/if\}\}/gs,
      (_match, content) => {
        return data.commits && data.commits.length > 0 ? content : '';
      }
    );

    rendered = rendered.replace(
      /\{\{#if pullRequests\}\}(.*?)\{\{\/if\}\}/gs,
      (_match, content) => {
        return data.pullRequests && data.pullRequests.length > 0 ? content : '';
      }
    );

    // Handle each loops (simplified)
    rendered = this.handleEachLoop(rendered, 'issues', data.issues);
    rendered = this.handleEachLoop(rendered, 'commits', data.commits || []);
    rendered = this.handleEachLoop(
      rendered,
      'pullRequests',
      data.pullRequests || []
    );

    // Handle issue type breakdown
    if (data.metrics.issueTypeBreakdown) {
      const typeEntries = Object.entries(data.metrics.issueTypeBreakdown);
      rendered = this.handleKeyValueLoop(
        rendered,
        'metrics.issueTypeBreakdown',
        typeEntries
      );
    }

    return rendered;
  }

  private static handleEachLoop(
    template: string,
    arrayName: string,
    array: any[]
  ): string {
    const regex = new RegExp(
      `\\{\\{#each ${arrayName}\\}\\}(.*?)\\{\\{\/each\\}\\}`,
      'gs'
    );

    return template.replace(regex, (_match, content) => {
      return array
        .map(item => {
          let itemContent = content;

          // Replace item properties
          itemContent = itemContent.replace(
            /\{\{(\w+)\}\}/g,
            (_propMatch: string, prop: string) => {
              const value = item[prop];
              return value !== undefined ? String(value) : '';
            }
          );

          // Handle nested each loops (e.g., commits within commit groups)
          itemContent = itemContent.replace(
            /\{\{#each (\w+)\}\}(.*?)\{\{\/each\}\}/gs,
            (_nestedMatch: any, nestedArrayName: any, nestedContent: any) => {
              const nestedArray = item[nestedArrayName] || [];
              return nestedArray
                .map((nestedItem: any) => {
                  let nestedItemContent = nestedContent;
                  nestedItemContent = nestedItemContent.replace(
                    /\{\{(\w+)\}\}/g,
                    (_nestedPropMatch: string, nestedProp: string) => {
                      const nestedValue = nestedItem[nestedProp];
                      return nestedValue !== undefined
                        ? String(nestedValue)
                        : '';
                    }
                  );
                  return nestedItemContent;
                })
                .join('');
            }
          );

          return itemContent;
        })
        .join('');
    });
  }

  private static handleKeyValueLoop(
    template: string,
    objectPath: string,
    entries: [string, any][]
  ): string {
    const regex = new RegExp(
      `\\{\\{#each ${objectPath.replace('.', '\\.')}\\}\\}(.*?)\\{\\{\/each\\}\\}`,
      'gs'
    );

    return template.replace(regex, (_match, content) => {
      return entries
        .map(([key, value]) => {
          let itemContent = content;
          itemContent = itemContent.replace(/\{\{@key\}\}/g, key);
          itemContent = itemContent.replace(/\{\{this\}\}/g, String(value));
          return itemContent;
        })
        .join('');
    });
  }

  private static escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

// Helper functions for template data preparation
export class ReportDataHelper {
  public static prepareSprintReportData(
    sprint: SprintData,
    issues: Issue[],
    commits?: any[],
    pullRequests?: any[],
    velocityData?: any,
    burndownData?: any
  ): SprintReportData {
    const metrics = this.calculateSprintMetrics(
      issues,
      velocityData,
      burndownData
    );

    return {
      sprint,
      issues,
      commits,
      pullRequests,
      metrics,
      generatedAt: new Date().toISOString(),
    };
  }

  private static calculateSprintMetrics(
    issues: Issue[],
    velocityData?: any,
    burndownData?: any
  ): SprintReportData['metrics'] {
    const totalIssues = issues.length;
    const completedIssues = issues.filter(issue =>
      ['Done', 'Closed', 'Resolved'].includes(issue.status)
    ).length;
    const inProgressIssues = issues.filter(issue =>
      ['In Progress', 'In Review', 'Code Review', 'Testing'].includes(
        issue.status
      )
    ).length;
    const todoIssues = issues.filter(issue =>
      ['To Do', 'Open', 'New', 'Backlog'].includes(issue.status)
    ).length;

    const totalStoryPoints = issues
      .map(issue => issue.storyPoints || 0)
      .reduce((sum, points) => sum + points, 0);

    const completedStoryPoints = issues
      .filter(issue => ['Done', 'Closed', 'Resolved'].includes(issue.status))
      .map(issue => issue.storyPoints || 0)
      .reduce((sum, points) => sum + points, 0);

    const issueTypeBreakdown = issues.reduce(
      (acc, issue) => {
        acc[issue.issueType] = (acc[issue.issueType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalIssues,
      completedIssues,
      inProgressIssues,
      todoIssues,
      completionRate:
        totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0,
      totalStoryPoints,
      completedStoryPoints,
      storyPointsCompletionRate:
        totalStoryPoints > 0
          ? Math.round((completedStoryPoints / totalStoryPoints) * 100)
          : 0,
      issueTypeBreakdown,
      velocityData,
      burndownData,
    };
  }
}
