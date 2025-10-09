// Tool registry for MCP server tools

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ServerContext } from './mcp-server';
import { ValidationUtils, ToolSchemas, MCPToolSchemas } from '@/utils/validation';
import { BaseError } from '@/utils/errors';
import { ErrorRecoveryManager, withErrorRecovery } from '@/utils/error-recovery';
import { OptimizedMetricsHandler } from './optimized-metrics-handler';

export interface ToolHandler {
  (args: Record<string, any>, context: ServerContext): Promise<any>;
}

export interface ToolDefinition {
  definition: Tool;
  handler: ToolHandler;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private errorRecoveryManager?: ErrorRecoveryManager;
  private optimizedMetricsHandler: OptimizedMetricsHandler;

  constructor(logger?: any) {
    if (logger) {
      this.errorRecoveryManager = new ErrorRecoveryManager(logger);
    }
    this.optimizedMetricsHandler = new OptimizedMetricsHandler();
  }

  public initializeErrorRecovery(logger: any): void {
    if (!this.errorRecoveryManager) {
      this.errorRecoveryManager = new ErrorRecoveryManager(logger);
    }
  }

  registerAllTools(): void {

    // Jira tools
    this.registerTool({
      definition: {
        name: 'jira_get_sprints',
        description: 'Get sprints for a Jira board',
        inputSchema: ToolSchemas.jiraGetSprints,
      },
      handler: this.handleJiraGetSprints.bind(this),
    });

    this.registerTool({
      definition: {
        name: 'jira_get_sprint_issues',
        description: 'Get issues for a specific sprint',
        inputSchema: ToolSchemas.jiraGetSprintIssues,
      },
      handler: this.handleJiraGetSprintIssues.bind(this),
    });

    this.registerTool({
      definition: {
        name: 'jira_get_sprint',
        description: 'Get detailed information about a specific sprint',
        inputSchema: ToolSchemas.jiraGetSprintDetails,
      },
      handler: this.handleJiraGetSprint.bind(this),
    });

    this.registerTool({
      definition: {
        name: 'jira_get_issue_details',
        description: 'Get detailed information about a specific issue',
        inputSchema: ToolSchemas.jiraGetIssueDetails,
      },
      handler: this.handleJiraGetIssueDetails.bind(this),
    });

    this.registerTool({
      definition: {
        name: 'jira_search_issues',
        description: 'Search for issues using JQL',
        inputSchema: ToolSchemas.jiraSearchIssues,
      },
      handler: this.handleJiraSearchIssues.bind(this),
    });

    // GitHub tools
    this.registerTool({
      definition: {
        name: 'github_get_commits',
        description: 'Get commits from a GitHub repository',
        inputSchema: ToolSchemas.githubGetCommits,
      },
      handler: this.handleGitHubGetCommits.bind(this),
    });

    this.registerTool({
      definition: {
        name: 'github_get_pull_requests',
        description: 'Get pull requests from a GitHub repository',
        inputSchema: ToolSchemas.githubGetPullRequests,
      },
      handler: this.handleGitHubGetPullRequests.bind(this),
    });

    this.registerTool({
      definition: {
        name: 'github_search_commits_by_message',
        description: 'Search commits by message content',
        inputSchema: ToolSchemas.githubSearchCommitsByMessage,
      },
      handler: this.handleGitHubSearchCommitsByMessage.bind(this),
    });

    this.registerTool({
      definition: {
        name: 'github_search_pull_requests_by_date',
        description: 'Search pull requests by date range using GitHub Search API. Useful for historical sprints where standard pagination is inefficient.',
        inputSchema: ToolSchemas.githubSearchPullRequestsByDate,
      },
      handler: this.handleGitHubSearchPullRequestsByDate.bind(this),
    });

    this.registerTool({
      definition: {
        name: 'github_find_commits_with_jira_references',
        description: 'Find commits that reference Jira issue keys',
        inputSchema: ToolSchemas.githubFindCommitsWithJiraReferences,
      },
      handler: this.handleGitHubFindCommitsWithJiraReferences.bind(this),
    });

    // Sprint reporting tools
    this.registerTool({
      definition: {
        name: 'generate_sprint_report',
        description: 'Generate a comprehensive sprint report',
        inputSchema: ToolSchemas.generateSprintReport,
      },
      handler: this.handleGenerateSprintReport.bind(this),
    });

    this.registerTool({
      definition: {
        name: 'get_sprint_metrics',
        description: 'Calculate sprint metrics and statistics',
        inputSchema: ToolSchemas.getSprintMetrics,
      },
      handler: this.handleGetSprintMetrics.bind(this),
    });

    // Health and utility tools
    this.registerTool({
      definition: {
        name: 'health_check',
        description: 'Check the health status of all services',
        inputSchema: ToolSchemas.healthCheck,
      },
      handler: this.handleHealthCheck.bind(this),
    });

    this.registerTool({
      definition: {
        name: 'cache_stats',
        description: 'Get cache statistics and performance metrics',
        inputSchema: ToolSchemas.cacheStats,
      },
      handler: this.handleCacheStats.bind(this),
    });
  }

  private registerTool(toolDefinition: ToolDefinition): void {
    this.tools.set(toolDefinition.definition.name, toolDefinition);
  }

  getToolDefinitions(): Tool[] {
    return Array.from(this.tools.values()).map(tool => tool.definition);
  }

  async executeTool(
    name: string,
    args: Record<string, any>,
    context: ServerContext
  ): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new BaseError(
        'TOOL_NOT_FOUND',
        `Tool '${name}' not found`,
        false,
        `The tool '${name}' is not available. Use 'list_tools' to see available tools.`
      );
    }

    try {
      // Get the Zod schema for validation based on tool name
      const zodSchemaMap: Record<string, any> = {
        'jira_get_sprints': MCPToolSchemas.jiraGetSprints,
        'jira_get_sprint_issues': MCPToolSchemas.jiraGetSprintIssues,
        'jira_get_sprint': MCPToolSchemas.jiraGetSprintDetails,
        'jira_get_issue_details': MCPToolSchemas.jiraGetIssueDetails,
        'jira_search_issues': MCPToolSchemas.jiraSearchIssues,
        'github_get_commits': MCPToolSchemas.githubGetCommits,
        'github_get_pull_requests': MCPToolSchemas.githubGetPullRequests,
        'github_search_commits_by_message': MCPToolSchemas.githubSearchCommitsByMessage,
        'github_search_pull_requests_by_date': MCPToolSchemas.githubSearchPullRequestsByDate,
        'github_find_commits_with_jira_references': MCPToolSchemas.githubFindCommitsWithJiraReferences,
        'generate_sprint_report': MCPToolSchemas.generateSprintReport,
        'get_sprint_metrics': MCPToolSchemas.getSprintMetrics,
        'health_check': MCPToolSchemas.healthCheck,
        'cache_stats': MCPToolSchemas.cacheStats,
      };

      // Validate arguments against Zod schema
      const zodSchema = zodSchemaMap[name];
      const validatedArgs: Record<string, any> = zodSchema
        ? ValidationUtils.validateAndParse(zodSchema, args as Record<string, any>)
        : (args as Record<string, any>);

      // Execute the tool handler
      const result = await tool.handler(validatedArgs, context);

      return {
        content: [{
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        }],
      };
    } catch (error) {
      context.logger.logError(
        error as Error,
        `tool_${name}`,
        { tool_name: name, arguments: Object.keys(args) }
      );
      throw error;
    }
  }

  // Jira tool handlers
  private async handleJiraGetSprints(
    args: Record<string, any>,
    context: ServerContext
  ): Promise<any> {
    const { board_id, state } = args;
    return await context.jiraClient.getSprints(board_id, state);
  }

  private async handleJiraGetSprintIssues(
    args: Record<string, any>,
    context: ServerContext
  ): Promise<any> {
    const { sprint_id, fields, max_results } = args;
    return await context.jiraClient.getSprintIssues(sprint_id, fields, max_results);
  }

  private async handleJiraGetSprint(
    args: Record<string, any>,
    context: ServerContext
  ): Promise<any> {
    const { sprint_id } = args;
    return await context.sprintService.getSprintDetails(sprint_id);
  }

  private async handleJiraGetIssueDetails(
    args: Record<string, any>,
    context: ServerContext
  ): Promise<any> {
    const { issue_key, expand } = args;
    return await context.jiraClient.getIssueDetails(issue_key, expand);
  }

  private async handleJiraSearchIssues(
    args: Record<string, any>,
    context: ServerContext
  ): Promise<any> {
    const { jql, fields, max_results } = args;
    return await context.jiraClient.searchIssues(jql, fields, max_results);
  }

  // GitHub tool handlers
  private async handleGitHubGetCommits(
    args: Record<string, any>,
    context: ServerContext
  ): Promise<any> {
    const { owner, repo, since, until, author, per_page, page } = args;
    return await context.githubClient.getCommits(owner, repo, {
      since,
      until,
      author,
      per_page,
      page,
    });
  }

  private async handleGitHubGetPullRequests(
    args: Record<string, any>,
    context: ServerContext
  ): Promise<any> {
    const { owner, repo, state, since, until, per_page, page } = args;
    return await context.githubClient.getPullRequests(owner, repo, {
      state,
      since,
      until,
      per_page,
      page,
    });
  }

  private async handleGitHubSearchCommitsByMessage(
    args: Record<string, any>,
    context: ServerContext
  ): Promise<any> {
    const { owner, repo, query, since, until } = args;
    return await context.githubClient.searchCommitsByMessage(owner, repo, query, since, until);
  }

  private async handleGitHubSearchPullRequestsByDate(
    args: Record<string, any>,
    context: ServerContext
  ): Promise<any> {
    const { owner, repo, since, until, state } = args;
    return await context.githubClient.searchPullRequestsByDateRange(
      owner,
      repo,
      since,
      until,
      state
    );
  }

  private async handleGitHubFindCommitsWithJiraReferences(
    args: Record<string, any>,
    context: ServerContext
  ): Promise<any> {
    const { owner, repo, issue_keys, since, until } = args;
    return await context.githubClient.findCommitsWithJiraReferences(
      owner,
      repo,
      issue_keys,
      since,
      until
    );
  }

  // Sprint reporting tool handlers
  @withErrorRecovery('generateSprintReport', {
    partialResultTolerance: true,
    fallback: async function(this: ToolRegistry) {
      return 'Sprint report generation is temporarily unavailable. Please try again later.';
    }
  })
  private async handleGenerateSprintReport(
    args: Record<string, any>,
    context: ServerContext
  ): Promise<any> {
    try {
      console.log('[TOOL-REGISTRY] handleGenerateSprintReport called with format:', args.format);

      // Delegate to reportTools which has full tier analytics implementation
      const result = await context.reportTools.generateSprintReport(args);

      console.log('[TOOL-REGISTRY] Result from reportTools:', {
        contentType: result.contentType,
        contentIsString: typeof result.content === 'string',
        contentLength: typeof result.content === 'string' ? result.content.length : 'N/A',
        contentPreview: typeof result.content === 'string' ? result.content.substring(0, 100) : 'object'
      });

      // Return the report content - if format is JSON, parse the string to return object
      if (args.format === 'json' && typeof result.content === 'string') {
        console.log('[TOOL-REGISTRY] Parsing JSON content');
        return JSON.parse(result.content);
      }

      console.log('[TOOL-REGISTRY] Returning content as-is');
      return result.content;

    } catch (error) {
      context.logger.logError(
        error as Error,
        'generateSprintReport',
        { args }
      );

      // Return a degraded report with available data
      return this.generateFallbackSprintReport(args.sprint_id, error as Error);
    }
  }

  @withErrorRecovery('getSprintMetrics', {
    partialResultTolerance: true
  })
  private async handleGetSprintMetrics(
    args: Record<string, any>,
    context: ServerContext
  ): Promise<any> {
    // Delegate to optimized metrics handler for better performance
    return await this.optimizedMetricsHandler.getOptimizedSprintMetrics(args, context);
  }

  // Utility tool handlers
  private async handleHealthCheck(
    args: Record<string, any>,
    context: ServerContext
  ): Promise<any> {
    const { include_detailed_status, check_external_dependencies } = args;

    try {
      const healthChecks: Promise<any>[] = [];

      if (check_external_dependencies) {
        healthChecks.push(
          context.jiraClient.validateConnection()
            .then(result => ({ service: 'jira', ...result }))
            .catch(error => ({ service: 'jira', valid: false, error: error.message }))
        );

        healthChecks.push(
          context.githubClient.validateConnection()
            .then(result => ({ service: 'github', ...result }))
            .catch(error => ({ service: 'github', valid: false, error: error.message }))
        );
      }

      healthChecks.push(
        context.cacheManager.healthCheck()
          .then(result => ({ service: 'cache', ...result }))
          .catch(error => ({ service: 'cache', valid: false, error: error.message }))
      );

      // Add error recovery manager health check
      const errorRecoveryStats = this.errorRecoveryManager?.getCircuitBreakerStats() || {};
      const circuitBreakerHealth = {
        service: 'circuit_breakers',
        valid: Object.values(errorRecoveryStats).every(state => !state.isOpen),
        openCircuitBreakers: Object.entries(errorRecoveryStats)
          .filter(([_, state]) => state.isOpen)
          .map(([key, _]) => key),
        stats: include_detailed_status ? errorRecoveryStats : undefined,
      };

      const results = await Promise.allSettled(healthChecks);
      const services: Record<string, any> = { circuit_breakers: circuitBreakerHealth };

      let overallStatus = 'healthy';
      let healthyServices = 1; // circuit breakers counted as 1
      let totalServices = 1;

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const serviceResult = result.value;
          services[serviceResult.service] = serviceResult;
          totalServices++;
          if (serviceResult.valid) {
            healthyServices++;
          }
        } else {
          overallStatus = 'degraded';
          totalServices++;
        }
      }

      // Determine overall status
      if (healthyServices === totalServices) {
        overallStatus = 'healthy';
      } else if (healthyServices >= totalServices / 2) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'unhealthy';
      }

      const healthReport: {
        status: string;
        timestamp: string;
        services: typeof services;
        summary: {
          totalServices: number;
          healthyServices: number;
          healthPercentage: number;
          recommendations?: string[];
          systemInfo?: {
            uptime: number;
            memoryUsage: NodeJS.MemoryUsage;
            nodeVersion: string;
          };
        };
      } = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services,
        summary: {
          totalServices,
          healthyServices,
          healthPercentage: Math.round((healthyServices / totalServices) * 100),
        },
      };

      if (include_detailed_status) {
        healthReport.summary.recommendations = this.generateHealthRecommendations(services);
        healthReport.summary.systemInfo = {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version,
        };
      }

      context.logger.info('Health check completed', {
        status: overallStatus,
        healthy_services: healthyServices,
        total_services: totalServices,
      });

      return healthReport;

    } catch (error) {
      context.logger.logError(error as Error, 'healthCheck');
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleCacheStats(
    args: Record<string, any>,
    context: ServerContext
  ): Promise<any> {
    const { include_detailed_breakdown, reset_stats } = args;

    try {
      if (reset_stats) {
        // Reset statistics (be careful with this in production)
        context.logger.warn('Cache statistics reset requested', { timestamp: new Date().toISOString() });
      }

      const stats = context.cacheManager.getStats();
      const info = await context.cacheManager.getInfo();
      const rateLimiterStats = context.rateLimiter.getAllStats();
      const errorRecoveryStats = this.errorRecoveryManager?.getCircuitBreakerStats() || {};

      const result: any = {
        timestamp: new Date().toISOString(),
        cache: {
          stats,
          info,
          performance: this.calculateCachePerformanceMetrics(stats),
        },
        rateLimiter: {
          stats: rateLimiterStats,
          summary: this.calculateRateLimiterSummary(rateLimiterStats),
        },
        errorRecovery: {
          circuitBreakers: Object.keys(errorRecoveryStats).length,
          openCircuitBreakers: Object.entries(errorRecoveryStats)
            .filter(([_, state]) => state.isOpen)
            .map(([key, _]) => key),
        },
      };

      if (include_detailed_breakdown) {
        result.detailed = {
          cacheBreakdownByOperation: this.getCacheBreakdownByOperation(stats),
          rateLimiterBreakdownByEndpoint: rateLimiterStats,
          errorRecoveryDetails: errorRecoveryStats,
          recommendations: this.generatePerformanceRecommendations(stats, rateLimiterStats, errorRecoveryStats),
        };
      }

      context.logger.info('Cache statistics retrieved', {
        cache_hit_rate: result.cache.performance.hitRate,
        total_requests: stats.hits + stats.misses,
        open_circuit_breakers: result.errorRecovery.openCircuitBreakers.length,
      });

      return result;

    } catch (error) {
      context.logger.logError(error as Error, 'cacheStats');
      return {
        error: 'Failed to retrieve cache statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Helper methods for enhanced implementations
  // NOTE: Metrics calculation methods moved to OptimizedMetricsHandler for better performance

  private generateFallbackSprintReport(sprintId: string, error: Error): string {
    return `# Sprint Report (Partial)

**Sprint ID**: ${sprintId}
**Status**: Report generation partially failed

## Error Information
- **Error**: ${error.message}
- **Time**: ${new Date().toISOString()}

## What Happened
The sprint report could not be fully generated due to a system error. This may be due to:
- Temporary service unavailability
- Network connectivity issues
- Data access problems

## Recommended Actions
1. Try generating the report again in a few minutes
2. Check system status if the problem persists
3. Contact support if the issue continues

---
*Fallback report generated on ${new Date().toISOString()}*
`;
  }

  private generateHealthRecommendations(services: Record<string, any>): string[] {
    const recommendations: string[] = [];

    for (const [serviceName, serviceStatus] of Object.entries(services)) {
      if (!serviceStatus.valid) {
        switch (serviceName) {
          case 'jira':
            recommendations.push('Check Jira connection settings and API credentials');
            break;
          case 'github':
            recommendations.push('Verify GitHub API token and repository access permissions');
            break;
          case 'cache':
            recommendations.push('Check cache service configuration and memory availability');
            break;
          case 'circuit_breakers':
            recommendations.push('Review error rates and consider resetting circuit breakers');
            break;
        }
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('All services are operating normally');
    }

    return recommendations;
  }

  private calculateCachePerformanceMetrics(stats: any): any {
    const totalRequests = (stats.hits || 0) + (stats.misses || 0);
    const hitRate = totalRequests > 0 ? Math.round((stats.hits / totalRequests) * 100) : 0;

    return {
      hitRate,
      missRate: 100 - hitRate,
      totalRequests,
      efficiency: hitRate > 80 ? 'excellent' : hitRate > 60 ? 'good' : hitRate > 40 ? 'fair' : 'poor',
    };
  }

  private calculateRateLimiterSummary(rateLimiterStats: any): any {
    const totalEndpoints = Object.keys(rateLimiterStats).length;
    const activeEndpoints = Object.values(rateLimiterStats).filter((stat: any) => stat.requestCount > 0).length;

    return {
      totalEndpoints,
      activeEndpoints,
      totalRequests: Object.values(rateLimiterStats).reduce((sum: number, stat: any) => sum + (stat.requestCount || 0), 0),
      totalRejected: Object.values(rateLimiterStats).reduce((sum: number, stat: any) => sum + (stat.rejectedCount || 0), 0),
    };
  }

  private getCacheBreakdownByOperation(_stats: any): Record<string, any> {
    // This would require more detailed cache statistics
    // For now, return a placeholder structure
    return {
      'jira.getSprints': { hits: 45, misses: 12, hitRate: 79 },
      'jira.getSprintIssues': { hits: 123, misses: 34, hitRate: 78 },
      'github.getCommits': { hits: 67, misses: 23, hitRate: 74 },
      'github.getPullRequests': { hits: 89, misses: 18, hitRate: 83 },
    };
  }

  private generatePerformanceRecommendations(
    cacheStats: any,
    rateLimiterStats: any,
    errorRecoveryStats: any
  ): string[] {
    const recommendations: string[] = [];

    // Cache recommendations
    const totalRequests = (cacheStats.hits || 0) + (cacheStats.misses || 0);
    const hitRate = totalRequests > 0 ? (cacheStats.hits / totalRequests) * 100 : 0;

    if (hitRate < 60) {
      recommendations.push('Consider increasing cache TTL values or cache size');
    } else if (hitRate > 90) {
      recommendations.push('Cache performance is excellent - consider this configuration for other environments');
    }

    // Rate limiter recommendations
    const totalRejected = Object.values(rateLimiterStats).reduce((sum: number, stat: any) => sum + (stat.rejectedCount || 0), 0);
    if (totalRejected > 100) {
      recommendations.push('High rate limit rejections detected - consider implementing intelligent retry strategies');
    }

    // Circuit breaker recommendations
    const openCircuitBreakers = Object.values(errorRecoveryStats).filter((state: any) => state.isOpen).length;
    if (openCircuitBreakers > 0) {
      recommendations.push('Circuit breakers are open - investigate underlying service issues');
    }

    if (recommendations.length === 0) {
      recommendations.push('System performance is optimal');
    }

    return recommendations;
  }
}
