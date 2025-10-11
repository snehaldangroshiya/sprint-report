#!/usr/bin/env node

// Register module aliases for production build
import 'module-alias/register';

// MCP Server with SSE (Server-Sent Events) Transport
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import cors from 'cors';
import express, { Request, Response } from 'express';
import { IncomingMessage, ServerResponse } from 'http';

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

const PORT = process.env.MCP_SSE_PORT
  ? parseInt(process.env.MCP_SSE_PORT)
  : 3002;
const HOST = process.env.MCP_SSE_HOST || 'localhost';
const SSE_ENDPOINT = '/message'; // POST endpoint for client messages

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

  // Initialize tool registry
  const toolRegistry = new ToolRegistry(logger);
  toolRegistry.registerAllTools();

  logger.info(
    `Registered ${toolRegistry.getToolDefinitions().length} MCP tools`
  );

  // Import MCP types
  const { ListToolsRequestSchema, CallToolRequestSchema } = await import(
    '@modelcontextprotocol/sdk/types.js'
  );

  // Store active SSE connections by session ID
  const activeSessions = new Map<
    string,
    { server: Server; transport: SSEServerTransport }
  >();

  // Helper to create a new server instance with all handlers
  const createServerInstance = () => {
    const newServer = new Server(
      {
        name: 'jira-github-sprint-reporter-sse',
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

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      mode: 'sse',
      timestamp: new Date().toISOString(),
      tools: toolRegistry.getToolDefinitions().length,
      activeSessions: activeSessions.size,
    });
  });

  // SSE endpoint - GET request establishes the SSE connection
  app.get('/sse', async (_req: Request, res: Response) => {
    try {
      logger.info('New SSE connection request');

      // Create new server and transport for this session
      const sessionServer = createServerInstance();
      
      // Prepare SSE transport options
      const allowedOrigins = process.env.NODE_ENV === 'production'
        ? (process.env.ALLOWED_ORIGINS?.split(',') || [])
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173'];
      
      const sessionTransport = new SSEServerTransport(SSE_ENDPOINT, res as ServerResponse, {
        enableDnsRebindingProtection: false,
        allowedOrigins: allowedOrigins,
      });

      const sessionId = sessionTransport.sessionId;

      // Store the session
      activeSessions.set(sessionId, {
        server: sessionServer,
        transport: sessionTransport,
      });

      logger.info(`Session initialized: ${sessionId}`);

      // Set up close handler
      sessionTransport.onclose = () => {
        logger.info(`Session closed: ${sessionId}`);
        activeSessions.delete(sessionId);
      };

      // Set up error handler
      sessionTransport.onerror = (error: Error) => {
        logger.error(`Session error: ${sessionId}`, error.message);
      };

      // Connect server to transport and start SSE stream
      await sessionServer.connect(sessionTransport);
      
      logger.info(`SSE stream started for session: ${sessionId}`);
    } catch (error: any) {
      logger.error('Error establishing SSE connection:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to establish SSE connection',
          message: error.message,
        });
      }
    }
  });

  // POST endpoint - receives messages from client
  app.post(SSE_ENDPOINT, async (req: Request, res: Response) => {
    try {
      const sessionId = req.query.sessionId as string;

      if (!sessionId) {
        res.status(400).json({
          error: 'Missing sessionId query parameter',
        });
        return;
      }

      logger.info(`Received message for session: ${sessionId}`);

      const session = activeSessions.get(sessionId);

      if (!session) {
        logger.warn(`Session not found: ${sessionId}`);
        res.status(404).json({
          error: 'Session not found',
          message: 'The specified session does not exist or has expired',
        });
        return;
      }

      // Let the transport handle the POST message
      await session.transport.handlePostMessage(
        req as IncomingMessage,
        res as ServerResponse,
        req.body
      );
    } catch (error: any) {
      logger.error('Error handling POST message:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to process message',
          message: error.message,
        });
      }
    }
  });

  // List active sessions endpoint (for debugging)
  app.get('/sessions', (_req: Request, res: Response) => {
    const sessions = Array.from(activeSessions.keys());
    res.json({
      count: sessions.length,
      sessions: sessions,
    });
  });

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: Function) => {
    logger.error('Server error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    }
  });

  // Start server
  app.listen(PORT, HOST, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 MCP Server (SSE Mode) Started');
    console.log('='.repeat(60));
    console.log(`📍 URL: http://${HOST}:${PORT}`);
    console.log(`🔌 SSE Endpoint: http://${HOST}:${PORT}/sse`);
    console.log(`📨 POST Endpoint: http://${HOST}:${PORT}${SSE_ENDPOINT}?sessionId=<id>`);
    console.log(`❤️  Health Check: http://${HOST}:${PORT}/health`);
    console.log(`📊 Sessions: http://${HOST}:${PORT}/sessions`);
    console.log(
      `🛠️  Tools Available: ${toolRegistry.getToolDefinitions().length}`
    );
    console.log('='.repeat(60));
    console.log('\nSSE Server is ready to accept connections');
    console.log('\nConnection flow:');
    console.log('1. Client: GET /sse → Establishes SSE stream');
    console.log('2. Server: Sends session ID via SSE');
    console.log('3. Client: POST /message?sessionId=<id> → Sends messages');
    console.log('4. Server: Responds via SSE stream\n');
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down MCP SSE server...');
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
  console.error('Failed to start MCP SSE server:', error);
  process.exit(1);
});
