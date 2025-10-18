/**
 * MCP Bridge Service
 * Handles all MCP tool execution with error handling
 */

import { EnhancedMCPServer } from '../../server/enhanced-mcp-server';
import { getLogger } from '../../utils/logger';

export class MCPBridge {
  private mcpServer: EnhancedMCPServer;
  private logger: any;

  constructor(mcpServer: EnhancedMCPServer) {
    this.mcpServer = mcpServer;
    this.logger = getLogger();
  }

  /**
   * Execute MCP tool with unified error handling
   */
  async callTool(toolName: string, args: any): Promise<any> {
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
          return parsed;
        } catch {
          return result.content[0].text;
        }
      }

      this.logger.debug('Returning MCP result directly', { tool: toolName });
      return result;
    } catch (error) {
      this.logger.logError(error as Error, `mcp_tool_${toolName}`, { args });
      throw error;
    }
  }

  /**
   * Generate comprehensive sprint report
   */
  async generateComprehensiveReport(
    _sprintId: string,
    toolParams: any
  ): Promise<any> {
    const result = await this.callTool('generate_sprint_report', toolParams);

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
}
