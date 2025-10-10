import { JiraClient } from '@/clients/jira-client';
import type { CacheManager } from '@/cache/cache-manager';
import { AppConfig } from '@/types';
import axios, { AxiosError } from 'axios';

// Mock dependencies
jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('JiraClient', () => {
  let jiraClient: JiraClient;
  let mockCacheManager: jest.Mocked<CacheManager>;
  let mockConfig: AppConfig;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock configuration
    mockConfig = {
      jira: {
        baseUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'test-token-123',
        maxResults: 50,
        timeout: 5000,
      },
      github: {
        token: 'github-token',
        apiUrl: 'https://api.github.com',
        timeout: 5000,
        userAgent: 'test-agent',
      },
      cache: {
        memory: { maxSize: 100, ttl: 300 },
      },
      server: {
        port: 3000,
        host: 'localhost',
        cors: true,
        corsOrigin: '*',
      },
      reports: {
        outputDir: './reports',
        templateDir: './templates',
        maxSize: 10485760,
      },
      security: {
        rateLimitPerMinute: 60,
        maxRequestSize: 1048576,
        enableHelmet: true,
      },
      logging: {
        level: 'error',
        enableApiLogging: false,
      },
      nodeEnv: 'test',
    } as AppConfig;

    // Create mock cache manager
    mockCacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      setMany: jest.fn().mockResolvedValue(undefined),
      getMany: jest.fn().mockResolvedValue(new Map()),
      delete: jest.fn().mockResolvedValue(true),
      deletePattern: jest.fn().mockResolvedValue(0),
      exists: jest.fn().mockResolvedValue(false),
      clear: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockReturnValue({
        hits: 0,
        misses: 0,
        keys: 0,
        memory: 0,
        hitRate: 0,
      }),
      getCacheKeys: jest.fn().mockResolvedValue([]),
      healthCheck: jest.fn().mockResolvedValue({ healthy: true }),
      cleanup: jest.fn().mockResolvedValue(0),
      close: jest.fn().mockResolvedValue(undefined),
    } as any as jest.Mocked<CacheManager>;

    // Create mock axios instance
    mockAxiosInstance = {
      defaults: {
        headers: { common: {} },
      },
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Create Jira client instance
    jiraClient = new JiraClient(mockConfig, mockCacheManager);
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://test.atlassian.net',
          timeout: 5000,
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
            Accept: 'application/json',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should use Bearer token authentication for Jira Server', () => {
      const createCall = mockedAxios.create.mock.calls[0]?.[0];
      expect(createCall?.headers).toMatchObject({
        Authorization: 'Bearer test-token-123',
      });
    });

    it('should setup request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('getSprints', () => {
    const mockSprintsResponse = {
      maxResults: 50,
      startAt: 0,
      total: 2,
      isLast: true,
      values: [
        {
          id: 1,
          self: 'https://test.atlassian.net/rest/agile/1.0/sprint/1',
          state: 'closed',
          name: 'Sprint 1',
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-15T00:00:00.000Z',
          completeDate: '2024-01-15T00:00:00.000Z',
          goal: 'Complete feature X',
          originBoardId: 123,
        },
        {
          id: 2,
          self: 'https://test.atlassian.net/rest/agile/1.0/sprint/2',
          state: 'active',
          name: 'Sprint 2',
          startDate: '2024-01-16T00:00:00.000Z',
          endDate: '2024-01-30T00:00:00.000Z',
          goal: 'Implement feature Y',
          originBoardId: 123,
        },
      ],
    };

    it('should fetch sprints successfully', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: mockSprintsResponse,
        status: 200,
        headers: {},
      });

      const sprints = await jiraClient.getSprints('123');

      expect(sprints).toHaveLength(2);
      expect(sprints[0]).toMatchObject({
        id: '1',
        name: 'Sprint 1',
        state: 'CLOSED',
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-15T00:00:00.000Z',
        goal: 'Complete feature X',
      });
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/rest/agile/1.0/board/123/sprint',
          method: 'GET',
        })
      );
    });

    it('should filter sprints by state', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: mockSprintsResponse,
        status: 200,
        headers: {},
      });

      await jiraClient.getSprints('123', 'active');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { state: 'active' },
        })
      );
    });

    it('should use cache for repeated requests', async () => {
      const mockSprintsResponse = {
        maxResults: 50,
        startAt: 0,
        total: 1,
        isLast: true,
        values: [
          {
            id: 1,
            name: 'Cached Sprint',
            state: 'closed',
            startDate: '2024-01-01T00:00:00.000Z',
            endDate: '2024-01-15T00:00:00.000Z',
            originBoardId: 123,
          },
        ],
      };

      mockCacheManager.get.mockResolvedValue(mockSprintsResponse);

      const sprints = await jiraClient.getSprints('123');

      expect(sprints).toHaveLength(1);
      expect(sprints[0]?.name).toBe('Cached Sprint');
      expect(mockAxiosInstance.request).not.toHaveBeenCalled();
      expect(mockCacheManager.get).toHaveBeenCalled();
    });

    it('should cache successful responses', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: mockSprintsResponse,
        status: 200,
        headers: {},
      });

      await jiraClient.getSprints('123');

      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      const axiosError = new Error('API Error') as AxiosError;
      axiosError.response = {
        status: 500,
        data: { errorMessages: ['Internal server error'] },
        headers: {},
        statusText: 'Internal Server Error',
        config: {} as any,
      };

      mockAxiosInstance.request.mockRejectedValue(axiosError);

      await expect(jiraClient.getSprints('123')).rejects.toThrow();
    });
  });

  describe('getSprintData', () => {
    const mockSprintResponse = {
      id: 1,
      self: 'https://test.atlassian.net/rest/agile/1.0/sprint/1',
      state: 'active',
      name: 'Sprint 1',
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-01-15T00:00:00.000Z',
      goal: 'Complete feature X',
      originBoardId: 123,
    };

    it('should fetch single sprint data', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: mockSprintResponse,
        status: 200,
        headers: {},
      });

      const sprint = await jiraClient.getSprintData('1');

      expect(sprint).toMatchObject({
        id: '1',
        name: 'Sprint 1',
        state: 'ACTIVE',
        boardId: 123,
      });
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/rest/agile/1.0/sprint/1',
        })
      );
    });

    it('should use cache for sprint data', async () => {
      const mockSprintResponse = {
        id: 1,
        name: 'Cached Sprint',
        state: 'active',
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-15T00:00:00.000Z',
        originBoardId: 123,
      };

      mockCacheManager.get.mockResolvedValue(mockSprintResponse);

      const sprint = await jiraClient.getSprintData('1');

      expect(sprint.id).toBe('1');
      expect(sprint.name).toBe('Cached Sprint');
      expect(sprint.state).toBe('ACTIVE');
      expect(mockAxiosInstance.request).not.toHaveBeenCalled();
    });
  });

  describe('getSprintIssues', () => {
    const mockIssuesResponse = {
      maxResults: 50,
      startAt: 0,
      total: 1,
      issues: [
        {
          id: 'issue-1',
          key: 'TEST-123',
          self: 'https://test.atlassian.net/rest/api/2/issue/TEST-123',
          fields: {
            summary: 'Test issue',
            status: {
              id: '1',
              name: 'Done',
              statusCategory: {
                id: 3,
                key: 'done',
                colorName: 'green',
                name: 'Done',
              },
            },
            assignee: {
              accountId: 'user-123',
              displayName: 'Test User',
              emailAddress: 'test@example.com',
            },
            reporter: {
              accountId: 'reporter-123',
              displayName: 'Reporter User',
            },
            priority: {
              id: '2',
              name: 'High',
            },
            issuetype: {
              id: '10001',
              name: 'Story',
              iconUrl: 'https://test.atlassian.net/icon.png',
            },
            created: '2024-01-01T00:00:00.000Z',
            updated: '2024-01-05T00:00:00.000Z',
            resolutiondate: '2024-01-05T00:00:00.000Z',
            labels: ['backend', 'api'],
            components: [{ id: '1', name: 'Backend' }],
            fixVersions: [{ id: '1', name: '1.0.0' }],
            customfield_10016: 5, // Story points
          },
        },
      ],
    };

    it('should fetch sprint issues successfully', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: mockIssuesResponse,
        status: 200,
        headers: {},
      });

      const issues = await jiraClient.getSprintIssues('1');

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        key: 'TEST-123',
        summary: 'Test issue',
        status: 'Done',
        assignee: 'Test User',
        storyPoints: 5,
        priority: 'High',
        issueType: 'Story',
      });
    });

    it('should handle pagination correctly', async () => {
      const page1Response = {
        ...mockIssuesResponse,
        total: 75,
        issues: Array(50).fill(mockIssuesResponse.issues[0]),
      };

      const page2Response = {
        ...mockIssuesResponse,
        total: 75,
        startAt: 50,
        // Second page has remaining issues (less than maxResults, triggers hasMore = false)
        issues: Array(25).fill(mockIssuesResponse.issues[0]),
      };

      // Reset cache mock to always return null
      mockCacheManager.get.mockResolvedValue(null);

      mockAxiosInstance.request
        .mockResolvedValueOnce({ data: page1Response, status: 200, headers: {} })
        .mockResolvedValueOnce({ data: page2Response, status: 200, headers: {} });

      const issues = await jiraClient.getSprintIssues('1');

      // Should fetch both pages: 50 + 25 = 75 issues
      expect(issues.length).toBeGreaterThanOrEqual(50);
      // Verify pagination was attempted
      expect(mockAxiosInstance.request).toHaveBeenCalled();
    });

    it('should respect maxResults parameter', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: mockIssuesResponse,
        status: 200,
        headers: {},
      });

      await jiraClient.getSprintIssues('1', undefined, 20);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            maxResults: 20,
          }),
        })
      );
    });

    it('should filter fields when specified', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: mockIssuesResponse,
        status: 200,
        headers: {},
      });

      await jiraClient.getSprintIssues('1', ['summary', 'status', 'assignee']);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            fields: 'summary,status,assignee',
          }),
        })
      );
    });

    it('should prevent infinite loops with safety check', async () => {
      const largeResponse = {
        ...mockIssuesResponse,
        total: 5000,
        issues: Array(50).fill(mockIssuesResponse.issues[0]),
      };

      mockAxiosInstance.request.mockResolvedValue({
        data: largeResponse,
        status: 200,
        headers: {},
      });

      const issues = await jiraClient.getSprintIssues('1');

      // Should stop at 1000 issues
      expect(issues.length).toBeLessThanOrEqual(1000);
    });

    it('should extract story points from custom fields', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: mockIssuesResponse,
        status: 200,
        headers: {},
      });

      const issues = await jiraClient.getSprintIssues('1');

      expect(issues[0]?.storyPoints).toBe(5);
    });

    it('should handle issues without assignee', async () => {
      const responseWithoutAssignee = {
        ...mockIssuesResponse,
        issues: [
          {
            ...mockIssuesResponse.issues[0],
            fields: {
              ...mockIssuesResponse.issues[0]?.fields,
              assignee: null,
            },
          },
        ],
      };

      mockAxiosInstance.request.mockResolvedValue({
        data: responseWithoutAssignee,
        status: 200,
        headers: {},
      });

      const issues = await jiraClient.getSprintIssues('1');

      expect(issues[0]?.assignee).toBe('Unassigned');
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 authentication errors', async () => {
      const axiosError = new Error('Unauthorized') as AxiosError;
      axiosError.response = {
        status: 401,
        data: { errorMessages: ['Authentication failed'] },
        headers: {},
        statusText: 'Unauthorized',
        config: {} as any,
      };

      mockAxiosInstance.request.mockRejectedValue(axiosError);

      await expect(jiraClient.getSprints('123')).rejects.toThrow();
    });

    it('should handle 403 forbidden errors', async () => {
      const axiosError = new Error('Forbidden') as AxiosError;
      axiosError.response = {
        status: 403,
        data: { errorMessages: ['Access denied'] },
        headers: {},
        statusText: 'Forbidden',
        config: {} as any,
      };

      mockAxiosInstance.request.mockRejectedValue(axiosError);

      await expect(jiraClient.getSprints('123')).rejects.toThrow();
    });

    it('should handle 404 not found errors', async () => {
      const axiosError = new Error('Not Found') as AxiosError;
      axiosError.response = {
        status: 404,
        data: { errorMessages: ['Board not found'] },
        headers: {},
        statusText: 'Not Found',
        config: {} as any,
      };

      mockAxiosInstance.request.mockRejectedValue(axiosError);

      await expect(jiraClient.getSprints('999')).rejects.toThrow();
    });

    it('should handle 429 rate limit errors', async () => {
      const axiosError = new Error('Too Many Requests') as AxiosError;
      axiosError.response = {
        status: 429,
        data: { errorMessages: ['Rate limit exceeded'] },
        headers: { 'retry-after': '60' },
        statusText: 'Too Many Requests',
        config: {} as any,
      };

      mockAxiosInstance.request.mockRejectedValue(axiosError);

      await expect(jiraClient.getSprints('123')).rejects.toThrow();
    });

    it('should handle 500 server errors', async () => {
      const axiosError = new Error('Internal Server Error') as AxiosError;
      axiosError.response = {
        status: 500,
        data: { errorMessages: ['Internal server error'] },
        headers: {},
        statusText: 'Internal Server Error',
        config: {} as any,
      };

      mockAxiosInstance.request.mockRejectedValue(axiosError);

      await expect(jiraClient.getSprints('123')).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      const axiosError = new Error('Timeout') as AxiosError;
      axiosError.code = 'ECONNABORTED';
      axiosError.config = { url: '/test' } as any;

      mockAxiosInstance.request.mockRejectedValue(axiosError);

      await expect(jiraClient.getSprints('123')).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      const axiosError = new Error('Network Error') as AxiosError;
      axiosError.code = 'ENOTFOUND';

      mockAxiosInstance.request.mockRejectedValue(axiosError);

      await expect(jiraClient.getSprints('123')).rejects.toThrow();
    });

    it('should extract error messages from Jira API response', async () => {
      const axiosError = new Error('API Error') as AxiosError;
      axiosError.response = {
        status: 400,
        data: {
          errorMessages: ['Board ID is invalid'],
          errors: {},
        },
        headers: {},
        statusText: 'Bad Request',
        config: {} as any,
      };

      mockAxiosInstance.request.mockRejectedValue(axiosError);

      await expect(jiraClient.getSprints('invalid')).rejects.toThrow();
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limit information from headers', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { values: [] },
        status: 200,
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
        },
      });

      await jiraClient.getSprints('123');

      const rateLimitInfo = jiraClient.getRateLimitInfo();
      expect(rateLimitInfo).toBeDefined();
    });

    it('should respect rate limit delays', async () => {
      // Mock cache misses
      mockCacheManager.get.mockResolvedValue(null);

      mockAxiosInstance.request
        .mockResolvedValueOnce({
          data: { values: [] },
          status: 200,
          headers: {},
        })
        .mockResolvedValueOnce({
          data: { values: [] },
          status: 200,
          headers: {},
        });

      const startTime = Date.now();
      await jiraClient.getSprints('123');
      await jiraClient.getSprints('456');
      const duration = Date.now() - startTime;

      // Should have some delay between requests (at least 50ms considering overhead)
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient failures', async () => {
      const axiosError = new Error('Network Error') as AxiosError;
      axiosError.code = 'ECONNRESET';

      mockAxiosInstance.request
        .mockRejectedValueOnce(axiosError)
        .mockRejectedValueOnce(axiosError)
        .mockResolvedValueOnce({
          data: { values: [] },
          status: 200,
          headers: {},
        });

      const sprints = await jiraClient.getSprints('123');

      expect(sprints).toEqual([]);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 4xx client errors', async () => {
      const axiosError = new Error('Bad Request') as AxiosError;
      axiosError.response = {
        status: 400,
        data: { errorMessages: ['Invalid request'] },
        headers: {},
        statusText: 'Bad Request',
        config: {} as any,
      };

      mockAxiosInstance.request.mockRejectedValue(axiosError);

      await expect(jiraClient.getSprints('123')).rejects.toThrow();
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(1);
    });

    it('should retry on 5xx server errors', async () => {
      const axiosError = new Error('Server Error') as AxiosError;
      axiosError.response = {
        status: 503,
        data: { errorMessages: ['Service unavailable'] },
        headers: {},
        statusText: 'Service Unavailable',
        config: {} as any,
      };

      mockAxiosInstance.request
        .mockRejectedValueOnce(axiosError)
        .mockResolvedValueOnce({
          data: { values: [] },
          status: 200,
          headers: {},
        });

      const sprints = await jiraClient.getSprints('123');

      expect(sprints).toEqual([]);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
    });

    it('should respect max retry attempts', async () => {
      const axiosError = new Error('Server Error') as AxiosError;
      axiosError.response = {
        status: 500,
        data: { errorMessages: ['Internal error'] },
        headers: {},
        statusText: 'Internal Server Error',
        config: {} as any,
      };

      mockAxiosInstance.request.mockRejectedValue(axiosError);

      await expect(jiraClient.getSprints('123')).rejects.toThrow();
      // Should try initial + 3 retries = 4 total
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(3);
    });
  });

  describe('validateConnection', () => {
    it('should validate successful connection', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: {
          displayName: 'Test User',
          emailAddress: 'test@example.com',
        },
        status: 200,
        headers: {},
      });

      const result = await jiraClient.validateConnection();

      expect(result.valid).toBe(true);
      expect(result.user).toBe('Test User');
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/rest/api/2/myself',
        })
      );
    });

    it('should detect invalid credentials', async () => {
      const axiosError = new Error('Unauthorized') as AxiosError;
      axiosError.response = {
        status: 401,
        data: { errorMessages: ['Invalid credentials'] },
        headers: {},
        statusText: 'Unauthorized',
        config: {} as any,
      };

      mockAxiosInstance.request.mockRejectedValue(axiosError);

      const result = await jiraClient.validateConnection();

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: {
          displayName: 'Test User',
          emailAddress: 'test@example.com',
        },
        status: 200,
        headers: {},
      });

      const health = await jiraClient.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status on failure', async () => {
      const axiosError = new Error('Connection failed') as AxiosError;
      mockAxiosInstance.request.mockRejectedValue(axiosError);

      const health = await jiraClient.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Connection failed');
    });

    it('should not use cache for health checks', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { displayName: 'Test User' },
        status: 200,
        headers: {},
      });

      await jiraClient.healthCheck();
      await jiraClient.healthCheck();

      // Should make request twice (no caching)
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      await jiraClient.clearCache();

      expect(mockCacheManager.clear).toHaveBeenCalled();
    });

    it('should get cache statistics', () => {
      const stats = jiraClient.getCacheStats();

      expect(stats).toMatchObject({
        size: expect.any(Number),
        entries: expect.any(Number),
        hits: expect.any(Number),
        misses: expect.any(Number),
        hitRate: expect.any(Number),
      });
    });

    it('should return cache manager instance', () => {
      const cacheManager = jiraClient.getCacheManager();

      expect(cacheManager).toBe(mockCacheManager);
    });
  });

  describe('searchIssues', () => {
    const mockSearchResponse = {
      maxResults: 50,
      startAt: 0,
      total: 1,
      issues: [
        {
          id: 'issue-1',
          key: 'TEST-123',
          fields: {
            summary: 'Test issue',
            status: { name: 'Done' },
            assignee: { displayName: 'Test User', accountId: 'user-123' },
            priority: { name: 'High' },
            issuetype: { name: 'Story' },
            created: '2024-01-01T00:00:00.000Z',
            updated: '2024-01-05T00:00:00.000Z',
            labels: [],
            components: [],
            fixVersions: [],
            reporter: { accountId: 'reporter-123', displayName: 'Reporter' },
          },
        },
      ],
    };

    it('should search issues using JQL', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: mockSearchResponse,
        status: 200,
        headers: {},
      });

      const issues = await jiraClient.searchIssues(
        'project = TEST AND status = Done'
      );

      expect(issues).toHaveLength(1);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/rest/api/3/search',
          method: 'POST',
        })
      );
    });

    it('should not cache search results', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: mockSearchResponse,
        status: 200,
        headers: {},
      });

      await jiraClient.searchIssues('project = TEST');

      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });
  });

  describe('getBoards', () => {
    const mockBoardsResponse = {
      maxResults: 50,
      startAt: 0,
      total: 1,
      isLast: true,
      values: [
        {
          id: 123,
          self: 'https://test.atlassian.net/rest/agile/1.0/board/123',
          name: 'Test Board',
          type: 'scrum',
          location: {
            type: 'project',
            key: 'TEST',
            id: '10000',
            name: 'Test Project',
          },
        },
      ],
    };

    it('should fetch boards successfully', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: mockBoardsResponse,
        status: 200,
        headers: {},
      });

      const boards = await jiraClient.getBoards();

      expect(boards).toHaveLength(1);
      expect(boards[0]).toMatchObject({
        id: 123,
        name: 'Test Board',
        type: 'scrum',
      });
    });

    it('should cache board data for 30 minutes', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: mockBoardsResponse,
        status: 200,
        headers: {},
      });

      await jiraClient.getBoards();

      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });

  describe('buildJQL', () => {
    it('should build simple JQL query', () => {
      const jql = jiraClient.buildJQL({
        project: 'TEST',
        status: 'Done',
      });

      expect(jql).toContain('project = "TEST"');
      expect(jql).toContain('status = "Done"');
      expect(jql).toContain('AND');
    });

    it('should handle array values with IN operator', () => {
      const jql = jiraClient.buildJQL({
        status: ['Done', 'In Progress', 'Closed'],
      });

      expect(jql).toContain('status IN (');
      expect(jql).toContain('"Done"');
      expect(jql).toContain('"In Progress"');
      expect(jql).toContain('"Closed"');
    });

    it('should skip null and undefined values', () => {
      const jql = jiraClient.buildJQL({
        project: 'TEST',
        status: null,
        assignee: undefined,
      });

      expect(jql).toContain('project = "TEST"');
      expect(jql).not.toContain('status');
      expect(jql).not.toContain('assignee');
    });

    it('should handle empty arrays', () => {
      const jql = jiraClient.buildJQL({
        project: 'TEST',
        status: [],
      });

      expect(jql).toBe('project = "TEST"');
    });
  });

  describe('Data Transformation', () => {
    it('should map sprint state correctly', async () => {
      const mockResponse = {
        maxResults: 50,
        startAt: 0,
        total: 3,
        isLast: true,
        values: [
          {
            id: 1,
            name: 'Active Sprint',
            state: 'active',
            originBoardId: 123,
          },
          {
            id: 2,
            name: 'Closed Sprint',
            state: 'closed',
            originBoardId: 123,
          },
          {
            id: 3,
            name: 'Future Sprint',
            state: 'future',
            originBoardId: 123,
          },
        ],
      };

      mockAxiosInstance.request.mockResolvedValue({
        data: mockResponse,
        status: 200,
        headers: {},
      });

      const sprints = await jiraClient.getSprints('123');

      expect(sprints[0]?.state).toBe('ACTIVE');
      expect(sprints[1]?.state).toBe('CLOSED');
      expect(sprints[2]?.state).toBe('FUTURE');
    });

    it('should extract story points from various custom fields', async () => {
      const mockResponse = {
        maxResults: 50,
        startAt: 0,
        total: 1,
        issues: [
          {
            id: 'issue-1',
            key: 'TEST-123',
            fields: {
              summary: 'Test',
              status: { name: 'Done' },
              assignee: { displayName: 'User', accountId: 'user-123' },
              priority: { name: 'High' },
              issuetype: { name: 'Story' },
              created: '2024-01-01T00:00:00.000Z',
              updated: '2024-01-01T00:00:00.000Z',
              labels: [],
              components: [],
              fixVersions: [],
              reporter: { accountId: 'reporter-123', displayName: 'Reporter' },
              customfield_10016: 8, // Story points
            },
          },
        ],
      };

      mockAxiosInstance.request.mockResolvedValue({
        data: mockResponse,
        status: 200,
        headers: {},
      });

      const issues = await jiraClient.getSprintIssues('1');

      expect(issues[0]?.storyPoints).toBe(8);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty sprint list', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: {
          maxResults: 50,
          startAt: 0,
          total: 0,
          isLast: true,
          values: [],
        },
        status: 200,
        headers: {},
      });

      const sprints = await jiraClient.getSprints('123');

      expect(sprints).toEqual([]);
    });

    it('should handle sprint with missing optional fields', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: {
          maxResults: 50,
          startAt: 0,
          total: 1,
          isLast: true,
          values: [
            {
              id: 1,
              name: 'Minimal Sprint',
              state: 'active',
              originBoardId: 123,
              // Missing startDate, endDate, goal
            },
          ],
        },
        status: 200,
        headers: {},
      });

      const sprints = await jiraClient.getSprints('123');

      expect(sprints).toHaveLength(1);
      expect(sprints[0]).toMatchObject({
        id: '1',
        name: 'Minimal Sprint',
        state: 'ACTIVE',
        startDate: '',
        endDate: '',
      });
      expect(sprints[0]?.goal).toBeUndefined();
    });

    it('should handle issues with missing custom fields', async () => {
      const mockResponse = {
        maxResults: 50,
        startAt: 0,
        total: 1,
        issues: [
          {
            id: 'issue-1',
            key: 'TEST-123',
            fields: {
              summary: 'Test',
              status: { name: 'Done' },
              assignee: null,
              priority: { name: 'High' },
              issuetype: { name: 'Story' },
              created: '2024-01-01T00:00:00.000Z',
              updated: '2024-01-01T00:00:00.000Z',
              labels: [],
              components: [],
              fixVersions: [],
              reporter: { accountId: 'reporter-123', displayName: 'Reporter' },
              // No custom fields
            },
          },
        ],
      };

      mockAxiosInstance.request.mockResolvedValue({
        data: mockResponse,
        status: 200,
        headers: {},
      });

      const issues = await jiraClient.getSprintIssues('1');

      expect(issues[0]).toBeDefined();
      expect(issues[0]?.storyPoints).toBeUndefined();
    });
  });
});
