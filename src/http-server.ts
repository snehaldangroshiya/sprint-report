#!/usr/bin/env node

// Register module aliases for production build
import 'module-alias/register';

// MCP Server with HTTP/SSE Transport
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
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
      mode: 'http-sse',
      timestamp: new Date().toISOString(),
      tools: toolRegistry.getToolDefinitions().length,
    });
  });

  // Store active transports
  const activeTransports = new Map<string, SSEServerTransport>();

  // MCP SSE endpoint - establish SSE connection
  app.get('/sse', async (req: Request, res: Response) => {
    const sessionId = Math.random().toString(36).substring(7);
    logger.info(`New SSE connection established: ${sessionId}`);

    // Create transport with the message endpoint path
    // SSEServerTransport will set its own headers
    const transport = new SSEServerTransport('/message', res);
    activeTransports.set(sessionId, transport);

    // Handle connection close
    req.on('close', () => {
      logger.info(`SSE connection closed: ${sessionId}`);
      activeTransports.delete(sessionId);
      transport.close?.();
    });

    // Connect server to transport
    // This will trigger the SSE handshake
    try {
      await server.connect(transport);
      logger.info(`MCP server connected to transport: ${sessionId}`);
    } catch (error) {
      logger.error(error as Error, 'Failed to connect transport');
      activeTransports.delete(sessionId);
    }
  });

  // MCP message endpoint - handle incoming messages
  app.post('/message', async (req: Request, res: Response) => {
    try {
      const message =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      logger.info('Received MCP message:', {
        method: message.method,
        id: message.id,
      });

      // Find the appropriate transport (for now, use the first one)
      // In production, you'd want to track sessions properly
      const transport = Array.from(activeTransports.values())[0];

      if (!transport) {
        logger.warn('No active transport found for message');
        res.status(503).json({ error: 'No active connection' });
        return;
      }

      // The transport will handle the message through the connected server
      // Just acknowledge receipt
      res.status(202).end();
    } catch (error: any) {
      logger.error('Error handling message:', error);
      res.status(400).json({ error: error.message });
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
    console.log('🚀 MCP Server (HTTP/SSE Mode) Started');
    console.log('='.repeat(60));
    console.log(`📍 URL: http://${HOST}:${PORT}`);
    console.log(`🔌 MCP SSE Endpoint: http://${HOST}:${PORT}/sse`);
    console.log(`📨 MCP Message Endpoint: http://${HOST}:${PORT}/message`);
    console.log(`❤️  Health Check: http://${HOST}:${PORT}/health`);
    console.log(
      `🛠️  Tools Available: ${toolRegistry.getToolDefinitions().length}`
    );
    console.log('='.repeat(60));
    console.log('\nMCP Server is ready to accept HTTP connections');
    console.log('Connect using: http://localhost:3001/sse\n');
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down MCP HTTP server...');
    // Close all active transports
    activeTransports.forEach((transport, sessionId) => {
      logger.info(`Closing transport: ${sessionId}`);
      transport.close?.();
    });
    activeTransports.clear();
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
