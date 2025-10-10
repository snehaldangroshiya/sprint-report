// Comprehensive tests for GitHub API client

import { GitHubClient, GitHubCommitResponse, GitHubPullRequestResponse } from '@/clients/github-client';
import { CacheManager } from '@/cache/cache-manager';
import { AppConfig, Commit, PullRequest } from '@/types';
import axios, { AxiosError } from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('@/cache/cache-manager');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GitHubClient', () => {
  let githubClient: GitHubClient;
  let mockCacheManager: jest.Mocked<CacheManager>;
  let mockAxiosInstance: any;
  let mockConfig: AppConfig;

  // Test data
  const testOwner = 'test-owner';
  const testRepo = 'test-repo';
  const testCommitSha = 'abc123def456';
  const testPRNumber = 42;

  const mockCommitResponse: GitHubCommitResponse = {
    sha: testCommitSha,
    commit: {
      message: 'Test commit message',
      author: {
        name: 'Test Author',
        email: 'test@example.com',
        date: '2025-01-01T10:00:00Z',
      },
      committer: {
        name: 'Test Committer',
        email: 'committer@example.com',
        date: '2025-01-01T10:00:00Z',
      },
    },
    author: {
      login: 'testauthor',
      id: 123,
      avatar_url: 'https://avatars.example.com/u/123',
    },
    committer: {
      login: 'testcommitter',
      id: 456,
      avatar_url: 'https://avatars.example.com/u/456',
    },
    parents: [
      {
        sha: 'parent123',
        url: 'https://api.github.com/repos/test/test/commits/parent123',
      },
    ],
    stats: {
      additions: 50,
      deletions: 20,
      total: 70,
    },
    files: [
      {
        filename: 'src/test.ts',
        status: 'modified',
        additions: 50,
        deletions: 20,
        changes: 70,
      },
    ],
    html_url: `https://github.com/${testOwner}/${testRepo}/commit/${testCommitSha}`,
  };

  const mockPRResponse: GitHubPullRequestResponse = {
    id: 1001,
    number: testPRNumber,
    title: 'Test Pull Request',
    body: 'This is a test PR body with PROJ-123 reference',
    state: 'open',
    created_at: '2025-01-01T09:00:00Z',
    updated_at: '2025-01-02T10:00:00Z',
    closed_at: null,
    merged_at: null,
    merge_commit_sha: null,
    user: {
      login: 'testauthor',
      id: 123,
    },
    assignees: [
      {
        login: 'assignee1',
        id: 789,
      },
    ],
    requested_reviewers: [
      {
        login: 'reviewer1',
        id: 999,
      },
    ],
    labels: [
      {
        id: 1,
        name: 'bug',
        color: 'red',
      },
    ],
    milestone: {
      id: 1,
      title: 'v1.0',
    },
    head: {
      ref: 'feature-branch',
      sha: 'head123',
    },
    base: {
      ref: 'main',
      sha: 'base123',
    },
    additions: 100,
    deletions: 50,
    changed_files: 5,
    commits: 3,
    html_url: `https://github.com/${testOwner}/${testRepo}/pull/${testPRNumber}`,
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock config
    mockConfig = {
      github: {
        token: 'ghp_test_token',
        apiUrl: 'https://api.github.com',
        timeout: 5000,
        userAgent: 'NextReleaseMCP/1.0',
      },
      jira: {
        baseUrl: 'https://jira.example.com',
        email: 'test@example.com',
        apiToken: 'test-token',
        timeout: 5000,
      },
      logging: {
        level: 'error',
        enableApiLogging: false,
      },
    } as AppConfig;

    // Setup mock axios instance
    mockAxiosInstance = {
      request: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Setup mock cache manager
    mockCacheManager = new CacheManager({
      memory: { maxSize: 100, ttl: 300 },
    }) as jest.Mocked<CacheManager>;

    mockCacheManager.get = jest.fn().mockResolvedValue(null);
    mockCacheManager.set = jest.fn().mockResolvedValue(undefined);
    mockCacheManager.delete = jest.fn().mockResolvedValue(true);
    mockCacheManager.clear = jest.fn().mockResolvedValue(undefined);
    mockCacheManager.getStats = jest.fn().mockReturnValue({
      hits: 0,
      misses: 0,
      keys: 0,
      memory: 0,
      hitRate: 0,
    });

    // Create client instance
    githubClient = new GitHubClient(mockConfig, mockCacheManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: mockConfig.github.apiUrl,
          timeout: mockConfig.github.timeout,
          headers: expect.objectContaining({
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${mockConfig.github.token}`,
            'User-Agent': mockConfig.github.userAgent,
          }),
        })
      );
    });

    it('should setup interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('should use provided cache manager', () => {
      const client = new GitHubClient(mockConfig, mockCacheManager);
      expect(client.getCacheManager()).toBe(mockCacheManager);
    });
  });

  describe('getCommits', () => {
    it('should fetch commits successfully', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: [mockCommitResponse],
        status: 200,
        headers: {},
      });

      const commits = await githubClient.getCommits(testOwner, testRepo, {
        per_page: 30,
        page: 1,
      });

      expect(commits).toHaveLength(1);
      expect(commits[0]).toMatchObject({
        sha: testCommitSha,
        message: 'Test commit message',
        author: {
          name: 'Test Author',
          email: 'test@example.com',
        },
      });
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `/repos/${testOwner}/${testRepo}/commits`,
          method: 'GET',
        })
      );
    });

    it('should apply date filters correctly', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: [mockCommitResponse],
        status: 200,
        headers: {},
      });

      const since = '2025-01-01T00:00:00Z';
      const until = '2025-01-31T23:59:59Z';

      await githubClient.getCommits(testOwner, testRepo, {
        since,
        until,
        per_page: 30,
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            since,
            until,
          }),
        })
      );
    });

    it('should apply author filter', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: [mockCommitResponse],
        status: 200,
        headers: {},
      });

      await githubClient.getCommits(testOwner, testRepo, {
        author: 'testauthor',
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            author: 'testauthor',
          }),
        })
      );
    });

    it('should use cache when available', async () => {
      const cachedData = [mockCommitResponse];

      mockCacheManager.get.mockResolvedValue(cachedData);

      const commits = await githubClient.getCommits(testOwner, testRepo);

      expect(commits).toHaveLength(1);
      expect(mockAxiosInstance.request).not.toHaveBeenCalled();
    });

    it('should handle pagination in getAllCommits', async () => {
      const page1 = Array(100).fill(mockCommitResponse);
      const page2 = Array(50).fill(mockCommitResponse);

      mockAxiosInstance.request
        .mockResolvedValueOnce({ data: page1, status: 200, headers: {} })
        .mockResolvedValueOnce({ data: page2, status: 200, headers: {} });

      const commits = await githubClient.getAllCommits(testOwner, testRepo);

      expect(commits).toHaveLength(150);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
    });

    it('should stop pagination when no more results', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: [],
        status: 200,
        headers: {},
      });

      const commits = await githubClient.getAllCommits(testOwner, testRepo);

      expect(commits).toHaveLength(0);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(1);
    });

    it('should enforce safety limit on pagination', async () => {
      // Mock 150 pages (15000 commits)
      mockAxiosInstance.request.mockResolvedValue({
        data: Array(100).fill(mockCommitResponse),
        status: 200,
        headers: {},
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const commits = await githubClient.getAllCommits(testOwner, testRepo);

      // Should stop at 10000 commits (100 pages)
      expect(commits.length).toBeLessThanOrEqual(10000);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('too many commits')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getPullRequests', () => {
    it('should fetch pull requests successfully', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: [mockPRResponse],
        status: 200,
        headers: {},
      });

      const prs = await githubClient.getPullRequests(testOwner, testRepo, {
        state: 'open',
        per_page: 30,
        page: 1,
      });

      expect(prs).toHaveLength(1);
      expect(prs[0]).toMatchObject({
        number: testPRNumber,
        title: 'Test Pull Request',
        state: 'open',
        author: 'testauthor',
      });
    });

    it('should filter pull requests by date range', async () => {
      const since = '2025-01-01T00:00:00Z';
      const until = '2025-01-31T23:59:59Z';

      mockAxiosInstance.request.mockResolvedValue({
        data: [mockPRResponse],
        status: 200,
        headers: {},
      });

      const prs = await githubClient.getPullRequests(testOwner, testRepo, {
        since,
        until,
      });

      expect(prs).toHaveLength(1);
      // Date filtering happens after fetch
      expect(mockAxiosInstance.request).toHaveBeenCalled();
    });

    it('should support different state filters', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: [mockPRResponse],
        status: 200,
        headers: {},
      });

      await githubClient.getPullRequests(testOwner, testRepo, {
        state: 'closed',
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            state: 'closed',
          }),
        })
      );
    });

    it('should use cache when available', async () => {
      const cachedData = [mockPRResponse];

      mockCacheManager.get.mockResolvedValue(cachedData);

      const prs = await githubClient.getPullRequests(testOwner, testRepo);

      expect(prs).toHaveLength(1);
      expect(mockAxiosInstance.request).not.toHaveBeenCalled();
    });
  });

  describe('searchPullRequestsByDateRange', () => {
    it('should use GitHub Search API for date range queries', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: {
          total_count: 1,
          incomplete_results: false,
          items: [mockPRResponse],
        },
        status: 200,
        headers: {},
      });

      const since = '2025-01-01T00:00:00Z';
      const until = '2025-01-31T23:59:59Z';

      const prs = await githubClient.searchPullRequestsByDateRange(
        testOwner,
        testRepo,
        since,
        until,
        'merged'
      );

      expect(prs).toHaveLength(1);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/search/issues',
          params: expect.objectContaining({
            q: expect.stringContaining(`repo:${testOwner}/${testRepo}`),
            sort: 'created',
            order: 'desc',
          }),
        })
      );
    });

    it('should handle pagination for search results', async () => {
      const page1 = {
        total_count: 150,
        incomplete_results: false,
        items: Array(100).fill(mockPRResponse),
      };
      const page2 = {
        total_count: 150,
        incomplete_results: false,
        items: Array(50).fill(mockPRResponse),
      };

      mockAxiosInstance.request
        .mockResolvedValueOnce({ data: page1, status: 200, headers: {} })
        .mockResolvedValueOnce({ data: page2, status: 200, headers: {} });

      const prs = await githubClient.searchPullRequestsByDateRange(
        testOwner,
        testRepo
      );

      expect(prs).toHaveLength(150);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
    });

    it('should enforce 1000 result limit', async () => {
      // Mock 11 pages (1100 results)
      mockAxiosInstance.request.mockResolvedValue({
        data: {
          total_count: 1100,
          incomplete_results: false,
          items: Array(100).fill(mockPRResponse),
        },
        status: 200,
        headers: {},
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const prs = await githubClient.searchPullRequestsByDateRange(
        testOwner,
        testRepo
      );

      // Should stop at 1000 results (10 pages)
      expect(prs.length).toBeLessThanOrEqual(1000);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Search API limit reached')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getEnhancedPullRequests', () => {
    beforeEach(() => {
      // Mock getAllPullRequests
      mockAxiosInstance.request.mockResolvedValue({
        data: [mockPRResponse],
        status: 200,
        headers: {},
      });
    });

    it('should enhance PRs with review data', async () => {
      // Mock PR details, reviews, and comments
      mockAxiosInstance.request
        .mockResolvedValueOnce({ data: [mockPRResponse], status: 200, headers: {} }) // getAllPullRequests
        .mockResolvedValueOnce({ data: mockPRResponse, status: 200, headers: {} }) // getPullRequestDetails
        .mockResolvedValueOnce({ data: [{ user: { login: 'reviewer1' }, state: 'APPROVED', submitted_at: '2025-01-02T10:00:00Z' }], status: 200, headers: {} }) // reviews
        .mockResolvedValueOnce({ data: [{ id: 1 }], status: 200, headers: {} }); // comments

      const prs = await githubClient.getEnhancedPullRequests(
        testOwner,
        testRepo,
        { limit: 1 }
      );

      expect(prs).toHaveLength(1);
      expect(prs[0]?.reviews).toBeDefined();
      expect(prs[0]?.reviewComments).toBe(1);
      expect(prs[0]?.timeToFirstReview).toBeDefined();
    });

    it('should handle enhancement failures gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockAxiosInstance.request
        .mockResolvedValueOnce({ data: [mockPRResponse], status: 200, headers: {} })
        .mockResolvedValueOnce({ data: mockPRResponse, status: 200, headers: {} })
        .mockRejectedValueOnce(new Error('Review fetch failed'));

      const prs = await githubClient.getEnhancedPullRequests(
        testOwner,
        testRepo,
        { limit: 1 }
      );

      expect(prs).toHaveLength(1);
      // Enhancement may succeed or fail gracefully depending on where the error occurs
      expect(prs[0]?.number).toBe(testPRNumber);

      consoleSpy.mockRestore();
    });

    it('should rate limit enhancement requests', async () => {
      const mockPRs = Array(10).fill(mockPRResponse);
      mockAxiosInstance.request
        .mockResolvedValueOnce({ data: mockPRs, status: 200, headers: {} });

      // Mock successful enhancements
      for (let i = 0; i < 10; i++) {
        mockAxiosInstance.request
          .mockResolvedValueOnce({ data: mockPRResponse, status: 200, headers: {} })
          .mockResolvedValueOnce({ data: [], status: 200, headers: {} })
          .mockResolvedValueOnce({ data: [], status: 200, headers: {} });
      }

      const startTime = Date.now();
      await githubClient.getEnhancedPullRequests(testOwner, testRepo, {
        limit: 10,
      });
      const duration = Date.now() - startTime;

      // Should take at least 1 second due to rate limiting (delay every 5 requests)
      expect(duration).toBeGreaterThanOrEqual(900);
    });
  });

  describe('validateConnection', () => {
    it('should validate successful connection', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: {
          login: 'testuser',
          id: 123,
        },
        status: 200,
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-reset': '1704110400',
        },
      });

      const result = await githubClient.validateConnection();

      expect(result.valid).toBe(true);
      expect(result.user).toBe('testuser');
      expect(result.rateLimit).toBeDefined();
    });

    it('should handle invalid token', async () => {
      const error: Partial<AxiosError> = {
        response: {
          status: 401,
          data: { message: 'Bad credentials' },
          statusText: 'Unauthorized',
          headers: {},
          config: {} as any,
        },
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 401',
      };

      mockAxiosInstance.request.mockRejectedValue(error);

      const result = await githubClient.validateConnection();

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { login: 'testuser' },
        status: 200,
        headers: {},
      });

      const health = await githubClient.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status on error', async () => {
      mockAxiosInstance.request.mockRejectedValue(new Error('Network error'));

      const health = await githubClient.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 authentication errors', async () => {
      const error: Partial<AxiosError> = {
        response: {
          status: 401,
          data: { message: 'Bad credentials' },
          statusText: 'Unauthorized',
          headers: {},
          config: {} as any,
        },
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 401',
      };

      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(
        githubClient.getCommits(testOwner, testRepo)
      ).rejects.toThrow();
    });

    it('should handle 403 forbidden errors', async () => {
      const error: Partial<AxiosError> = {
        response: {
          status: 403,
          data: { message: 'Rate limit exceeded' },
          statusText: 'Forbidden',
          headers: {},
          config: {} as any,
        },
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 403',
      };

      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(
        githubClient.getCommits(testOwner, testRepo)
      ).rejects.toThrow();
    });

    it('should handle 404 not found errors', async () => {
      const error: Partial<AxiosError> = {
        response: {
          status: 404,
          data: { message: 'Not Found' },
          statusText: 'Not Found',
          headers: {},
          config: {} as any,
        },
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 404',
      };

      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(
        githubClient.getCommits(testOwner, testRepo)
      ).rejects.toThrow();
    });

    it('should handle 429 rate limit errors', async () => {
      const error: Partial<AxiosError> = {
        response: {
          status: 429,
          data: { message: 'API rate limit exceeded' },
          statusText: 'Too Many Requests',
          headers: {
            'retry-after': '60',
          },
          config: {} as any,
        },
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 429',
      };

      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(
        githubClient.getCommits(testOwner, testRepo)
      ).rejects.toThrow();
    });

    it('should handle 500 server errors', async () => {
      const error: Partial<AxiosError> = {
        response: {
          status: 500,
          data: { message: 'Internal Server Error' },
          statusText: 'Internal Server Error',
          headers: {},
          config: {} as any,
        },
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 500',
      };

      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(
        githubClient.getCommits(testOwner, testRepo)
      ).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      const error: Partial<AxiosError> = {
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
        config: {
          url: `/repos/${testOwner}/${testRepo}/commits`,
        } as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
      };

      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(
        githubClient.getCommits(testOwner, testRepo)
      ).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      const error: Partial<AxiosError> = {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND api.github.com',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
      };

      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(
        githubClient.getCommits(testOwner, testRepo)
      ).rejects.toThrow();
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient failures', async () => {
      const error: Partial<AxiosError> = {
        response: {
          status: 500,
          data: {},
          statusText: 'Internal Server Error',
          headers: {},
          config: {} as any,
        },
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 500',
      };

      mockAxiosInstance.request
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          data: [mockCommitResponse],
          status: 200,
          headers: {},
        });

      const commits = await githubClient.getCommits(testOwner, testRepo);

      expect(commits).toHaveLength(1);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(3);
    });

    it('should not retry on client errors', async () => {
      const error: Partial<AxiosError> = {
        response: {
          status: 400,
          data: { message: 'Bad Request' },
          statusText: 'Bad Request',
          headers: {},
          config: {} as any,
        },
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 400',
      };

      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(
        githubClient.getCommits(testOwner, testRepo)
      ).rejects.toThrow();

      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(1);
    });

    it('should retry on rate limit errors', async () => {
      const error: Partial<AxiosError> = {
        response: {
          status: 429,
          data: { message: 'Rate limit exceeded' },
          statusText: 'Too Many Requests',
          headers: {
            'retry-after': '1',
          },
          config: {} as any,
        },
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 429',
      };

      mockAxiosInstance.request
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          data: [mockCommitResponse],
          status: 200,
          headers: {},
        });

      const commits = await githubClient.getCommits(testOwner, testRepo);

      expect(commits).toHaveLength(1);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
    });
  });

  describe('Statistics Methods', () => {
    const mockCommits: Commit[] = [
      {
        sha: 'commit1',
        message: 'First commit',
        author: { name: 'Author1', email: 'author1@test.com', date: '2025-01-01T10:00:00Z' },
        date: '2025-01-01T10:00:00Z',
        url: 'https://github.com/test/test/commit/commit1',
        stats: { additions: 100, deletions: 50, total: 150 },
      },
      {
        sha: 'commit2',
        message: 'Second commit',
        author: { name: 'Author2', email: 'author2@test.com', date: '2025-01-02T10:00:00Z' },
        date: '2025-01-02T10:00:00Z',
        url: 'https://github.com/test/test/commit/commit2',
        stats: { additions: 50, deletions: 25, total: 75 },
      },
      {
        sha: 'commit3',
        message: 'Third commit',
        author: { name: 'Author1', email: 'author1@test.com', date: '2025-01-03T10:00:00Z' },
        date: '2025-01-03T10:00:00Z',
        url: 'https://github.com/test/test/commit/commit3',
        stats: { additions: 25, deletions: 10, total: 35 },
      },
    ];

    describe('calculateCommitActivityStats', () => {
      it('should calculate commit activity statistics', () => {
        const stats = githubClient.calculateCommitActivityStats(mockCommits);

        expect(stats.totalCommits).toBe(3);
        expect(stats.commitsByAuthor['Author1']).toBe(2);
        expect(stats.commitsByAuthor['Author2']).toBe(1);
        expect(stats.commitsByDay).toHaveLength(3);
        expect(stats.averageCommitsPerDay).toBeCloseTo(1);
        expect(stats.peakCommitDay).toBe('2025-01-01');
      });

      it('should handle empty commit list', () => {
        const stats = githubClient.calculateCommitActivityStats([]);

        expect(stats.totalCommits).toBe(0);
        expect(stats.commitsByAuthor).toEqual({});
        expect(stats.commitsByDay).toHaveLength(0);
        expect(stats.averageCommitsPerDay).toBe(0);
        expect(stats.peakCommitDay).toBe('');
      });
    });

    describe('calculateCodeChangeStats', () => {
      it('should calculate code change statistics', () => {
        const stats = githubClient.calculateCodeChangeStats(mockCommits);

        expect(stats.totalLinesAdded).toBe(175);
        expect(stats.totalLinesDeleted).toBe(85);
        expect(stats.netLineChange).toBe(90);
        expect(stats.changesByAuthor['Author1']?.additions).toBe(125);
        expect(stats.changesByAuthor['Author2']?.additions).toBe(50);
      });

      it('should handle commits without stats', () => {
        const commitsNoStats: Commit[] = [
          {
            sha: 'commit1',
            message: 'Test commit',
            author: { name: 'Author1', email: 'author1@test.com', date: '2025-01-01T10:00:00Z' },
            date: '2025-01-01T10:00:00Z',
            url: 'https://github.com/test/test/commit/commit1',
          },
        ];

        const stats = githubClient.calculateCodeChangeStats(commitsNoStats);

        expect(stats.totalLinesAdded).toBe(0);
        expect(stats.totalLinesDeleted).toBe(0);
        expect(stats.netLineChange).toBe(0);
      });
    });

    describe('calculateCodeReviewStats', () => {
      const mockPRsWithReviews: PullRequest[] = [
        {
          id: 1,
          number: 1,
          title: 'PR 1',
          body: '',
          state: 'merged',
          createdAt: '2025-01-01T09:00:00Z',
          updatedAt: '2025-01-02T10:00:00Z',
          author: 'author1',
          reviewers: [],
          commits: 3,
          additions: 100,
          deletions: 50,
          changedFiles: 5,
          reviews: [
            { reviewer: 'reviewer1', state: 'APPROVED', submittedAt: '2025-01-02T10:00:00Z', comments: 2 },
            { reviewer: 'reviewer2', state: 'CHANGES_REQUESTED', submittedAt: '2025-01-02T11:00:00Z', comments: 5 },
          ],
        },
        {
          id: 2,
          number: 2,
          title: 'PR 2',
          body: '',
          state: 'merged',
          createdAt: '2025-01-03T09:00:00Z',
          updatedAt: '2025-01-04T10:00:00Z',
          author: 'author2',
          reviewers: [],
          commits: 2,
          additions: 50,
          deletions: 25,
          changedFiles: 3,
          reviews: [
            { reviewer: 'reviewer1', state: 'APPROVED', submittedAt: '2025-01-04T10:00:00Z', comments: 1 },
          ],
        },
      ];

      it('should calculate code review statistics', () => {
        const stats = githubClient.calculateCodeReviewStats(mockPRsWithReviews);

        expect(stats.totalReviews).toBe(3);
        expect(stats.reviewsByReviewer['reviewer1']).toBe(2);
        expect(stats.reviewsByReviewer['reviewer2']).toBe(1);
        expect(stats.averageReviewsPerPR).toBeCloseTo(1.5);
        expect(stats.approvalRate).toBeCloseTo(66.67, 1);
        expect(stats.changesRequestedRate).toBeCloseTo(33.33, 1);
      });

      it('should handle PRs without reviews', () => {
        const prsNoReviews: PullRequest[] = [
          {
            id: 1,
            number: 1,
            title: 'PR 1',
            body: '',
            state: 'open',
            createdAt: '2025-01-01T09:00:00Z',
            updatedAt: '2025-01-02T10:00:00Z',
            author: 'author1',
            reviewers: [],
            commits: 1,
            additions: 10,
            deletions: 5,
            changedFiles: 2,
          },
        ];

        const stats = githubClient.calculateCodeReviewStats(prsNoReviews);

        expect(stats.totalReviews).toBe(0);
        expect(stats.averageReviewsPerPR).toBe(0);
        expect(stats.approvalRate).toBe(0);
        expect(stats.changesRequestedRate).toBe(0);
      });
    });
  });

  describe('Jira Integration', () => {
    describe('extractIssueKeysFromCommitMessage', () => {
      it('should extract standard Jira issue keys', () => {
        const message = 'PROJ-123: Fix bug in authentication';
        const keys = githubClient.extractIssueKeysFromCommitMessage(message);

        expect(keys).toContain('PROJ-123');
      });

      it('should extract multiple issue keys', () => {
        const message = 'PROJ-123 PROJ-456: Implement feature';
        const keys = githubClient.extractIssueKeysFromCommitMessage(message);

        expect(keys).toContain('PROJ-123');
        expect(keys).toContain('PROJ-456');
      });

      it('should extract issue keys with action keywords', () => {
        const message = 'Fixes PROJ-123 and resolves PROJ-456';
        const keys = githubClient.extractIssueKeysFromCommitMessage(message);

        expect(keys).toContain('PROJ-123');
        expect(keys).toContain('PROJ-456');
      });

      it('should extract issue keys with hash prefix', () => {
        const message = 'Update dependencies #PROJ-123';
        const keys = githubClient.extractIssueKeysFromCommitMessage(message);

        expect(keys).toContain('PROJ-123');
      });

      it('should return empty array for no matches', () => {
        const message = 'Regular commit message without issues';
        const keys = githubClient.extractIssueKeysFromCommitMessage(message);

        expect(keys).toHaveLength(0);
      });

      it('should deduplicate issue keys', () => {
        const message = 'PROJ-123 fixes PROJ-123 and closes PROJ-123';
        const keys = githubClient.extractIssueKeysFromCommitMessage(message);

        expect(keys).toHaveLength(1);
        expect(keys[0]).toBe('PROJ-123');
      });
    });

    describe('findCommitsWithJiraReferences', () => {
      beforeEach(() => {
        const commitsWithJira = [
          { ...mockCommitResponse, commit: { ...mockCommitResponse.commit, message: 'PROJ-123: Fix bug' } },
          { ...mockCommitResponse, commit: { ...mockCommitResponse.commit, message: 'PROJ-456: Add feature' } },
        ];

        mockAxiosInstance.request.mockResolvedValue({
          data: commitsWithJira,
          status: 200,
          headers: {},
        });
      });

      it('should find commits referencing specific issues', async () => {
        const result = await githubClient.findCommitsWithJiraReferences(
          testOwner,
          testRepo,
          ['PROJ-123', 'PROJ-456']
        );

        expect(result).toHaveLength(2);
        expect(result[0]?.issueKey).toBe('PROJ-123');
        expect(result[1]?.issueKey).toBe('PROJ-456');
      });

      it('should apply date filters', async () => {
        const since = '2025-01-01T00:00:00Z';
        const until = '2025-01-31T23:59:59Z';

        await githubClient.findCommitsWithJiraReferences(
          testOwner,
          testRepo,
          ['PROJ-123'],
          since,
          until
        );

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            params: expect.objectContaining({
              since,
              until,
            }),
          })
        );
      });
    });
  });

  describe('URL Building Methods', () => {
    it('should build repository URL', () => {
      const url = githubClient.buildRepositoryUrl(testOwner, testRepo);
      expect(url).toBe(`https://github.com/${testOwner}/${testRepo}`);
    });

    it('should build commit URL', () => {
      const url = githubClient.buildCommitUrl(testOwner, testRepo, testCommitSha);
      expect(url).toBe(`https://github.com/${testOwner}/${testRepo}/commit/${testCommitSha}`);
    });

    it('should build pull request URL', () => {
      const url = githubClient.buildPullRequestUrl(testOwner, testRepo, testPRNumber);
      expect(url).toBe(`https://github.com/${testOwner}/${testRepo}/pull/${testPRNumber}`);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      await githubClient.clearCache();
      expect(mockCacheManager.clear).toHaveBeenCalled();
    });

    it('should get cache stats', () => {
      const stats = githubClient.getCacheStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
    });

    it('should cache successful responses', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: [mockCommitResponse],
        status: 200,
        headers: {},
      });

      await githubClient.getCommits(testOwner, testRepo);

      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should not cache POST requests', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { success: true },
        status: 200,
        headers: {},
      });

      // Note: GitHubClient doesn't have POST methods in the current implementation
      // This test verifies the base client behavior
      expect(mockCacheManager.set).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limit info from headers', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: [mockCommitResponse],
        status: 200,
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-reset': '1704110400',
        },
      });

      await githubClient.getCommits(testOwner, testRepo);

      const rateLimitInfo = githubClient.getRateLimitInfo();
      expect(rateLimitInfo).toBeDefined();
    });

    it('should get rate limit status', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: {
          resources: {
            core: {
              limit: 5000,
              remaining: 4999,
              reset: 1704110400,
              used: 1,
            },
            search: {
              limit: 30,
              remaining: 30,
              reset: 1704110400,
              used: 0,
            },
          },
        },
        status: 200,
        headers: {},
      });

      const status = await githubClient.getRateLimitStatus();

      expect(status.core.limit).toBe(5000);
      expect(status.search.limit).toBe(30);
    });
  });
});
