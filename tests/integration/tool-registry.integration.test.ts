// Integration tests for enhanced tool registry functionality

import { ToolRegistry } from '../../src/server/tool-registry';
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

describe('ToolRegistry Integration Tests', () => {
  let server: MCPServer;
  let registry: ToolRegistry;
  let mockJiraClient: jest.Mocked<any>;
  let mockGitHubClient: jest.Mocked<any>;
  let mockCacheManager: jest.Mocked<any>;
  let mockRateLimiter: jest.Mocked<any>;

  beforeEach(async () => {
    // Setup comprehensive mocks
    mockJiraClient = {
      validateConnection: jest.fn().mockResolvedValue({ valid: true, user: 'Test User' }),
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, latency: 100 }),
      getSprints: jest.fn().mockResolvedValue([
        { id: '1', name: 'Sprint 1', state: 'ACTIVE', startDate: '2023-01-01', endDate: '2023-01-14' }
      ]),
      getSprintIssues: jest.fn().mockResolvedValue([
        {
          key: 'TEST-1',
          summary: 'Test issue',
          status: 'Done',
          assignee: 'testuser',
          storyPoints: 5,
          fields: {
            status: { name: 'Done', statusCategory: { key: 'done' } },
            summary: 'Test issue',
            assignee: { displayName: 'Test User' },
            customfield_10016: 5, // story points
            priority: { name: 'High' },
            issuetype: { name: 'Story' },
            created: '2023-01-01T00:00:00Z',
            updated: '2023-01-05T00:00:00Z',
            resolutiondate: '2023-01-05T00:00:00Z',
            labels: ['backend', 'api']
          }
        }
      ]),
      getIssueDetails: jest.fn().mockResolvedValue({
        key: 'TEST-1',
        fields: {
          summary: 'Test issue details',
          status: { name: 'Done' },
          assignee: { displayName: 'Test User' }
        }
      }),
      searchIssues: jest.fn().mockResolvedValue([])
    };

    mockGitHubClient = {
      validateConnection: jest.fn().mockResolvedValue({ valid: true, user: 'testuser' }),
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, latency: 150 }),
      getCommits: jest.fn().mockResolvedValue([
        {
          sha: 'abc123',
          message: 'Fix TEST-1: Implement feature',
          author: { name: 'Developer', email: 'dev@test.com', date: '2023-01-03T10:00:00Z' },
          url: 'https://github.com/test/repo/commit/abc123'
        }
      ]),
      getPullRequests: jest.fn().mockResolvedValue([
        {
          number: 1,
          title: 'Fix TEST-1: New feature',
          state: 'merged',
          author: 'developer',
          createdAt: '2023-01-02T00:00:00Z',
          mergedAt: '2023-01-04T00:00:00Z',
          url: 'https://github.com/test/repo/pull/1'
        }
      ]),
      findCommitsWithJiraReferences: jest.fn().mockResolvedValue([
        {
          issueKey: 'TEST-1',
          commits: [
            {
              sha: 'abc123',
              message: 'Fix TEST-1: Implement feature',
              author: { name: 'Developer', email: 'dev@test.com', date: '2023-01-03T10:00:00Z' },
              url: 'https://github.com/test/repo/commit/abc123'
            }
          ]
        }
      ]),
      findPullRequestsWithJiraReferences: jest.fn().mockResolvedValue([
        {
          issueKey: 'TEST-1',
          prs: [
            {
              number: 1,
              title: 'Fix TEST-1: New feature',
              state: 'merged',
              author: 'developer',
              createdAt: '2023-01-02T00:00:00Z',
              mergedAt: '2023-01-04T00:00:00Z',
              url: 'https://github.com/test/repo/pull/1'
            }
          ]
        }
      ]),
      searchCommitsByMessage: jest.fn().mockResolvedValue([]),
      getAllPullRequests: jest.fn().mockResolvedValue([])
    };

    mockCacheManager = {
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, latency: 50 }),
      cleanup: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockResolvedValue({
        hits: 100,
        misses: 50,
        keys: 25,
        memory: 1024,
        hitRate: 0.67
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
    registry = (server as any).toolRegistry;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Enhanced Sprint Reporting', () => {
    test('should generate comprehensive sprint report with all data sources', async () => {
      const args = {
        sprint_id: '1',
        github_owner: 'testorg',
        github_repo: 'testrepo',
        format: 'markdown',
        include_commits: true,
        include_prs: true,
        include_velocity: false,
        include_burndown: false
      };

      const result = await registry.executeTool('generate_sprint_report', args, {
        jiraClient: mockJiraClient,
        githubClient: mockGitHubClient,
        cacheManager: mockCacheManager,
        rateLimiter: mockRateLimiter,
        logger: { logError: jest.fn(), logInfo: jest.fn() }
      } as any);

      expect(result.content[0].text).toContain('Sprint Report: Sprint 1');
      expect(result.content[0].text).toContain('TEST-1');
      expect(result.content[0].text).toContain('Related Commits');
      expect(result.content[0].text).toContain('Related Pull Requests');

      // Verify all methods were called
      expect(mockJiraClient.getSprints).toHaveBeenCalledWith('1', 'active');
      expect(mockJiraClient.getSprintIssues).toHaveBeenCalledWith('1', undefined, 100);
      expect(mockGitHubClient.findCommitsWithJiraReferences).toHaveBeenCalled();
      expect(mockGitHubClient.findPullRequestsWithJiraReferences).toHaveBeenCalled();
    });

    test('should generate JSON format report', async () => {
      const args = {
        sprint_id: '1',
        format: 'json',
        include_commits: false,
        include_prs: false
      };

      const result = await registry.executeTool('generate_sprint_report', args, {
        jiraClient: mockJiraClient,
        githubClient: mockGitHubClient,
        cacheManager: mockCacheManager,
        rateLimiter: mockRateLimiter,
        logger: { logError: jest.fn(), logInfo: jest.fn() }
      } as any);

      const reportData = JSON.parse(result.content[0].text);
      expect(reportData).toHaveProperty('sprint');
      expect(reportData).toHaveProperty('issues');
      expect(reportData).toHaveProperty('metrics');
      expect(reportData.sprint.name).toBe('Sprint 1');
    });

    test('should handle missing GitHub data gracefully', async () => {
      const args = {
        sprint_id: '1',
        include_commits: true,
        include_prs: true
      };

      // Simulate GitHub client not available
      const contextWithoutGithub = {
        jiraClient: mockJiraClient,
        githubClient: null,
        cacheManager: mockCacheManager,
        rateLimiter: mockRateLimiter,
        logger: { logError: jest.fn(), logInfo: jest.fn() }
      };

      const result = await registry.executeTool('generate_sprint_report', args, contextWithoutGithub as any);

      expect(result.content[0].text).toContain('Sprint Report: Sprint 1');
      expect(result.content[0].text).toContain('No commit data available');
      expect(result.content[0].text).toContain('No pull request data available');
    });
  });

  describe('Sprint Metrics Calculation', () => {
    test('should calculate comprehensive sprint metrics', async () => {
      const args = {
        sprint_id: '1',
        include_velocity: false,
        include_burndown: false
      };

      const result = await registry.executeTool('get_sprint_metrics', args, {
        jiraClient: mockJiraClient,
        githubClient: mockGitHubClient,
        cacheManager: mockCacheManager,
        rateLimiter: mockRateLimiter,
        logger: { logError: jest.fn(), logInfo: jest.fn() }
      } as any);

      const metrics = JSON.parse(result.content[0].text);

      expect(metrics).toHaveProperty('totalIssues', 1);
      expect(metrics).toHaveProperty('completedIssues', 1);
      expect(metrics).toHaveProperty('completionRate', 100);
      expect(metrics).toHaveProperty('totalStoryPoints', 5);
      expect(metrics).toHaveProperty('completedStoryPoints', 5);
      expect(metrics).toHaveProperty('issueTypeBreakdown');
    });
  });

  describe('GitHub Integration', () => {
    test('should find commits with Jira references', async () => {
      const args = {
        owner: 'testorg',
        repo: 'testrepo',
        issue_keys: ['TEST-1', 'TEST-2'],
        max_commits_per_issue: 10
      };

      const result = await registry.executeTool('github_find_commits_with_jira_references', args, {
        jiraClient: mockJiraClient,
        githubClient: mockGitHubClient,
        cacheManager: mockCacheManager,
        rateLimiter: mockRateLimiter,
        logger: { logError: jest.fn(), logInfo: jest.fn() }
      } as any);

      const commitData = JSON.parse(result.content[0].text);
      expect(commitData).toHaveLength(1);
      expect(commitData[0].issueKey).toBe('TEST-1');
      expect(commitData[0].commits).toHaveLength(1);
      expect(commitData[0].commits[0].sha).toBe('abc123');
    });

    test('should get pull requests with filters', async () => {
      const args = {
        owner: 'testorg',
        repo: 'testrepo',
        state: 'all',
        per_page: 50
      };

      const result = await registry.executeTool('github_get_pull_requests', args, {
        jiraClient: mockJiraClient,
        githubClient: mockGitHubClient,
        cacheManager: mockCacheManager,
        rateLimiter: mockRateLimiter,
        logger: { logError: jest.fn(), logInfo: jest.fn() }
      } as any);

      const prs = JSON.parse(result.content[0].text);
      expect(prs).toHaveLength(1);
      expect(prs[0].number).toBe(1);
      expect(prs[0].state).toBe('merged');
    });
  });

  describe('Health and Monitoring', () => {
    test('should provide comprehensive health check', async () => {
      const args = {
        include_detailed_status: true,
        check_external_dependencies: true
      };

      const result = await registry.executeTool('health_check', args, {
        jiraClient: mockJiraClient,
        githubClient: mockGitHubClient,
        cacheManager: mockCacheManager,
        rateLimiter: mockRateLimiter,
        logger: { logError: jest.fn(), logInfo: jest.fn() }
      } as any);

      const health = JSON.parse(result.content[0].text);

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('services');
      expect(health.services).toHaveProperty('jira');
      expect(health.services).toHaveProperty('github');
      expect(health.services).toHaveProperty('cache');

      expect(mockJiraClient.healthCheck).toHaveBeenCalled();
      expect(mockGitHubClient.healthCheck).toHaveBeenCalled();
      expect(mockCacheManager.healthCheck).toHaveBeenCalled();
    });

    test('should provide cache statistics', async () => {
      const args = {
        include_detailed_breakdown: true,
        reset_stats: false
      };

      const result = await registry.executeTool('cache_stats', args, {
        jiraClient: mockJiraClient,
        githubClient: mockGitHubClient,
        cacheManager: mockCacheManager,
        rateLimiter: mockRateLimiter,
        logger: { logError: jest.fn(), logInfo: jest.fn() }
      } as any);

      const stats = JSON.parse(result.content[0].text);

      expect(stats).toHaveProperty('hits', 100);
      expect(stats).toHaveProperty('misses', 50);
      expect(stats).toHaveProperty('hitRate', 0.67);
      expect(stats).toHaveProperty('keys', 25);
      expect(stats).toHaveProperty('memory', 1024);

      expect(mockCacheManager.getStats).toHaveBeenCalled();
    });
  });

  describe('Error Recovery Integration', () => {
    test('should handle Jira service failures gracefully', async () => {
      mockJiraClient.getSprints.mockRejectedValue(new Error('Jira service unavailable'));

      const args = { sprint_id: '1', format: 'markdown' };

      const result = await registry.executeTool('generate_sprint_report', args, {
        jiraClient: mockJiraClient,
        githubClient: mockGitHubClient,
        cacheManager: mockCacheManager,
        rateLimiter: mockRateLimiter,
        logger: { logError: jest.fn(), logInfo: jest.fn() }
      } as any);

      // Should return fallback message due to error recovery
      expect(result.content[0].text).toContain('temporarily unavailable');
    });

    test('should handle GitHub service failures gracefully', async () => {
      mockGitHubClient.findCommitsWithJiraReferences.mockRejectedValue(new Error('GitHub API error'));

      const args = {
        sprint_id: '1',
        github_owner: 'testorg',
        github_repo: 'testrepo',
        include_commits: true
      };

      const result = await registry.executeTool('generate_sprint_report', args, {
        jiraClient: mockJiraClient,
        githubClient: mockGitHubClient,
        cacheManager: mockCacheManager,
        rateLimiter: mockRateLimiter,
        logger: { logError: jest.fn(), logInfo: jest.fn() }
      } as any);

      // Should still generate report but without GitHub data
      expect(result.content[0].text).toContain('Sprint Report: Sprint 1');
    });

    test('should validate input parameters strictly', async () => {
      const invalidArgs = {
        sprint_id: 'invalid-id', // Should be numeric
        format: 'invalid-format' // Should be one of allowed formats
      };

      await expect(
        registry.executeTool('generate_sprint_report', invalidArgs, {
          jiraClient: mockJiraClient,
          githubClient: mockGitHubClient,
          cacheManager: mockCacheManager,
          rateLimiter: mockRateLimiter,
          logger: { logError: jest.fn(), logInfo: jest.fn() }
        } as any)
      ).rejects.toThrow();
    });
  });

  describe('Template Engine Integration', () => {
    test('should generate HTML format with proper styling', async () => {
      const args = {
        sprint_id: '1',
        format: 'html',
        theme: 'corporate'
      };

      const result = await registry.executeTool('generate_sprint_report', args, {
        jiraClient: mockJiraClient,
        githubClient: mockGitHubClient,
        cacheManager: mockCacheManager,
        rateLimiter: mockRateLimiter,
        logger: { logError: jest.fn(), logInfo: jest.fn() }
      } as any);

      expect(result.content[0].text).toContain('<!DOCTYPE html>');
      expect(result.content[0].text).toContain('<style>');
      expect(result.content[0].text).toContain('Sprint Report: Sprint 1');
      expect(result.content[0].text).toContain('class="metrics-grid"');
    });

    test('should generate CSV format for data export', async () => {
      const args = {
        sprint_id: '1',
        format: 'csv'
      };

      const result = await registry.executeTool('generate_sprint_report', args, {
        jiraClient: mockJiraClient,
        githubClient: mockGitHubClient,
        cacheManager: mockCacheManager,
        rateLimiter: mockRateLimiter,
        logger: { logError: jest.fn(), logInfo: jest.fn() }
      } as any);

      const csvData = result.content[0].text;
      expect(csvData).toContain('Key,Summary,Status,Assignee,Type,Priority,Story Points,Labels');
      expect(csvData).toContain('TEST-1');
      expect(csvData).toContain('Test issue');
    });
  });

  describe('Cross-Service Data Integration', () => {
    test('should correlate Jira issues with GitHub commits and PRs', async () => {
      // This test verifies the complete data integration pipeline
      const args = {
        sprint_id: '1',
        github_owner: 'testorg',
        github_repo: 'testrepo',
        format: 'json',
        include_commits: true,
        include_prs: true
      };

      const result = await registry.executeTool('generate_sprint_report', args, {
        jiraClient: mockJiraClient,
        githubClient: mockGitHubClient,
        cacheManager: mockCacheManager,
        rateLimiter: mockRateLimiter,
        logger: { logError: jest.fn(), logInfo: jest.fn() }
      } as any);

      const reportData = JSON.parse(result.content[0].text);

      // Verify sprint data
      expect(reportData.sprint).toEqual({
        id: '1',
        name: 'Sprint 1',
        state: 'ACTIVE',
        startDate: '2023-01-01',
        endDate: '2023-01-14'
      });

      // Verify issue data
      expect(reportData.issues).toHaveLength(1);
      expect(reportData.issues[0].key).toBe('TEST-1');

      // Verify metrics calculation
      expect(reportData.metrics.totalIssues).toBe(1);
      expect(reportData.metrics.completedIssues).toBe(1);
      expect(reportData.metrics.completionRate).toBe(100);
      expect(reportData.metrics.codeIntegrationRate).toBeGreaterThan(0);

      // Verify GitHub integration
      expect(reportData.commits).toHaveLength(1);
      expect(reportData.commits[0].issueKey).toBe('TEST-1');
      expect(reportData.pullRequests).toHaveLength(1);
      expect(reportData.pullRequests[0].issueKey).toBe('TEST-1');
    });
  });
});