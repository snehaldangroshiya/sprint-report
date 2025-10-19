// API endpoints for Azure AI Foundry Agent
// Self-hosted LLMs on Azure infrastructure

import { Router, Request, Response } from 'express';

import { AzureAgent, AzureAgentConfig } from '@/agent/azure-agent';
import { EnhancedServerContext } from '@/server/enhanced-mcp-server';
import { ToolRegistry } from '@/server/tool-registry';
import { createLogger } from '@/utils/logger';

const logger = createLogger('AzureAgentAPI');

export function createAzureAgentRouter(
  toolRegistry: ToolRegistry,
  context: EnhancedServerContext
): Router {
  const router = Router();

  // Initialize agent (reuse across requests)
  let agent: AzureAgent | null = null;

  const getAgent = () => {
    if (!agent) {
      const config: AzureAgentConfig = {
        temperature: parseFloat(process.env.AZURE_OPENAI_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.AZURE_OPENAI_MAX_TOKENS || '4096'),
        maxIterations: parseInt(
          process.env.AZURE_OPENAI_MAX_ITERATIONS || '10'
        ),
      };

      if (process.env.AZURE_OPENAI_ENDPOINT) {
        config.endpoint = process.env.AZURE_OPENAI_ENDPOINT;
      }
      if (process.env.AZURE_OPENAI_API_KEY) {
        config.apiKey = process.env.AZURE_OPENAI_API_KEY;
      }
      if (process.env.AZURE_OPENAI_DEPLOYMENT_NAME) {
        config.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
      }

      agent = new AzureAgent(toolRegistry, context, config);
    }
    return agent;
  };

  /**
   * POST /api/agent/azure/chat
   * Send a message to the Azure AI agent
   */
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { message, conversationHistory = [] } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          error: 'Message is required and must be a string',
        });
      }

      logger.info('Azure agent chat request', {
        message: message.substring(0, 100),
      });

      const agent = getAgent();

      // Check availability first
      const status = await agent.checkAvailability();
      if (!status.available) {
        return res.status(503).json({
          error: 'Azure AI Foundry is not available',
          message: status.error || 'Please check your Azure configuration',
          setupInstructions: 'See docs/AZURE_AI_FOUNDRY_SETUP.md',
        });
      }

      const response = await agent.query(message, conversationHistory);

      logger.info('Azure agent chat response', {
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
          provider: 'azure-ai-foundry',
          model: response.model,
        },
      });
    } catch (error) {
      logger.error(error as Error, 'Azure agent chat failed');
      return res.status(500).json({
        error: 'Failed to process agent query',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/agent/azure/chat/stream
   * Stream responses from the Azure AI agent (Server-Sent Events)
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

        logger.info('Azure agent stream request', {
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

          logger.info('Azure agent stream completed');
        } catch (error) {
          logger.error(error as Error, 'Azure agent stream failed');
          res.write(
            `data: ${JSON.stringify({ type: 'error', content: 'Stream failed' })}\n\n`
          );
          res.end();
        }
      } catch (error) {
        logger.error(error as Error, 'Azure agent stream setup failed');
        res.status(500).json({
          error: 'Failed to setup stream',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/agent/azure/status
   * Check if Azure AI Foundry is available
   */
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const agent = getAgent();
      const status = await agent.checkAvailability();
      const info = agent.getDeploymentInfo();

      return res.json({
        success: true,
        data: {
          available: status.available,
          error: status.error,
          endpoint: info.endpoint,
          deploymentName: info.deploymentName,
          model: info.model,
          provider: 'azure-ai-foundry',
        },
      });
    } catch (error) {
      logger.error(error as Error, 'Failed to check Azure status');
      return res.status(500).json({
        error: 'Failed to check status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/agent/azure/tools
   * List all available MCP tools
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
   * GET /api/agent/azure/config
   * Get current agent configuration
   */
  router.get('/config', (_req: Request, res: Response) => {
    return res.json({
      success: true,
      data: {
        endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'Not configured',
        deploymentName:
          process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'Not configured',
        temperature: parseFloat(process.env.AZURE_OPENAI_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.AZURE_OPENAI_MAX_TOKENS || '4096'),
        maxIterations: parseInt(
          process.env.AZURE_OPENAI_MAX_ITERATIONS || '10'
        ),
        provider: 'azure-ai-foundry',
        selfHosted: true,
      },
    });
  });

  return router;
}
