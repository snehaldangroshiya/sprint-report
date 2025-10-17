// Example usage of the AI Agent with MCP tools

import { AIAgent } from './ai-agent';
import { EnhancedMCPServer } from '@/server/enhanced-mcp-server';
import { createAppConfig } from '@/config/environment';

/**
 * Example: Using the AI Agent to answer questions about sprints
 */
async function exampleUsage() {
  // Initialize MCP server
  createAppConfig(); // Initialize configuration
  const mcpServer = new EnhancedMCPServer();
  await mcpServer.initialize();

  const context = (mcpServer as any).context;
  const toolRegistry = (mcpServer as any).toolRegistry;

  // Initialize AI Agent with Claude API key
  const agent = new AIAgent(
    process.env.ANTHROPIC_API_KEY!,
    toolRegistry,
    context,
    {
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 4096,
      temperature: 0.7,
      maxIterations: 10,
    }
  );

  // Example 1: Simple query
  console.log('\n=== Example 1: Sprint Summary ===');
  const response1 = await agent.query(
    'What are the current active sprints in project SCRUM? Give me a summary of each sprint.'
  );
  console.log('Answer:', response1.answer);
  console.log('Tools used:', response1.toolsUsed);
  console.log('Iterations:', response1.iterations);

  // Example 2: Complex analysis
  console.log('\n=== Example 2: Sprint Analysis ===');
  const response2 = await agent.query(
    'For sprint ID 123, analyze the completion rate, identify any blockers, and suggest improvements for the next sprint.'
  );
  console.log('Answer:', response2.answer);
  console.log('Tools used:', response2.toolsUsed);

  // Example 3: Cross-service query (Jira + GitHub)
  console.log('\n=== Example 3: Integration Analysis ===');
  const response3 = await agent.query(
    'Find all GitHub commits for sprint 123 that reference Jira issues. Are there any commits without Jira references?'
  );
  console.log('Answer:', response3.answer);
  console.log('Tools used:', response3.toolsUsed);

  // Example 4: Streaming response
  console.log('\n=== Example 4: Streaming Response ===');
  console.log('Asking: Generate a comprehensive sprint report for sprint 123...\n');

  for await (const chunk of agent.queryStream(
    'Generate a comprehensive sprint report for sprint 123 in markdown format'
  )) {
    if (chunk.type === 'text') {
      process.stdout.write(chunk.content);
    } else if (chunk.type === 'tool_use') {
      console.log(`\n[Using tool: ${chunk.toolName}]`);
    } else if (chunk.type === 'tool_result') {
      console.log(`[${chunk.content}]`);
    } else if (chunk.type === 'done') {
      console.log('\n\n[Response complete]');
    }
  }

  // Example 5: Multi-turn conversation
  console.log('\n=== Example 5: Conversation ===');
  let conversationHistory: any[] = [];

  const turn1 = await agent.query('List all sprints in project SCRUM', conversationHistory);
  console.log('User: List all sprints in project SCRUM');
  console.log('Agent:', turn1.answer);
  conversationHistory = turn1.conversationHistory;

  const turn2 = await agent.query(
    'Now analyze the velocity trend across these sprints',
    conversationHistory
  );
  console.log('\nUser: Now analyze the velocity trend across these sprints');
  console.log('Agent:', turn2.answer);
  conversationHistory = turn2.conversationHistory;

  const turn3 = await agent.query(
    'What recommendations would you make for improving velocity?',
    conversationHistory
  );
  console.log('\nUser: What recommendations would you make for improving velocity?');
  console.log('Agent:', turn3.answer);
}

// Run if called directly
if (require.main === module) {
  exampleUsage()
    .then(() => {
      console.log('\n✅ All examples completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { exampleUsage };
