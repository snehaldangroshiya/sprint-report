import { EnhancedMCPServer } from '@/server/enhanced-mcp-server';
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

describe('AnalyticsAggregator', () => {
  let analyticsAggregator: AnalyticsAggregator;
  let mockMCPServer: jest.Mocked<EnhancedMCPServer>;
  let mockMCPBridge: jest.Mocked<MCPBridge>;
  let mockCacheManager: any;
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock cache manager
    mockCacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      getMany: jest.fn().mockResolvedValue(new Map()),
      setMany: jest.fn().mockResolvedValue(undefined),
    };

    // Create mock context
    mockContext = {
      cacheManager: mockCacheManager,
    };

    // Create mock MCP server
    mockMCPServer = {
      getContext: jest.fn().mockReturnValue(mockContext),
    } as any;

    // Create mock MCP bridge
    mockMCPBridge = {
      callTool: jest.fn(),
    } as any;

    // Create AnalyticsAggregator instance
    analyticsAggregator = new AnalyticsAggregator(mockMCPServer, mockMCPBridge);
  });

  describe('Constructor', () => {
    it('should initialize with MCP server and bridge', () => {
      expect(analyticsAggregator).toBeDefined();
    });
  });

  describe('aggregateCommitsByMonth', () => {
    it('should aggregate commits by month', () => {
      const commits = [
        { date: '2024-01-15T10:00:00Z' },
        { date: '2024-01-20T10:00:00Z' },
        { date: '2024-02-10T10:00:00Z' },
      ];

      const result = analyticsAggregator.aggregateCommitsByMonth(commits);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2024-01',
        commits: 2,
        prs: 0,
      });
      expect(result[1]).toEqual({
        date: '2024-02',
        commits: 1,
        prs: 0,
      });
    });

    it('should aggregate pull requests by month', () => {
      const commits: any[] = [];
      const pullRequests = [
        { merged_at: '2024-03-05T10:00:00Z' },
        { merged_at: '2024-03-15T10:00:00Z' },
        { closed_at: '2024-04-10T10:00:00Z' },
      ];

      const result = analyticsAggregator.aggregateCommitsByMonth(
        commits,
        pullRequests
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2024-03',
        commits: 0,
        prs: 2,
      });
      expect(result[1]).toEqual({
        date: '2024-04',
        commits: 0,
        prs: 1,
      });
    });

    it('should aggregate both commits and PRs', () => {
      const commits = [
        { commit: { committer: { date: '2024-05-10T10:00:00Z' } } },
      ];
      const pullRequests = [{ mergedAt: '2024-05-15T10:00:00Z' }];

      const result = analyticsAggregator.aggregateCommitsByMonth(
        commits,
        pullRequests
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        date: '2024-05',
        commits: 1,
        prs: 1,
      });
    });

    it('should zero-fill months in date range', () => {
      const commits = [
        { date: '2024-01-10T10:00:00Z' },
        { date: '2024-03-10T10:00:00Z' },
      ];
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-31');

      const result = analyticsAggregator.aggregateCommitsByMonth(
        commits,
        [],
        startDate,
        endDate
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ date: '2024-01', commits: 1, prs: 0 });
      expect(result[1]).toEqual({ date: '2024-02', commits: 0, prs: 0 }); // Zero-filled
      expect(result[2]).toEqual({ date: '2024-03', commits: 1, prs: 0 });
    });

    it('should handle commits without dates', () => {
      const commits = [
        { date: '2024-01-10T10:00:00Z' },
        { sha: '123abc' }, // No date
        { date: '2024-01-15T10:00:00Z' },
      ];

      const result = analyticsAggregator.aggregateCommitsByMonth(commits);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        date: '2024-01',
        commits: 2, // Only commits with dates
        prs: 0,
      });
    });

    it('should handle PRs without dates', () => {
      const pullRequests = [
        { merged_at: '2024-02-10T10:00:00Z' },
        { number: 123 }, // No date
        { created_at: '2024-02-15T10:00:00Z' }, // Uses created_at as fallback
      ];

      const result = analyticsAggregator.aggregateCommitsByMonth(
        [],
        pullRequests
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        date: '2024-02',
        commits: 0,
        prs: 2,
      });
    });

    it('should sort results chronologically', () => {
      const commits = [
        { date: '2024-03-10T10:00:00Z' },
        { date: '2024-01-10T10:00:00Z' },
        { date: '2024-02-10T10:00:00Z' },
      ];

      const result = analyticsAggregator.aggregateCommitsByMonth(commits);

      expect(result[0]?.date).toBe('2024-01');
      expect(result[1]?.date).toBe('2024-02');
      expect(result[2]?.date).toBe('2024-03');
    });

    it('should handle empty arrays', () => {
      const result = analyticsAggregator.aggregateCommitsByMonth([], []);

      expect(result).toEqual([]);
    });
  });

  describe('calculateVelocityData', () => {
    const mockSprints = [
      {
        id: '1',
        name: 'Sprint 1',
        startDate: '2024-03-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'Sprint 2',
        startDate: '2024-02-15T00:00:00Z',
      },
      {
        id: '3',
        name: 'Sprint 3',
        startDate: '2024-02-01T00:00:00Z',
      },
    ];

    const mockIssues1 = [
      { status: 'Done', storyPoints: 5 },
      { status: 'Done', storyPoints: 3 },
      { status: 'In Progress', storyPoints: 2 },
    ];

    const mockIssues2 = [
      { status: 'Closed', storyPoints: 8 },
      { status: 'Done', storyPoints: 5 },
    ];

    const mockIssues3 = [{ status: 'Resolved', storyPoints: 3 }];

    it('should calculate velocity for recent sprints', async () => {
      mockMCPBridge.callTool.mockResolvedValueOnce(mockSprints);
      mockCacheManager.getMany.mockResolvedValue(
        new Map([
          ['sprint:1:issues', mockIssues1],
          ['sprint:2:issues', mockIssues2],
        ])
      );
      mockMCPBridge.callTool.mockResolvedValueOnce(mockIssues3);

      const result = await analyticsAggregator.calculateVelocityData('6306', 3);

      expect(result.sprints).toHaveLength(3);
      // Sprints are sorted newest first (by startDate descending)
      // Sprint 1: 2024-03-01 (newest)
      // Sprint 2: 2024-02-15
      // Sprint 3: 2024-02-01 (oldest)
      expect(result.sprints[0]).toMatchObject({
        id: '1',
        name: 'Sprint 1',
        velocity: 8, // 5 + 3 (only Done issues)
        commitment: 10, // 5 + 3 + 2 (all issues)
        completed: 8,
      });
      expect(result.average).toBe(8); // (8 + 13 + 3) / 3 = 24/3 = 8
    });

    it('should determine increasing trend', async () => {
      const sprints = [
        { id: '1', name: 'S1', startDate: '2024-04-01T00:00:00Z' },
        { id: '2', name: 'S2', startDate: '2024-03-15T00:00:00Z' },
        { id: '3', name: 'S3', startDate: '2024-03-01T00:00:00Z' },
      ];

      mockMCPBridge.callTool.mockResolvedValueOnce(sprints);
      mockCacheManager.getMany.mockResolvedValue(
        new Map([
          // After sorting newest first: S1 (15), S2 (10), S3 (5)
          // First half: [S1] avg=15
          // Second half: [S2, S3] avg=7.5
          // Trend: secondAvg (7.5) < firstAvg * 0.9 (13.5) = decreasing
          // For increasing: first half should be lower than second half
          ['sprint:1:issues', [{ status: 'Done', storyPoints: 5 }]], // Newest = lowest
          ['sprint:2:issues', [{ status: 'Done', storyPoints: 10 }]],
          ['sprint:3:issues', [{ status: 'Done', storyPoints: 15 }]], // Oldest = highest
        ])
      );

      const result = await analyticsAggregator.calculateVelocityData('6306', 3);

      // First half (newer): [5] avg=5
      // Second half (older): [10, 15] avg=12.5
      // secondAvg (12.5) > firstAvg * 1.1 (5.5) = increasing
      expect(result.trend).toBe('increasing');
    });

    it('should determine decreasing trend', async () => {
      const sprints = [
        { id: '1', name: 'S1', startDate: '2024-04-01T00:00:00Z' },
        { id: '2', name: 'S2', startDate: '2024-03-15T00:00:00Z' },
        { id: '3', name: 'S3', startDate: '2024-03-01T00:00:00Z' },
      ];

      mockMCPBridge.callTool.mockResolvedValueOnce(sprints);
      mockCacheManager.getMany.mockResolvedValue(
        new Map([
          // After sorting newest first: S1, S2, S3
          // For decreasing: first half (newer) should be higher than second half (older)
          ['sprint:1:issues', [{ status: 'Done', storyPoints: 15 }]], // Newest = highest
          ['sprint:2:issues', [{ status: 'Done', storyPoints: 10 }]],
          ['sprint:3:issues', [{ status: 'Done', storyPoints: 5 }]], // Oldest = lowest
        ])
      );

      const result = await analyticsAggregator.calculateVelocityData('6306', 3);

      // First half (newer): [15] avg=15
      // Second half (older): [10, 5] avg=7.5
      // secondAvg (7.5) < firstAvg * 0.9 (13.5) = decreasing
      expect(result.trend).toBe('decreasing');
    });

    it('should determine stable trend', async () => {
      const sprints = [
        { id: '1', name: 'S1', startDate: '2024-04-01T00:00:00Z' },
        { id: '2', name: 'S2', startDate: '2024-03-15T00:00:00Z' },
        { id: '3', name: 'S3', startDate: '2024-03-01T00:00:00Z' },
      ];

      mockMCPBridge.callTool.mockResolvedValueOnce(sprints);
      mockCacheManager.getMany.mockResolvedValue(
        new Map([
          ['sprint:1:issues', [{ status: 'Done', storyPoints: 10 }]],
          ['sprint:2:issues', [{ status: 'Done', storyPoints: 10 }]],
          ['sprint:3:issues', [{ status: 'Done', storyPoints: 10 }]],
        ])
      );

      const result = await analyticsAggregator.calculateVelocityData('6306', 3);

      expect(result.trend).toBe('stable');
    });

    it('should use cache for sprints list', async () => {
      mockCacheManager.get.mockResolvedValue(mockSprints);
      mockCacheManager.getMany.mockResolvedValue(
        new Map([
          ['sprint:1:issues', mockIssues1],
          ['sprint:2:issues', mockIssues2],
          ['sprint:3:issues', mockIssues3],
        ])
      );

      await analyticsAggregator.calculateVelocityData('6306', 3);

      expect(mockCacheManager.get).toHaveBeenCalledWith('sprints:closed:6306');
      expect(mockMCPBridge.callTool).not.toHaveBeenCalledWith(
        'jira_get_sprints',
        expect.anything()
      );
    });

    it('should fetch and cache missing sprint issues', async () => {
      mockMCPBridge.callTool.mockResolvedValueOnce(mockSprints);
      mockCacheManager.getMany.mockResolvedValue(new Map());
      mockMCPBridge.callTool
        .mockResolvedValueOnce(mockIssues1)
        .mockResolvedValueOnce(mockIssues2)
        .mockResolvedValueOnce(mockIssues3);

      await analyticsAggregator.calculateVelocityData('6306', 3);

      expect(mockCacheManager.setMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'sprint:1:issues',
            value: mockIssues1,
            ttl: 1800,
          }),
        ])
      );
    });

    it('should handle sprints without startDate', async () => {
      const sprints = [
        { id: '1', name: 'S1', startDate: '2024-04-01T00:00:00Z' },
        { id: '2', name: 'S2' }, // No startDate
        { id: '3', name: 'S3', startDate: '2024-03-01T00:00:00Z' },
      ];

      mockMCPBridge.callTool.mockResolvedValueOnce(sprints);
      mockCacheManager.getMany.mockResolvedValue(
        new Map([
          ['sprint:1:issues', [{ status: 'Done', storyPoints: 5 }]],
          ['sprint:3:issues', [{ status: 'Done', storyPoints: 3 }]],
          ['sprint:2:issues', []], // Empty issues for sprint without startDate
        ])
      );

      const result = await analyticsAggregator.calculateVelocityData('6306', 3);

      // Sprint without startDate should be sorted last
      // Order after sort: S1 (2024-04-01), S3 (2024-03-01), S2 (no date)
      expect(result.sprints).toHaveLength(3);
      expect(result.sprints[2]?.id).toBe('2'); // Sprint without date is last
    });

    it('should handle errors during calculation', async () => {
      mockMCPBridge.callTool.mockRejectedValue(new Error('Jira API error'));

      await expect(
        analyticsAggregator.calculateVelocityData('error-board', 5)
      ).rejects.toThrow('Jira API error');
    });
  });

  describe('calculateTeamPerformance', () => {
    const mockSprints = [
      { id: '1', name: 'Sprint 1', startDate: '2024-03-01T00:00:00Z' },
      { id: '2', name: 'Sprint 2', startDate: '2024-02-15T00:00:00Z' },
    ];

    const mockIssues1 = [
      { status: 'Done', storyPoints: 5 },
      { status: 'Done', storyPoints: 3 },
      { status: 'In Progress', storyPoints: 2 },
    ];

    const mockIssues2 = [
      { status: 'Closed', storyPoints: 8 },
      { status: 'To Do', storyPoints: 4 },
    ];

    it('should calculate team performance metrics', async () => {
      mockMCPBridge.callTool.mockResolvedValueOnce(mockSprints);
      mockCacheManager.getMany.mockResolvedValue(
        new Map([
          ['sprint:1:issues', mockIssues1],
          ['sprint:2:issues', mockIssues2],
        ])
      );

      const result = await analyticsAggregator.calculateTeamPerformance(
        '6306',
        2
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'Sprint 1',
        planned: 10, // 5 + 3 + 2
        completed: 8, // 5 + 3
        velocity: 8,
      });
      expect(result[1]).toEqual({
        name: 'Sprint 2',
        planned: 12, // 8 + 4
        completed: 8, // 8
        velocity: 8,
      });
    });

    it('should return empty array when no sprints available', async () => {
      mockMCPBridge.callTool.mockResolvedValueOnce([]);

      const result = await analyticsAggregator.calculateTeamPerformance(
        '6306',
        5
      );

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockMCPBridge.callTool.mockRejectedValue(new Error('API error'));

      const result = await analyticsAggregator.calculateTeamPerformance(
        'error-board',
        5
      );

      expect(result).toEqual([]);
    });

    it('should handle sprints with no issues', async () => {
      mockMCPBridge.callTool.mockResolvedValueOnce(mockSprints);
      mockCacheManager.getMany.mockResolvedValue(
        new Map([
          ['sprint:1:issues', []],
          ['sprint:2:issues', []],
        ])
      );

      const result = await analyticsAggregator.calculateTeamPerformance(
        '6306',
        2
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'Sprint 1',
        planned: 0,
        completed: 0,
        velocity: 0,
      });
    });
  });

  describe('calculateIssueTypeDistribution', () => {
    const mockSprints = [
      { id: '1', name: 'Sprint 1', startDate: '2024-03-01T00:00:00Z' },
      { id: '2', name: 'Sprint 2', startDate: '2024-02-15T00:00:00Z' },
    ];

    const mockIssues1 = [
      { issueType: 'Story' },
      { issueType: 'Story' },
      { issueType: 'Bug' },
    ];

    const mockIssues2 = [
      { issueType: 'Task' },
      { issueType: 'Story' },
      { issueType: 'Bug' },
      { issueType: 'Bug' },
    ];

    it('should calculate issue type distribution', async () => {
      mockMCPBridge.callTool.mockResolvedValueOnce(mockSprints);
      mockCacheManager.getMany.mockResolvedValue(
        new Map([
          ['sprint:1:issues', mockIssues1],
          ['sprint:2:issues', mockIssues2],
        ])
      );

      const result = await analyticsAggregator.calculateIssueTypeDistribution(
        '6306',
        2
      );

      expect(result).toHaveLength(3);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Story', value: 3 }),
          expect.objectContaining({ name: 'Bug', value: 3 }),
          expect.objectContaining({ name: 'Task', value: 1 }),
        ])
      );
    });

    it('should sort issue types by count descending', async () => {
      mockMCPBridge.callTool.mockResolvedValueOnce(mockSprints);
      mockCacheManager.getMany.mockResolvedValue(
        new Map([
          ['sprint:1:issues', mockIssues1],
          ['sprint:2:issues', mockIssues2],
        ])
      );

      const result = await analyticsAggregator.calculateIssueTypeDistribution(
        '6306',
        2
      );

      // Story and Bug both have 3, Task has 1
      expect(result[0]?.value).toBeGreaterThanOrEqual(result[1]?.value || 0);
      expect(result[1]?.value).toBeGreaterThanOrEqual(result[2]?.value || 0);
    });

    it('should assign colors to issue types', async () => {
      mockMCPBridge.callTool.mockResolvedValueOnce(mockSprints);
      mockCacheManager.getMany.mockResolvedValue(
        new Map([['sprint:1:issues', mockIssues1]])
      );

      const result = await analyticsAggregator.calculateIssueTypeDistribution(
        '6306',
        1
      );

      const storyItem = result.find(item => item.name === 'Story');
      const bugItem = result.find(item => item.name === 'Bug');

      expect(storyItem?.color).toBe('#3b82f6');
      expect(bugItem?.color).toBe('#ef4444');
    });

    it('should handle unknown issue types', async () => {
      const issuesWithUnknown = [
        { issueType: 'Story' },
        { type: 'CustomType' }, // Uses fallback field
        {}, // No type field
      ];

      mockMCPBridge.callTool.mockResolvedValueOnce([mockSprints[0]]);
      mockCacheManager.getMany.mockResolvedValue(
        new Map([['sprint:1:issues', issuesWithUnknown]])
      );

      const result = await analyticsAggregator.calculateIssueTypeDistribution(
        '6306',
        1
      );

      const unknownItem = result.find(item => item.name === 'Unknown');
      expect(unknownItem?.value).toBe(1);
      expect(unknownItem?.color).toBe('#6b7280');
    });

    it('should return empty array on error', async () => {
      mockMCPBridge.callTool.mockRejectedValue(new Error('API error'));

      const result = await analyticsAggregator.calculateIssueTypeDistribution(
        'error-board',
        5
      );

      expect(result).toEqual([]);
    });

    it('should handle empty issue lists', async () => {
      mockMCPBridge.callTool.mockResolvedValueOnce(mockSprints);
      mockCacheManager.getMany.mockResolvedValue(
        new Map([
          ['sprint:1:issues', []],
          ['sprint:2:issues', []],
        ])
      );

      const result = await analyticsAggregator.calculateIssueTypeDistribution(
        '6306',
        2
      );

      expect(result).toEqual([]);
    });
  });

  describe('Integration Scenarios', () => {
    it('should reuse cached sprint list across multiple calculations', async () => {
      const sprints = [
        { id: '1', name: 'Sprint 1', startDate: '2024-03-01T00:00:00Z' },
      ];

      mockCacheManager.get.mockResolvedValue(sprints);
      mockCacheManager.getMany.mockResolvedValue(
        new Map([['sprint:1:issues', [{ status: 'Done', storyPoints: 5 }]]])
      );

      await analyticsAggregator.calculateVelocityData('6306', 1);
      await analyticsAggregator.calculateTeamPerformance('6306', 1);
      await analyticsAggregator.calculateIssueTypeDistribution('6306', 1);

      // Should use cache for all three calls
      expect(mockCacheManager.get).toHaveBeenCalledTimes(3);
      expect(mockMCPBridge.callTool).not.toHaveBeenCalledWith(
        'jira_get_sprints',
        expect.anything()
      );
    });

    it('should handle parallel issue fetching efficiently', async () => {
      const sprints = [
        { id: '1', name: 'S1', startDate: '2024-03-01T00:00:00Z' },
        { id: '2', name: 'S2', startDate: '2024-02-15T00:00:00Z' },
        { id: '3', name: 'S3', startDate: '2024-02-01T00:00:00Z' },
      ];

      mockMCPBridge.callTool.mockResolvedValueOnce(sprints);
      mockCacheManager.getMany.mockResolvedValue(new Map());

      const issues1 = [{ status: 'Done', storyPoints: 5 }];
      const issues2 = [{ status: 'Done', storyPoints: 8 }];
      const issues3 = [{ status: 'Done', storyPoints: 3 }];

      mockMCPBridge.callTool
        .mockResolvedValueOnce(issues1)
        .mockResolvedValueOnce(issues2)
        .mockResolvedValueOnce(issues3);

      await analyticsAggregator.calculateVelocityData('6306', 3);

      // Should fetch all 3 in parallel (one call for sprints, then 3 parallel for issues)
      expect(mockMCPBridge.callTool).toHaveBeenCalledTimes(4);
    });
  });
});
