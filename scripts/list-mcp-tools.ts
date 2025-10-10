#!/usr/bin/env tsx
/**
 * List all MCP tools available in the server
 * Usage: tsx scripts/list-mcp-tools.ts
 */

import { ToolRegistry } from '../src/server/tool-registry';

console.log('\n📋 MCP Server Tools\n');
console.log('==================\n');

const registry = new ToolRegistry();
registry.registerAllTools();

const tools = registry.getToolDefinitions();

// Group tools by category
const categories = {
  jira: [] as typeof tools,
  github: [] as typeof tools,
  sprint: [] as typeof tools,
  utility: [] as typeof tools,
};

tools.forEach((tool) => {
  if (tool.name.startsWith('jira_')) {
    categories.jira.push(tool);
  } else if (tool.name.startsWith('github_')) {
    categories.github.push(tool);
  } else if (tool.name.includes('sprint') || tool.name.includes('report')) {
    categories.sprint.push(tool);
  } else {
    categories.utility.push(tool);
  }
});

// Print by category
console.log('🎫 Jira Tools:\n');
categories.jira.forEach((tool, i) => {
  console.log(`  ${i + 1}. ${tool.name}`);
  console.log(`     ${tool.description}\n`);
});

console.log('\n🐙 GitHub Tools:\n');
categories.github.forEach((tool, i) => {
  console.log(`  ${i + 1}. ${tool.name}`);
  console.log(`     ${tool.description}\n`);
});

console.log('\n📊 Sprint Reporting Tools:\n');
categories.sprint.forEach((tool, i) => {
  console.log(`  ${i + 1}. ${tool.name}`);
  console.log(`     ${tool.description}\n`);
});

console.log('\n🔧 Health & Utility Tools:\n');
categories.utility.forEach((tool, i) => {
  console.log(`  ${i + 1}. ${tool.name}`);
  console.log(`     ${tool.description}\n`);
});

console.log(`\nTotal: ${tools.length} tools\n`);
