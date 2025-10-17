// AI Agent implementation using Ollama (local LLM) with MCP tools
// This agent runs completely locally and is FREE!

import { Ollama } from 'ollama';
import { EnhancedServerContext } from '@/server/enhanced-mcp-server';
import { ToolRegistry } from '@/server/tool-registry';
import { createLogger } from '@/utils/logger';

const logger = createLogger('OllamaAgent');

export interface OllamaAgentConfig {
  model?: string;
  temperature?: number;
  maxIterations?: number;
  ollamaHost?: string;
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
}

export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

export class OllamaAgent {
  private client: Ollama;
  private toolRegistry: ToolRegistry;
  private context: EnhancedServerContext;
  private config: Required<OllamaAgentConfig>;

  constructor(
    toolRegistry: ToolRegistry,
    context: EnhancedServerContext,
    config: OllamaAgentConfig = {}
  ) {
    this.client = new Ollama({
      host: config.ollamaHost || process.env.OLLAMA_HOST || 'http://localhost:11434',
    });
    this.toolRegistry = toolRegistry;
    this.context = context;
    this.config = {
      model: config.model || process.env.OLLAMA_MODEL || 'llama3.1:8b',
      temperature: config.temperature ?? parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
      maxIterations: config.maxIterations ?? parseInt(process.env.OLLAMA_MAX_ITERATIONS || '10'),
      ollamaHost: config.ollamaHost || process.env.OLLAMA_HOST || 'http://localhost:11434',
    };
  }

  /**
   * Process a user query using the AI agent with MCP tools
   */
  async query(
    userPrompt: string,
    conversationHistory: AgentMessage[] = []
  ): Promise<AgentResponse> {
    logger.info('Ollama agent query started', { prompt: userPrompt, model: this.config.model });

    const toolsUsed: string[] = [];
    let iterations = 0;
    const history: AgentMessage[] = [...conversationHistory];

    // Add system prompt with tool information
    if (history.length === 0) {
      history.push({
        role: 'system',
        content: this.buildSystemPrompt(),
      });
    }

    // Add user message to history
    history.push({
      role: 'user',
      content: userPrompt,
    });

    // Agent loop - can call tools multiple times
    while (iterations < this.config.maxIterations) {
      iterations++;

      try {
        // Build prompt for current iteration
        const prompt = this.buildPrompt(history);

        logger.info(`Iteration ${iterations}: Sending to Ollama`);

        const response = await this.client.generate({
          model: this.config.model,
          prompt,
          stream: false,
          options: {
            temperature: this.config.temperature,
          },
        });

        const responseText = response.response.trim();
        logger.info(`Iteration ${iterations}: Got response (${responseText.length} chars)`);

        // Check if the response contains a tool call
        const toolCall = this.extractToolCall(responseText);

        if (toolCall) {
          logger.info(`Tool call detected: ${toolCall.name}`, { params: toolCall.parameters });
          toolsUsed.push(toolCall.name);

          try {
            // Execute the MCP tool
            const result = await this.toolRegistry.executeTool(
              toolCall.name,
              toolCall.parameters,
              this.context
            );

            // Extract text content from MCP response
            const resultText =
              typeof result === 'string'
                ? result
                : result.content?.[0]?.text || JSON.stringify(result, null, 2);

            // Add tool result to history
            history.push({
              role: 'assistant',
              content: `I used the tool ${toolCall.name} with parameters ${JSON.stringify(toolCall.parameters)}.`,
            });

            history.push({
              role: 'user',
              content: `Tool result: ${resultText.substring(0, 2000)}${resultText.length > 2000 ? '... (truncated)' : ''}`,
            });

            logger.info(`Tool ${toolCall.name} executed successfully`);

            // Continue loop to get final answer
            continue;
          } catch (error) {
            logger.error(error as Error, `Tool ${toolCall.name} failed`);
            history.push({
              role: 'user',
              content: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
            // Continue to let agent handle the error
            continue;
          }
        }

        // No tool call detected - this is the final answer
        const finalAnswer = this.extractFinalAnswer(responseText);

        history.push({
          role: 'assistant',
          content: finalAnswer,
        });

        logger.info('Ollama agent query completed', {
          iterations,
          toolsUsed: toolsUsed.length,
        });

        return {
          answer: finalAnswer,
          toolsUsed: Array.from(new Set(toolsUsed)),
          iterations,
          conversationHistory: history,
        };
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
   * Build system prompt with available tools
   */
  private buildSystemPrompt(): string {
    const tools = this.toolRegistry.getToolDefinitions();

    const toolDescriptions = tools
      .map(tool => {
        const params = JSON.stringify(tool.inputSchema, null, 2);
        return `- ${tool.name}: ${tool.description}\n  Parameters: ${params}`;
      })
      .join('\n\n');

    return `You are an AI assistant that helps manage Jira and GitHub sprint data. You have access to the following tools:

${toolDescriptions}

To use a tool, respond in this exact format:
TOOL_CALL: tool_name
PARAMETERS: {"param1": "value1", "param2": "value2"}

After receiving tool results, you can either:
1. Call another tool if you need more information
2. Provide a final answer to the user

When providing a final answer, start with "FINAL_ANSWER:" and then give a clear, helpful response based on the tool results.

Guidelines:
- Always check if you have enough information before answering
- Use tools to get accurate, up-to-date data
- Be concise but thorough in your answers
- If a tool fails, explain what happened and suggest alternatives
- Format your responses clearly with markdown when appropriate`;
  }

  /**
   * Build prompt for current iteration
   */
  private buildPrompt(history: AgentMessage[]): string {
    return history
      .map(msg => {
        if (msg.role === 'system') {
          return `System: ${msg.content}`;
        } else if (msg.role === 'user') {
          return `User: ${msg.content}`;
        } else {
          return `Assistant: ${msg.content}`;
        }
      })
      .join('\n\n');
  }

  /**
   * Extract tool call from response
   */
  private extractToolCall(response: string): ToolCall | null {
    // Look for tool call pattern
    const toolCallMatch = response.match(/TOOL_CALL:\s*(\w+)/i);
    const parametersMatch = response.match(/PARAMETERS:\s*(\{[\s\S]*?\})/i);

    if (toolCallMatch && toolCallMatch[1] && parametersMatch && parametersMatch[1]) {
      try {
        const parameters = JSON.parse(parametersMatch[1]);
        return {
          name: toolCallMatch[1],
          parameters,
        };
      } catch (error) {
        logger.warn('Failed to parse tool parameters', { response });
        return null;
      }
    }

    return null;
  }

  /**
   * Extract final answer from response
   */
  private extractFinalAnswer(response: string): string {
    // Look for FINAL_ANSWER: prefix
    const finalAnswerMatch = response.match(/FINAL_ANSWER:\s*([\s\S]*)/i);
    if (finalAnswerMatch && finalAnswerMatch[1]) {
      return finalAnswerMatch[1].trim();
    }

    // If no explicit marker, return the whole response
    return response;
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
    const history: AgentMessage[] = [...conversationHistory];

    if (history.length === 0) {
      history.push({
        role: 'system',
        content: this.buildSystemPrompt(),
      });
    }

    history.push({
      role: 'user',
      content: userPrompt,
    });

    while (iterations < this.config.maxIterations) {
      iterations++;

      const prompt = this.buildPrompt(history);

      // Stream the response
      const stream = await this.client.generate({
        model: this.config.model,
        prompt,
        stream: true,
        options: {
          temperature: this.config.temperature,
        },
      });

      let fullResponse = '';

      for await (const chunk of stream) {
        fullResponse += chunk.response;

        // Check if we're getting a tool call
        if (fullResponse.includes('TOOL_CALL:') && !fullResponse.includes('PARAMETERS:')) {
          // Still receiving tool call, don't yield yet
          continue;
        }

        // Yield text incrementally
        if (!fullResponse.includes('TOOL_CALL:')) {
          yield {
            type: 'text',
            content: chunk.response,
          };
        }
      }

      // Check for tool call in full response
      const toolCall = this.extractToolCall(fullResponse);

      if (toolCall) {
        yield {
          type: 'tool_use',
          content: `Using tool: ${toolCall.name}`,
          toolName: toolCall.name,
        };

        toolsUsed.push(toolCall.name);

        try {
          const result = await this.toolRegistry.executeTool(
            toolCall.name,
            toolCall.parameters,
            this.context
          );

          const resultText =
            typeof result === 'string'
              ? result
              : result.content?.[0]?.text || JSON.stringify(result, null, 2);

          yield {
            type: 'tool_result',
            content: `✓ ${toolCall.name} completed`,
            toolName: toolCall.name,
          };

          history.push({
            role: 'assistant',
            content: `I used the tool ${toolCall.name}.`,
          });

          history.push({
            role: 'user',
            content: `Tool result: ${resultText.substring(0, 2000)}`,
          });

          continue;
        } catch (error) {
          yield {
            type: 'tool_result',
            content: `✗ ${toolCall.name} failed`,
            toolName: toolCall.name,
          };

          history.push({
            role: 'user',
            content: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown'}`,
          });

          continue;
        }
      }

      // No tool call - final answer received
      yield { type: 'done', content: '' };
      return;
    }
  }

  /**
   * Check if Ollama is available and model is pulled
   */
  async checkAvailability(): Promise<{
    available: boolean;
    modelPulled: boolean;
    error?: string;
  }> {
    try {
      // Check if Ollama is running
      const models = await this.client.list();
      const modelPulled = models.models.some(m => m.name.includes(this.config.model));

      if (modelPulled) {
        return {
          available: true,
          modelPulled: true,
        };
      } else {
        return {
          available: true,
          modelPulled: false,
          error: `Model ${this.config.model} not found. Run: ollama pull ${this.config.model}`,
        };
      }
    } catch (error) {
      return {
        available: false,
        modelPulled: false,
        error: error instanceof Error ? error.message : 'Ollama not available',
      };
    }
  }

  /**
   * Get available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.list();
      return response.models.map(m => m.name);
    } catch (error) {
      logger.error(error as Error, 'Failed to list models');
      return [];
    }
  }
}
