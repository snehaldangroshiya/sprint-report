#!/usr/bin/env node

// Register module aliases for production build
import 'module-alias/register';

// MCP Server with HTTP/StreamableHttp Transport
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import cors from 'cors';
import express, { Request, Response } from 'express';

import { CacheManager } from './cache/cache-manager';
import { CacheOptimizer } from './cache/cache-optimizer';
import { GitHubClient } from './clients/github-client';
import { JiraClient } from './clients/jira-client';
import { createAppConfig } from './config/environment';
import { initializeGlobalPerformanceMonitor } from './performance/performance-monitor';
import { ReportGenerator } from './reporting/report-generator';
import { EnhancedServerContext } from './server/enhanced-mcp-server';
import { ToolRegistry } from './server/tool-registry';
import { ExportService } from './services/export-service';
import { SprintService } from './services/sprint-service';
import { ReportTools } from './tools/report-tools';
import { getLogger } from './utils/logger';
import { ServiceRateLimiter } from './utils/rate-limiter';

const PORT = process.env.MCP_HTTP_PORT
  ? parseInt(process.env.MCP_HTTP_PORT)
  : 3001;
const HOST = process.env.MCP_SERVER_HOST || 'localhost';

async function main() {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin:
        process.env.NODE_ENV === 'production'
          ? process.env.ALLOWED_ORIGINS?.split(',') || []
          : [
              'http://localhost:3000',
              'http://localhost:3001',
              'http://localhost:3002',
              'http://localhost:5173',
            ],
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.text());

  // Initialize configuration and clients
  const config = createAppConfig();
  const logger = getLogger(config.logging);
  const cacheManager = new CacheManager(config.cache);
  const rateLimiter = new ServiceRateLimiter();
  const jiraClient = new JiraClient(config);
  const githubClient = new GitHubClient(config);

  // Initialize performance monitoring and optimization
  const performanceMonitor = initializeGlobalPerformanceMonitor();
  const cacheOptimizer = new CacheOptimizer(cacheManager, performanceMonitor);

  // Initialize reporting services
  const sprintService = new SprintService(
    jiraClient,
    githubClient,
    cacheManager
  );
  const analyticsService = (sprintService as any).analyticsService;
  const exportService = new ExportService();
  const reportGenerator = new ReportGenerator(sprintService);
  const reportTools = new ReportTools(
    sprintService,
    analyticsService,
    exportService,
    reportGenerator
  );

  const context: EnhancedServerContext = {
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

  // Create MCP server instance
  const server = new Server(
    {
      name: 'jira-github-sprint-reporter-http',
      version: '2.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Initialize tool registry
  const toolRegistry = new ToolRegistry(logger);
  toolRegistry.registerAllTools();

  logger.info(
    `Registered ${toolRegistry.getToolDefinitions().length} MCP tools`
  );

  // Set up tool handlers (from @modelcontextprotocol/sdk)
  const { ListToolsRequestSchema, CallToolRequestSchema } = await import(
    '@modelcontextprotocol/sdk/types.js'
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: toolRegistry.getToolDefinitions(),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const { name, arguments: args } = request.params;

    try {
      return await toolRegistry.executeTool(name, args || {}, context);
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool ${name}: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      mode: 'http-streamable',
      timestamp: new Date().toISOString(),
      tools: toolRegistry.getToolDefinitions().length,
    });
  });

  // Store active sessions with their server instances and transports
  const activeSessions = new Map<
    string,
    { server: Server; transport: StreamableHTTPServerTransport }
  >();

  // Helper to create a new server instance with all handlers
  const createServerInstance = () => {
    const newServer = new Server(
      {
        name: 'jira-github-sprint-reporter-http',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Set up tool handlers
    newServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: toolRegistry.getToolDefinitions(),
      };
    });

    newServer.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;

      try {
        return await toolRegistry.executeTool(name, args || {}, context);
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${name}: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });

    return newServer;
  };

  // MCP endpoint - handles both GET (SSE) and POST (JSON-RPC messages)
  app.all('/mcp', async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      
      logger.info(`MCP ${req.method} request`, {
        sessionId,
        hasBody: !!req.body,
        method: req.body?.method,
      });

      let sessionServer: Server;
      let sessionTransport: StreamableHTTPServerTransport;

      if (sessionId && activeSessions.has(sessionId)) {
        // Reuse existing session
        const session = activeSessions.get(sessionId)!;
        sessionServer = session.server;
        sessionTransport = session.transport;
      } else {
        // Create new server and transport for this session
        sessionServer = createServerInstance();
        sessionTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: async (sid: string) => {
            logger.info(`Session initialized: ${sid}`);
            activeSessions.set(sid, {
              server: sessionServer,
              transport: sessionTransport,
            });
          },
          onsessionclosed: async (sid: string) => {
            logger.info(`Session closed: ${sid}`);
            activeSessions.delete(sid);
          },
        });

        // Connect server to transport
        await sessionServer.connect(sessionTransport);
      }

      // Let the transport handle the request
      await sessionTransport.handleRequest(req, res, req.body);
    } catch (error: any) {
      logger.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          message: error.message,
        });
      }
    }
  });

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: Function) => {
    logger.error('Server error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  // Start server
  app.listen(PORT, HOST, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 MCP Server (HTTP/StreamableHttp Mode) Started');
    console.log('='.repeat(60));
    console.log(`📍 URL: http://${HOST}:${PORT}`);
    console.log(`🔌 MCP Endpoint: http://${HOST}:${PORT}/mcp`);
    console.log(`❤️  Health Check: http://${HOST}:${PORT}/health`);
    console.log(
      `🛠️  Tools Available: ${toolRegistry.getToolDefinitions().length}`
    );
    console.log('='.repeat(60));
    console.log('\nMCP Server is ready to accept HTTP connections');
    console.log('Connect using: http://localhost:3001/mcp\n');
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down MCP HTTP server...');
    // Close all active sessions
    activeSessions.forEach(({ transport }, sessionId) => {
      logger.info(`Closing session: ${sessionId}`);
      transport.close?.();
    });
    activeSessions.clear();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

main().catch(error => {
  console.error('Failed to start MCP HTTP server:', error);
  process.exit(1);
});
