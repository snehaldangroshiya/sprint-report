#!/usr/bin/env node
// Interactive CLI for AI Agent

import readline from 'readline';

import chalk from 'chalk';

import { AIAgent } from './ai-agent';

import { EnhancedMCPServer } from '@/server/enhanced-mcp-server';

async function main() {
  console.log(chalk.bold.blue('\n🤖 AI Agent CLI\n'));
  console.log('Initializing MCP server...');

  // Initialize MCP server
  const mcpServer = new EnhancedMCPServer();
  await mcpServer.initialize();

  const context = (mcpServer as any).context;
  const toolRegistry = (mcpServer as any).toolRegistry;

  // Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      chalk.red('❌ Error: ANTHROPIC_API_KEY environment variable is required')
    );
    console.log(chalk.yellow('\nPlease set your API key:'));
    console.log('export ANTHROPIC_API_KEY=sk-ant-api03-...');
    process.exit(1);
  }

  // Initialize agent
  const agent = new AIAgent(apiKey, toolRegistry, context);

  console.log(chalk.green('✅ Agent ready!\n'));
  console.log(chalk.gray('Type your question or command:'));
  console.log(chalk.gray('  - "exit" or "quit" to exit'));
  console.log(chalk.gray('  - "clear" to clear conversation history'));
  console.log(chalk.gray('  - "tools" to list available tools'));
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

    if (trimmed === 'history') {
      console.log(chalk.bold('\n💬 Conversation History:\n'));
      conversationHistory.forEach((msg: any, i: number) => {
        const role =
          msg.role === 'user' ? chalk.cyan('You') : chalk.magenta('Agent');
        const content =
          typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content).substring(0, 100);
        console.log(`${i + 1}. ${role}: ${content}`);
      });
      console.log();
      rl.prompt();
      return;
    }

    // Query agent
    try {
      console.log(chalk.gray('\nThinking...\n'));

      const startTime = Date.now();
      const response = await agent.query(trimmed, conversationHistory);
      const duration = Date.now() - startTime;

      conversationHistory = response.conversationHistory;

      console.log(chalk.magenta('Agent: ') + response.answer);
      console.log(
        chalk.gray(
          `\n[Tools: ${response.toolsUsed.join(', ') || 'none'} | ` +
            `Iterations: ${response.iterations} | ` +
            `Time: ${(duration / 1000).toFixed(1)}s]\n`
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
