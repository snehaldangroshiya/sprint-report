// AI Agent implementation using Azure AI Foundry (self-hosted LLMs on Azure)
// Compatible with Azure OpenAI and Azure ML deployed models

import OpenAI from 'openai';

import { EnhancedServerContext } from '@/server/enhanced-mcp-server';
import { ToolRegistry } from '@/server/tool-registry';
import { createLogger } from '@/utils/logger';

const logger = createLogger('AzureAgent');

export interface AzureAgentConfig {
  endpoint?: string;
  apiKey?: string;
  deploymentName?: string;
  temperature?: number;
  maxTokens?: number;
  maxIterations?: number;
  apiVersion?: string;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentResponse {
  answer: string;
  toolsUsed: string[];
  iterations: number;
  conversationHistory: AgentMessage[];
  cost?: number;
  model?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * Azure AI Foundry Agent
 *
 * Supports:
 * - Azure AI Foundry deployed models (Llama, Mistral, Phi, etc.)
 * - Azure OpenAI Service
 * - Uses OpenAI-compatible API
 */
export class AzureAgent {
  private client: OpenAI;
  private toolRegistry: ToolRegistry;
  private context: EnhancedServerContext;
  private config: Required<AzureAgentConfig>;

  constructor(
    toolRegistry: ToolRegistry,
    context: EnhancedServerContext,
    config: AzureAgentConfig = {}
  ) {
    // Azure AI Foundry uses OpenAI-compatible API
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.AZURE_OPENAI_API_KEY,
      baseURL: config.endpoint || process.env.AZURE_OPENAI_ENDPOINT,
      // For Azure OpenAI, you might need:
      // baseURL: `${endpoint}/openai/deployments/${deploymentName}`,
      defaultHeaders: {
        'api-key': config.apiKey || process.env.AZURE_OPENAI_API_KEY || '',
      },
    });

    this.toolRegistry = toolRegistry;
    this.context = context;
    this.config = {
      endpoint: config.endpoint || process.env.AZURE_OPENAI_ENDPOINT || '',
      apiKey: config.apiKey || process.env.AZURE_OPENAI_API_KEY || '',
      deploymentName:
        config.deploymentName ||
        process.env.AZURE_OPENAI_DEPLOYMENT_NAME ||
        'llama-3-1-8b',
      temperature:
        config.temperature ??
        parseFloat(process.env.AZURE_OPENAI_TEMPERATURE || '0.7'),
      maxTokens:
        config.maxTokens ??
        parseInt(process.env.AZURE_OPENAI_MAX_TOKENS || '4096'),
      maxIterations:
        config.maxIterations ??
        parseInt(process.env.AZURE_OPENAI_MAX_ITERATIONS || '10'),
      apiVersion:
        config.apiVersion ||
        process.env.AZURE_OPENAI_API_VERSION ||
        '2024-02-01',
    };

    logger.info('Azure Agent initialized', {
      endpoint: this.config.endpoint,
      deployment: this.config.deploymentName,
    });
  }

  /**
   * Process a user query using the AI agent with MCP tools
   */
  async query(
    userPrompt: string,
    conversationHistory: AgentMessage[] = []
  ): Promise<AgentResponse> {
    logger.info('Azure agent query started', {
      prompt: userPrompt.substring(0, 100),
      deployment: this.config.deploymentName,
    });

    const toolsUsed: string[] = [];
    let iterations = 0;
    const messages: any[] = [];

    // Add system prompt with tool information
    if (conversationHistory.length === 0) {
      messages.push({
        role: 'system',
        content: this.buildSystemPrompt(),
      });
    } else {
      // Convert conversation history
      messages.push(
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        }))
      );
    }

    // Add user message
    messages.push({
      role: 'user',
      content: userPrompt,
    });

    // Convert MCP tools to OpenAI function calling format
    const tools = this.convertMCPToolsToOpenAI();

    // Agent loop - can call tools multiple times
    while (iterations < this.config.maxIterations) {
      iterations++;

      try {
        logger.info(`Iteration ${iterations}: Sending to Azure AI Foundry`);

        const requestParams: any = {
          model: this.config.deploymentName,
          messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        };

        // Only add tools if we have them
        if (tools.length > 0) {
          requestParams.tools = tools;
          requestParams.tool_choice = 'auto';
        }

        const response =
          await this.client.chat.completions.create(requestParams);

        const choice = response.choices[0];
        if (!choice) {
          throw new Error('No response from Azure AI Foundry');
        }

        const finishReason = choice.finish_reason;

        logger.info(`Iteration ${iterations}: finish_reason = ${finishReason}`);

        // Add assistant response to messages
        messages.push(choice.message);

        // Check if model wants to use tools
        if (finishReason === 'tool_calls' && choice.message.tool_calls) {
          // Process tool calls
          for (const toolCall of choice.message.tool_calls) {
            if (toolCall.type !== 'function') continue;

            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);

            logger.info(`Executing tool: ${toolName}`, { args: toolArgs });
            toolsUsed.push(toolName);

            try {
              // Execute the MCP tool
              const result = await this.toolRegistry.executeTool(
                toolName,
                toolArgs,
                this.context
              );

              // Extract text content from MCP response
              const resultText =
                typeof result === 'string'
                  ? result
                  : result.content?.[0]?.text ||
                    JSON.stringify(result, null, 2);

              // Add tool result to messages
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: resultText.substring(0, 4000), // Limit size
              });

              logger.info(`Tool ${toolName} executed successfully`);
            } catch (error) {
              logger.error(error as Error, `Tool ${toolName} failed`);

              // Add error to messages so agent can handle it
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              });
            }
          }

          // Continue loop to get final answer
          continue;
        }

        // No tool calls - this is the final answer
        const finalAnswer = choice.message.content || 'No response generated.';

        logger.info('Azure agent query completed', {
          iterations,
          toolsUsed: toolsUsed.length,
        });

        return {
          answer: finalAnswer,
          toolsUsed: Array.from(new Set(toolsUsed)),
          iterations,
          conversationHistory: this.convertMessagesToHistory(messages),
          model: this.config.deploymentName,
        };
      } catch (error) {
        logger.error(error as Error, 'Agent iteration failed');

        // Check if it's a rate limit or service error
        if (error instanceof Error && error.message.includes('rate limit')) {
          throw new Error('Azure rate limit exceeded. Please try again later.');
        }

        throw error;
      }
    }

    // Max iterations reached
    logger.warn('Agent reached max iterations');
    throw new Error(
      `Agent exceeded maximum iterations (${this.config.maxIterations})`
    );
  }

  /**
   * Build system prompt with available tools
   */
  private buildSystemPrompt(): string {
    const tools = this.toolRegistry.getToolDefinitions();

    const toolDescriptions = tools
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join('\n');

    return `You are an AI assistant that helps manage Jira and GitHub sprint data. You have access to the following tools:

${toolDescriptions}

Guidelines:
- Use tools to get accurate, up-to-date data
- Call multiple tools if needed to gather all necessary information
- Provide clear, helpful responses based on the tool results
- If a tool fails, explain what happened and suggest alternatives
- Format your responses clearly with markdown when appropriate
- Always verify you have sufficient information before answering`;
  }

  /**
   * Convert MCP tool definitions to OpenAI function calling format
   */
  private convertMCPToolsToOpenAI(): any[] {
    const mcpTools = this.toolRegistry.getToolDefinitions();

    return mcpTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  /**
   * Convert messages to conversation history format
   */
  private convertMessagesToHistory(messages: any[]): AgentMessage[] {
    return messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content:
          typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content),
      }));
  }

  /**
   * Stream responses for real-time interaction
   */
  async *queryStream(
    userPrompt: string,
    conversationHistory: AgentMessage[] = []
  ): AsyncGenerator<{
    type: 'text' | 'tool_use' | 'tool_result' | 'done';
    content: string;
    toolName?: string;
  }> {
    const toolsUsed: string[] = [];
    let iterations = 0;
    const messages: any[] = [];

    // Setup messages
    if (conversationHistory.length === 0) {
      messages.push({
        role: 'system',
        content: this.buildSystemPrompt(),
      });
    } else {
      messages.push(
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        }))
      );
    }

    messages.push({
      role: 'user',
      content: userPrompt,
    });

    const tools = this.convertMCPToolsToOpenAI();

    while (iterations < this.config.maxIterations) {
      iterations++;

      try {
        const streamParams = {
          model: this.config.deploymentName,
          messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          stream: true as const, // Force TypeScript to use streaming overload
          ...(tools.length > 0 && { tools, tool_choice: 'auto' as const }),
        };

        const stream = await this.client.chat.completions.create(streamParams);

        const toolCalls: any[] = [];

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            yield {
              type: 'text',
              content: delta.content,
            };
          }

          if (delta?.tool_calls) {
            toolCalls.push(...delta.tool_calls);
          }

          if (chunk.choices[0]?.finish_reason === 'tool_calls') {
            // Process tool calls
            for (const toolCall of toolCalls) {
              if (toolCall.function?.name) {
                const toolName = toolCall.function.name;
                toolsUsed.push(toolName);

                yield {
                  type: 'tool_use',
                  content: `Using tool: ${toolName}`,
                  toolName,
                };

                try {
                  const toolArgs = JSON.parse(toolCall.function.arguments);
                  const result = await this.toolRegistry.executeTool(
                    toolName,
                    toolArgs,
                    this.context
                  );

                  const resultText =
                    typeof result === 'string'
                      ? result
                      : result.content?.[0]?.text ||
                        JSON.stringify(result, null, 2);

                  messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: resultText.substring(0, 4000),
                  });

                  yield {
                    type: 'tool_result',
                    content: `✓ ${toolName} completed`,
                    toolName,
                  };
                } catch (error) {
                  yield {
                    type: 'tool_result',
                    content: `✗ ${toolName} failed`,
                    toolName,
                  };

                  messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
                  });
                }
              }
            }

            // Continue to next iteration
            break;
          }

          if (chunk.choices[0]?.finish_reason === 'stop') {
            yield { type: 'done', content: '' };
            return;
          }
        }
      } catch (error) {
        logger.error(error as Error, 'Stream failed');
        throw error;
      }
    }
  }

  /**
   * Check if Azure AI Foundry is available
   */
  async checkAvailability(): Promise<{
    available: boolean;
    error?: string;
  }> {
    try {
      // Simple test call
      const response = await this.client.chat.completions.create({
        model: this.config.deploymentName,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      });

      if (response.choices?.[0]?.message) {
        return {
          available: true,
        };
      }

      return {
        available: false,
        error: 'No response from Azure AI Foundry',
      };
    } catch (error) {
      return {
        available: false,
        error:
          error instanceof Error
            ? error.message
            : 'Azure AI Foundry not available',
      };
    }
  }

  /**
   * Get deployment information
   */
  getDeploymentInfo(): {
    endpoint: string;
    deploymentName: string;
    model: string;
  } {
    return {
      endpoint: this.config.endpoint,
      deploymentName: this.config.deploymentName,
      model: this.config.deploymentName,
    };
  }
}
