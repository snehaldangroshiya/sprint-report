// API endpoint for Ollama AI Agent (Local LLM)
// FREE alternative to Claude API - runs completely locally!

import { Router, Request, Response } from 'express';
import { OllamaAgent } from '@/agent/ollama-agent';
import { EnhancedServerContext } from '@/server/enhanced-mcp-server';
import { ToolRegistry } from '@/server/tool-registry';
import { createLogger } from '@/utils/logger';

const logger = createLogger('OllamaAgentAPI');

export function createOllamaAgentRouter(
  toolRegistry: ToolRegistry,
  context: EnhancedServerContext
): Router {
  const router = Router();

  // Initialize agent (reuse across requests)
  let agent: OllamaAgent | null = null;

  const getAgent = () => {
    if (!agent) {
      agent = new OllamaAgent(toolRegistry, context, {
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
        temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
        maxIterations: parseInt(process.env.OLLAMA_MAX_ITERATIONS || '10'),
        ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',
      });
    }
    return agent;
  };

  /**
   * POST /api/ollama/chat
   * Send a message to the Ollama AI agent
   *
   * Body:
   * {
   *   "message": "What are the active sprints?",
   *   "conversationHistory": [...] // optional
   * }
   */
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { message, conversationHistory = [] } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          error: 'Message is required and must be a string',
        });
      }

      logger.info('Ollama agent chat request', { message: message.substring(0, 100) });

      const agent = getAgent();

      // Check availability first
      const status = await agent.checkAvailability();
      if (!status.available) {
        return res.status(503).json({
          error: 'Ollama is not available',
          message: status.error || 'Please ensure Ollama is running',
          setupInstructions: 'Install from https://ollama.ai/ and run: ollama serve',
        });
      }

      if (!status.modelPulled) {
        return res.status(400).json({
          error: 'Model not available',
          message: status.error,
        });
      }

      const response = await agent.query(message, conversationHistory);

      logger.info('Ollama agent chat response', {
        toolsUsed: response.toolsUsed.length,
        iterations: response.iterations,
      });

      return res.json({
        success: true,
        data: {
          answer: response.answer,
          toolsUsed: response.toolsUsed,
          iterations: response.iterations,
          conversationHistory: response.conversationHistory,
        },
      });
    } catch (error) {
      logger.error(error as Error, 'Ollama agent chat failed');
      return res.status(500).json({
        error: 'Failed to process agent query',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/ollama/chat/stream
   * Stream responses from the Ollama AI agent (Server-Sent Events)
   */
  router.post('/chat/stream', async (req: Request, res: Response) => {
    try {
      const { message, conversationHistory = [] } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          error: 'Message is required and must be a string',
        });
      }

      logger.info('Ollama agent stream request', { message: message.substring(0, 100) });

      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const agent = getAgent();

      try {
        for await (const chunk of agent.queryStream(message, conversationHistory)) {
          const data = JSON.stringify(chunk);
          res.write(`data: ${data}\n\n`);

          if (chunk.type === 'done') {
            break;
          }
        }

        res.write('data: [DONE]\n\n');
        res.end();

        logger.info('Ollama agent stream completed');
        return;
      } catch (error) {
        logger.error(error as Error, 'Ollama agent stream failed');
        res.write(`data: ${JSON.stringify({ type: 'error', content: 'Stream failed' })}\n\n`);
        res.end();
        return;
      }
    } catch (error) {
      logger.error(error as Error, 'Ollama agent stream setup failed');
      return res.status(500).json({
        error: 'Failed to setup stream',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/ollama/status
   * Check if Ollama is available and which models are installed
   */
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const agent = getAgent();
      const status = await agent.checkAvailability();
      const models = status.available ? await agent.listModels() : [];

      return res.json({
        success: true,
        data: {
          available: status.available,
          modelPulled: status.modelPulled,
          currentModel: process.env.OLLAMA_MODEL || 'llama3.1:8b',
          availableModels: models,
          error: status.error,
          host: process.env.OLLAMA_HOST || 'http://localhost:11434',
        },
      });
    } catch (error) {
      logger.error(error as Error, 'Failed to check Ollama status');
      return res.status(500).json({
        error: 'Failed to check status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/ollama/models
   * List all available Ollama models
   */
  router.get('/models', async (_req: Request, res: Response) => {
    try {
      const agent = getAgent();
      const models = await agent.listModels();

      return res.json({
        success: true,
        data: {
          models,
          count: models.length,
          recommended: ['llama3.1:8b', 'llama3:8b', 'mistral:7b', 'phi3:mini'],
        },
      });
    } catch (error) {
      logger.error(error as Error, 'Failed to list models');
      return res.status(500).json({
        error: 'Failed to list models',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/ollama/tools
   * List all available tools (same as regular agent)
   */
  router.get('/tools', (_req: Request, res: Response) => {
    try {
      const tools = toolRegistry.getToolDefinitions();
      return res.json({
        success: true,
        data: {
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          })),
          count: tools.length,
        },
      });
    } catch (error) {
      logger.error(error as Error, 'Failed to list tools');
      return res.status(500).json({
        error: 'Failed to list tools',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/ollama/config
   * Get current Ollama agent configuration
   */
  router.get('/config', (_req: Request, res: Response) => {
    return res.json({
      success: true,
      data: {
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
        temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
        maxIterations: parseInt(process.env.OLLAMA_MAX_ITERATIONS || '10'),
        host: process.env.OLLAMA_HOST || 'http://localhost:11434',
        free: true,
        local: true,
      },
    });
  });

  return router;
}
