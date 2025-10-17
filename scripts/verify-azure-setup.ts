#!/usr/bin/env node
// Quick test to verify Azure AI Foundry setup

import chalk from 'chalk';

console.log(chalk.bold.blue('\n🔷 Azure AI Foundry Setup Verification\n'));

// Check if openai is installed
try {
  require('openai');
  console.log(chalk.green('✅ openai package installed'));
} catch (error) {
  console.log(chalk.red('❌ openai package not found'));
  console.log(chalk.yellow('   Run: npm install openai'));
  process.exit(1);
}

// Check environment variables
const requiredEnvVars = {
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
};

const optionalEnvVars = {
  AZURE_OPENAI_TEMPERATURE: process.env.AZURE_OPENAI_TEMPERATURE || '0.7',
  AZURE_OPENAI_MAX_TOKENS: process.env.AZURE_OPENAI_MAX_TOKENS || '4096',
  AZURE_OPENAI_MAX_ITERATIONS: process.env.AZURE_OPENAI_MAX_ITERATIONS || '10',
};

console.log(chalk.bold('\n📋 Required Configuration:\n'));

let missingVars = 0;
for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (value) {
    console.log(chalk.green(`✅ ${key}`));
    if (key === 'AZURE_OPENAI_ENDPOINT') {
      console.log(chalk.gray(`   ${value}`));
    } else if (key === 'AZURE_OPENAI_DEPLOYMENT_NAME') {
      console.log(chalk.gray(`   ${value}`));
    } else {
      console.log(chalk.gray(`   ${value.substring(0, 20)}...`));
    }
  } else {
    console.log(chalk.red(`❌ ${key} - NOT SET`));
    missingVars++;
  }
}

console.log(chalk.bold('\n⚙️  Optional Configuration:\n'));

for (const [key, value] of Object.entries(optionalEnvVars)) {
  console.log(chalk.cyan(`   ${key}: ${value}`));
}

if (missingVars > 0) {
  console.log(chalk.bold.red('\n❌ Missing required environment variables!\n'));
  console.log(chalk.yellow('Please set the following in your .env file:\n'));
  console.log(chalk.cyan('AZURE_OPENAI_ENDPOINT=https://your-endpoint.inference.ml.azure.com/v1'));
  console.log(chalk.cyan('AZURE_OPENAI_API_KEY=your-azure-api-key'));
  console.log(chalk.cyan('AZURE_OPENAI_DEPLOYMENT_NAME=llama-3-1-8b'));
  console.log(chalk.gray('\nSee docs/AZURE_AI_FOUNDRY_SETUP.md for full setup instructions.\n'));
  process.exit(1);
}

// Check MCP credentials
console.log(chalk.bold('\n🔧 MCP Configuration:\n'));

const mcpVars = {
  JIRA_BASE_URL: process.env.JIRA_BASE_URL,
  JIRA_EMAIL: process.env.JIRA_EMAIL,
  JIRA_API_TOKEN: process.env.JIRA_API_TOKEN,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
};

for (const [key, value] of Object.entries(mcpVars)) {
  if (value) {
    console.log(chalk.green(`✅ ${key}`));
  } else {
    console.log(chalk.yellow(`⚠️  ${key} - NOT SET (optional for testing)`));
  }
}

console.log(chalk.bold.green('\n✅ Azure AI Foundry is configured!\n'));

console.log(chalk.bold('🚀 Next Steps:\n'));
console.log(chalk.cyan('1. Test the agent:'));
console.log(chalk.gray('   npm run agent:azure\n'));
console.log(chalk.cyan('2. Start HTTP server:'));
console.log(chalk.gray('   npm run dev:http\n'));
console.log(chalk.cyan('3. Test API endpoint:'));
console.log(chalk.gray('   curl -X POST http://localhost:3001/api/agent/azure/chat \\'));
console.log(chalk.gray('     -H "Content-Type: application/json" \\'));
console.log(chalk.gray('     -d \'{"message": "Hello, are you working?"}\'\n'));

console.log(chalk.bold('📚 Documentation:\n'));
console.log(chalk.gray('   Full guide: docs/AZURE_AI_FOUNDRY_SETUP.md'));
console.log(chalk.gray('   Quick guide: docs/AZURE_OLLAMA_QUICK_GUIDE.md'));
console.log(chalk.gray('   Summary: docs/AZURE_AI_FOUNDRY_SUMMARY.md\n'));
