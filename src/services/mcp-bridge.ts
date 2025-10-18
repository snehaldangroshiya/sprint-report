// MCP Bridge Service - Abstraction layer for MCP tool execution
// Centralizes all MCP tool calls with error handling and logging

import { EnhancedMCPServer } from '@/server/enhanced-mcp-server';
import { Logger } from '@/utils/logger';

/**
 * Bridge service for executing MCP tools through EnhancedMCPServer
 * Provides type-safe interface and centralized error handling
 */
export class MCPBridge {
  private logger: Logger;
  private mcpServer: EnhancedMCPServer;

  constructor(mcpServer: EnhancedMCPServer) {
    this.mcpServer = mcpServer;
    this.logger = new Logger({ service: 'MCPBridge' });
  }

  /**
   * Execute any MCP tool with type-safe return value
   * @param toolName - Name of the MCP tool to execute
   * @param args - Arguments to pass to the tool
   * @returns Parsed tool result
   */
  async executeTool<T = any>(toolName: string, args: any): Promise<T> {
    try {
      const context = this.mcpServer.getContext();

      this.logger.debug('Executing MCP tool', {
        tool: toolName,
        argKeys: Object.keys(args),
      });

      const toolRegistry = (this.mcpServer as any).toolRegistry;
      const result = await toolRegistry.executeTool(toolName, args, context);

      this.logger.debug('MCP tool result received', {
        tool: toolName,
        resultType: typeof result,
        resultKeys:
          result && typeof result === 'object' ? Object.keys(result) : 'N/A',
      });

      // Extract content from MCP response
      if (result.content?.[0]?.text) {
        this.logger.debug('Extracting from MCP content', {
          tool: toolName,
          contentLength: result.content[0].text.length,
        });

        try {
          const parsed = JSON.parse(result.content[0].text);
          this.logger.debug('Parsed MCP JSON content', {
            tool: toolName,
            parsedKeys: Object.keys(parsed),
            hasMetadata: !!parsed.metadata,
            hasSprintGoal: !!parsed.sprintGoal,
          });
          return parsed as T;
        } catch {
          return result.content[0].text as T;
        }
      }

      this.logger.debug('Returning MCP result directly', { tool: toolName });
      return result as T;
    } catch (error) {
      this.logger.logError(error as Error, `mcp_tool_${toolName}`, { args });
      throw error;
    }
  }

  /**
   * Generate comprehensive sprint report with all tiers and GitHub metrics
   * @param sprintId - Sprint ID
   * @param params - Report generation parameters
   * @returns Comprehensive report data with tier1, tier2, tier3, forward_looking, enhanced_github
   */
  async generateComprehensiveReport(
    sprintId: string,
    params: {
      github_owner?: string;
      github_repo?: string;
      include_tier1?: boolean;
      include_tier2?: boolean;
      include_tier3?: boolean;
      include_forward_looking?: boolean;
      include_enhanced_github?: boolean;
    }
  ): Promise<any> {
    const toolParams = {
      sprint_id: sprintId,
      github_owner: params.github_owner,
      github_repo: params.github_repo,
      format: 'json',
      include_commits: true,
      include_prs: true,
      include_velocity: true,
      include_burndown: true,
      theme: 'default',
      include_tier1: params.include_tier1 ?? true,
      include_tier2: params.include_tier2 ?? true,
      include_tier3: params.include_tier3 ?? true,
      include_forward_looking: params.include_forward_looking ?? true,
      include_enhanced_github: params.include_enhanced_github ?? true,
    };

    const result = await this.executeTool('generate_sprint_report', toolParams);

    // Extract content from MCP tool result
    let reportData;
    if (typeof result === 'object' && result !== null && 'content' in result) {
      const content = result.content;
      reportData = typeof content === 'string' ? JSON.parse(content) : content;
    } else if (typeof result === 'string') {
      reportData = JSON.parse(result);
    } else {
      reportData = result;
    }

    // Reorganize data to match frontend expectations
    const response: any = {
      ...reportData,
      tier1:
        reportData.sprintGoal ||
        reportData.scopeChanges ||
        reportData.spilloverAnalysis
          ? {
              sprint_goal: reportData.sprintGoal,
              scope_changes: reportData.scopeChanges,
              spillover_analysis: reportData.spilloverAnalysis,
            }
          : undefined,
      tier2:
        reportData.blockers ||
        reportData.bugMetrics ||
        reportData.cycleTimeMetrics ||
        reportData.teamCapacity
          ? {
              blockers: reportData.blockers,
              bug_metrics: reportData.bugMetrics,
              cycle_time_metrics: reportData.cycleTimeMetrics,
              team_capacity: reportData.teamCapacity,
            }
          : undefined,
      tier3:
        reportData.epicProgress || reportData.technicalDebt || reportData.risks
          ? {
              epic_progress: reportData.epicProgress,
              technical_debt: reportData.technicalDebt,
              risks: reportData.risks,
            }
          : undefined,
      forward_looking:
        reportData.nextSprintForecast || reportData.carryoverItems
          ? {
              next_sprint_forecast: reportData.nextSprintForecast,
              carryover_items: reportData.carryoverItems,
            }
          : undefined,
      enhanced_github: reportData.enhancedGitHubMetrics
        ? {
            commit_activity: reportData.enhancedGitHubMetrics.commitActivity,
            pull_request_stats:
              reportData.enhancedGitHubMetrics.pullRequestStats,
            code_change_stats: reportData.enhancedGitHubMetrics.codeChanges,
            pr_to_issue_traceability:
              reportData.enhancedGitHubMetrics.prToIssueTraceability,
            code_review_stats: reportData.enhancedGitHubMetrics.codeReviewStats,
          }
        : undefined,
    };

    // Remove undefined fields
    Object.keys(response).forEach(key => {
      if (response[key] === undefined) {
        delete response[key];
      }
    });

    return response;
  }

  /**
   * Get MCP server context (for route handlers)
   */
  getContext(): any {
    return this.mcpServer.getContext();
  }
}
