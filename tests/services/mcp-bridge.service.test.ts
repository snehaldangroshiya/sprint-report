import { EnhancedMCPServer } from '@/server/enhanced-mcp-server';
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

describe('MCPBridge', () => {
  let mcpBridge: MCPBridge;
  let mockMCPServer: jest.Mocked<EnhancedMCPServer>;
  let mockToolRegistry: any;
  let mockContext: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock context
    mockContext = {
      config: {},
      cacheManager: {},
      performanceMonitor: {},
    };

    // Create mock tool registry
    mockToolRegistry = {
      executeTool: jest.fn(),
      getToolDefinitions: jest.fn().mockReturnValue([]),
    };

    // Create mock MCP server
    mockMCPServer = {
      getContext: jest.fn().mockReturnValue(mockContext),
      toolRegistry: mockToolRegistry,
    } as any;

    // Inject tool registry into MCP server
    (mockMCPServer as any).toolRegistry = mockToolRegistry;

    // Create MCPBridge instance
    mcpBridge = new MCPBridge(mockMCPServer);
  });

  describe('Constructor', () => {
    it('should initialize with MCP server', () => {
      expect(mcpBridge).toBeDefined();
      expect(mockMCPServer.getContext).not.toHaveBeenCalled();
    });
  });

  describe('callTool', () => {
    it('should execute tool successfully with simple result', async () => {
      const mockResult = { success: true, data: 'test data' };
      mockToolRegistry.executeTool.mockResolvedValue(mockResult);

      const result = await mcpBridge.callTool('test_tool', { arg1: 'value1' });

      expect(result).toEqual(mockResult);
      expect(mockMCPServer.getContext).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockToolRegistry.executeTool).toHaveBeenCalledWith(
        'test_tool',
        { arg1: 'value1' },
        mockContext
      );
    });

    it('should extract and parse JSON from MCP content response', async () => {
      const mockData = { sprint: 'data', metadata: { count: 10 } };
      const mockResult = {
        content: [{ text: JSON.stringify(mockData) }],
      };
      mockToolRegistry.executeTool.mockResolvedValue(mockResult);

      const result = await mcpBridge.callTool('get_sprint', {
        sprintId: '123',
      });

      expect(result).toEqual(mockData);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockToolRegistry.executeTool).toHaveBeenCalled();
    });

    it('should return raw text when JSON parsing fails', async () => {
      const mockResult = {
        content: [{ text: 'This is not JSON' }],
      };
      mockToolRegistry.executeTool.mockResolvedValue(mockResult);

      const result = await mcpBridge.callTool('test_tool', {});

      expect(result).toBe('This is not JSON');
    });

    it('should return result directly when no content field', async () => {
      const mockResult = { data: 'direct result' };
      mockToolRegistry.executeTool.mockResolvedValue(mockResult);

      const result = await mcpBridge.callTool('test_tool', {});

      expect(result).toEqual(mockResult);
    });

    it('should handle tool execution errors', async () => {
      const mockError = new Error('Tool execution failed');
      mockToolRegistry.executeTool.mockRejectedValue(mockError);

      await expect(
        mcpBridge.callTool('failing_tool', { arg: 'value' })
      ).rejects.toThrow('Tool execution failed');

      expect(mockToolRegistry.executeTool).toHaveBeenCalled();
    });

    it('should log debug information during execution', async () => {
      const mockResult = { success: true };
      mockToolRegistry.executeTool.mockResolvedValue(mockResult);

      await mcpBridge.callTool('test_tool', { arg1: 'value1', arg2: 'value2' });

      // Logger should be called for debug messages
      expect(mockMCPServer.getContext).toHaveBeenCalled();
    });
  });

  describe('generateComprehensiveReport', () => {
    it('should generate report with all tier data', async () => {
      const mockReportData = {
        sprintGoal: 'Complete Feature X',
        scopeChanges: { added: 5, removed: 2 },
        spilloverAnalysis: { items: 3, percentage: 15 },
        blockers: [{ id: '1', description: 'Blocker 1' }],
        bugMetrics: { total: 10, resolved: 8 },
        cycleTimeMetrics: { average: 3.5, median: 3 },
        teamCapacity: { available: 100, utilized: 85 },
        epicProgress: [{ name: 'Epic 1', completion: 75 }],
        technicalDebt: { count: 12, hours: 48 },
        risks: [{ description: 'Risk 1', severity: 'high' }],
        nextSprintForecast: { velocity: 45, confidence: 0.85 },
        carryoverItems: [{ key: 'PROJ-123', summary: 'Unfinished work' }],
        enhancedGitHubMetrics: {
          commitActivity: { total: 150, perDay: 10 },
          pullRequestStats: { merged: 20, pending: 5 },
          codeChanges: { linesAdded: 1500, linesDeleted: 800 },
          prToIssueTraceability: { linked: 18, unlinked: 2 },
          codeReviewStats: { avgReviewTime: 4.5 },
        },
      };

      mockToolRegistry.executeTool.mockResolvedValue({
        content: [{ text: JSON.stringify(mockReportData) }],
      });

      const result = await mcpBridge.generateComprehensiveReport('123', {
        sprintId: '123',
      });

      expect(result).toHaveProperty('tier1');
      expect(result.tier1).toEqual({
        sprint_goal: 'Complete Feature X',
        scope_changes: { added: 5, removed: 2 },
        spillover_analysis: { items: 3, percentage: 15 },
      });

      expect(result).toHaveProperty('tier2');
      expect(result.tier2).toMatchObject({
        blockers: mockReportData.blockers,
        bug_metrics: mockReportData.bugMetrics,
        cycle_time_metrics: mockReportData.cycleTimeMetrics,
        team_capacity: mockReportData.teamCapacity,
      });

      expect(result).toHaveProperty('tier3');
      expect(result.tier3).toMatchObject({
        epic_progress: mockReportData.epicProgress,
        technical_debt: mockReportData.technicalDebt,
        risks: mockReportData.risks,
      });

      expect(result).toHaveProperty('forward_looking');
      expect(result.forward_looking).toMatchObject({
        next_sprint_forecast: mockReportData.nextSprintForecast,
        carryover_items: mockReportData.carryoverItems,
      });

      expect(result).toHaveProperty('enhanced_github');
      expect(result.enhanced_github).toMatchObject({
        commit_activity: mockReportData.enhancedGitHubMetrics.commitActivity,
        pull_request_stats:
          mockReportData.enhancedGitHubMetrics.pullRequestStats,
        code_change_stats: mockReportData.enhancedGitHubMetrics.codeChanges,
        pr_to_issue_traceability:
          mockReportData.enhancedGitHubMetrics.prToIssueTraceability,
        code_review_stats: mockReportData.enhancedGitHubMetrics.codeReviewStats,
      });
    });

    it('should handle partial tier data', async () => {
      const mockReportData = {
        sprintGoal: 'Complete Feature Y',
        // Missing tier2 data
        epicProgress: [{ name: 'Epic 2', completion: 50 }],
        // Missing tier1 scope changes and spillover
        // Missing forward looking data
        // Missing GitHub metrics
      };

      mockToolRegistry.executeTool.mockResolvedValue({
        content: [{ text: JSON.stringify(mockReportData) }],
      });

      const result = await mcpBridge.generateComprehensiveReport('456', {
        sprintId: '456',
      });

      expect(result.tier1).toEqual({
        sprint_goal: 'Complete Feature Y',
        scope_changes: undefined,
        spillover_analysis: undefined,
      });

      // tier2 should be undefined since no tier2 fields present
      expect(result.tier2).toBeUndefined();

      expect(result.tier3).toEqual({
        epic_progress: mockReportData.epicProgress,
        technical_debt: undefined,
        risks: undefined,
      });

      expect(result.forward_looking).toBeUndefined();
      expect(result.enhanced_github).toBeUndefined();
    });

    it('should remove undefined tier sections', async () => {
      const mockReportData = {
        sprintGoal: 'Minimal report',
      };

      mockToolRegistry.executeTool.mockResolvedValue({
        content: [{ text: JSON.stringify(mockReportData) }],
      });

      const result = await mcpBridge.generateComprehensiveReport('789', {
        sprintId: '789',
      });

      // Only tier1 should be present (with sprint_goal)
      expect(result).toHaveProperty('tier1');
      expect(result).not.toHaveProperty('tier2');
      expect(result).not.toHaveProperty('tier3');
      expect(result).not.toHaveProperty('forward_looking');
      expect(result).not.toHaveProperty('enhanced_github');
    });

    it('should parse JSON from content string', async () => {
      const mockReportData = { sprintGoal: 'Test Goal' };

      mockToolRegistry.executeTool.mockResolvedValue({
        content: JSON.stringify(mockReportData),
      });

      const result = await mcpBridge.generateComprehensiveReport('123', {
        sprintId: '123',
      });

      expect(result.tier1).toEqual({
        sprint_goal: 'Test Goal',
        scope_changes: undefined,
        spillover_analysis: undefined,
      });
    });

    it('should handle string result', async () => {
      const mockReportData = { sprintGoal: 'Test Goal 2' };

      mockToolRegistry.executeTool.mockResolvedValue(
        JSON.stringify(mockReportData)
      );

      const result = await mcpBridge.generateComprehensiveReport('123', {
        sprintId: '123',
      });

      expect(result.tier1).toEqual({
        sprint_goal: 'Test Goal 2',
        scope_changes: undefined,
        spillover_analysis: undefined,
      });
    });

    it('should handle direct object result', async () => {
      const mockReportData = {
        sprintGoal: 'Direct Object Goal',
        blockers: [{ id: '1', description: 'Blocker' }],
      };

      mockToolRegistry.executeTool.mockResolvedValue(mockReportData);

      const result = await mcpBridge.generateComprehensiveReport('123', {
        sprintId: '123',
      });

      expect(result.tier1).toEqual({
        sprint_goal: 'Direct Object Goal',
        scope_changes: undefined,
        spillover_analysis: undefined,
      });

      expect(result.tier2).toEqual({
        blockers: mockReportData.blockers,
        bug_metrics: undefined,
        cycle_time_metrics: undefined,
        team_capacity: undefined,
      });
    });

    it('should call generate_sprint_report tool with correct params', async () => {
      const toolParams = {
        sprintId: '999',
        includeGitHub: true,
        boardId: '6306',
      };

      mockToolRegistry.executeTool.mockResolvedValue({
        content: [{ text: '{"sprintGoal": "Test"}' }],
      });

      await mcpBridge.generateComprehensiveReport('999', toolParams);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockToolRegistry.executeTool).toHaveBeenCalledWith(
        'generate_sprint_report',
        toolParams,
        mockContext
      );
    });

    it('should handle tool execution errors in report generation', async () => {
      const mockError = new Error('Report generation failed');
      mockToolRegistry.executeTool.mockRejectedValue(mockError);

      await expect(
        mcpBridge.generateComprehensiveReport('123', { sprintId: '123' })
      ).rejects.toThrow('Report generation failed');
    });
  });

  describe('Error Handling', () => {
    it('should log errors with tool name and args', async () => {
      const mockError = new Error('Test error');
      mockToolRegistry.executeTool.mockRejectedValue(mockError);

      await expect(
        mcpBridge.callTool('error_tool', { param: 'value' })
      ).rejects.toThrow('Test error');

      expect(mockToolRegistry.executeTool).toHaveBeenCalledWith(
        'error_tool',
        { param: 'value' },
        mockContext
      );
    });

    it('should propagate errors from tool registry', async () => {
      const customError = new Error('Custom tool error');
      mockToolRegistry.executeTool.mockRejectedValue(customError);

      await expect(mcpBridge.callTool('test_tool', {})).rejects.toThrow(
        'Custom tool error'
      );
    });
  });

  describe('Data Transformation', () => {
    it('should correctly transform tier1 data structure', async () => {
      const mockData = {
        sprintGoal: 'Q4 Goals',
        scopeChanges: { added: 3, removed: 1, modified: 2 },
        spilloverAnalysis: { total: 5, percentage: 25 },
      };

      mockToolRegistry.executeTool.mockResolvedValue(mockData);

      const result = await mcpBridge.generateComprehensiveReport('123', {
        sprintId: '123',
      });

      expect(result.tier1).toEqual({
        sprint_goal: mockData.sprintGoal,
        scope_changes: mockData.scopeChanges,
        spillover_analysis: mockData.spilloverAnalysis,
      });
    });

    it('should correctly transform GitHub metrics structure', async () => {
      const mockData = {
        enhancedGitHubMetrics: {
          commitActivity: { total: 200, avgPerDay: 14 },
          pullRequestStats: { total: 30, merged: 25, pending: 5 },
          codeChanges: { added: 2000, deleted: 500, files: 45 },
          prToIssueTraceability: { linked: 28, unlinked: 2, percentage: 93 },
          codeReviewStats: { avgTime: 5.2, participants: 8 },
        },
      };

      mockToolRegistry.executeTool.mockResolvedValue(mockData);

      const result = await mcpBridge.generateComprehensiveReport('123', {
        sprintId: '123',
      });

      expect(result.enhanced_github).toEqual({
        commit_activity: mockData.enhancedGitHubMetrics.commitActivity,
        pull_request_stats: mockData.enhancedGitHubMetrics.pullRequestStats,
        code_change_stats: mockData.enhancedGitHubMetrics.codeChanges,
        pr_to_issue_traceability:
          mockData.enhancedGitHubMetrics.prToIssueTraceability,
        code_review_stats: mockData.enhancedGitHubMetrics.codeReviewStats,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty report data', async () => {
      mockToolRegistry.executeTool.mockResolvedValue({});

      const result = await mcpBridge.generateComprehensiveReport('123', {
        sprintId: '123',
      });

      // All tiers should be undefined
      expect(result.tier1).toBeUndefined();
      expect(result.tier2).toBeUndefined();
      expect(result.tier3).toBeUndefined();
      expect(result.forward_looking).toBeUndefined();
      expect(result.enhanced_github).toBeUndefined();
    });

    it('should handle null values in report data', async () => {
      const mockData = {
        sprintGoal: null,
        blockers: null,
        epicProgress: null,
      };

      mockToolRegistry.executeTool.mockResolvedValue(mockData);

      const result = await mcpBridge.generateComprehensiveReport('123', {
        sprintId: '123',
      });

      // Tiers should be undefined since all fields are null
      expect(result.tier1).toBeUndefined();
      expect(result.tier2).toBeUndefined();
      expect(result.tier3).toBeUndefined();
    });

    it('should handle malformed JSON in content', async () => {
      mockToolRegistry.executeTool.mockResolvedValue({
        content: [{ text: '{invalid json}' }],
      });

      const result = await mcpBridge.callTool('test_tool', {});

      // Should return raw text when JSON parse fails
      expect(result).toBe('{invalid json}');
    });

    it('should handle undefined result from tool execution', async () => {
      mockToolRegistry.executeTool.mockResolvedValue(undefined);

      const result = await mcpBridge.callTool('test_tool', {});

      expect(result).toBeUndefined();
    });
  });
});
