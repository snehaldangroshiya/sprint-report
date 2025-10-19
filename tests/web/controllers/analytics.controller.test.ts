import { Request, Response } from 'express';

import { EnhancedMCPServer } from '@/server/enhanced-mcp-server';
import { AnalyticsController } from '@/web/controllers/analytics.controller';
import { AnalyticsAggregator } from '@/web/services/analytics-aggregator.service';
import { MCPBridge } from '@/web/services/mcp-bridge.service';

// Mock dependencies
jest.mock('@/utils/logger', () => ({
  getLogger: (): unknown => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logError: jest.fn(),
  }),
}));

describe('AnalyticsController', () => {
  let analyticsController: AnalyticsController;
  let mockMCPServer: jest.Mocked<EnhancedMCPServer>;
  let mockMCPBridge: jest.Mocked<MCPBridge>;
  let mockAnalyticsAggregator: jest.Mocked<AnalyticsAggregator>;
  let mockCacheManager: any;
  let mockContext: any;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock cache manager
    mockCacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    // Mock context
    mockContext = {
      cacheManager: mockCacheManager,
    };

    // Mock MCP server
    mockMCPServer = {
      getContext: jest.fn().mockReturnValue(mockContext),
    } as any;

    // Mock MCP bridge
    mockMCPBridge = {
      callTool: jest.fn(),
    } as any;

    // Mock analytics aggregator
    mockAnalyticsAggregator = {
      aggregateCommitsByMonth: jest.fn(),
      calculateVelocityData: jest.fn(),
      calculateTeamPerformance: jest.fn(),
      calculateIssueTypeDistribution: jest.fn(),
    } as any;

    // Create controller instance
    analyticsController = new AnalyticsController(
      mockMCPServer,
      mockMCPBridge,
      mockAnalyticsAggregator
    );

    // Mock Express request and response
    mockReq = {
      params: {},
      query: {},
    };

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe('getCommitTrends', () => {
    beforeEach(() => {
      mockReq.params = { owner: 'testowner', repo: 'testrepo' };
      mockReq.query = { period: '6months' };
    });

    it('should serve from cache when available', async () => {
      const cachedData = [{ date: '2024-01', commits: 10, prs: 5 }];
      mockCacheManager.get.mockResolvedValue(cachedData);

      await analyticsController.getCommitTrends(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'commit-trends:v4:testowner:testrepo:6months'
      );
      expect(mockRes.json).toHaveBeenCalledWith(cachedData);
      expect(mockMCPBridge.callTool).not.toHaveBeenCalled();
    });

    it('should fetch and aggregate commit trends when not cached', async () => {
      const mockCommits = [
        { date: '2024-01-15T10:00:00Z' },
        { date: '2024-02-20T10:00:00Z' },
      ];
      const mockPRs = [{ merged_at: '2024-01-25T10:00:00Z' }];
      const mockTrends = [
        { date: '2024-01', commits: 1, prs: 1 },
        { date: '2024-02', commits: 1, prs: 0 },
      ];

      mockCacheManager.get.mockResolvedValue(null);
      mockMCPBridge.callTool
        .mockResolvedValueOnce(mockCommits) // First page of commits
        .mockResolvedValueOnce([]) // Second page (empty)
        .mockResolvedValueOnce(mockPRs) // First page of PRs
        .mockResolvedValueOnce([]); // Second page (empty)
      mockAnalyticsAggregator.aggregateCommitsByMonth.mockReturnValue(
        mockTrends
      );

      await analyticsController.getCommitTrends(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockMCPBridge.callTool).toHaveBeenCalledWith(
        'github_get_commits',
        expect.objectContaining({
          owner: 'testowner',
          repo: 'testrepo',
          per_page: 100,
          page: 1,
        })
      );
      expect(
        mockAnalyticsAggregator.aggregateCommitsByMonth
      ).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'commit-trends:v4:testowner:testrepo:6months',
        mockTrends,
        { ttl: 600000 }
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockTrends);
    });

    it('should handle pagination when fetching commits', async () => {
      const page1 = Array(100).fill({ date: '2024-01-15T10:00:00Z' });
      const page2 = Array(100).fill({ date: '2024-01-20T10:00:00Z' });
      const page3 = Array(50).fill({ date: '2024-01-25T10:00:00Z' });

      mockCacheManager.get.mockResolvedValue(null);

      // Mock implementation that returns different pages based on the page parameter
      mockMCPBridge.callTool.mockImplementation(
        (toolName: string, args: any) => {
          if (toolName === 'github_get_commits') {
            if (args.page === 1) return Promise.resolve(page1);
            if (args.page === 2) return Promise.resolve(page2);
            if (args.page === 3) return Promise.resolve(page3);
            return Promise.resolve([]);
          }
          // For github_get_pull_requests
          return Promise.resolve([]);
        }
      );

      mockAnalyticsAggregator.aggregateCommitsByMonth.mockReturnValue([]);

      await analyticsController.getCommitTrends(
        mockReq as Request,
        mockRes as Response
      );

      // Should have fetched 3 pages of commits (250 total items)
      // Stops at page 3 because it has <100 items
      const commitCalls = mockMCPBridge.callTool.mock.calls.filter(
        call => call[0] === 'github_get_commits'
      );

      expect(commitCalls.length).toBe(3); // Pages 1, 2, 3 (stops at page 3 since <100 items)
      expect(commitCalls[0]?.[1]).toMatchObject({ page: 1 });
      expect(commitCalls[1]?.[1]).toMatchObject({ page: 2 });
      expect(commitCalls[2]?.[1]).toMatchObject({ page: 3 });

      // Verify aggregator received all commits (250 total)
      expect(
        mockAnalyticsAggregator.aggregateCommitsByMonth
      ).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ date: expect.any(String) }),
        ]),
        expect.any(Array),
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should handle different time periods', async () => {
      mockReq.query = { period: '1month' };
      mockCacheManager.get.mockResolvedValue(null);
      mockMCPBridge.callTool.mockResolvedValue([]);
      mockAnalyticsAggregator.aggregateCommitsByMonth.mockReturnValue([]);

      await analyticsController.getCommitTrends(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'commit-trends:v4:testowner:testrepo:1month'
      );
    });

    it('should gracefully handle PR fetch errors', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockMCPBridge.callTool
        .mockResolvedValueOnce([]) // Commits
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('GitHub API error')); // PR fetch fails
      mockAnalyticsAggregator.aggregateCommitsByMonth.mockReturnValue([]);

      await analyticsController.getCommitTrends(
        mockReq as Request,
        mockRes as Response
      );

      // Should still complete successfully with empty PRs
      expect(
        mockAnalyticsAggregator.aggregateCommitsByMonth
      ).toHaveBeenCalledWith([], [], expect.any(Date), expect.any(Date));
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should handle errors and return proper status code', async () => {
      mockCacheManager.get.mockRejectedValue(new Error('Cache error'));

      await analyticsController.getCommitTrends(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });
  });

  describe('getTeamPerformance', () => {
    beforeEach(() => {
      mockReq.params = { boardId: '6306' };
      mockReq.query = { sprints: '10' };
    });

    it('should serve from cache when available', async () => {
      const cachedData = [
        { name: 'Sprint 1', planned: 10, completed: 8, velocity: 8 },
      ];
      mockCacheManager.get.mockResolvedValue(cachedData);

      await analyticsController.getTeamPerformance(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        'team-performance:6306:10'
      );
      expect(mockRes.json).toHaveBeenCalledWith(cachedData);
      expect(
        mockAnalyticsAggregator.calculateTeamPerformance
      ).not.toHaveBeenCalled();
    });

    it('should calculate and cache team performance', async () => {
      const mockPerformance = [
        { name: 'Sprint 1', planned: 10, completed: 8, velocity: 8 },
        { name: 'Sprint 2', planned: 12, completed: 10, velocity: 10 },
      ];

      mockCacheManager.get.mockResolvedValue(null);
      mockAnalyticsAggregator.calculateTeamPerformance.mockResolvedValue(
        mockPerformance
      );

      await analyticsController.getTeamPerformance(
        mockReq as Request,
        mockRes as Response
      );

      expect(
        mockAnalyticsAggregator.calculateTeamPerformance
      ).toHaveBeenCalledWith('6306', 10);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'team-performance:6306:10',
        mockPerformance,
        { ttl: 300000 }
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockPerformance);
    });

    it('should not cache empty results', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockAnalyticsAggregator.calculateTeamPerformance.mockResolvedValue([]);

      await analyticsController.getTeamPerformance(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockCacheManager.set).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it('should use default sprint count when not provided', async () => {
      mockReq.query = {};
      mockCacheManager.get.mockResolvedValue(null);
      mockAnalyticsAggregator.calculateTeamPerformance.mockResolvedValue([]);

      await analyticsController.getTeamPerformance(
        mockReq as Request,
        mockRes as Response
      );

      expect(
        mockAnalyticsAggregator.calculateTeamPerformance
      ).toHaveBeenCalledWith('6306', 10);
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Jira API error');
      mockCacheManager.get.mockResolvedValue(null);
      mockAnalyticsAggregator.calculateTeamPerformance.mockRejectedValue(error);

      await analyticsController.getTeamPerformance(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });
  });

  describe('getIssueTypeDistribution', () => {
    beforeEach(() => {
      mockReq.params = { boardId: '6306' };
      mockReq.query = { sprints: '6' };
    });

    it('should serve from cache when available', async () => {
      const cachedData = [
        { name: 'Story', value: 10, color: '#3b82f6' },
        { name: 'Bug', value: 5, color: '#ef4444' },
      ];
      mockCacheManager.get.mockResolvedValue(cachedData);

      await analyticsController.getIssueTypeDistribution(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockCacheManager.get).toHaveBeenCalledWith('issue-types:6306:6');
      expect(mockRes.json).toHaveBeenCalledWith(cachedData);
      expect(
        mockAnalyticsAggregator.calculateIssueTypeDistribution
      ).not.toHaveBeenCalled();
    });

    it('should calculate and cache issue type distribution', async () => {
      const mockDistribution = [
        { name: 'Story', value: 15, color: '#3b82f6' },
        { name: 'Bug', value: 8, color: '#ef4444' },
        { name: 'Task', value: 3, color: '#f59e0b' },
      ];

      mockCacheManager.get.mockResolvedValue(null);
      mockAnalyticsAggregator.calculateIssueTypeDistribution.mockResolvedValue(
        mockDistribution
      );

      await analyticsController.getIssueTypeDistribution(
        mockReq as Request,
        mockRes as Response
      );

      expect(
        mockAnalyticsAggregator.calculateIssueTypeDistribution
      ).toHaveBeenCalledWith('6306', 6);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'issue-types:6306:6',
        mockDistribution,
        { ttl: 600000 }
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockDistribution);
    });

    it('should use default sprint count when not provided', async () => {
      mockReq.query = {};
      mockCacheManager.get.mockResolvedValue(null);
      mockAnalyticsAggregator.calculateIssueTypeDistribution.mockResolvedValue(
        []
      );

      await analyticsController.getIssueTypeDistribution(
        mockReq as Request,
        mockRes as Response
      );

      expect(
        mockAnalyticsAggregator.calculateIssueTypeDistribution
      ).toHaveBeenCalledWith('6306', 6);
    });

    it('should cache even empty results', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockAnalyticsAggregator.calculateIssueTypeDistribution.mockResolvedValue(
        []
      );

      await analyticsController.getIssueTypeDistribution(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'issue-types:6306:6',
        [],
        { ttl: 600000 }
      );
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Calculation error');
      mockCacheManager.get.mockResolvedValue(null);
      mockAnalyticsAggregator.calculateIssueTypeDistribution.mockRejectedValue(
        error
      );

      await analyticsController.getIssueTypeDistribution(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });
  });

  describe('getVelocityData', () => {
    beforeEach(() => {
      mockReq.params = { boardId: '6306' };
      mockReq.query = { sprints: '10' };
    });

    it('should serve from cache when available', async () => {
      const cachedData = {
        sprints: [{ id: '1', name: 'Sprint 1', velocity: 10 }],
        average: 10,
        trend: 'stable',
      };
      mockCacheManager.get.mockResolvedValue(cachedData);

      await analyticsController.getVelocityData(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockCacheManager.get).toHaveBeenCalledWith('velocity:6306:10');
      expect(mockRes.json).toHaveBeenCalledWith(cachedData);
      expect(
        mockAnalyticsAggregator.calculateVelocityData
      ).not.toHaveBeenCalled();
    });

    it('should calculate and cache velocity data', async () => {
      const mockVelocity = {
        sprints: [
          {
            id: '1',
            name: 'Sprint 1',
            velocity: 10,
            commitment: 12,
            completed: 10,
          },
          {
            id: '2',
            name: 'Sprint 2',
            velocity: 12,
            commitment: 15,
            completed: 12,
          },
        ],
        average: 11,
        trend: 'increasing',
      };

      mockCacheManager.get.mockResolvedValue(null);
      mockAnalyticsAggregator.calculateVelocityData.mockResolvedValue(
        mockVelocity
      );

      await analyticsController.getVelocityData(
        mockReq as Request,
        mockRes as Response
      );

      expect(
        mockAnalyticsAggregator.calculateVelocityData
      ).toHaveBeenCalledWith('6306', 10);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'velocity:6306:10',
        mockVelocity,
        { ttl: 300000 }
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockVelocity);
    });

    it('should use default sprint count when not provided', async () => {
      mockReq.query = {};
      mockCacheManager.get.mockResolvedValue(null);
      mockAnalyticsAggregator.calculateVelocityData.mockResolvedValue({
        sprints: [],
        average: 0,
        trend: 'stable',
      });

      await analyticsController.getVelocityData(
        mockReq as Request,
        mockRes as Response
      );

      expect(
        mockAnalyticsAggregator.calculateVelocityData
      ).toHaveBeenCalledWith('6306', 10);
    });

    it('should handle errors with custom status code', async () => {
      const error: any = new Error('Not found');
      error.statusCode = 404;
      error.userMessage = 'Board not found';

      mockCacheManager.get.mockResolvedValue(null);
      mockAnalyticsAggregator.calculateVelocityData.mockRejectedValue(error);

      await analyticsController.getVelocityData(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Board not found',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should include stack trace in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockReq.params = { boardId: '6306' };
      mockReq.query = {};
      const error = new Error('Test error');
      mockCacheManager.get.mockRejectedValue(error);

      await analyticsController.getVelocityData(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockReq.params = { boardId: '6306' };
      mockReq.query = {};
      const error = new Error('Test error');
      mockCacheManager.get.mockRejectedValue(error);

      await analyticsController.getVelocityData(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.not.objectContaining({
          stack: expect.any(String),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should use default error message when none provided', async () => {
      mockReq.params = { boardId: '6306' };
      mockReq.query = {};
      const error: any = {};

      mockCacheManager.get.mockRejectedValue(error);

      await analyticsController.getVelocityData(
        mockReq as Request,
        mockRes as Response
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to get velocity data',
        })
      );
    });
  });
});
