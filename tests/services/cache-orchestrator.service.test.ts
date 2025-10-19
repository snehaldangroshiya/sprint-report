import { EnhancedMCPServer } from '@/server/enhanced-mcp-server';
import { CacheOrchestrator } from '@/web/services/cache-orchestrator.service';
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

describe('CacheOrchestrator', () => {
  let cacheOrchestrator: CacheOrchestrator;
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
      delete: jest.fn().mockResolvedValue(true),
      clear: jest.fn().mockResolvedValue(undefined),
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
      generateComprehensiveReport: jest.fn(),
    } as any;

    // Create CacheOrchestrator instance
    cacheOrchestrator = new CacheOrchestrator(mockMCPServer, mockMCPBridge);
  });

  describe('Constructor', () => {
    it('should initialize with MCP server and bridge', () => {
      expect(cacheOrchestrator).toBeDefined();
    });
  });

  describe('getSprintCacheTTL', () => {
    it('should return 5 minutes TTL for active sprint', async () => {
      mockCacheManager.get.mockResolvedValue('active');

      const ttl = await cacheOrchestrator.getSprintCacheTTL('123');

      expect(ttl).toBe(300000); // 5 minutes
      expect(mockCacheManager.get).toHaveBeenCalledWith('sprint:123:state');
    });

    it('should return 30 days TTL for closed sprint', async () => {
      mockCacheManager.get.mockResolvedValue('closed');

      const ttl = await cacheOrchestrator.getSprintCacheTTL('456');

      expect(ttl).toBe(2592000000); // 30 days
      expect(mockCacheManager.get).toHaveBeenCalledWith('sprint:456:state');
    });

    it('should return 15 minutes TTL for future sprint', async () => {
      mockCacheManager.get.mockResolvedValue('future');

      const ttl = await cacheOrchestrator.getSprintCacheTTL('789');

      expect(ttl).toBe(900000); // 15 minutes
      expect(mockCacheManager.get).toHaveBeenCalledWith('sprint:789:state');
    });

    it('should return 10 minutes default TTL for unknown state', async () => {
      mockCacheManager.get.mockResolvedValue('unknown_state');

      const ttl = await cacheOrchestrator.getSprintCacheTTL('999');

      expect(ttl).toBe(600000); // 10 minutes default
    });

    it('should fetch sprint state when not cached', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockMCPBridge.callTool.mockResolvedValue({ state: 'active' });

      const ttl = await cacheOrchestrator.getSprintCacheTTL('100');

      expect(ttl).toBe(300000); // 5 minutes for active
      expect(mockMCPBridge.callTool).toHaveBeenCalledWith('jira_get_sprint', {
        sprint_id: '100',
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'sprint:100:state',
        'active',
        { ttl: 3600000 }
      );
    });

    it('should handle errors fetching sprint state gracefully', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockMCPBridge.callTool.mockRejectedValue(new Error('Jira API error'));

      const ttl = await cacheOrchestrator.getSprintCacheTTL('error-sprint');

      expect(ttl).toBe(600000); // 10 minutes default fallback
    });

    it('should handle cache manager errors gracefully', async () => {
      mockCacheManager.get.mockRejectedValue(new Error('Cache error'));

      const ttl = await cacheOrchestrator.getSprintCacheTTL('cache-error');

      expect(ttl).toBe(600000); // 10 minutes default
    });

    it('should cache sprint state for 1 hour after fetching', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockMCPBridge.callTool.mockResolvedValue({ state: 'closed' });

      await cacheOrchestrator.getSprintCacheTTL('200');

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'sprint:200:state',
        'closed',
        { ttl: 3600000 } // 1 hour
      );
    });
  });

  describe('scheduleBackgroundRefresh', () => {
    it('should schedule refresh when cache is past half-life', async () => {
      const now = Date.now();
      const metadata = { createdAt: now - 350000 }; // Created 350s ago
      mockCacheManager.get.mockResolvedValue(metadata);

      const refreshFunction = jest.fn().mockResolvedValue({ data: 'fresh' });
      const ttl = 600000; // 10 minutes

      await cacheOrchestrator.scheduleBackgroundRefresh(
        'test-key',
        refreshFunction,
        ttl
      );

      // Wait for setImmediate callback
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));

      expect(refreshFunction).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'test-key',
        { data: 'fresh' },
        { ttl }
      );
    });

    it('should not refresh when cache is before half-life', async () => {
      const now = Date.now();
      const metadata = { createdAt: now - 100000 }; // Created 100s ago
      mockCacheManager.get.mockResolvedValue(metadata);

      const refreshFunction = jest.fn().mockResolvedValue({ data: 'fresh' });
      const ttl = 600000; // 10 minutes, half-life is 300s

      await cacheOrchestrator.scheduleBackgroundRefresh(
        'test-key',
        refreshFunction,
        ttl
      );

      // Wait a bit to ensure no callback is scheduled
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(refreshFunction).not.toHaveBeenCalled();
    });

    it('should handle refresh errors gracefully', async () => {
      const now = Date.now();
      const metadata = { createdAt: now - 350000 };
      mockCacheManager.get.mockResolvedValue(metadata);

      const refreshFunction = jest
        .fn()
        .mockRejectedValue(new Error('Refresh failed'));

      await cacheOrchestrator.scheduleBackgroundRefresh(
        'error-key',
        refreshFunction,
        600000
      );

      // Wait for setImmediate callback
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));

      expect(refreshFunction).toHaveBeenCalled();
      // Should not throw error
    });

    it('should not refresh when metadata is missing', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const refreshFunction = jest.fn();

      await cacheOrchestrator.scheduleBackgroundRefresh(
        'no-metadata',
        refreshFunction,
        600000
      );

      // Wait a bit to ensure no callback is scheduled
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(refreshFunction).not.toHaveBeenCalled();
    });

    it('should not refresh when metadata has no createdAt', async () => {
      mockCacheManager.get.mockResolvedValue({ someOtherField: 'value' });

      const refreshFunction = jest.fn();

      await cacheOrchestrator.scheduleBackgroundRefresh(
        'invalid-metadata',
        refreshFunction,
        600000
      );

      // Wait a bit to ensure no callback is scheduled
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(refreshFunction).not.toHaveBeenCalled();
    });
  });

  describe('warmSprintCache', () => {
    it('should warm cache with sprint issues and comprehensive report', async () => {
      const mockIssues = [{ key: 'PROJ-1' }, { key: 'PROJ-2' }];
      const mockReport = { sprint: 'data', metrics: {} };

      mockMCPBridge.callTool.mockResolvedValue(mockIssues);
      mockMCPBridge.generateComprehensiveReport.mockResolvedValue(mockReport);

      await cacheOrchestrator.warmSprintCache('300', 'owner', 'repo');

      expect(mockMCPBridge.callTool).toHaveBeenCalledWith(
        'jira_get_sprint_issues',
        { sprint_id: '300' }
      );

      expect(mockMCPBridge.generateComprehensiveReport).toHaveBeenCalledWith(
        '300',
        expect.objectContaining({
          sprint_id: '300',
          github_owner: 'owner',
          github_repo: 'repo',
          include_tier1: true,
          include_tier2: true,
          include_tier3: true,
          include_forward_looking: true,
          include_enhanced_github: true,
        })
      );

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'sprint:300:issues:all:100',
        mockIssues,
        { ttl: 7200000 } // 2 hours
      );

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'comprehensive:300:owner:repo:true:true:true:true:true',
        mockReport,
        { ttl: 7200000 }
      );
    });

    it('should handle errors during cache warming', async () => {
      mockMCPBridge.callTool.mockRejectedValue(
        new Error('Failed to fetch issues')
      );

      await expect(
        cacheOrchestrator.warmSprintCache('error-sprint', 'owner', 'repo')
      ).rejects.toThrow('Failed to fetch issues');
    });

    it('should warm cache with correct comprehensive report parameters', async () => {
      mockMCPBridge.callTool.mockResolvedValue([]);
      mockMCPBridge.generateComprehensiveReport.mockResolvedValue({});

      await cacheOrchestrator.warmSprintCache('400', 'test-owner', 'test-repo');

      expect(mockMCPBridge.generateComprehensiveReport).toHaveBeenCalledWith(
        '400',
        {
          sprint_id: '400',
          github_owner: 'test-owner',
          github_repo: 'test-repo',
          format: 'json',
          include_commits: true,
          include_prs: true,
          include_velocity: true,
          include_burndown: true,
          theme: 'default',
          include_tier1: true,
          include_tier2: true,
          include_tier3: true,
          include_forward_looking: true,
          include_enhanced_github: true,
        }
      );
    });
  });

  describe('invalidateIssueCache', () => {
    it('should invalidate cache for issue with sprint field', async () => {
      const issue = {
        key: 'PROJ-123',
        fields: {
          sprint: { id: '500' },
        },
      };

      await cacheOrchestrator.invalidateIssueCache(issue, null);

      expect(mockCacheManager.delete).toHaveBeenCalledWith(
        'sprint:500:issues:*'
      );
      expect(mockCacheManager.delete).toHaveBeenCalledWith(
        'sprint:500:metrics:*'
      );
      expect(mockCacheManager.delete).toHaveBeenCalledWith(
        'comprehensive:500:*'
      );
      expect(mockCacheManager.delete).toHaveBeenCalledWith('sprint:500:state');
    });

    it('should invalidate cache for sprints in changelog', async () => {
      const issue = { key: 'PROJ-456' };
      const changelog = {
        items: [
          { field: 'Sprint', from: '600', to: '700' },
          { field: 'Status', from: 'To Do', to: 'In Progress' },
        ],
      };

      await cacheOrchestrator.invalidateIssueCache(issue, changelog);

      // Should invalidate both sprints (600 and 700)
      expect(mockCacheManager.delete).toHaveBeenCalledWith(
        'sprint:600:issues:*'
      );
      expect(mockCacheManager.delete).toHaveBeenCalledWith(
        'sprint:700:issues:*'
      );
    });

    it('should handle multiple sprint changes and deduplicate', async () => {
      const issue = {
        key: 'PROJ-789',
        fields: {
          sprint: { id: '800' },
        },
      };
      const changelog = {
        items: [
          { field: 'Sprint', from: '800', to: '900' }, // 800 appears twice
          { field: 'Sprint', from: '900', to: '1000' },
        ],
      };

      await cacheOrchestrator.invalidateIssueCache(issue, changelog);

      // Verify deduplication by checking call patterns
      const deleteCalls = mockCacheManager.delete.mock.calls;
      const sprintIds = new Set(
        deleteCalls.map((call: any) => call[0].match(/sprint:(\d+):/)?.[1])
      );

      expect(sprintIds.has('800')).toBe(true);
      expect(sprintIds.has('900')).toBe(true);
      expect(sprintIds.has('1000')).toBe(true);
    });

    it('should handle issues without sprints', async () => {
      const issue = { key: 'PROJ-NO-SPRINT', fields: {} };

      await cacheOrchestrator.invalidateIssueCache(issue, null);

      // Should not crash, but no sprints to invalidate
      expect(mockCacheManager.delete).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully during invalidation', async () => {
      const issue = {
        key: 'PROJ-ERROR',
        fields: { sprint: { id: '999' } },
      };
      mockCacheManager.delete.mockRejectedValue(new Error('Delete failed'));

      // Should not throw error
      await cacheOrchestrator.invalidateIssueCache(issue, null);

      expect(mockCacheManager.delete).toHaveBeenCalled();
    });
  });

  describe('invalidateSprintCache', () => {
    it('should invalidate all sprint-related cache patterns', async () => {
      await cacheOrchestrator.invalidateSprintCache('1100');

      expect(mockCacheManager.delete).toHaveBeenCalledWith(
        'sprint:1100:issues:*'
      );
      expect(mockCacheManager.delete).toHaveBeenCalledWith(
        'sprint:1100:metrics:*'
      );
      expect(mockCacheManager.delete).toHaveBeenCalledWith(
        'comprehensive:1100:*'
      );
      expect(mockCacheManager.delete).toHaveBeenCalledWith('sprint:1100:state');
    });

    it('should handle errors during pattern deletion', async () => {
      mockCacheManager.delete.mockRejectedValue(
        new Error('Pattern deletion failed')
      );

      // Should not throw error
      await cacheOrchestrator.invalidateSprintCache('error-pattern');

      expect(mockCacheManager.delete).toHaveBeenCalled();
    });

    it('should continue deleting patterns even if one fails', async () => {
      mockCacheManager.delete
        .mockRejectedValueOnce(new Error('First pattern failed'))
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await cacheOrchestrator.invalidateSprintCache('1200');

      // Should attempt to delete all 4 patterns
      expect(mockCacheManager.delete).toHaveBeenCalledTimes(4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null sprint state from MCP bridge', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockMCPBridge.callTool.mockResolvedValue(null);

      const ttl = await cacheOrchestrator.getSprintCacheTTL('null-sprint');

      expect(ttl).toBe(600000); // Default fallback
    });

    it('should handle sprint without state field', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockMCPBridge.callTool.mockResolvedValue({ id: '123', name: 'Sprint' });

      const ttl = await cacheOrchestrator.getSprintCacheTTL('no-state');

      expect(ttl).toBe(600000); // Default fallback
    });

    it('should handle empty changelog items array', async () => {
      const issue = { key: 'PROJ-EMPTY' };
      const changelog = { items: [] };

      await cacheOrchestrator.invalidateIssueCache(issue, changelog);

      expect(mockCacheManager.delete).not.toHaveBeenCalled();
    });

    it('should handle changelog with null items', async () => {
      const issue = { key: 'PROJ-NULL-ITEMS' };
      const changelog = { items: null };

      // Should not crash
      await cacheOrchestrator.invalidateIssueCache(issue, changelog);
    });
  });

  describe('Integration Scenarios', () => {
    it('should properly sequence cache warming operations', async () => {
      const callOrder: string[] = [];

      mockMCPBridge.callTool.mockImplementation(async () => {
        callOrder.push('fetch_issues');
        return [];
      });

      mockMCPBridge.generateComprehensiveReport.mockImplementation(async () => {
        callOrder.push('generate_report');
        return {};
      });

      mockCacheManager.set.mockImplementation(async (key: string) => {
        if (key.includes('issues')) {
          callOrder.push('cache_issues');
        } else if (key.includes('comprehensive')) {
          callOrder.push('cache_report');
        }
      });

      await cacheOrchestrator.warmSprintCache('seq-test', 'owner', 'repo');

      expect(callOrder).toEqual([
        'fetch_issues',
        'cache_issues',
        'generate_report',
        'cache_report',
      ]);
    });

    it('should handle concurrent invalidation requests', async () => {
      const sprint1Promise =
        cacheOrchestrator.invalidateSprintCache('concurrent-1');
      const sprint2Promise =
        cacheOrchestrator.invalidateSprintCache('concurrent-2');

      await Promise.all([sprint1Promise, sprint2Promise]);

      // Should delete patterns for both sprints
      expect(mockCacheManager.delete).toHaveBeenCalledWith(
        'sprint:concurrent-1:issues:*'
      );
      expect(mockCacheManager.delete).toHaveBeenCalledWith(
        'sprint:concurrent-2:issues:*'
      );
    });
  });
});
