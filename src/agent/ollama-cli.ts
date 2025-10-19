#!/usr/bin/env node
// Interactive CLI for Ollama AI Agent (Local LLM - FREE!)

import readline from 'readline';

import chalk from 'chalk';

import { OllamaAgent } from './ollama-agent';

import { EnhancedMCPServer } from '@/server/enhanced-mcp-server';

async function main() {
  console.log(chalk.bold.blue('\n🦙 Ollama AI Agent CLI (FREE Local LLM)\n'));
  console.log('Initializing MCP server...');

  // Initialize MCP server
  const mcpServer = new EnhancedMCPServer();
  await mcpServer.initialize();

  const context = (mcpServer as any).context;
  const toolRegistry = (mcpServer as any).toolRegistry;

  // Initialize Ollama agent
  const agent = new OllamaAgent(toolRegistry, context);

  // Check if Ollama is available
  console.log('Checking Ollama availability...');
  const status = await agent.checkAvailability();

  if (!status.available) {
    console.error(chalk.red('\n❌ Error: Ollama is not running'));
    console.log(chalk.yellow('\nPlease install and start Ollama:'));
    console.log(chalk.cyan('1. Download from: https://ollama.ai/'));
    console.log(chalk.cyan('2. Install and run: ollama serve'));
    console.log(chalk.cyan('3. Pull a model: ollama pull llama3.1:8b'));
    process.exit(1);
  }

  if (!status.modelPulled) {
    console.error(chalk.red('\n❌ Error: Model not available'));
    console.log(chalk.yellow(status.error));
    console.log(chalk.cyan('\nAvailable models:'));
    const models = await agent.listModels();
    if (models.length > 0) {
      models.forEach(m => console.log(chalk.gray(`  - ${m}`)));
      console.log(chalk.yellow('\nOr pull the default model:'));
    }
    console.log(chalk.cyan('ollama pull llama3.1:8b'));
    process.exit(1);
  }

  const models = await agent.listModels();
  console.log(
    chalk.green(
      `✅ Ollama ready! Using model: ${process.env.OLLAMA_MODEL || 'llama3.1:8b'}`
    )
  );
  console.log(chalk.gray(`Available models: ${models.join(', ')}\n`));

  console.log(chalk.gray('Type your question or command:'));
  console.log(chalk.gray('  - "exit" or "quit" to exit'));
  console.log(chalk.gray('  - "clear" to clear conversation history'));
  console.log(chalk.gray('  - "tools" to list available tools'));
  console.log(chalk.gray('  - "models" to list available models'));
  console.log(chalk.gray('  - "history" to show conversation\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('You: '),
  });

  let conversationHistory: any[] = [];

  rl.prompt();

  rl.on('line', async (input: string) => {
    const trimmed = input.trim();

    if (!trimmed) {
      rl.prompt();
      return;
    }

    // Commands
    if (trimmed === 'exit' || trimmed === 'quit') {
      console.log(chalk.yellow('\n👋 Goodbye!\n'));
      rl.close();
      process.exit(0);
    }

    if (trimmed === 'clear') {
      conversationHistory = [];
      console.log(chalk.green('✅ Conversation history cleared\n'));
      rl.prompt();
      return;
    }

    if (trimmed === 'tools') {
      const tools = toolRegistry.getToolDefinitions();
      console.log(chalk.bold('\n📦 Available Tools:\n'));
      tools.forEach((tool: any) => {
        console.log(chalk.blue(`  • ${tool.name}`));
        console.log(chalk.gray(`    ${tool.description}`));
      });
      console.log();
      rl.prompt();
      return;
    }

    if (trimmed === 'models') {
      const models = await agent.listModels();
      console.log(chalk.bold('\n🦙 Available Ollama Models:\n'));
      models.forEach((model: string) => {
        const current = model.includes(
          process.env.OLLAMA_MODEL || 'llama3.1:8b'
        );
        console.log(
          current
            ? chalk.green(`  ✓ ${model} (current)`)
            : chalk.gray(`    ${model}`)
        );
      });
      console.log(
        chalk.gray('\nTo switch models: export OLLAMA_MODEL=model-name\n')
      );
      rl.prompt();
      return;
    }

    if (trimmed === 'history') {
      console.log(chalk.bold('\n💬 Conversation History:\n'));
      conversationHistory.forEach((msg: any, i: number) => {
        const role =
          msg.role === 'user'
            ? chalk.cyan('You')
            : msg.role === 'system'
              ? chalk.yellow('System')
              : chalk.magenta('Agent');
        const content =
          typeof msg.content === 'string'
            ? msg.content.substring(0, 100)
            : JSON.stringify(msg.content).substring(0, 100);
        console.log(`${i + 1}. ${role}: ${content}`);
      });
      console.log();
      rl.prompt();
      return;
    }

    // Query agent
    try {
      console.log(chalk.gray('\n🦙 Thinking locally...\n'));

      const startTime = Date.now();
      const response = await agent.query(trimmed, conversationHistory);
      const duration = Date.now() - startTime;

      conversationHistory = response.conversationHistory;

      console.log(chalk.magenta('Agent: ') + response.answer);
      console.log(
        chalk.gray(
          `\n[Tools: ${response.toolsUsed.join(', ') || 'none'} | ` +
            `Iterations: ${response.iterations} | ` +
            `Time: ${(duration / 1000).toFixed(1)}s | ` +
            `Cost: FREE!]\n`
        )
      );
    } catch (error) {
      console.error(
        chalk.red('❌ Error:'),
        error instanceof Error ? error.message : error
      );
      console.log();
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.yellow('\n👋 Goodbye!\n'));
    process.exit(0);
  });
}

// Handle errors
process.on('unhandledRejection', error => {
  console.error(chalk.red('\n❌ Unhandled error:'), error);
  process.exit(1);
});

// Run
main().catch(error => {
  console.error(chalk.red('❌ Failed to start:'), error);
  process.exit(1);
});
