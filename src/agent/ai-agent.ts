// AI Agent implementation using Claude API with MCP tools
// This agent can intelligently use your MCP tools to answer queries

import Anthropic from '@anthropic-ai/sdk';

import { EnhancedServerContext } from '@/server/enhanced-mcp-server';
import { ToolRegistry } from '@/server/tool-registry';
import { createLogger } from '@/utils/logger';

const logger = createLogger('AIAgent');

export interface AgentConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  maxIterations?: number;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentResponse {
  answer: string;
  toolsUsed: string[];
  iterations: number;
  conversationHistory: AgentMessage[];
}

export class AIAgent {
  private client: Anthropic;
  private toolRegistry: ToolRegistry;
  private context: EnhancedServerContext;
  private config: Required<AgentConfig>;

  constructor(
    apiKey: string,
    toolRegistry: ToolRegistry,
    context: EnhancedServerContext,
    config: AgentConfig = {}
  ) {
    this.client = new Anthropic({ apiKey });
    this.toolRegistry = toolRegistry;
    this.context = context;
    this.config = {
      model: config.model || 'claude-3-5-sonnet-20241022',
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.7,
      maxIterations: config.maxIterations || 10,
    };
  }

  /**
   * Process a user query using the AI agent with MCP tools
   */
  async query(
    userPrompt: string,
    conversationHistory: AgentMessage[] = []
  ): Promise<AgentResponse> {
    logger.info('Agent query started', { prompt: userPrompt });

    const toolsUsed: string[] = [];
    let iterations = 0;
    const history: AgentMessage[] = [...conversationHistory];

    // Add user message to history
    history.push({
      role: 'user',
      content: userPrompt,
    });

    // Convert MCP tools to Claude format
    const tools = this.convertMCPToolsToClaude();

    logger.info(`Agent has ${tools.length} tools available`);

    // Agent loop - Claude can call tools multiple times
    while (iterations < this.config.maxIterations) {
      iterations++;

      try {
        const response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages: history as any,
          tools,
        });

        logger.info(
          `Iteration ${iterations}: stop_reason = ${response.stop_reason}`
        );

        // Check if Claude wants to use tools
        if (response.stop_reason === 'tool_use') {
          // Process tool calls
          const toolResults: any[] = [];

          for (const block of response.content) {
            if (block.type === 'tool_use') {
              const toolName = block.name;
              const toolInput = block.input as Record<string, any>;

              logger.info(`Executing tool: ${toolName}`, { input: toolInput });
              toolsUsed.push(toolName);

              try {
                // Execute the MCP tool
                const result = await this.toolRegistry.executeTool(
                  toolName,
                  toolInput,
                  this.context
                );

                // Extract text content from MCP response
                const resultText =
                  typeof result === 'string'
                    ? result
                    : result.content?.[0]?.text || JSON.stringify(result);

                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: resultText,
                });

                logger.info(`Tool ${toolName} executed successfully`);
              } catch (error) {
                logger.error(error as Error, `Tool ${toolName} failed`);
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  is_error: true,
                });
              }
            }
          }

          // Add assistant's tool use and tool results to history
          history.push({
            role: 'assistant',
            content: response.content as any,
          });

          history.push({
            role: 'user',
            content: toolResults as any,
          });

          // Continue loop to get Claude's final response
          continue;
        }

        // Claude has finished - extract final answer
        if (response.stop_reason === 'end_turn') {
          const textBlocks = response.content.filter(
            (block: any) => block.type === 'text'
          );
          const answer = textBlocks.map((block: any) => block.text).join('\n');

          history.push({
            role: 'assistant',
            content: answer,
          });

          logger.info('Agent query completed', {
            iterations,
            toolsUsed: toolsUsed.length,
          });

          return {
            answer,
            toolsUsed: Array.from(new Set(toolsUsed)),
            iterations,
            conversationHistory: history,
          };
        }

        // Max tokens reached
        if (response.stop_reason === 'max_tokens') {
          logger.warn('Agent reached max tokens');
          const textBlocks = response.content.filter(
            (block: any) => block.type === 'text'
          );
          const answer =
            textBlocks.map((block: any) => block.text).join('\n') +
            '\n\n[Response truncated due to length]';

          history.push({
            role: 'assistant',
            content: answer,
          });

          return {
            answer,
            toolsUsed: Array.from(new Set(toolsUsed)),
            iterations,
            conversationHistory: history,
          };
        }
      } catch (error) {
        logger.error(error as Error, 'Agent iteration failed');
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
   * Convert MCP tool definitions to Claude's tool format
   */
  private convertMCPToolsToClaude(): any[] {
    const mcpTools = this.toolRegistry.getToolDefinitions();

    return mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
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
    const history: AgentMessage[] = [...conversationHistory];
    history.push({ role: 'user', content: userPrompt });

    const tools = this.convertMCPToolsToClaude();
    let iterations = 0;

    while (iterations < this.config.maxIterations) {
      iterations++;

      const stream = await this.client.messages.stream({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        messages: history as any,
        tools,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'text_delta') {
            yield {
              type: 'text',
              content: chunk.delta.text,
            };
          }
        } else if (chunk.type === 'content_block_start') {
          if (chunk.content_block.type === 'tool_use') {
            yield {
              type: 'tool_use',
              content: 'Using tool...',
              toolName: chunk.content_block.name,
            };
          }
        }
      }

      const response = await stream.finalMessage();

      if (response.stop_reason === 'tool_use') {
        const toolResults: any[] = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            try {
              const result = await this.toolRegistry.executeTool(
                block.name,
                block.input as Record<string, any>,
                this.context
              );

              const resultText =
                typeof result === 'string'
                  ? result
                  : result.content?.[0]?.text || JSON.stringify(result);

              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: resultText,
              });

              yield {
                type: 'tool_result',
                content: `✓ ${block.name} completed`,
                toolName: block.name,
              };
            } catch (error) {
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
                is_error: true,
              });
            }
          }
        }

        history.push({
          role: 'assistant',
          content: response.content as any,
        });

        history.push({
          role: 'user',
          content: toolResults as any,
        });

        continue;
      }

      if (response.stop_reason === 'end_turn') {
        yield { type: 'done', content: '' };
        return;
      }
    }
  }
}
