// Enhanced MCP Server with integrated performance monitoring and cache optimization

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  PerformanceMonitor,
  initializeGlobalPerformanceMonitor,
  measurePerformance,
} from '../performance/performance-monitor';

import { ToolRegistry } from './tool-registry';

import { CacheManager } from '@/cache/cache-manager';
import { CacheOptimizer } from '@/cache/cache-optimizer';
import { GitHubClient } from '@/clients/github-client';
import { GitHubGraphQLClient } from '@/clients/github-graphql-client';
import { JiraClient } from '@/clients/jira-client';
import { createAppConfig } from '@/config/environment';
import { ReportGenerator } from '@/reporting/report-generator';
import { AnalyticsService } from '@/services/analytics-service';
import { ExportService } from '@/services/export-service';
import { SprintService } from '@/services/sprint-service';
import { ReportTools } from '@/tools/report-tools';
import { AppConfig, ServerInfo, HealthStatus } from '@/types';
import { BaseError } from '@/utils/errors';
import { getLogger } from '@/utils/logger';
import { ServiceRateLimiter } from '@/utils/rate-limiter';

export interface EnhancedServerContext {
  config: AppConfig;
  jiraClient: JiraClient;
  githubClient: GitHubClient;
  githubGraphQLClient?: GitHubGraphQLClient;
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
  private readonly healthCheckIntervalMs: number;

  constructor(options?: { healthCheckIntervalMs?: number }) {
    // Stdio mode default: 5 minutes (less frequent for desktop apps)
    // HTTP mode (api-server) should override to 30s
    this.healthCheckIntervalMs =
      options?.healthCheckIntervalMs ?? 5 * 60 * 1000;
    this.server = new Server(
      {
        name: 'enhanced-jira-github-sprint-reporter',
        version: '2.2.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
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
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
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
            request_id: requestId,
          });

          const result = await this.toolRegistry.executeTool(
            name,
            args || {},
            this.context!
          );

          this.context!.logger.info('Tool execution completed', {
            type: 'tool_execution_success',
            tool_name: name,
            request_id: requestId,
          });

          return result;
        } catch (error) {
          this.context!.logger.error(error as Error, `tool_${name}`, {
            tool_name: name,
            arguments: Object.keys(args || {}),
            request_id: requestId,
          });
          throw error;
        }
      });
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: this.getResourceDefinitions(),
      };
    });

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async request => {
      if (!this.context) {
        throw new BaseError(
          'SERVER_NOT_INITIALIZED',
          'Server not initialized',
          false,
          'Server is starting up. Please try again in a moment.'
        );
      }

      const { uri } = request.params;
      return await this.readResource(uri);
    });

    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: this.getPromptDefinitions(),
      };
    });

    // Get prompt with arguments
    this.server.setRequestHandler(GetPromptRequestSchema, async request => {
      const { name, arguments: args } = request.params;
      return await this.getPrompt(name, args || {});
    });
  }

  private setupPerformanceMonitoring(): void {
    // Setup performance monitoring event handlers
    this.performanceMonitor.on('alert', alert => {
      if (this.context) {
        this.context.logger.warn(
          `Performance Alert [${alert.severity}]: ${alert.message}`,
          {
            alert_rule: alert.rule,
            severity: alert.severity,
            timestamp: alert.timestamp,
          }
        );
      }
    });

    this.performanceMonitor.on('snapshot', snapshot => {
      if (this.context) {
        this.context.logger.debug('system_snapshot', {
          duration: snapshot.duration,
          memory_used: snapshot.memory.heapUsed,
          cache_hit_rate: snapshot.cache.hitRate,
          operations_total: snapshot.operations.total,
          average_latency: snapshot.operations.averageLatency,
        });
      }
    });
  }

  private getResourceDefinitions(): any[] {
    return [
      {
        uri: 'sprint://active',
        name: 'Active Sprint',
        description: 'Current active sprint information and metrics',
        mimeType: 'application/json',
      },
      {
        uri: 'sprint://recent',
        name: 'Recent Sprints',
        description: 'List of recently completed sprints',
        mimeType: 'application/json',
      },
      {
        uri: 'reports://recent',
        name: 'Recent Reports',
        description: 'Recently generated sprint reports',
        mimeType: 'application/json',
      },
      {
        uri: 'analytics://dashboard',
        name: 'Dashboard Analytics',
        description: 'Real-time dashboard metrics and performance data',
        mimeType: 'application/json',
      },
      {
        uri: 'config://server',
        name: 'Server Configuration',
        description: 'Server configuration and capabilities information',
        mimeType: 'application/json',
      },
      {
        uri: 'health://status',
        name: 'Health Status',
        description: 'Current health status of all services',
        mimeType: 'application/json',
      },
    ];
  }

  private async readResource(uri: string): Promise<any> {
    if (!this.context) {
      throw new BaseError(
        'SERVER_NOT_INITIALIZED',
        'Server not initialized',
        false,
        'Cannot read resource'
      );
    }

    try {
      // Parse URI scheme and path
      const parts = uri.split('://');
      const scheme = parts[0];
      const path = parts[1] || '';

      switch (scheme) {
        case 'sprint':
          return await this.readSprintResource(path);
        case 'reports':
          return await this.readReportsResource(path);
        case 'analytics':
          return await this.readAnalyticsResource(path);
        case 'config':
          return await this.readConfigResource(path);
        case 'health':
          return await this.readHealthResource(path);
        default:
          throw new BaseError(
            'INVALID_RESOURCE',
            `Unknown resource scheme: ${scheme}`,
            false,
            'Resource URI must start with sprint://, reports://, analytics://, config://, or health://'
          );
      }
    } catch (error) {
      this.context.logger.error(error as Error, 'resource_read', { uri });
      throw error;
    }
  }

  private async readSprintResource(path: string): Promise<any> {
    if (path === 'active') {
      // Get active sprint for default board (6306)
      const boardId = '6306';
      const allSprints = await this.context!.sprintService.getSprints(boardId);
      const activeSprints = allSprints.filter((s: any) => s.state === 'active');

      if (activeSprints.length === 0) {
        return {
          contents: [
            {
              uri: 'sprint://active',
              mimeType: 'application/json',
              text: JSON.stringify(
                { message: 'No active sprint found' },
                null,
                2
              ),
            },
          ],
        };
      }

      const activeSprint = activeSprints[0];
      if (!activeSprint) {
        return {
          contents: [
            {
              uri: 'sprint://active',
              mimeType: 'application/json',
              text: JSON.stringify(
                { message: 'No active sprint found' },
                null,
                2
              ),
            },
          ],
        };
      }

      const details = await this.context!.sprintService.getSprintDetails(
        activeSprint.id
      );

      return {
        contents: [
          {
            uri: 'sprint://active',
            mimeType: 'application/json',
            text: JSON.stringify({ sprint: activeSprint, details }, null, 2),
          },
        ],
      };
    } else if (path === 'recent') {
      const boardId = '6306';
      const allSprints = await this.context!.sprintService.getSprints(boardId);
      const closedSprints = allSprints.filter((s: any) => s.state === 'closed');
      const recent = closedSprints.slice(0, 5); // Last 5 sprints

      return {
        contents: [
          {
            uri: 'sprint://recent',
            mimeType: 'application/json',
            text: JSON.stringify(
              { sprints: recent, count: recent.length },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new BaseError(
      'INVALID_RESOURCE_PATH',
      `Unknown sprint resource path: ${path}`,
      false,
      'Valid paths: active, recent'
    );
  }

  private async readReportsResource(path: string): Promise<any> {
    if (path === 'recent') {
      const reports = this.context!.reportGenerator.getAllReports();
      const recent = reports.slice(0, 10); // Last 10 reports

      return {
        contents: [
          {
            uri: 'reports://recent',
            mimeType: 'application/json',
            text: JSON.stringify(
              { reports: recent, count: recent.length },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new BaseError(
      'INVALID_RESOURCE_PATH',
      `Unknown reports resource path: ${path}`,
      false,
      'Valid paths: recent'
    );
  }

  private async readAnalyticsResource(path: string): Promise<any> {
    if (path === 'dashboard') {
      const metrics =
        await this.context!.analyticsService.getDashboardMetrics();

      return {
        contents: [
          {
            uri: 'analytics://dashboard',
            mimeType: 'application/json',
            text: JSON.stringify(metrics, null, 2),
          },
        ],
      };
    }

    throw new BaseError(
      'INVALID_RESOURCE_PATH',
      `Unknown analytics resource path: ${path}`,
      false,
      'Valid paths: dashboard'
    );
  }

  private async readConfigResource(path: string): Promise<any> {
    if (path === 'server') {
      const config = {
        server: this.getServerInfo(),
        capabilities: this.getServerCapabilities(),
        performance: this.performanceMonitor.getPerformanceSummary(),
        cache: await this.context!.cacheManager.getInfo(),
      };

      return {
        contents: [
          {
            uri: 'config://server',
            mimeType: 'application/json',
            text: JSON.stringify(config, null, 2),
          },
        ],
      };
    }

    throw new BaseError(
      'INVALID_RESOURCE_PATH',
      `Unknown config resource path: ${path}`,
      false,
      'Valid paths: server'
    );
  }

  private async readHealthResource(path: string): Promise<any> {
    if (path === 'status') {
      const health = await this.getHealthStatus();

      return {
        contents: [
          {
            uri: 'health://status',
            mimeType: 'application/json',
            text: JSON.stringify(health, null, 2),
          },
        ],
      };
    }

    throw new BaseError(
      'INVALID_RESOURCE_PATH',
      `Unknown health resource path: ${path}`,
      false,
      'Valid paths: status'
    );
  }

  private getPromptDefinitions(): any[] {
    return [
      {
        name: 'generate-sprint-report',
        description:
          'Generate a comprehensive sprint report with metrics and analysis',
        arguments: [
          {
            name: 'sprint_id',
            description: 'Sprint ID to generate report for',
            required: true,
          },
          {
            name: 'format',
            description: 'Report format (html, markdown, json)',
            required: false,
          },
          {
            name: 'include_github',
            description: 'Include GitHub commit and PR data',
            required: false,
          },
        ],
      },
      {
        name: 'analyze-sprint-performance',
        description:
          'Analyze sprint performance with velocity, completion rate, and trends',
        arguments: [
          {
            name: 'sprint_id',
            description: 'Sprint ID to analyze',
            required: true,
          },
          {
            name: 'compare_previous',
            description: 'Include comparison with previous sprints',
            required: false,
          },
        ],
      },
      {
        name: 'compare-sprints',
        description: 'Compare metrics and performance across multiple sprints',
        arguments: [
          {
            name: 'sprint_ids',
            description: 'Comma-separated list of sprint IDs to compare',
            required: true,
          },
          {
            name: 'metrics',
            description:
              'Specific metrics to compare (velocity, completion, quality)',
            required: false,
          },
        ],
      },
      {
        name: 'generate-release-notes',
        description:
          'Generate release notes from sprint issues and GitHub commits',
        arguments: [
          {
            name: 'sprint_id',
            description: 'Sprint ID for release notes',
            required: true,
          },
          {
            name: 'repository',
            description: 'GitHub repository (owner/repo)',
            required: false,
          },
        ],
      },
      {
        name: 'executive-summary',
        description:
          'Generate executive-level sprint summary with key highlights',
        arguments: [
          {
            name: 'sprint_id',
            description: 'Sprint ID to summarize',
            required: true,
          },
          {
            name: 'focus_areas',
            description:
              'Key areas to highlight (achievements, risks, next-steps)',
            required: false,
          },
        ],
      },
    ];
  }

  private async getPrompt(
    name: string,
    args: Record<string, any>
  ): Promise<any> {
    switch (name) {
      case 'generate-sprint-report':
        return this.getSprintReportPrompt(args);
      case 'analyze-sprint-performance':
        return this.getSprintAnalysisPrompt(args);
      case 'compare-sprints':
        return this.getCompareSprintsPrompt(args);
      case 'generate-release-notes':
        return this.getReleaseNotesPrompt(args);
      case 'executive-summary':
        return this.getExecutiveSummaryPrompt(args);
      default:
        throw new BaseError(
          'INVALID_PROMPT',
          `Unknown prompt: ${name}`,
          false,
          'Valid prompts: generate-sprint-report, analyze-sprint-performance, compare-sprints, generate-release-notes, executive-summary'
        );
    }
  }

  private async getSprintReportPrompt(args: Record<string, any>): Promise<any> {
    const { sprint_id, format = 'markdown', include_github = 'true' } = args;

    if (!sprint_id) {
      throw new BaseError(
        'MISSING_ARGUMENT',
        'sprint_id is required',
        false,
        'Please provide a sprint_id'
      );
    }

    const prompt = `Generate a comprehensive sprint report for sprint ${sprint_id}.

Format: ${format}
Include GitHub data: ${include_github}

Please use the generate_sprint_report tool with these parameters:
- sprint_id: "${sprint_id}"
- format: "${format}"
- include_tier1: true
- include_tier2: true
- include_tier3: true

The report should include:
1. Sprint overview and timeline
2. Completion metrics (story points, issues)
3. Team velocity and performance trends
4. Quality metrics (bugs, blockers)
${include_github === 'true' ? '5. GitHub commit activity and PR statistics\n6. Code review metrics' : ''}

Focus on actionable insights and clear data visualization.`;

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: prompt,
          },
        },
      ],
    };
  }

  private async getSprintAnalysisPrompt(
    args: Record<string, any>
  ): Promise<any> {
    const { sprint_id, compare_previous = 'true' } = args;

    if (!sprint_id) {
      throw new BaseError(
        'MISSING_ARGUMENT',
        'sprint_id is required',
        false,
        'Please provide a sprint_id'
      );
    }

    const prompt = `Analyze the performance of sprint ${sprint_id}.

Compare with previous sprints: ${compare_previous}

Use the get_analytics_report tool to gather comprehensive analytics, then provide:

1. **Velocity Analysis**
   - Current sprint velocity vs historical average
   - Trend direction (improving/declining)
   - Forecast for next sprint

2. **Completion Rate**
   - Story points completed vs committed
   - Issue completion percentage
   - Carryover analysis

3. **Quality Metrics**
   - Bug introduction rate
   - Blocker frequency
   - Cycle time trends

4. **Team Performance**
   - Capacity utilization
   - Work distribution
   - Productivity indicators

${compare_previous === 'true' ? '5. **Historical Comparison**\n   - Compare last 3-5 sprints\n   - Identify patterns and trends\n   - Highlight improvements or concerns' : ''}

Provide actionable recommendations for improvement.`;

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: prompt,
          },
        },
      ],
    };
  }

  private async getCompareSprintsPrompt(
    args: Record<string, any>
  ): Promise<any> {
    const { sprint_ids, metrics = 'all' } = args;

    if (!sprint_ids) {
      throw new BaseError(
        'MISSING_ARGUMENT',
        'sprint_ids is required',
        false,
        'Please provide comma-separated sprint_ids'
      );
    }

    const sprintList = sprint_ids.split(',').map((id: string) => id.trim());

    const prompt = `Compare performance across multiple sprints: ${sprintList.join(', ')}

Metrics to focus on: ${metrics}

For each sprint, use the get_sprint_metrics tool, then create a comparative analysis:

1. **Velocity Comparison**
   - Story points delivered per sprint
   - Velocity trends and patterns
   - Best and worst performing sprints

2. **Completion Rate Comparison**
   - Percentage of committed work completed
   - Issue completion rates
   - Carryover patterns

3. **Quality Metrics Comparison**
   - Bug rates across sprints
   - Blocker frequency
   - Technical debt accumulation

4. **Team Efficiency**
   - Cycle time trends
   - Work distribution patterns
   - Capacity utilization changes

5. **Key Insights**
   - What factors contributed to high-performing sprints?
   - What challenges impacted lower-performing sprints?
   - Recommendations for consistent improvement

Present the comparison in a clear table format with trend indicators (↑/↓/→).`;

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: prompt,
          },
        },
      ],
    };
  }

  private async getReleaseNotesPrompt(args: Record<string, any>): Promise<any> {
    const { sprint_id, repository } = args;

    if (!sprint_id) {
      throw new BaseError(
        'MISSING_ARGUMENT',
        'sprint_id is required',
        false,
        'Please provide a sprint_id'
      );
    }

    const prompt = `Generate professional release notes for sprint ${sprint_id}.
${repository ? `\nGitHub Repository: ${repository}` : ''}

Use the following tools to gather information:
1. get_sprint_issues - Get all completed issues
2. ${repository ? 'get_commits and get_pull_requests - Get GitHub activity' : 'Skip GitHub integration'}

Structure the release notes as follows:

## Release Notes - Sprint ${sprint_id}

### 🎯 Highlights
- Major features delivered
- Key improvements
- Important fixes

### ✨ New Features
[List user stories and features completed]

### 🔧 Improvements
[List enhancements and optimizations]

### 🐛 Bug Fixes
[List bugs resolved]

### 📊 Sprint Metrics
- Story Points: [completed/committed]
- Issues: [completed/total]
- Velocity: [current]

${repository ? '### 💻 Code Changes\n- Commits: [count]\n- Pull Requests: [merged/total]\n- Contributors: [list]' : ''}

### 🚀 Next Sprint Focus
[Preview of upcoming priorities]

Use clear, user-friendly language. Focus on value delivered to users.`;

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: prompt,
          },
        },
      ],
    };
  }

  private async getExecutiveSummaryPrompt(
    args: Record<string, any>
  ): Promise<any> {
    const { sprint_id, focus_areas = 'achievements,risks,next-steps' } = args;

    if (!sprint_id) {
      throw new BaseError(
        'MISSING_ARGUMENT',
        'sprint_id is required',
        false,
        'Please provide a sprint_id'
      );
    }

    const areas = focus_areas.split(',').map((a: string) => a.trim());

    const prompt = `Generate an executive-level summary for sprint ${sprint_id}.

Focus areas: ${areas.join(', ')}

Use get_sprint_metrics and get_analytics_report to gather data, then create a concise summary:

## Executive Summary - Sprint ${sprint_id}

### ⚡ At a Glance
- Status: [Green/Yellow/Red]
- Velocity: [X points, Y% vs target]
- Completion: [X%, on track/behind/ahead]

${areas.includes('achievements') ? '### 🏆 Key Achievements\n- [3-5 bullet points of major wins]\n- Focus on business value delivered\n' : ''}

${areas.includes('risks') ? '### ⚠️ Risks & Concerns\n- [Critical issues or blockers]\n- [Resource constraints]\n- [Technical debt]\n' : ''}

${areas.includes('next-steps') ? '### 🎯 Next Sprint Priorities\n- [Top 3-5 priorities]\n- [Resource allocation]\n- [Risk mitigation plans]\n' : ''}

### 📈 Trend Analysis
- Velocity trend: [improving/stable/declining]
- Quality trend: [improving/stable/declining]
- Team capacity: [optimal/stretched/underutilized]

### 💡 Recommendations
[1-3 key actions for leadership]

Keep it concise (max 1 page). Use metrics to support insights. Highlight decisions needed from leadership.`;

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: prompt,
          },
        },
      ],
    };
  }

  @measurePerformance('server-initialization')
  async initialize(): Promise<void> {
    try {
      this.startTime = Date.now();
      const config = createAppConfig();
      const logger = getLogger(config.logging);

      logger.info('Starting Enhanced MCP Server initialization', {
        type: 'server_startup',
        version: '2.2.0',
        node_version: process.version,
        memory_usage: process.memoryUsage(),
      });

      // Initialize core services
      const cacheManager = new CacheManager(config.cache);
      const rateLimiter = new ServiceRateLimiter();

      // Initialize clients with shared CacheManager for Redis support
      const jiraClient = new JiraClient(config, cacheManager);
      const githubClient = new GitHubClient(config, cacheManager);

      // Initialize GraphQL client for improved GitHub operations
      const githubGraphQLClient = new GitHubGraphQLClient(config.github.token, {
        cacheManager,
        enableCache: true,
        defaultCacheTTL: 300000, // 5 minutes
      });

      // Initialize cache optimizer
      const cacheOptimizer = new CacheOptimizer(
        cacheManager,
        this.performanceMonitor
      );

      // Initialize reporting services
      // Note: SprintService creates its own AnalyticsService internally
      const sprintService = new SprintService(
        jiraClient,
        githubClient,
        cacheManager,
        config.github.token // Pass GitHub token for GraphQL client
      );
      const analyticsService = (sprintService as any).analyticsService; // Access internal instance
      const exportService = new ExportService();
      const reportGenerator = new ReportGenerator(sprintService);
      const reportTools = new ReportTools(
        sprintService,
        analyticsService,
        exportService,
        reportGenerator
      );

      // Setup server context
      this.context = {
        config,
        jiraClient,
        githubClient,
        githubGraphQLClient,
        cacheManager,
        cacheOptimizer,
        rateLimiter,
        logger,
        performanceMonitor: this.performanceMonitor,
        sprintService,
        analyticsService,
        exportService,
        reportGenerator,
        reportTools,
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
        capabilities: this.getServerCapabilities(),
      });
    } catch (error) {
      const logger =
        this.context?.logger ||
        getLogger({ level: 'error', enableConsole: false });
      logger.error(error as Error, 'server_initialization');
      throw error;
    }
  }

  private async performInitialHealthChecks(): Promise<void> {
    if (!this.context) return;

    const healthChecks = [
      {
        name: 'jira',
        check: () => this.context!.jiraClient.validateConnection(),
      },
      {
        name: 'github',
        check: () => this.context!.githubClient.validateConnection(),
      },
      { name: 'cache', check: () => this.context!.cacheManager.healthCheck() },
    ];

    for (const { name, check } of healthChecks) {
      try {
        const result = await check();
        this.context.logger.info(`${name} service health check passed`, {
          type: 'health_check_success',
          service: name,
          result,
        });
      } catch (error) {
        this.context.logger.warn(`${name} service health check failed`, {
          type: 'health_check_warning',
          service: name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  private schedulePeriodicOptimization(): void {
    // Run cache optimization every 15 minutes
    this.optimizationInterval = setInterval(
      async () => {
        if (!this.context || this.isShuttingDown) return;

        try {
          const result = await this.context.cacheOptimizer.optimizeCache();

          this.context.logger.info('Periodic cache optimization completed', {
            type: 'cache_optimization',
            keys_processed: result.keysProcessed,
            space_saved: result.spaceSaved,
            actions: result.actionsPerformed,
            recommendations: result.recommendations.length,
          });
        } catch (error) {
          this.context.logger.error(error as Error, 'cache_optimization');
        }
      },
      15 * 60 * 1000
    ); // 15 minutes
  }

  private scheduleHealthMonitoring(): void {
    // Adaptive health check interval:
    // - stdio mode (default): 5 minutes (desktop apps, less frequent)
    // - HTTP mode: 30 seconds (web API, frequent monitoring)
    this.healthCheckInterval = setInterval(async () => {
      if (!this.context || this.isShuttingDown) return;

      try {
        const [jiraHealth, githubHealth, cacheHealth] =
          await Promise.allSettled([
            this.context.jiraClient.healthCheck(),
            this.context.githubClient.healthCheck(),
            this.context.cacheManager.healthCheck(),
          ]);

        const serviceHealths = {
          jira: this.convertHealthResult(jiraHealth),
          github: this.convertHealthResult(githubHealth),
          cache: this.convertHealthResult(cacheHealth),
        };

        const cacheStats = this.context.cacheManager.getStats();

        this.performanceMonitor.createSnapshot(cacheStats, serviceHealths);
      } catch (error) {
        this.context.logger.error(error as Error, 'health_monitoring');
      }
    }, this.healthCheckIntervalMs);
  }

  private convertHealthResult(result: PromiseSettledResult<any>): any {
    if (result.status === 'fulfilled') {
      const health = result.value;
      return {
        status: health.healthy ? 'healthy' : 'unhealthy',
        latency: health.latency || 0,
        errorRate: 0,
        consecutiveErrors: 0,
        lastError: health.error,
      };
    } else {
      return {
        status: 'unhealthy',
        latency: 0,
        errorRate: 1,
        consecutiveErrors: 1,
        lastError: result.reason?.message || 'Health check failed',
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
      'predictive_cache_warming',
    ];
  }

  async getHealthStatus(): Promise<HealthStatus> {
    if (!this.context) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 0,
        version: '2.2.0',
        checks: [],
      };
    }

    try {
      const [jiraHealth, githubHealth, cacheHealth] = await Promise.allSettled([
        this.context.jiraClient.healthCheck(),
        this.context.githubClient.healthCheck(),
        this.context.cacheManager.healthCheck(),
      ]);

      const checks = [
        {
          name: 'jira',
          status: (jiraHealth.status === 'fulfilled' && jiraHealth.value.healthy
            ? 'healthy'
            : 'unhealthy') as 'healthy' | 'unhealthy',
          responseTime:
            jiraHealth.status === 'fulfilled'
              ? 'responseTime' in jiraHealth.value
                ? jiraHealth.value.responseTime
                : (jiraHealth.value as any).latency || 0
              : 0,
          error:
            jiraHealth.status === 'rejected'
              ? jiraHealth.reason?.message
              : undefined,
        },
        {
          name: 'github',
          status: (githubHealth.status === 'fulfilled' &&
          githubHealth.value.healthy
            ? 'healthy'
            : 'unhealthy') as 'healthy' | 'unhealthy',
          responseTime:
            githubHealth.status === 'fulfilled'
              ? 'responseTime' in githubHealth.value
                ? githubHealth.value.responseTime
                : (githubHealth.value as any).latency || 0
              : 0,
          error:
            githubHealth.status === 'rejected'
              ? githubHealth.reason?.message
              : undefined,
        },
        {
          name: 'cache',
          status: (cacheHealth.status === 'fulfilled' &&
          cacheHealth.value.healthy
            ? 'healthy'
            : 'unhealthy') as 'healthy' | 'unhealthy',
          responseTime:
            cacheHealth.status === 'fulfilled'
              ? 'responseTime' in cacheHealth.value
                ? cacheHealth.value.responseTime
                : (cacheHealth.value as any).latency || 0
              : 0,
          error:
            cacheHealth.status === 'rejected'
              ? cacheHealth.reason?.message
              : undefined,
        },
      ];

      const allHealthy = checks.every(check => check.status === 'healthy');

      // Transform checks array into services object for frontend compatibility
      const services: Record<string, { healthy: boolean; latency: number }> =
        {};
      checks.forEach(check => {
        services[check.name] = {
          healthy: check.status === 'healthy',
          latency: check.responseTime,
        };
      });

      return {
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        version: '2.2.0',
        checks,
        services,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        version: '2.2.0',
        checks: [],
      };
    }
  }

  getServerInfo(): ServerInfo {
    return {
      name: 'enhanced-jira-github-sprint-reporter',
      version: '2.2.0',
      uptime: this.context ? Date.now() - this.startTime : 0,
      capabilities: this.getServerCapabilities(),
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
      throw new BaseError(
        'SERVER_NOT_INITIALIZED',
        'Server not initialized',
        false,
        'Cannot warm cache'
      );
    }

    await this.context.cacheOptimizer.warmCache(context);
  }

  async optimizeCache(): Promise<any> {
    if (!this.context) {
      throw new BaseError(
        'SERVER_NOT_INITIALIZED',
        'Server not initialized',
        false,
        'Cannot optimize cache'
      );
    }

    return await this.context.cacheOptimizer.optimizeCache();
  }

  async getPerformanceMetrics(): Promise<any> {
    return {
      summary: this.performanceMonitor.getPerformanceSummary(),
      recentSnapshots: this.performanceMonitor.getRecentSnapshots(10),
      cacheOptimization: this.context
        ? await this.context.cacheOptimizer.getOptimizationSummary()
        : null,
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    if (this.context) {
      this.context.logger.info('Enhanced MCP Server started and listening', {
        type: 'server_listening',
        transport: 'stdio',
        tools: this.toolRegistry.getToolDefinitions().length,
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
          uptime: Date.now() - this.startTime,
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
          this.context.rateLimiter.destroy(),
        ]);
      }

      // Cleanup performance monitor
      this.performanceMonitor.cleanup();

      if (this.context) {
        this.context.logger.info('Enhanced MCP Server shutdown completed', {
          type: 'server_shutdown_complete',
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

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.error('\nReceived SIGINT, shutting down gracefully...');
  if (global.mcpServer) {
    await global.mcpServer.shutdown().catch((error: Error) => {
      console.error('Error during shutdown:', error);
      process.exit(1);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGTERM', async () => {
  console.error('\nReceived SIGTERM, shutting down gracefully...');
  if (global.mcpServer) {
    await global.mcpServer.shutdown().catch((error: Error) => {
      console.error('Error during shutdown:', error);
      process.exit(1);
    });
  } else {
    process.exit(0);
  }
});

// Global server instance for signal handlers
declare global {
  // eslint-disable-next-line no-var
  var mcpServer: EnhancedMCPServer | undefined;
}
