// Express API server wrapping MCP functionality for web UI

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { createAppConfig } from '../config/environment';
import {
  securityHeaders,
  sanitizeRequest,
  rateLimitConfig,
  validateRequestSize,
} from '../middleware/validation';
import { EnhancedMCPServer } from '../server/enhanced-mcp-server';
import { AppConfig } from '../types';
import { getLogger } from '../utils/logger';

import { AnalyticsController } from './controllers/analytics.controller';
import { ReportController } from './controllers/report.controller';
import {
  createHealthRouter,
  createCacheRouter,
  createSprintRouter,
  createGitHubRouter,
  createAnalyticsRouter,
  createReportRouter,
  createVelocityRouter,
  createMCPToolsRouter,
} from './routes';

// Week 1 Services
import { AnalyticsAggregator } from './services/analytics-aggregator.service';
import { CacheOrchestrator } from './services/cache-orchestrator.service';
import { MCPBridge } from './services/mcp-bridge.service';

// Week 2 Controllers

export class WebAPIServer {
  private app: express.Application;
  private mcpServer: EnhancedMCPServer;
  private config: AppConfig;
  private logger: any;

  // Week 1 Services
  private mcpBridge: MCPBridge;
  private cacheOrchestrator: CacheOrchestrator;
  private analyticsAggregator: AnalyticsAggregator;

  // Week 2 Controllers
  private analyticsController: AnalyticsController;
  private reportController: ReportController;

  constructor() {
    this.app = express();
    // HTTP mode: use frequent health checks (30 seconds) for web API monitoring
    this.mcpServer = new EnhancedMCPServer({
      healthCheckIntervalMs: 30 * 1000,
    });
    this.config = createAppConfig();
    this.logger = getLogger(this.config.logging);

    // Initialize Week 1 Services
    this.mcpBridge = new MCPBridge(this.mcpServer);
    this.cacheOrchestrator = new CacheOrchestrator(
      this.mcpServer,
      this.mcpBridge
    );
    this.analyticsAggregator = new AnalyticsAggregator(
      this.mcpServer,
      this.mcpBridge
    );

    // Initialize Week 2 Controllers
    this.analyticsController = new AnalyticsController(
      this.mcpServer,
      this.mcpBridge,
      this.analyticsAggregator
    );
    this.reportController = new ReportController();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security headers
    this.app.use(securityHeaders);

    // Helmet security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            frameSrc: ["'self'"],
          },
        },
        crossOriginEmbedderPolicy: false,
      })
    );

    // CORS with strict configuration
    this.app.use(
      cors({
        origin:
          process.env.NODE_ENV === 'production'
            ? process.env.ALLOWED_ORIGINS?.split(',') || [
                'https://your-domain.com',
              ]
            : [
                'http://localhost:3000',
                'http://localhost:3001',
                'http://localhost:3002',
                'http://localhost:5173',
              ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
        exposedHeaders: ['Content-Disposition'],
      })
    );

    // Rate limiting with configuration
    const limiter = rateLimit(rateLimitConfig);
    this.app.use('/api/', limiter);

    // Request size validation
    this.app.use(validateRequestSize(10 * 1024 * 1024)); // 10MB limit

    // Request sanitization
    this.app.use(sanitizeRequest);

    // Compression and parsing with security limits
    this.app.use(compression());
    this.app.use(
      express.json({
        limit: '10mb',
        strict: true,
        type: 'application/json',
      })
    );
    this.app.use(
      express.urlencoded({
        extended: true,
        limit: '10mb',
        parameterLimit: 1000,
      })
    );

    // Trust proxy for rate limiting (if behind reverse proxy)
    if (process.env.NODE_ENV === 'production') {
      this.app.set('trust proxy', 1);
    }

    // Request logging
    this.app.use((req, _res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        type: 'api_request',
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });

    // Static files (for built React app)
    this.app.use(express.static('dist/web'));
  }

  private setupRoutes(): void {
    // Helper to get server context
    const getContext = () => this.mcpServer.getContext();
    const getMCPServer = () => this.mcpServer;

    // Mount modular routers
    // Health routes (/api/health, /api/info, /api/metrics, /api/system-status)
    const healthRouter = createHealthRouter(getContext, getMCPServer);
    this.app.use('/api', healthRouter);

    // Cache routes (/api/cache/stats, /api/cache/warm, /api/cache/warm-sprint/:id, /api/cache/webhooks/jira/*, /api/cache/optimize)
    const cacheRouter = createCacheRouter(
      getContext,
      getMCPServer,
      this.cacheOrchestrator.warmSprintCache.bind(this.cacheOrchestrator),
      this.cacheOrchestrator.invalidateSprintCache.bind(this.cacheOrchestrator),
      this.cacheOrchestrator.invalidateIssueCache.bind(this.cacheOrchestrator)
    );
    this.app.use('/api', cacheRouter);

    // Sprint routes (/api/boards, /api/sprints, /api/sprints/:id/issues, /api/sprints/:id/metrics, /api/sprints/:id/comprehensive)
    const sprintRouter = createSprintRouter(
      getContext,
      this.mcpBridge.callTool.bind(this.mcpBridge),
      this.cacheOrchestrator.getSprintCacheTTL.bind(this.cacheOrchestrator),
      this.mcpBridge.generateComprehensiveReport.bind(this.mcpBridge),
      this.cacheOrchestrator.scheduleBackgroundRefresh.bind(
        this.cacheOrchestrator
      ),
      this.handleAPIError.bind(this)
    );
    this.app.use('/api', sprintRouter);

    // GitHub routes (/api/github/repos/:owner/:repo/commits, /api/github/repos/:owner/:repo/pulls, /api/github/:owner/:repo/commits/jira)
    const githubRouter = createGitHubRouter(
      this.mcpBridge.callTool.bind(this.mcpBridge),
      this.handleAPIError.bind(this)
    );
    this.app.use('/api/github', githubRouter);

    // Analytics routes (/api/analytics/commit-trends/:owner/:repo, /api/analytics/team-performance/:boardId, /api/analytics/issue-types/:boardId)
    const analyticsRouter = createAnalyticsRouter(this.analyticsController);
    this.app.use('/api/analytics', analyticsRouter);

    // Report routes (/api/reports/sprint, /api/export/sprint-report/pdf, /api/export/analytics/pdf)
    const reportRouter = createReportRouter(
      this.reportController,
      this.mcpBridge.callTool.bind(this.mcpBridge),
      this.handleAPIError.bind(this)
    );
    this.app.use('/api', reportRouter);

    // Velocity routes (/api/velocity/:boardId)
    const velocityRouter = createVelocityRouter(this.analyticsController);
    this.app.use('/api/velocity', velocityRouter);

    // MCP Tools routes (/api/mcp/tools, /api/mcp/cache/clear, /api/mcp/tools/refresh)
    const mcpToolsRouter = createMCPToolsRouter(getContext, getMCPServer);
    this.app.use('/api', mcpToolsRouter);

    // Fallback for React Router (SPA) - Express 5 compatible
    // Comment out for now as it causes routing issues
    // this.app.get('/:path(.*)', (_, res) => {
    //   res.sendFile('index.html', { root: 'dist/web' });
    // });

    // Global error handler (Express 5 requires 4 parameters)
    this.app.use(
      (
        error: any,
        req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        this.logger.logError(error, 'api_error', {
          method: req.method,
          path: req.path,
          body: req.body,
        });

        res.status(500).json({
          error: 'Internal server error',
          message:
            process.env.NODE_ENV === 'development'
              ? error.message
              : 'Something went wrong',
        });
      }
    );
  }

  private handleAPIError(
    error: any,
    res: express.Response,
    message: string
  ): void {
    this.logger.logError(error, 'api_error');

    const statusCode = error.statusCode || error.status || 500;
    const errorMessage = error.userMessage || error.message || message;

    res.status(statusCode).json({
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }

  async initialize(): Promise<void> {
    // Initialize MCP server
    await this.mcpServer.initialize();

    this.logger.info('Web API Server initialized', {
      type: 'api_server_init',
      port: this.config.server.port,
      host: this.config.server.host,
    });
  }

  async start(): Promise<void> {
    await this.initialize();

    const server = this.app.listen(
      this.config.server.port,
      this.config.server.host,
      () => {
        this.logger.info(`Web API Server listening`, {
          type: 'api_server_start',
          port: this.config.server.port,
          host: this.config.server.host,
          url: `http://${this.config.server.host}:${this.config.server.port}`,
        });
      }
    );

    // Graceful shutdown
    const gracefulShutdown = async () => {
      this.logger.info('Web API Server shutting down...');

      server.close(async () => {
        await this.mcpServer.shutdown();
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  }

  getApp(): express.Application {
    return this.app;
  }
}

// CLI entry point
if (require.main === module) {
  const server = new WebAPIServer();
  server.start().catch(error => {
    console.error('Failed to start Web API Server:', error);
    process.exit(1);
  });
}
