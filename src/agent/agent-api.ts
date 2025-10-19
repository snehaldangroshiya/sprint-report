// API endpoint for AI Agent chat interface
// Add this to your Express server

import { Router, Request, Response } from 'express';

import { AIAgent } from '@/agent/ai-agent';
import { EnhancedServerContext } from '@/server/enhanced-mcp-server';
import { ToolRegistry } from '@/server/tool-registry';
import { createLogger } from '@/utils/logger';

const logger = createLogger('AgentAPI');

export function createAgentRouter(
  toolRegistry: ToolRegistry,
  context: EnhancedServerContext
): Router {
  const router = Router();

  // Initialize agent (reuse across requests)
  let agent: AIAgent | null = null;

  const getAgent = () => {
    if (!agent) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }
      agent = new AIAgent(apiKey, toolRegistry, context, {
        model: process.env.AGENT_MODEL || 'claude-3-5-sonnet-20241022',
        maxTokens: parseInt(process.env.AGENT_MAX_TOKENS || '4096'),
        temperature: parseFloat(process.env.AGENT_TEMPERATURE || '0.7'),
        maxIterations: parseInt(process.env.AGENT_MAX_ITERATIONS || '10'),
      });
    }
    return agent;
  };

  /**
   * POST /api/agent/chat
   * Send a message to the AI agent
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

      logger.info('Agent chat request', { message: message.substring(0, 100) });

      const agent = getAgent();
      const response = await agent.query(message, conversationHistory);

      logger.info('Agent chat response', {
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
      logger.error(error as Error, 'Agent chat failed');
      return res.status(500).json({
        error: 'Failed to process agent query',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/agent/chat/stream
   * Stream responses from the AI agent (Server-Sent Events)
   *
   * Body:
   * {
   *   "message": "Generate a sprint report",
   *   "conversationHistory": [...] // optional
   * }
   */
  router.post(
    '/chat/stream',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { message, conversationHistory = [] } = req.body;

        if (!message || typeof message !== 'string') {
          res.status(400).json({
            error: 'Message is required and must be a string',
          });
          return;
        }

        logger.info('Agent stream request', {
          message: message.substring(0, 100),
        });

        // Set up SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const agent = getAgent();

        try {
          for await (const chunk of agent.queryStream(
            message,
            conversationHistory
          )) {
            const data = JSON.stringify(chunk);
            res.write(`data: ${data}\n\n`);

            if (chunk.type === 'done') {
              break;
            }
          }

          res.write('data: [DONE]\n\n');
          res.end();

          logger.info('Agent stream completed');
        } catch (error) {
          logger.error(error as Error, 'Agent stream failed');
          res.write(
            `data: ${JSON.stringify({ type: 'error', content: 'Stream failed' })}\n\n`
          );
          res.end();
        }
      } catch (error) {
        logger.error(error as Error, 'Agent stream setup failed');
        res.status(500).json({
          error: 'Failed to setup stream',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/agent/tools
   * List all available tools the agent can use
   */
  router.get('/tools', (_req: Request, res: Response) => {
    try {
      const tools = toolRegistry.getToolDefinitions();
      res.json({
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
      res.status(500).json({
        error: 'Failed to list tools',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/agent/config
   * Get current agent configuration
   */
  router.get('/config', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        model: process.env.AGENT_MODEL || 'claude-3-5-sonnet-20241022',
        maxTokens: parseInt(process.env.AGENT_MAX_TOKENS || '4096'),
        temperature: parseFloat(process.env.AGENT_TEMPERATURE || '0.7'),
        maxIterations: parseInt(process.env.AGENT_MAX_ITERATIONS || '10'),
        available: !!process.env.ANTHROPIC_API_KEY,
      },
    });
  });

  return router;
}
