#!/usr/bin/env node
// Interactive CLI for Azure AI Foundry Agent (Self-hosted LLMs on Azure)

import readline from 'readline';

import chalk from 'chalk';

import { AzureAgent } from './azure-agent';

import { EnhancedMCPServer } from '@/server/enhanced-mcp-server';

async function main() {
  console.log(
    chalk.bold.blue('\n🔷 Azure AI Foundry Agent CLI (Self-Hosted LLMs)\n')
  );
  console.log('Initializing MCP server...');

  // Initialize MCP server
  const mcpServer = new EnhancedMCPServer();
  await mcpServer.initialize();

  const context = (mcpServer as any).context;
  const toolRegistry = (mcpServer as any).toolRegistry;

  // Check Azure configuration
  if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_API_KEY) {
    console.error(chalk.red('\n❌ Error: Azure AI Foundry not configured'));
    console.log(chalk.yellow('\nPlease set these environment variables:'));
    console.log(
      chalk.cyan(
        '  AZURE_OPENAI_ENDPOINT=https://your-endpoint.inference.ml.azure.com/v1'
      )
    );
    console.log(chalk.cyan('  AZURE_OPENAI_API_KEY=your-azure-api-key'));
    console.log(
      chalk.cyan('  AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name')
    );
    console.log(
      chalk.gray('\nSee docs/AZURE_AI_FOUNDRY_SETUP.md for setup instructions.')
    );
    process.exit(1);
  }

  // Initialize Azure agent
  const agent = new AzureAgent(toolRegistry, context);

  // Check if Azure is available
  console.log('Checking Azure AI Foundry availability...');
  const status = await agent.checkAvailability();

  if (!status.available) {
    console.error(chalk.red('\n❌ Error: Azure AI Foundry is not available'));
    console.log(chalk.yellow(`\nReason: ${status.error}`));
    console.log(chalk.gray('\nPlease check:'));
    console.log(chalk.gray('  1. Your endpoint URL is correct'));
    console.log(chalk.gray('  2. Your API key is valid'));
    console.log(chalk.gray('  3. Your deployment exists and is running'));
    console.log(chalk.gray('  4. You have network connectivity to Azure'));
    process.exit(1);
  }

  const info = agent.getDeploymentInfo();
  console.log(
    chalk.green(
      `✅ Azure AI Foundry ready! Using deployment: ${info.deploymentName}`
    )
  );
  console.log(chalk.gray(`   Endpoint: ${info.endpoint}`));

  // List available tools
  const tools = toolRegistry.getToolDefinitions();
  console.log(chalk.gray(`   Available tools: ${tools.length}`));

  console.log(chalk.bold('\nType your question or command:'));
  console.log(chalk.gray('  - "exit" or "quit" to exit'));
  console.log(chalk.gray('  - "clear" to clear conversation history'));
  console.log(chalk.gray('  - "tools" to list available tools'));
  console.log(chalk.gray('  - "info" to show deployment information'));
  console.log(chalk.gray('  - "history" to show conversation\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('You: '),
  });

  let conversationHistory: any[] = [];

  rl.prompt();

  rl.on('line', async (input: string) => {
    const trimmedInput = input.trim();

    // Handle commands
    if (trimmedInput === 'exit' || trimmedInput === 'quit') {
      console.log(chalk.yellow('\n👋 Goodbye!\n'));
      process.exit(0);
    }

    if (trimmedInput === 'clear') {
      conversationHistory = [];
      console.log(chalk.yellow('🗑️  Conversation history cleared.\n'));
      rl.prompt();
      return;
    }

    if (trimmedInput === 'tools') {
      console.log(chalk.bold('\n📦 Available MCP Tools:\n'));
      tools.forEach((tool: any, i: number) => {
        console.log(chalk.cyan(`${i + 1}. ${tool.name}`));
        console.log(chalk.gray(`   ${tool.description}`));
      });
      console.log();
      rl.prompt();
      return;
    }

    if (trimmedInput === 'info') {
      console.log(chalk.bold('\n🔷 Deployment Information:\n'));
      console.log(chalk.cyan(`  Endpoint: ${info.endpoint}`));
      console.log(chalk.cyan(`  Deployment: ${info.deploymentName}`));
      console.log(chalk.cyan(`  Model: ${info.model}`));
      console.log(chalk.cyan(`  Provider: Azure AI Foundry`));
      console.log(chalk.cyan(`  Self-Hosted: Yes`));
      console.log();
      rl.prompt();
      return;
    }

    if (trimmedInput === 'history') {
      console.log(chalk.bold('\n💬 Conversation History:\n'));
      if (conversationHistory.length === 0) {
        console.log(chalk.gray('  (empty)'));
      } else {
        conversationHistory.forEach((msg: any) => {
          const prefix =
            msg.role === 'user' ? chalk.cyan('You:') : chalk.green('Agent:');
          console.log(
            `${prefix} ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
          );
        });
      }
      console.log();
      rl.prompt();
      return;
    }

    if (!trimmedInput) {
      rl.prompt();
      return;
    }

    // Process query
    try {
      console.log(chalk.gray('\n🔷 Thinking on Azure...\n'));

      const startTime = Date.now();
      const response = await agent.query(trimmedInput, conversationHistory);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(chalk.bold.green('Agent: ') + response.answer + '\n');

      // Show metadata
      if (response.toolsUsed.length > 0) {
        console.log(chalk.gray(`[Tools: ${response.toolsUsed.join(', ')}]`));
      }
      console.log(
        chalk.gray(
          `[Iterations: ${response.iterations} | Time: ${duration}s | Model: ${response.model}]`
        )
      );
      console.log();

      // Update conversation history
      conversationHistory = response.conversationHistory;
    } catch (error) {
      console.error(
        chalk.red('\n❌ Error: ') +
          (error instanceof Error ? error.message : 'Unknown error')
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
