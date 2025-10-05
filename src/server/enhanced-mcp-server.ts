// Enhanced MCP Server with integrated performance monitoring and cache optimization

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
import { getLogger } from '@/utils/logger';
import { createAppConfig } from '@/config/environment';
import { BaseError } from '@/utils/errors';
import { ToolRegistry } from './tool-registry';
import {
  PerformanceMonitor,
  initializeGlobalPerformanceMonitor,
  measurePerformance
} from '../performance/performance-monitor';
import { SprintService } from '@/services/sprint-service';
import { AnalyticsService } from '@/services/analytics-service';
import { ExportService } from '@/services/export-service';
import { ReportGenerator } from '@/reporting/report-generator';
import { ReportTools } from '@/tools/report-tools';

export interface EnhancedServerContext {
  config: AppConfig;
  jiraClient: JiraClient;
  githubClient: GitHubClient;
  cacheManager: CacheManager;
  cacheOptimizer: CacheOptimizer;
  rateLimiter: ServiceRateLimiter;
  logger: ReturnType<typeof getLogger>;
  performanceMonitor: PerformanceMonitor;
  sprintService: SprintService;
  analyticsService: AnalyticsService;
  exportService: ExportService;
  reportGenerator: ReportGenerator;
  reportTools: ReportTools;
}

export class EnhancedMCPServer {
  private server: Server;
  private context: EnhancedServerContext | null = null;
  private startTime: number = 0;
  private isShuttingDown: boolean = false;
  private toolRegistry: ToolRegistry;
  private performanceMonitor: PerformanceMonitor;
  private optimizationInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.server = new Server(
      {
        name: 'enhanced-jira-github-sprint-reporter',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.performanceMonitor = initializeGlobalPerformanceMonitor();
    this.toolRegistry = new ToolRegistry();
    this.setupHandlers();
    this.setupPerformanceMonitoring();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.toolRegistry.getToolDefinitions(),
      };
    });

    // Handle tool execution with performance monitoring
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
      const requestId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      return this.performanceMonitor.measureAsync(`tool_${name}`, async () => {
        try {
          this.context!.logger.info('Tool execution started', {
            type: 'tool_execution',
            tool_name: name,
            arguments: Object.keys(args || {}),
            request_id: requestId
          });

          const result = await this.toolRegistry.executeTool(
            name,
            args || {},
            this.context!
          );

          this.context!.logger.info('Tool execution completed', {
            type: 'tool_execution_success',
            tool_name: name,
            request_id: requestId
          });

          return result;
        } catch (error) {
          this.context!.logger.error(
            error as Error,
            `tool_${name}`,
            { tool_name: name, arguments: Object.keys(args || {}), request_id: requestId }
          );
          throw error;
        }
      });
    });
  }

  private setupPerformanceMonitoring(): void {
    // Setup performance monitoring event handlers
    this.performanceMonitor.on('alert', (alert) => {
      if (this.context) {
        this.context.logger.warn(`Performance Alert [${alert.severity}]: ${alert.message}`, {
          alert_rule: alert.rule,
          severity: alert.severity,
          timestamp: alert.timestamp
        });
      }
    });

    this.performanceMonitor.on('snapshot', (snapshot) => {
      if (this.context) {
        this.context.logger.debug('system_snapshot', {
          duration: snapshot.duration,
          memory_used: snapshot.memory.heapUsed,
          cache_hit_rate: snapshot.cache.hitRate,
          operations_total: snapshot.operations.total,
          average_latency: snapshot.operations.averageLatency
        });
      }
    });
  }

  @measurePerformance('server-initialization')
  async initialize(): Promise<void> {
    try {
      this.startTime = Date.now();
      const config = createAppConfig();
      const logger = getLogger(config.logging);

      logger.info('Starting Enhanced MCP Server initialization', {
        type: 'server_startup',
        version: '2.0.0',
        node_version: process.version,
        memory_usage: process.memoryUsage()
      });

      // Initialize core services
      const cacheManager = new CacheManager(config.cache);
      const rateLimiter = new ServiceRateLimiter();

      // Initialize clients with shared CacheManager for Redis support
      const jiraClient = new JiraClient(config, cacheManager);
      const githubClient = new GitHubClient(config, cacheManager);

      // Initialize cache optimizer
      const cacheOptimizer = new CacheOptimizer(cacheManager, this.performanceMonitor);

      // Initialize reporting services
      // Note: SprintService creates its own AnalyticsService internally
      const sprintService = new SprintService(jiraClient, githubClient, cacheManager);
      const analyticsService = (sprintService as any).analyticsService; // Access internal instance
      const exportService = new ExportService();
      const reportGenerator = new ReportGenerator(sprintService);
      const reportTools = new ReportTools(sprintService, analyticsService, exportService, reportGenerator);

      // Setup server context
      this.context = {
        config,
        jiraClient,
        githubClient,
        cacheManager,
        cacheOptimizer,
        rateLimiter,
        logger,
        performanceMonitor: this.performanceMonitor,
        sprintService,
        analyticsService,
        exportService,
        reportGenerator,
        reportTools
      };

      // Initialize tool registry with enhanced context
      this.toolRegistry.initializeErrorRecovery(logger);
      this.toolRegistry.registerAllTools();

      // Perform health checks
      await this.performInitialHealthChecks();

      // Setup automatic optimization
      this.schedulePeriodicOptimization();

      // Setup health monitoring
      this.scheduleHealthMonitoring();

      logger.info('Enhanced MCP Server initialization completed', {
        type: 'server_ready',
        initialization_time: Date.now() - this.startTime,
        capabilities: this.getServerCapabilities()
      });

    } catch (error) {
      const logger = this.context?.logger || getLogger({ level: 'error', enableConsole: false });
      logger.error(error as Error, 'server_initialization');
      throw error;
    }
  }

  private async performInitialHealthChecks(): Promise<void> {
    if (!this.context) return;

    const healthChecks = [
      { name: 'jira', check: () => this.context!.jiraClient.validateConnection() },
      { name: 'github', check: () => this.context!.githubClient.validateConnection() },
      { name: 'cache', check: () => this.context!.cacheManager.healthCheck() }
    ];

    for (const { name, check } of healthChecks) {
      try {
        const result = await check();
        this.context.logger.info(`${name} service health check passed`, {
          type: 'health_check_success',
          service: name,
          result
        });
      } catch (error) {
        this.context.logger.warn(`${name} service health check failed`, {
          type: 'health_check_warning',
          service: name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private schedulePeriodicOptimization(): void {
    // Run cache optimization every 15 minutes
    this.optimizationInterval = setInterval(async () => {
      if (!this.context || this.isShuttingDown) return;

      try {
        const result = await this.context.cacheOptimizer.optimizeCache();

        this.context.logger.info('Periodic cache optimization completed', {
          type: 'cache_optimization',
          keys_processed: result.keysProcessed,
          space_saved: result.spaceSaved,
          actions: result.actionsPerformed,
          recommendations: result.recommendations.length
        });

      } catch (error) {
        this.context.logger.error(error as Error, 'cache_optimization');
      }
    }, 15 * 60 * 1000); // 15 minutes
  }

  private scheduleHealthMonitoring(): void {
    // Create performance snapshots every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      if (!this.context || this.isShuttingDown) return;

      try {
        const [jiraHealth, githubHealth, cacheHealth] = await Promise.allSettled([
          this.context.jiraClient.healthCheck(),
          this.context.githubClient.healthCheck(),
          this.context.cacheManager.healthCheck()
        ]);

        const serviceHealths = {
          jira: this.convertHealthResult(jiraHealth),
          github: this.convertHealthResult(githubHealth),
          cache: this.convertHealthResult(cacheHealth)
        };

        const cacheStats = this.context.cacheManager.getStats();

        this.performanceMonitor.createSnapshot(cacheStats, serviceHealths);

      } catch (error) {
        this.context.logger.error(error as Error, 'health_monitoring');
      }
    }, 30 * 1000); // 30 seconds
  }

  private convertHealthResult(result: PromiseSettledResult<any>): any {
    if (result.status === 'fulfilled') {
      const health = result.value;
      return {
        status: health.healthy ? 'healthy' : 'unhealthy',
        latency: health.latency || 0,
        errorRate: 0,
        consecutiveErrors: 0,
        lastError: health.error
      };
    } else {
      return {
        status: 'unhealthy',
        latency: 0,
        errorRate: 1,
        consecutiveErrors: 1,
        lastError: result.reason?.message || 'Health check failed'
      };
    }
  }

  private getServerCapabilities(): string[] {
    return [
      'enhanced_performance_monitoring',
      'intelligent_cache_optimization',
      'automatic_error_recovery',
      'comprehensive_template_engine',
      'cross_service_correlation',
      'real_time_health_monitoring',
      'adaptive_rate_limiting',
      'predictive_cache_warming'
    ];
  }

  async getHealthStatus(): Promise<HealthStatus> {
    if (!this.context) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 0,
        version: '2.0.0',
        checks: []
      };
    }

    try {
      const [jiraHealth, githubHealth, cacheHealth] = await Promise.allSettled([
        this.context.jiraClient.healthCheck(),
        this.context.githubClient.healthCheck(),
        this.context.cacheManager.healthCheck()
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
        uptime: Date.now() - this.startTime,
        version: '2.0.0',
        checks
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        version: '2.0.0',
        checks: []
      };
    }
  }


  getServerInfo(): ServerInfo {
    return {
      name: 'enhanced-jira-github-sprint-reporter',
      version: '2.0.0',
      uptime: this.context ? Date.now() - this.startTime : 0,
      capabilities: this.getServerCapabilities()
    };
  }

  getContext(): EnhancedServerContext {
    if (!this.context) {
      throw new BaseError(
        'SERVER_NOT_INITIALIZED',
        'Server context not available',
        false,
        'Server is not initialized'
      );
    }
    return this.context;
  }

  async warmCache(context: {
    sprintIds?: string[];
    repositories?: Array<{ owner: string; repo: string }>;
    issueKeys?: string[];
  }): Promise<void> {
    if (!this.context) {
      throw new BaseError('SERVER_NOT_INITIALIZED', 'Server not initialized', false, 'Cannot warm cache');
    }

    await this.context.cacheOptimizer.warmCache(context);
  }

  async optimizeCache(): Promise<any> {
    if (!this.context) {
      throw new BaseError('SERVER_NOT_INITIALIZED', 'Server not initialized', false, 'Cannot optimize cache');
    }

    return await this.context.cacheOptimizer.optimizeCache();
  }

  getPerformanceMetrics(): any {
    return {
      summary: this.performanceMonitor.getPerformanceSummary(),
      recentSnapshots: this.performanceMonitor.getRecentSnapshots(10),
      cacheOptimization: this.context?.cacheOptimizer.getOptimizationSummary()
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    if (this.context) {
      this.context.logger.info('Enhanced MCP Server started and listening', {
        type: 'server_listening',
        transport: 'stdio',
        tools: this.toolRegistry.getToolDefinitions().length
      });
    }
  }

  @measurePerformance('server-shutdown')
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;

    try {
      if (this.context) {
        this.context.logger.info('Enhanced MCP Server shutdown initiated', {
          type: 'server_shutdown',
          uptime: Date.now() - this.startTime
        });
      }

      // Clear intervals
      if (this.optimizationInterval) {
        clearInterval(this.optimizationInterval);
      }
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Cleanup services
      if (this.context) {
        await Promise.allSettled([
          this.context.cacheManager.cleanup(),
          this.context.rateLimiter.destroy()
        ]);
      }

      // Cleanup performance monitor
      this.performanceMonitor.cleanup();

      if (this.context) {
        this.context.logger.info('Enhanced MCP Server shutdown completed', {
          type: 'server_shutdown_complete'
        });
      }

    } catch (error) {
      if (this.context) {
        this.context.logger.error(error as Error, 'server_shutdown');
      }
    } finally {
      process.exit(0);
    }
  }
}

// Process signal handlers
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  if (global.mcpServer) {
    await (global.mcpServer as EnhancedMCPServer).shutdown();
  }
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  if (global.mcpServer) {
    await (global.mcpServer as EnhancedMCPServer).shutdown();
  }
});

// Global server instance for signal handlers
declare global {
  var mcpServer: EnhancedMCPServer | undefined;
}

