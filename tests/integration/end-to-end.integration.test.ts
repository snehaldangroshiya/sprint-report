// End-to-end integration tests for complete MCP server functionality

import { MCPServer } from '../../src/server/mcp-server';
import { createTestConfig } from '../setup';

// Mock external dependencies
jest.mock('../../src/clients/jira-client');
jest.mock('../../src/clients/github-client');
jest.mock('../../src/cache/cache-manager');
jest.mock('../../src/utils/rate-limiter');

const MockJiraClient = require('../../src/clients/jira-client').JiraClient;
const MockGitHubClient = require('../../src/clients/github-client').GitHubClient;
const MockCacheManager = require('../../src/cache/cache-manager').CacheManager;
const MockServiceRateLimiter = require('../../src/utils/rate-limiter').ServiceRateLimiter;

describe('End-to-End Integration Tests', () => {
  let server: MCPServer;
  let mockJiraClient: jest.Mocked<any>;
  let mockGitHubClient: jest.Mocked<any>;
  let mockCacheManager: jest.Mocked<any>;
  let mockRateLimiter: jest.Mocked<any>;

  beforeEach(async () => {
    // Setup comprehensive mocks with realistic data
    mockJiraClient = {
      validateConnection: jest.fn().mockResolvedValue({ valid: true, user: 'Test User' }),
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, latency: 100 }),
      getSprints: jest.fn().mockResolvedValue([
        {
          id: '42',
          name: 'Sprint 2024-Q1-02',
          state: 'ACTIVE',
          startDate: '2024-01-15T00:00:00Z',
          endDate: '2024-01-29T23:59:59Z',
          goal: 'Complete user authentication and implement dashboard features',
          boardId: 123
        }
      ]),
      getSprintIssues: jest.fn().mockResolvedValue([
        {
          key: 'AUTH-101',
          summary: 'Implement OAuth2 authentication flow',
          status: 'Done',
          assignee: 'Alice Developer',
          storyPoints: 8,
          priority: 'High',
          issueType: 'Story',
          created: '2024-01-15T09:00:00Z',
          updated: '2024-01-20T16:30:00Z',
          resolved: '2024-01-20T16:30:00Z',
          labels: ['backend', 'security', 'oauth'],
          fields: {
            summary: 'Implement OAuth2 authentication flow',
            status: { name: 'Done', statusCategory: { key: 'done' } },
            assignee: { displayName: 'Alice Developer' },
            customfield_10016: 8,
            priority: { name: 'High' },
            issuetype: { name: 'Story' },
            created: '2024-01-15T09:00:00Z',
            updated: '2024-01-20T16:30:00Z',
            resolutiondate: '2024-01-20T16:30:00Z',
            labels: ['backend', 'security', 'oauth']
          }
        },
        {
          key: 'DASH-102',
          summary: 'Create responsive dashboard layout',
          status: 'In Progress',
          assignee: 'Bob Designer',
          storyPoints: 5,
          priority: 'Medium',
          issueType: 'Story',
          created: '2024-01-16T10:00:00Z',
          updated: '2024-01-22T14:00:00Z',
          resolved: undefined,
          labels: ['frontend', 'ui', 'responsive'],
          fields: {
            summary: 'Create responsive dashboard layout',
            status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
            assignee: { displayName: 'Bob Designer' },
            customfield_10016: 5,
            priority: { name: 'Medium' },
            issuetype: { name: 'Story' },
            created: '2024-01-16T10:00:00Z',
            updated: '2024-01-22T14:00:00Z',
            labels: ['frontend', 'ui', 'responsive']
          }
        },
        {
          key: 'BUG-103',
          summary: 'Fix responsive layout issues on mobile',
          status: 'To Do',
          assignee: 'Charlie Tester',
          storyPoints: 2,
          priority: 'Low',
          issueType: 'Bug',
          created: '2024-01-17T11:00:00Z',
          updated: '2024-01-17T11:00:00Z',
          resolved: undefined,
          labels: ['frontend', 'mobile', 'bugfix'],
          fields: {
            summary: 'Fix responsive layout issues on mobile',
            status: { name: 'To Do', statusCategory: { key: 'new' } },
            assignee: { displayName: 'Charlie Tester' },
            customfield_10016: 2,
            priority: { name: 'Low' },
            issuetype: { name: 'Bug' },
            created: '2024-01-17T11:00:00Z',
            updated: '2024-01-17T11:00:00Z',
            labels: ['frontend', 'mobile', 'bugfix']
          }
        }
      ])
    };

    mockGitHubClient = {
      validateConnection: jest.fn().mockResolvedValue({ valid: true, user: 'testorg' }),
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, latency: 120 }),
      findCommitsWithJiraReferences: jest.fn().mockResolvedValue([
        {
          issueKey: 'AUTH-101',
          commits: [
            {
              sha: 'a1b2c3d4e5f6',
              message: 'AUTH-101: Implement OAuth2 provider configuration',
              author: { name: 'Alice Developer', email: 'alice@company.com', date: '2024-01-18T14:30:00Z' },
              url: 'https://github.com/company/project/commit/a1b2c3d4e5f6'
            },
            {
              sha: 'b2c3d4e5f6g7',
              message: 'AUTH-101: Add token validation middleware',
              author: { name: 'Alice Developer', email: 'alice@company.com', date: '2024-01-19T11:15:00Z' },
              url: 'https://github.com/company/project/commit/b2c3d4e5f6g7'
            },
            {
              sha: 'c3d4e5f6g7h8',
              message: 'AUTH-101: Implement logout endpoint',
              author: { name: 'Alice Developer', email: 'alice@company.com', date: '2024-01-20T15:45:00Z' },
              url: 'https://github.com/company/project/commit/c3d4e5f6g7h8'
            }
          ]
        },
        {
          issueKey: 'DASH-102',
          commits: [
            {
              sha: 'd4e5f6g7h8i9',
              message: 'DASH-102: Initial dashboard component structure',
              author: { name: 'Bob Designer', email: 'bob@company.com', date: '2024-01-21T10:00:00Z' },
              url: 'https://github.com/company/project/commit/d4e5f6g7h8i9'
            }
          ]
        }
      ]),
      findPullRequestsWithJiraReferences: jest.fn().mockResolvedValue([
        {
          issueKey: 'AUTH-101',
          prs: [
            {
              number: 156,
              title: 'AUTH-101: Complete OAuth2 authentication implementation',
              state: 'merged',
              author: 'Alice Developer',
              createdAt: '2024-01-18T12:00:00Z',
              mergedAt: '2024-01-20T16:30:00Z',
              url: 'https://github.com/company/project/pull/156'
            }
          ]
        },
        {
          issueKey: 'DASH-102',
          prs: [
            {
              number: 157,
              title: 'DASH-102: WIP - Responsive dashboard layout',
              state: 'open',
              author: 'Bob Designer',
              createdAt: '2024-01-21T09:30:00Z',
              mergedAt: undefined,
              url: 'https://github.com/company/project/pull/157'
            }
          ]
        }
      ])
    };

    mockCacheManager = {
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, latency: 25 }),
      cleanup: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockResolvedValue({
        hits: 245,
        misses: 83,
        keys: 67,
        memory: 2048,
        hitRate: 0.75
      })
    };

    mockRateLimiter = {
      destroy: jest.fn(),
      isAllowed: jest.fn().mockReturnValue(true)
    };

    MockJiraClient.mockImplementation(() => mockJiraClient);
    MockGitHubClient.mockImplementation(() => mockGitHubClient);
    MockCacheManager.mockImplementation(() => mockCacheManager);
    MockServiceRateLimiter.mockImplementation(() => mockRateLimiter);

    server = new MCPServer();
    await server.initialize();
  });

  afterEach(async () => {
    await server.shutdown();
    jest.clearAllMocks();
  });

  describe('Complete Sprint Reporting Workflow', () => {
    test('should execute full sprint report generation with all integrations', async () => {
      const toolRegistry = (server as any).toolRegistry;

      // Step 1: Health check to ensure all services are ready
      const healthResult = await toolRegistry.executeTool('health_check', {
        include_detailed_status: true,
        check_external_dependencies: true
      }, server.getContext());

      const healthData = JSON.parse(healthResult.content[0].text);
      expect(healthData.status).toBe('healthy');
      expect(healthData.services.jira.healthy).toBe(true);
      expect(healthData.services.github.healthy).toBe(true);
      expect(healthData.services.cache.healthy).toBe(true);

      // Step 2: Generate comprehensive sprint report
      const reportResult = await toolRegistry.executeTool('generate_sprint_report', {
        sprint_id: '42',
        github_owner: 'company',
        github_repo: 'project',
        format: 'json',
        include_commits: true,
        include_prs: true,
        include_velocity: false,
        include_burndown: false,
        theme: 'corporate'
      }, server.getContext());

      const reportData = JSON.parse(reportResult.content[0].text);

      // Verify sprint data integration
      expect(reportData.sprint).toEqual({
        id: '42',
        name: 'Sprint 2024-Q1-02',
        state: 'ACTIVE',
        startDate: '2024-01-15T00:00:00Z',
        endDate: '2024-01-29T23:59:59Z',
        goal: 'Complete user authentication and implement dashboard features'
      });

      // Verify issue data integration
      expect(reportData.issues).toHaveLength(3);
      expect(reportData.issues[0].key).toBe('AUTH-101');
      expect(reportData.issues[1].key).toBe('DASH-102');
      expect(reportData.issues[2].key).toBe('BUG-103');

      // Verify comprehensive metrics calculation
      expect(reportData.metrics).toEqual({
        totalIssues: 3,
        completedIssues: 1,
        inProgressIssues: 1,
        todoIssues: 1,
        completionRate: 33, // 1/3 * 100
        totalStoryPoints: 15, // 8 + 5 + 2
        completedStoryPoints: 8,
        storyPointsCompletionRate: 53, // 8/15 * 100
        issueTypeBreakdown: {
          'Story': 2,
          'Bug': 1
        },
        codeIntegrationRate: 0.67 // 2 issues with commits out of 3
      });

      // Verify GitHub commit integration
      expect(reportData.commits).toHaveLength(2);
      expect(reportData.commits[0].issueKey).toBe('AUTH-101');
      expect(reportData.commits[0].commits).toHaveLength(3);
      expect(reportData.commits[1].issueKey).toBe('DASH-102');
      expect(reportData.commits[1].commits).toHaveLength(1);

      // Verify GitHub PR integration
      expect(reportData.pullRequests).toHaveLength(2);
      expect(reportData.pullRequests[0].issueKey).toBe('AUTH-101');
      expect(reportData.pullRequests[0].prs[0].state).toBe('merged');
      expect(reportData.pullRequests[1].issueKey).toBe('DASH-102');
      expect(reportData.pullRequests[1].prs[0].state).toBe('open');

      // Verify timestamp
      expect(reportData.generatedAt).toBeDefined();
      expect(new Date(reportData.generatedAt)).toBeInstanceOf(Date);

      // Verify all service calls were made
      expect(mockJiraClient.getSprints).toHaveBeenCalledWith('42', 'active');
      expect(mockJiraClient.getSprintIssues).toHaveBeenCalledWith('42', undefined, 100);
      expect(mockGitHubClient.findCommitsWithJiraReferences).toHaveBeenCalledWith(
        'company',
        'project',
        ['AUTH-101', 'DASH-102', 'BUG-103'],
        undefined,
        undefined
      );
      expect(mockGitHubClient.findPullRequestsWithJiraReferences).toHaveBeenCalledWith(
        'company',
        'project',
        ['AUTH-101', 'DASH-102', 'BUG-103'],
        undefined,
        undefined
      );
    });

    test('should generate different report formats correctly', async () => {
      const toolRegistry = (server as any).toolRegistry;

      // Test Markdown format
      const markdownResult = await toolRegistry.executeTool('generate_sprint_report', {
        sprint_id: '42',
        format: 'markdown',
        include_commits: true,
        include_prs: true
      }, server.getContext());

      const markdownContent = markdownResult.content[0].text;
      expect(markdownContent).toContain('# Sprint Report: Sprint 2024-Q1-02');
      expect(markdownContent).toContain('## Sprint Overview');
      expect(markdownContent).toContain('## Sprint Metrics');
      expect(markdownContent).toContain('## Related Commits');
      expect(markdownContent).toContain('## Related Pull Requests');

      // Test HTML format
      const htmlResult = await toolRegistry.executeTool('generate_sprint_report', {
        sprint_id: '42',
        format: 'html',
        include_commits: true,
        include_prs: true,
        theme: 'corporate'
      }, server.getContext());

      const htmlContent = htmlResult.content[0].text;
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).toContain('<title>Sprint Report: Sprint 2024-Q1-02</title>');
      expect(htmlContent).toContain('<div class="metrics-grid">');
      expect(htmlContent).toContain('<style>');

      // Test CSV format
      const csvResult = await toolRegistry.executeTool('generate_sprint_report', {
        sprint_id: '42',
        format: 'csv'
      }, server.getContext());

      const csvContent = csvResult.content[0].text;
      expect(csvContent).toContain('Key,Summary,Status,Assignee,Type,Priority,Story Points,Labels');
      expect(csvContent).toContain('AUTH-101');
      expect(csvContent).toContain('DASH-102');
      expect(csvContent).toContain('BUG-103');
    });
  });

  describe('Error Recovery in Production Scenarios', () => {
    test('should handle Jira service outage gracefully', async () => {
      // Simulate Jira service outage
      mockJiraClient.getSprints.mockRejectedValue(new Error('Jira service unavailable'));
      mockJiraClient.getSprintIssues.mockRejectedValue(new Error('Jira service unavailable'));

      const toolRegistry = (server as any).toolRegistry;

      const result = await toolRegistry.executeTool('generate_sprint_report', {
        sprint_id: '42',
        format: 'markdown'
      }, server.getContext());

      // Should get fallback response
      expect(result.content[0].text).toContain('temporarily unavailable');
    });

    test('should continue with GitHub data when Jira is down', async () => {
      // Only Jira fails, GitHub works
      mockJiraClient.getSprints.mockRejectedValue(new Error('Jira timeout'));
      mockJiraClient.getSprintIssues.mockRejectedValue(new Error('Jira timeout'));

      const toolRegistry = (server as any).toolRegistry;

      // GitHub operations should still work
      const commitResult = await toolRegistry.executeTool('github_find_commits_with_jira_references', {
        owner: 'company',
        repo: 'project',
        issue_keys: ['AUTH-101', 'DASH-102']
      }, server.getContext());

      const commitData = JSON.parse(commitResult.content[0].text);
      expect(commitData).toHaveLength(2);
      expect(commitData[0].issueKey).toBe('AUTH-101');

      // Health check should show degraded state
      const healthResult = await toolRegistry.executeTool('health_check', {
        include_detailed_status: true
      }, server.getContext());

      const healthData = JSON.parse(healthResult.content[0].text);
      expect(healthData.status).toBe('degraded');
      expect(healthData.services.jira.healthy).toBe(false);
      expect(healthData.services.github.healthy).toBe(true);
    });

    test('should handle rate limiting gracefully', async () => {
      // Simulate rate limiting on first call, then success
      mockGitHubClient.findCommitsWithJiraReferences
        .mockRejectedValueOnce(new Error('API rate limit exceeded'))
        .mockResolvedValue([
          {
            issueKey: 'AUTH-101',
            commits: [{
              sha: 'abc123',
              message: 'AUTH-101: Fix after rate limit',
              author: { name: 'Developer', email: 'dev@test.com', date: '2024-01-20T10:00:00Z' },
              url: 'https://github.com/test/repo/commit/abc123'
            }]
          }
        ]);

      const toolRegistry = (server as any).toolRegistry;

      const result = await toolRegistry.executeTool('github_find_commits_with_jira_references', {
        owner: 'company',
        repo: 'project',
        issue_keys: ['AUTH-101']
      }, server.getContext());

      const commitData = JSON.parse(result.content[0].text);
      expect(commitData).toHaveLength(1);
      expect(commitData[0].commits[0].message).toBe('AUTH-101: Fix after rate limit');

      // Should have retried after rate limit
      expect(mockGitHubClient.findCommitsWithJiraReferences).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large sprint with many issues efficiently', async () => {
      // Setup large dataset
      const largeIssueSet = Array.from({ length: 100 }, (_, i) => ({
        key: `PERF-${1000 + i}`,
        summary: `Performance test issue ${i + 1}`,
        status: i < 70 ? 'Done' : i < 90 ? 'In Progress' : 'To Do',
        assignee: `Developer ${(i % 5) + 1}`,
        storyPoints: (i % 8) + 1,
        priority: ['High', 'Medium', 'Low'][i % 3],
        issueType: ['Story', 'Bug', 'Task'][i % 3],
        created: '2024-01-15T09:00:00Z',
        updated: '2024-01-20T16:30:00Z',
        resolved: i < 70 ? '2024-01-20T16:30:00Z' : undefined,
        labels: [`label${i % 3}`, `category${i % 4}`],
        fields: {
          summary: `Performance test issue ${i + 1}`,
          status: {
            name: i < 70 ? 'Done' : i < 90 ? 'In Progress' : 'To Do',
            statusCategory: { key: i < 70 ? 'done' : i < 90 ? 'indeterminate' : 'new' }
          },
          assignee: { displayName: `Developer ${(i % 5) + 1}` },
          customfield_10016: (i % 8) + 1,
          priority: { name: ['High', 'Medium', 'Low'][i % 3] },
          issuetype: { name: ['Story', 'Bug', 'Task'][i % 3] },
          created: '2024-01-15T09:00:00Z',
          updated: '2024-01-20T16:30:00Z',
          resolutiondate: i < 70 ? '2024-01-20T16:30:00Z' : undefined,
          labels: [`label${i % 3}`, `category${i % 4}`]
        }
      }));

      mockJiraClient.getSprintIssues.mockResolvedValue(largeIssueSet);

      const toolRegistry = (server as any).toolRegistry;

      const startTime = Date.now();
      const result = await toolRegistry.executeTool('generate_sprint_report', {
        sprint_id: '42',
        format: 'json',
        include_commits: false,
        include_prs: false
      }, server.getContext());
      const endTime = Date.now();

      const reportData = JSON.parse(result.content[0].text);

      // Verify large dataset handling
      expect(reportData.issues).toHaveLength(100);
      expect(reportData.metrics.totalIssues).toBe(100);
      expect(reportData.metrics.completedIssues).toBe(70);
      expect(reportData.metrics.inProgressIssues).toBe(20);
      expect(reportData.metrics.todoIssues).toBe(10);

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('should cache results for improved performance', async () => {
      const toolRegistry = (server as any).toolRegistry;

      // First call
      await toolRegistry.executeTool('get_sprint_metrics', {
        sprint_id: '42'
      }, server.getContext());

      // Second call should use cache (if implemented)
      await toolRegistry.executeTool('get_sprint_metrics', {
        sprint_id: '42'
      }, server.getContext());

      // Verify cache usage
      const cacheResult = await toolRegistry.executeTool('cache_stats', {
        include_detailed_breakdown: true
      }, server.getContext());

      const cacheStats = JSON.parse(cacheResult.content[0].text);
      expect(cacheStats.hits).toBeGreaterThan(0);
      expect(cacheStats.hitRate).toBeGreaterThan(0);
    });
  });

  describe('Server Lifecycle Management', () => {
    test('should maintain consistent state across operations', async () => {
      const toolRegistry = (server as any).toolRegistry;

      // Perform multiple operations
      const operations = [
        toolRegistry.executeTool('health_check', {}, server.getContext()),
        toolRegistry.executeTool('cache_stats', {}, server.getContext()),
        toolRegistry.executeTool('get_sprint_metrics', { sprint_id: '42' }, server.getContext())
      ];

      const results = await Promise.all(operations);

      // All operations should succeed
      results.forEach(result => {
        expect(result.content).toBeDefined();
        expect(result.content[0].text).toBeDefined();
      });

      // Server should remain in healthy state
      const finalHealthResult = await toolRegistry.executeTool('health_check', {}, server.getContext());
      const finalHealth = JSON.parse(finalHealthResult.content[0].text);
      expect(finalHealth.status).toBe('healthy');
    });

    test('should cleanup resources properly on shutdown', async () => {
      const initialHealthResult = await (server as any).toolRegistry.executeTool('health_check', {}, server.getContext());
      const initialHealth = JSON.parse(initialHealthResult.content[0].text);
      expect(initialHealth.status).toBe('healthy');

      // Shutdown server
      await server.shutdown();

      // Verify cleanup was called
      expect(mockCacheManager.cleanup).toHaveBeenCalled();
      expect(mockRateLimiter.destroy).toHaveBeenCalled();
    });
  });

  describe('Real-world Integration Scenarios', () => {
    test('should handle mixed success/failure scenarios', async () => {
      // Simulate realistic mixed scenario
      mockJiraClient.getSprintIssues.mockResolvedValue([
        // Partial issue data
        {
          key: 'MIXED-1',
          summary: 'Working issue',
          status: 'Done',
          assignee: 'Developer',
          storyPoints: 3,
          priority: 'Medium',
          issueType: 'Story',
          created: '2024-01-15T09:00:00Z',
          updated: '2024-01-20T16:30:00Z',
          resolved: '2024-01-20T16:30:00Z',
          labels: ['working'],
          fields: {
            summary: 'Working issue',
            status: { name: 'Done', statusCategory: { key: 'done' } },
            assignee: { displayName: 'Developer' },
            customfield_10016: 3,
            priority: { name: 'Medium' },
            issuetype: { name: 'Story' },
            created: '2024-01-15T09:00:00Z',
            updated: '2024-01-20T16:30:00Z',
            resolutiondate: '2024-01-20T16:30:00Z',
            labels: ['working']
          }
        }
      ]);

      // GitHub partially works
      mockGitHubClient.findCommitsWithJiraReferences.mockResolvedValue([
        {
          issueKey: 'MIXED-1',
          commits: [
            {
              sha: 'mixed123',
              message: 'MIXED-1: Implement feature',
              author: { name: 'Developer', email: 'dev@test.com', date: '2024-01-18T10:00:00Z' },
              url: 'https://github.com/test/repo/commit/mixed123'
            }
          ]
        }
      ]);

      // But PR lookup fails
      mockGitHubClient.findPullRequestsWithJiraReferences.mockRejectedValue(new Error('PR API temporarily unavailable'));

      const toolRegistry = (server as any).toolRegistry;

      const result = await toolRegistry.executeTool('generate_sprint_report', {
        sprint_id: '42',
        github_owner: 'company',
        github_repo: 'project',
        format: 'json',
        include_commits: true,
        include_prs: true
      }, server.getContext());

      const reportData = JSON.parse(result.content[0].text);

      // Should have issue and commit data
      expect(reportData.issues).toHaveLength(1);
      expect(reportData.commits).toHaveLength(1);
      expect(reportData.commits[0].commits).toHaveLength(1);

      // But no PR data due to failure
      expect(reportData.pullRequests).toBeUndefined();
    });

    test('should maintain service quality under load', async () => {
      const toolRegistry = (server as any).toolRegistry;

      // Simulate concurrent requests
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        toolRegistry.executeTool('get_sprint_metrics', {
          sprint_id: '42',
          include_velocity: false
        }, server.getContext())
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(concurrentRequests);
      const endTime = Date.now();

      // All requests should succeed
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults).toHaveLength(10);

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(2000);

      // Each result should be valid
      successfulResults.forEach(result => {
        const data = JSON.parse((result as any).value.content[0].text);
        expect(data.totalIssues).toBe(3);
        expect(data.completedIssues).toBe(1);
      });
    });
  });
});