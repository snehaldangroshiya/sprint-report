// Integration tests for template engine functionality

import { ReportTemplateEngine, ReportDataHelper, SprintReportData, TemplateConfig } from '../../src/templates/report-templates';
import { Issue, SprintData } from '../../src/types';

describe('Template Engine Integration Tests', () => {
  let mockSprintData: SprintData;
  let mockIssues: Issue[];
  let mockCommits: Array<{ issueKey: string; commits: any[] }>;
  let mockPullRequests: Array<{ issueKey: string; prs: any[] }>;

  beforeEach(() => {
    mockSprintData = {
      id: '123',
      name: 'Sprint 2024-Q1-01',
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-01-14T23:59:59Z',
      goal: 'Implement user authentication and basic dashboard',
      state: 'ACTIVE',
      boardId: 1
    };

    mockIssues = [
      {
        id: '10001',
        key: 'PROJ-101',
        summary: 'Implement OAuth2 authentication',
        status: 'Done',
        assignee: 'John Doe',
        assigneeAccountId: 'user123',
        storyPoints: 8,
        priority: 'High',
        issueType: 'Story',
        created: '2024-01-01T09:00:00Z',
        updated: '2024-01-05T16:30:00Z',
        resolved: '2024-01-05T16:30:00Z',
        labels: ['backend', 'security', 'oauth'],
        components: ['Authentication Service'],
        fixVersions: ['v1.2.0']
      },
      {
        id: '10002',
        key: 'PROJ-102',
        summary: 'Create user dashboard layout',
        status: 'In Progress',
        assignee: 'Jane Smith',
        assigneeAccountId: 'user456',
        storyPoints: 5,
        priority: 'Medium',
        issueType: 'Story',
        created: '2024-01-02T10:00:00Z',
        updated: '2024-01-06T14:00:00Z',
        resolved: undefined,
        labels: ['frontend', 'ui', 'react'],
        components: ['Web Frontend'],
        fixVersions: ['v1.2.0']
      },
      {
        id: '10003',
        key: 'PROJ-103',
        summary: 'Fix login button styling',
        status: 'To Do',
        assignee: 'Bob Wilson',
        assigneeAccountId: 'user789',
        storyPoints: 1,
        priority: 'Low',
        issueType: 'Bug',
        created: '2024-01-03T11:00:00Z',
        updated: '2024-01-03T11:00:00Z',
        resolved: undefined,
        labels: ['frontend', 'css', 'bugfix'],
        components: ['Web Frontend'],
        fixVersions: ['v1.2.0']
      }
    ];

    mockCommits = [
      {
        issueKey: 'PROJ-101',
        commits: [
          {
            sha: 'abc123def456',
            message: 'PROJ-101: Implement OAuth2 provider integration',
            author: 'John Doe',
            date: '2024-01-04T15:30:00Z',
            url: 'https://github.com/org/repo/commit/abc123def456'
          },
          {
            sha: 'def456ghi789',
            message: 'PROJ-101: Add token validation middleware',
            author: 'John Doe',
            date: '2024-01-05T10:15:00Z',
            url: 'https://github.com/org/repo/commit/def456ghi789'
          }
        ]
      },
      {
        issueKey: 'PROJ-102',
        commits: [
          {
            sha: 'ghi789jkl012',
            message: 'PROJ-102: Create dashboard component structure',
            author: 'Jane Smith',
            date: '2024-01-06T13:45:00Z',
            url: 'https://github.com/org/repo/commit/ghi789jkl012'
          }
        ]
      }
    ];

    mockPullRequests = [
      {
        issueKey: 'PROJ-101',
        prs: [
          {
            number: 42,
            title: 'PROJ-101: Implement OAuth2 authentication system',
            state: 'merged',
            author: 'John Doe',
            createdAt: '2024-01-04T12:00:00Z',
            mergedAt: '2024-01-05T16:00:00Z',
            url: 'https://github.com/org/repo/pull/42'
          }
        ]
      },
      {
        issueKey: 'PROJ-102',
        prs: [
          {
            number: 43,
            title: 'PROJ-102: WIP - User dashboard implementation',
            state: 'open',
            author: 'Jane Smith',
            createdAt: '2024-01-06T09:00:00Z',
            mergedAt: undefined,
            url: 'https://github.com/org/repo/pull/43'
          }
        ]
      }
    ];
  });

  describe('Report Data Preparation', () => {
    test('should prepare comprehensive sprint report data', () => {
      const reportData = ReportDataHelper.prepareSprintReportData(
        mockSprintData,
        mockIssues,
        mockCommits,
        mockPullRequests
      );

      expect(reportData.sprint).toEqual(mockSprintData);
      expect(reportData.issues).toHaveLength(3);
      expect(reportData.commits).toHaveLength(2);
      expect(reportData.pullRequests).toHaveLength(2);

      // Verify metrics calculation
      expect(reportData.metrics.totalIssues).toBe(3);
      expect(reportData.metrics.completedIssues).toBe(1);
      expect(reportData.metrics.inProgressIssues).toBe(1);
      expect(reportData.metrics.todoIssues).toBe(1);
      expect(reportData.metrics.completionRate).toBe(33); // 1/3 * 100, rounded
      expect(reportData.metrics.totalStoryPoints).toBe(14);
      expect(reportData.metrics.completedStoryPoints).toBe(8);
      expect(reportData.metrics.storyPointsCompletionRate).toBe(57); // 8/14 * 100, rounded

      // Verify issue type breakdown
      expect(reportData.metrics.issueTypeBreakdown).toEqual({
        'Story': 2,
        'Bug': 1
      });

      expect(reportData.generatedAt).toBeDefined();
      expect(new Date(reportData.generatedAt)).toBeInstanceOf(Date);
    });

    test('should calculate code integration rate correctly', () => {
      const reportData = ReportDataHelper.prepareSprintReportData(
        mockSprintData,
        mockIssues,
        mockCommits,
        mockPullRequests
      );

      // 2 issues have commits out of 3 total = 67% integration rate
      expect(reportData.metrics.codeIntegrationRate).toBeCloseTo(0.67, 2);
    });
  });

  describe('Markdown Template Generation', () => {
    test('should generate comprehensive markdown report', () => {
      const reportData = ReportDataHelper.prepareSprintReportData(
        mockSprintData,
        mockIssues,
        mockCommits,
        mockPullRequests
      );

      const config: TemplateConfig = {
        format: 'markdown',
        includeCommits: true,
        includePullRequests: true,
        includeVelocity: false,
        includeBurndown: false
      };

      const markdown = ReportTemplateEngine.generateMarkdownReport(reportData, config);

      // Verify header structure
      expect(markdown).toContain('# Sprint Report: Sprint 2024-Q1-01');

      // Verify sprint overview
      expect(markdown).toContain('## Sprint Overview');
      expect(markdown).toContain('- **Sprint ID**: 123');
      expect(markdown).toContain('- **Start Date**: 2024-01-01T00:00:00Z');
      expect(markdown).toContain('- **End Date**: 2024-01-14T23:59:59Z');
      expect(markdown).toContain('- **Sprint Goal**: Implement user authentication and basic dashboard');

      // Verify metrics section
      expect(markdown).toContain('## Sprint Metrics');
      expect(markdown).toContain('- **Total Issues**: 3');
      expect(markdown).toContain('- **Completed Issues**: 1');
      expect(markdown).toContain('- **In Progress**: 1');
      expect(markdown).toContain('- **To Do**: 1');
      expect(markdown).toContain('- **Completion Rate**: 33%');

      // Verify story points
      expect(markdown).toContain('### Story Points');
      expect(markdown).toContain('- **Total Points**: 14');
      expect(markdown).toContain('- **Completed Points**: 8');
      expect(markdown).toContain('- **Points Completion Rate**: 57%');

      // Verify issue breakdown by type
      expect(markdown).toContain('## Issue Breakdown by Type');
      expect(markdown).toContain('- **Story**: 2 issues');
      expect(markdown).toContain('- **Bug**: 1 issues');

      // Verify issues summary
      expect(markdown).toContain('## Issues Summary');
      expect(markdown).toContain('### PROJ-101: Implement OAuth2 authentication');
      expect(markdown).toContain('- **Status**: Done');
      expect(markdown).toContain('- **Assignee**: John Doe');
      expect(markdown).toContain('- **Story Points**: 8');

      // Verify commit integration
      expect(markdown).toContain('## Related Commits');
      expect(markdown).toContain('### PROJ-101');
      expect(markdown).toContain('- [abc123def456](https://github.com/org/repo/commit/abc123def456): PROJ-101: Implement OAuth2 provider integration');

      // Verify PR integration
      expect(markdown).toContain('## Related Pull Requests');
      expect(markdown).toContain('- [#42](https://github.com/org/repo/pull/42): PROJ-101: Implement OAuth2 authentication system - merged by John Doe');

      // Verify generation timestamp
      expect(markdown).toMatch(/Report generated on \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('should handle missing optional data gracefully', () => {
      const reportData = ReportDataHelper.prepareSprintReportData(
        { ...mockSprintData, goal: undefined },
        mockIssues
      );

      const config: TemplateConfig = {
        format: 'markdown',
        includeCommits: false,
        includePullRequests: false
      };

      const markdown = ReportTemplateEngine.generateMarkdownReport(reportData, config);

      expect(markdown).not.toContain('Sprint Goal');
      expect(markdown).not.toContain('## Related Commits');
      expect(markdown).not.toContain('## Related Pull Requests');
      expect(markdown).toContain('No commit data available');
      expect(markdown).toContain('No pull request data available');
    });
  });

  describe('HTML Template Generation', () => {
    test('should generate comprehensive HTML report', () => {
      const reportData = ReportDataHelper.prepareSprintReportData(
        mockSprintData,
        mockIssues,
        mockCommits,
        mockPullRequests
      );

      const config: TemplateConfig = {
        format: 'html',
        includeCommits: true,
        includePullRequests: true,
        theme: 'corporate'
      };

      const html = ReportTemplateEngine.generateHTMLReport(reportData, config);

      // Verify HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<title>Sprint Report: Sprint 2024-Q1-01</title>');
      expect(html).toContain('<style>');

      // Verify CSS inclusion
      expect(html).toContain('font-family: -apple-system');
      expect(html).toContain('.metrics-grid');
      expect(html).toContain('.metric-card');

      // Verify content structure
      expect(html).toContain('<h1>Sprint Report: Sprint 2024-Q1-01</h1>');
      expect(html).toContain('<div class="metrics-overview">');
      expect(html).toContain('<div class="metric-card">');
      expect(html).toContain('<h3>3</h3>'); // Total issues
      expect(html).toContain('<p>Total Issues</p>');

      // Verify progress bars
      expect(html).toContain('<div class="progress-bar">');
      expect(html).toContain('style="width: 33%"'); // Completion rate

      // Verify issue cards
      expect(html).toContain('<div class="issue-card">');
      expect(html).toContain('<h3>PROJ-101: Implement OAuth2 authentication</h3>');
      expect(html).toContain('<span class="status">Done</span>');

      // Verify commits section
      expect(html).toContain('<section class="commits-section">');
      expect(html).toContain('<h2>Related Commits</h2>');
      expect(html).toContain('<a href="https://github.com/org/repo/commit/abc123def456"');

      // Verify PRs section
      expect(html).toContain('<section class="prs-section">');
      expect(html).toContain('<h2>Related Pull Requests</h2>');
      expect(html).toContain('<a href="https://github.com/org/repo/pull/42"');

      // Verify responsive design
      expect(html).toContain('@media (max-width: 768px)');
    });

    test('should apply different themes correctly', () => {
      const reportData = ReportDataHelper.prepareSprintReportData(
        mockSprintData,
        mockIssues
      );

      const config: TemplateConfig = {
        format: 'html',
        theme: 'dark'
      };

      const html = ReportTemplateEngine.generateHTMLReport(reportData, config);

      // Should contain all standard styling regardless of theme
      expect(html).toContain('<style>');
      expect(html).toContain('color: #333');
      expect(html).toContain('background-color: #f5f7fa');
    });
  });

  describe('JSON Template Generation', () => {
    test('should generate structured JSON report', () => {
      const reportData = ReportDataHelper.prepareSprintReportData(
        mockSprintData,
        mockIssues,
        mockCommits,
        mockPullRequests
      );

      const config: TemplateConfig = { format: 'json' };

      const jsonString = ReportTemplateEngine.generateJSONReport(reportData, config);
      const parsedData = JSON.parse(jsonString);

      // Verify complete data structure
      expect(parsedData).toHaveProperty('sprint');
      expect(parsedData).toHaveProperty('issues');
      expect(parsedData).toHaveProperty('commits');
      expect(parsedData).toHaveProperty('pullRequests');
      expect(parsedData).toHaveProperty('metrics');
      expect(parsedData).toHaveProperty('generatedAt');

      // Verify data integrity
      expect(parsedData.sprint.id).toBe('123');
      expect(parsedData.issues).toHaveLength(3);
      expect(parsedData.commits).toHaveLength(2);
      expect(parsedData.pullRequests).toHaveLength(2);

      // Verify metrics structure
      expect(parsedData.metrics).toHaveProperty('totalIssues');
      expect(parsedData.metrics).toHaveProperty('completedIssues');
      expect(parsedData.metrics).toHaveProperty('issueTypeBreakdown');
      expect(parsedData.metrics).toHaveProperty('codeIntegrationRate');
    });
  });

  describe('CSV Template Generation', () => {
    test('should generate CSV format for data export', () => {
      const reportData = ReportDataHelper.prepareSprintReportData(
        mockSprintData,
        mockIssues
      );

      const config: TemplateConfig = { format: 'csv' };

      const csv = ReportTemplateEngine.generateCSVReport(reportData, config);
      const lines = csv.split('\n');

      // Verify header
      expect(lines[0]).toBe('Key,Summary,Status,Assignee,Type,Priority,Story Points,Labels');

      // Verify data rows
      expect(lines).toHaveLength(4); // Header + 3 issues
      expect(lines[1]).toContain('PROJ-101');
      expect(lines[1]).toContain('Implement OAuth2 authentication');
      expect(lines[1]).toContain('Done');
      expect(lines[1]).toContain('John Doe');
      expect(lines[1]).toContain('Story');
      expect(lines[1]).toContain('High');
      expect(lines[1]).toContain('8');

      // Verify CSV escaping for complex data
      expect(lines[1]).toContain('"backend; security; oauth"'); // Proper array joining and quoting
    });

    test('should handle CSV escaping correctly', () => {
      const issueWithCommas = {
        ...mockIssues[0],
        summary: 'Fix issue with "quotes", commas, and\nnewlines',
        labels: ['label with spaces', 'another,with,commas']
      };

      const reportData = ReportDataHelper.prepareSprintReportData(
        mockSprintData,
        [issueWithCommas]
      );

      const config: TemplateConfig = { format: 'csv' };
      const csv = ReportTemplateEngine.generateCSVReport(reportData, config);

      // Should properly escape quotes and commas
      expect(csv).toContain('"Fix issue with ""quotes"", commas, and\nnewlines"');
      expect(csv).toContain('"label with spaces; another,with,commas"');
    });
  });

  describe('Template Engine Error Handling', () => {
    test('should handle missing template gracefully', () => {
      const engine = new ReportTemplateEngine();

      expect(() => {
        engine.generateReport('nonexistent-template', {} as SprintReportData);
      }).toThrow('Template not found: nonexistent-template');
    });

    test('should handle malformed data gracefully', () => {
      const malformedData = {
        sprint: null,
        issues: undefined,
        metrics: {}
      } as any;

      const config: TemplateConfig = { format: 'markdown' };

      // Should not throw, but handle gracefully
      expect(() => {
        ReportTemplateEngine.generateMarkdownReport(malformedData, config);
      }).not.toThrow();
    });
  });

  describe('Template Customization', () => {
    test('should support custom template registration', () => {
      const engine = new ReportTemplateEngine();

      const customTemplate = {
        name: 'custom-summary',
        format: 'markdown' as const,
        generate: (data: SprintReportData) => `Custom: ${data.sprint.name} - ${data.metrics.totalIssues} issues`
      };

      engine.registerTemplate(customTemplate);

      const reportData = ReportDataHelper.prepareSprintReportData(mockSprintData, mockIssues);
      const result = engine.generateReport('custom-summary', reportData);

      expect(result).toBe('Custom: Sprint 2024-Q1-01 - 3 issues');
    });

    test('should list available templates', () => {
      const engine = new ReportTemplateEngine();
      const templates = engine.getAvailableTemplates();

      expect(templates).toContain('sprint-summary-md');
      expect(templates).toContain('sprint-summary-html');
      expect(templates).toContain('sprint-data-json');
      expect(templates).toContain('sprint-issues-csv');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large datasets efficiently', () => {
      // Create a large dataset
      const largeIssueSet: Issue[] = Array.from({ length: 1000 }, (_, i) => ({
        ...mockIssues[0],
        id: `${10000 + i}`,
        key: `PROJ-${1000 + i}`,
        summary: `Generated issue ${i + 1}`
      }));

      const startTime = Date.now();

      const reportData = ReportDataHelper.prepareSprintReportData(
        mockSprintData,
        largeIssueSet
      );

      const config: TemplateConfig = { format: 'json' };
      const jsonReport = ReportTemplateEngine.generateJSONReport(reportData, config);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process 1000 issues in reasonable time (< 1 second)
      expect(processingTime).toBeLessThan(1000);
      expect(reportData.metrics.totalIssues).toBe(1000);
      expect(JSON.parse(jsonReport).issues).toHaveLength(1000);
    });

    test('should maintain memory efficiency with large commits/PR datasets', () => {
      const largeCommitSet = Array.from({ length: 100 }, (_, i) => ({
        issueKey: `PROJ-${i % 10}`,
        commits: Array.from({ length: 20 }, (_, j) => ({
          sha: `commit${i}-${j}`,
          message: `Commit ${j} for issue ${i}`,
          author: 'Developer',
          date: '2024-01-01T00:00:00Z',
          url: `https://github.com/org/repo/commit/commit${i}-${j}`
        }))
      }));

      const reportData = ReportDataHelper.prepareSprintReportData(
        mockSprintData,
        mockIssues.slice(0, 10), // 10 issues
        largeCommitSet // 100 commit groups * 20 commits = 2000 total commits
      );

      const config: TemplateConfig = { format: 'markdown', includeCommits: true };
      const markdown = ReportTemplateEngine.generateMarkdownReport(reportData, config);

      // Should handle large commit dataset without issues
      expect(reportData.commits).toHaveLength(100);
      expect(markdown).toContain('## Related Commits');
      expect(markdown.length).toBeGreaterThan(10000); // Should be substantial content
    });
  });
});