// Jest test setup and global configuration

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Default test environment variables if not set
const testDefaults = {
  JIRA_BASE_URL: 'https://test.atlassian.net',
  JIRA_EMAIL: 'test@example.com',
  JIRA_API_TOKEN: 'test-token',
  GITHUB_TOKEN: 'test-github-token',
  GITHUB_API_URL: 'https://api.github.com',
  LOG_LEVEL: 'error', // Reduce logging noise in tests
  CACHE_DEFAULT_TTL: '300',
  CACHE_MAX_MEMORY_SIZE: '100',
  REDIS_ENABLED: 'false', // Disable Redis in tests by default
};

// Apply test defaults
for (const [key, value] of Object.entries(testDefaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeEach(() => {
  // Restore console methods for each test
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterEach(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Global teardown for async resources
afterAll(async () => {
  // Give time for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Custom Jest matchers
expect.extend({
  toBeValidISODate(received: string) {
    const date = new Date(received);
    const isValid = !isNaN(date.getTime()) && received === date.toISOString();

    return {
      message: () => `expected ${received} to be a valid ISO date string`,
      pass: isValid,
    };
  },

  toBeValidJiraKey(received: string) {
    const jiraKeyPattern = /^[A-Z][A-Z0-9_]*-\d+$/;
    const isValid = jiraKeyPattern.test(received);

    return {
      message: () => `expected ${received} to be a valid Jira issue key (format: ABC-123)`,
      pass: isValid,
    };
  },

  toBeValidGitHubSha(received: string) {
    const shaPattern = /^[a-f0-9]{40}$/;
    const isValid = shaPattern.test(received);

    return {
      message: () => `expected ${received} to be a valid GitHub commit SHA (40 hex characters)`,
      pass: isValid,
    };
  },
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidISODate(): R;
      toBeValidJiraKey(): R;
      toBeValidGitHubSha(): R;
    }
  }
}

// Mock implementations for external services
export const mockJiraResponse = {
  getSprints: (boardId: string) => ({
    values: [
      {
        id: 1,
        name: 'Test Sprint 1',
        state: 'closed',
        startDate: '2023-01-01T00:00:00.000Z',
        endDate: '2023-01-15T00:00:00.000Z',
        goal: 'Test sprint goal',
        originBoardId: parseInt(boardId),
      },
    ],
  }),

  getSprintIssues: (_sprintId: string) => ({
    issues: [
      {
        id: 'test-issue-1',
        key: 'TEST-123',
        fields: {
          summary: 'Test issue',
          status: { name: 'Done' },
          assignee: { displayName: 'Test User', accountId: 'test-account' },
          priority: { name: 'High' },
          issuetype: { name: 'Story' },
          created: '2023-01-01T00:00:00.000Z',
          updated: '2023-01-02T00:00:00.000Z',
          labels: ['test'],
          components: [{ name: 'Frontend' }],
          fixVersions: [{ name: '1.0.0' }],
          customfield_10016: 5, // Story points
        },
      },
    ],
  }),
};

export const mockGitHubResponse = {
  getCommits: (_owner: string, _repo: string) => [
    {
      sha: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
      commit: {
        message: 'feat: implement user authentication (TEST-123)',
        author: {
          name: 'Test Author',
          email: 'test@example.com',
          date: '2023-01-02T10:00:00Z',
        },
        committer: {
          name: 'Test Author',
          email: 'test@example.com',
          date: '2023-01-02T10:00:00Z',
        },
      },
      author: {
        login: 'testuser',
        id: 123,
        avatar_url: 'https://github.com/testuser.avatar',
      },
      html_url: 'https://github.com/test/repo/commit/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
      stats: {
        additions: 10,
        deletions: 5,
        total: 15,
      },
    },
  ],

  getPullRequests: (_owner: string, _repo: string) => [
    {
      id: 1,
      number: 123,
      title: 'Add user authentication',
      body: 'Implements authentication flow for TEST-123',
      state: 'closed',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      closed_at: '2023-01-02T00:00:00Z',
      merged_at: '2023-01-02T00:00:00Z',
      user: {
        login: 'testuser',
        id: 123,
      },
      assignees: [],
      requested_reviewers: [],
      labels: [],
      milestone: null,
      head: {
        ref: 'feature/auth',
        sha: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
      },
      base: {
        ref: 'main',
        sha: 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1',
      },
      additions: 100,
      deletions: 20,
      changed_files: 5,
      commits: 3,
      html_url: 'https://github.com/test/repo/pull/123',
    },
  ],
};

// Helper functions for tests
export const createTestConfig = () => ({
  nodeEnv: 'test',
  logging: {
    level: 'error' as const,
    enableApiLogging: false,
  },
  jira: {
    baseUrl: 'https://test.atlassian.net',
    email: 'test@example.com',
    apiToken: 'test-token',
    timeout: 5000,
  },
  github: {
    token: 'test-github-token',
    apiUrl: 'https://api.github.com',
    timeout: 5000,
    userAgent: 'jira-github-reporter/1.0.0',
  },
  cache: {
    defaultTtl: 300,
    maxMemorySize: 100,
  },
  redis: {
    enabled: false,
    host: 'localhost',
    port: 6379,
    password: undefined,
    db: 0,
  },
  server: {
    port: 3000,
    host: '127.0.0.1',
  },
});

export const waitForAsync = (ms: number = 10) =>
  new Promise(resolve => setTimeout(resolve, ms));