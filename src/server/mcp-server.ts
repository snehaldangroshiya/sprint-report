// MCP Server implementation for Jira-GitHub Sprint Reporting

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { AppConfig, ServerInfo, HealthStatus } from '@/types';
import { JiraClient } from '@/clients/jira-client';
import { GitHubClient } from '@/clients/github-client';
import { CacheManager } from '@/cache/cache-manager';
import { CacheOptimizer } from '@/cache/cache-optimizer';
import { ServiceRateLimiter } from '@/utils/rate-limiter';
import { Logger, getLogger } from '@/utils/logger';
import { createAppConfig } from '@/config/environment';
import { BaseError } from '@/utils/errors';
import { ToolRegistry } from './tool-registry';
import { initializeGlobalPerformanceMonitor } from '@/performance/performance-monitor';
import { SprintService } from '@/services/sprint-service';
import { AnalyticsService } from '@/services/analytics-service';
import { ExportService } from '@/services/export-service';
import { ReportGenerator } from '@/reporting/report-generator';
import { ReportTools } from '@/tools/report-tools';
import { EnhancedServerContext } from './enhanced-mcp-server';

// Legacy ServerContext - kept for backwards compatibility
export interface ServerContext {
  config: AppConfig;
  jiraClient: JiraClient;
  githubClient: GitHubClient;
  cacheManager: CacheManager;
  rateLimiter: ServiceRateLimiter;
  logger: Logger;
  sprintService: SprintService;
  analyticsService: AnalyticsService;
  exportService: ExportService;
  reportGenerator: ReportGenerator;
  reportTools: ReportTools;
}

export class MCPServer {
  private server: Server;
  private context: EnhancedServerContext | null = null;
  private startTime: number = 0;
  private isShuttingDown: boolean = false;
  private toolRegistry: ToolRegistry;

  constructor() {
    this.server = new Server(
      {
        name: 'jira-github-sprint-reporter',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.toolRegistry = new ToolRegistry();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.toolRegistry.getToolDefinitions(),
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.context) {
        throw new BaseError(
          'SERVER_NOT_INITIALIZED',
          'Server not initialized',
          false,
          'Server is starting up. Please try again in a moment.'
        );
      }

      const { name, arguments: args } = request.params;

      try {
        this.context.logger.info('Tool execution started', {
          type: 'tool_execution',
          tool_name: name,
          arguments: Object.keys(args || {}),
        });

        const startTime = Date.now();
        const result = await this.toolRegistry.executeTool(
          name,
          args || {},
          this.context
        );
        const duration = Date.now() - startTime;

        this.context.logger.debug(`Tool ${name} performance`, {
          duration,
          tool_name: name,
        });

        this.context.logger.info('Tool execution completed', {
          type: 'tool_execution_complete',
          tool_name: name,
          success: true,
          duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - Date.now();

        this.context.logger.error(
          error as Error,
          `tool_${name}`,
          {
            tool_name: name,
            arguments: Object.keys(args || {}),
            duration,
          }
        );

        // Transform internal errors to MCP-compatible format
        if (error instanceof BaseError) {
          return {
            content: [{
              type: 'text',
              text: `Error: ${error.userMessage}`,
            }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text',
            text: `Unexpected error occurred. Please try again later.`,
          }],
          isError: true,
        };
      }
    });

    // Handle shutdown gracefully
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGTSTP', () => this.shutdown());
  }

  async initialize(): Promise<void> {
    try {
      this.startTime = Date.now();

      // Load configuration
      const config = createAppConfig();

      // Initialize logger first
      const logger = getLogger({
        level: config.logging.level as 'error' | 'warn' | 'info' | 'debug',
        enableConsole: config.logging.enableApiLogging
      });

      logger.info('Server initialization started', {
        type: 'server_startup',
        version: '1.0.0',
        node_version: process.version,
        environment: config.nodeEnv,
      });

      // Initialize cache manager
      const cacheManager = new CacheManager(config.cache);

      // Initialize rate limiter
      const rateLimiter = new ServiceRateLimiter();

      // Initialize API clients
      const jiraClient = new JiraClient(config);
      const githubClient = new GitHubClient(config);

      // Initialize performance monitoring and optimization
      const performanceMonitor = initializeGlobalPerformanceMonitor();
      const cacheOptimizer = new CacheOptimizer(cacheManager, performanceMonitor);

      // Initialize reporting services
      const sprintService = new SprintService(jiraClient, githubClient, cacheManager);
      const analyticsService = (sprintService as any).analyticsService;
      const exportService = new ExportService();
      const reportGenerator = new ReportGenerator(sprintService);
      const reportTools = new ReportTools(sprintService, analyticsService, exportService, reportGenerator);

      // Store context
      this.context = {
        config,
        jiraClient,
        githubClient,
        cacheManager,
        cacheOptimizer,
        rateLimiter,
        logger,
        performanceMonitor,
        sprintService,
        analyticsService,
        exportService,
        reportGenerator,
        reportTools,
      };

      // Register all tools with the registry
      this.toolRegistry.registerAllTools();

      // Perform health checks
      await this.performStartupHealthChecks();

      const initTime = Date.now() - this.startTime;
      logger.info('Server initialization completed', {
        type: 'server_ready',
        initialization_time: initTime,
        tools_registered: this.toolRegistry.getToolDefinitions().length,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to initialize MCP server:', errorMessage);

      if (this.context?.logger) {
        this.context.logger.error(
          error as Error,
          'server_initialization',
          { phase: 'startup' }
        );
      }

      throw error;
    }
  }

  private async performStartupHealthChecks(): Promise<void> {
    if (!this.context) {
      throw new Error('Context not initialized');
    }

    const { logger, jiraClient, githubClient, cacheManager } = this.context;
    const healthChecks: Array<{ name: string; check: () => Promise<any> }> = [];

    // Jira connection health check
    healthChecks.push({
      name: 'jira',
      check: () => jiraClient.validateConnection(),
    });

    // GitHub connection health check
    healthChecks.push({
      name: 'github',
      check: () => githubClient.validateConnection(),
    });

    // Cache health check
    healthChecks.push({
      name: 'cache',
      check: () => cacheManager.healthCheck(),
    });

    // Run all health checks in parallel
    const results = await Promise.allSettled(
      healthChecks.map(async ({ name, check }) => {
        const startTime = Date.now();
        try {
          const result = await check();
          const duration = Date.now() - startTime;

          logger.debug(`Health check passed: ${name}`, { duration, result });
          return { name, success: true, result, duration };
        } catch (error) {
          const duration = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          logger.error(error as Error, `Health check failed: ${name}`, { duration });
          return { name, success: false, error: errorMessage, duration };
        }
      })
    );

    // Analyze results
    const failedChecks = results
      .map((result, index) => ({
        name: healthChecks[index]?.name || 'unknown',
        result: result.status === 'fulfilled' ? result.value : { success: false, error: result.reason },
      }))
      .filter(({ result }) => !result.success);

    if (failedChecks.length > 0) {
      logger.warn('Some health checks failed during startup', {
        type: 'health_check_failures',
        failed_services: failedChecks.map(check => check.name),
        failures: failedChecks.map(check => ({
          service: check.name,
          error: check.result.error,
        })),
      });

      // Log warnings but don't fail startup - services may recover
      for (const { name, result } of failedChecks) {
        logger.warn(`Health check failed for ${name}`, {
          service: name,
          error: result.error,
          impact: 'Service may be degraded',
        });
      }
    }
  }

  async run(): Promise<void> {
    await this.initialize();

    if (!this.context) {
      throw new Error('Server context not initialized');
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.context.logger.info('MCP Server started successfully', {
      type: 'server_started',
      transport: 'stdio',
      tools_available: this.toolRegistry.getToolDefinitions().length,
      uptime: Date.now() - this.startTime,
    });

    // Keep the process alive
    process.stdin.resume();
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown || !this.context) {
      return;
    }

    this.isShuttingDown = true;
    const { logger, cacheManager, rateLimiter } = this.context;

    logger.info('Server shutdown initiated', {
      type: 'server_shutdown',
      uptime: Date.now() - this.startTime,
    });

    try {
      // Cleanup resources
      await Promise.allSettled([
        cacheManager.cleanup(),
        rateLimiter.destroy()
      ]);

      logger.info('Server shutdown completed gracefully', {
        type: 'server_shutdown_complete',
        total_uptime: Date.now() - this.startTime,
      });

    } catch (error) {
      console.error('Error during shutdown:', error);
    } finally {
      process.exit(0);
    }
  }

  // Health check endpoint for monitoring
  async getHealthStatus(): Promise<HealthStatus> {
    if (!this.context) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 0,
        version: '1.0.0',
        checks: []
      };
    }

    const { jiraClient, githubClient, cacheManager } = this.context;
    const uptime = Date.now() - this.startTime;

    try {
      // Perform parallel health checks
      const [jiraHealth, githubHealth, cacheHealth] = await Promise.allSettled([
        jiraClient.healthCheck(),
        githubClient.healthCheck(),
        cacheManager.healthCheck(),
      ]);

      const checks = [
        {
          name: 'jira',
          status: (jiraHealth.status === 'fulfilled' && jiraHealth.value.healthy ? 'healthy' : 'unhealthy') as 'healthy' | 'unhealthy',
          responseTime: jiraHealth.status === 'fulfilled' ? ('responseTime' in jiraHealth.value ? jiraHealth.value.responseTime : (jiraHealth.value as any).latency || 0) : 0,
          error: jiraHealth.status === 'rejected' ? jiraHealth.reason?.message : undefined
        },
        {
          name: 'github',
          status: (githubHealth.status === 'fulfilled' && githubHealth.value.healthy ? 'healthy' : 'unhealthy') as 'healthy' | 'unhealthy',
          responseTime: githubHealth.status === 'fulfilled' ? ('responseTime' in githubHealth.value ? githubHealth.value.responseTime : (githubHealth.value as any).latency || 0) : 0,
          error: githubHealth.status === 'rejected' ? githubHealth.reason?.message : undefined
        },
        {
          name: 'cache',
          status: (cacheHealth.status === 'fulfilled' && cacheHealth.value.healthy ? 'healthy' : 'unhealthy') as 'healthy' | 'unhealthy',
          responseTime: cacheHealth.status === 'fulfilled' ? ('responseTime' in cacheHealth.value ? cacheHealth.value.responseTime : (cacheHealth.value as any).latency || 0) : 0,
          error: cacheHealth.status === 'rejected' ? cacheHealth.reason?.message : undefined
        }
      ];

      const allHealthy = checks.every(check => check.status === 'healthy');

      return {
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime,
        version: '1.0.0',
        checks
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime,
        version: '1.0.0',
        checks: []
      };
    }
  }

  // Get server information
  getServerInfo(): ServerInfo {
    return {
      name: 'jira-github-sprint-reporter',
      version: '1.0.0',
      uptime: this.context ? Date.now() - this.startTime : 0,
      capabilities: ['jira_integration', 'github_integration', 'sprint_reporting']
    };
  }
}