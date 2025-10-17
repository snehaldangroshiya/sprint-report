# AI Agent Quick Reference

## 🚀 Quick Start

```bash
# 1. Get API key from https://console.anthropic.com/

# 2. Set environment variable
export ANTHROPIC_API_KEY=sk-ant-api03-...

# 3. Run CLI
npm run agent

# 4. Or run examples
npm run agent:example
```

## 📝 CLI Commands

```
tools      - List all available MCP tools
history    - Show conversation history
clear      - Clear conversation
exit/quit  - Exit CLI
```

## 🔧 API Endpoints

### Chat
```bash
POST /api/agent/chat
{
  "message": "What are the active sprints?",
  "conversationHistory": [] # optional
}
```

### Streaming Chat
```bash
POST /api/agent/chat/stream
# Returns Server-Sent Events
```

### List Tools
```bash
GET /api/agent/tools
```

### Configuration
```bash
GET /api/agent/config
```

## 💡 Example Queries

### Simple
```
"What are the active sprints?"
"Show me sprint 123"
"List blocked issues"
```

### Complex
```
"Analyze sprint 123 and compare it to sprint 122"
"Find all high-priority bugs and check their GitHub PRs"
"Calculate velocity trend and suggest improvements"
```

### Multi-Step
```
User: "List all sprints"
Agent: [Lists sprints]

User: "Now show issues for the first one"
Agent: [Shows issues from first sprint]

User: "Which are blocked?"
Agent: [Filters blocked issues]
```

## ⚙️ Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional
AGENT_MODEL=claude-3-5-sonnet-20241022
AGENT_MAX_TOKENS=4096
AGENT_TEMPERATURE=0.7
AGENT_MAX_ITERATIONS=10
```

## 🎯 Available Models

| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| Haiku | Fast | Good | $ |
| Sonnet | Medium | Great | $$ |
| Opus | Slow | Best | $$$ |

## 🛠️ Available Tools (14)

### Jira (5)
- `jira_get_sprints` - List sprints
- `jira_get_sprint_issues` - Get sprint issues
- `jira_get_sprint` - Sprint details
- `jira_get_issue_details` - Issue details
- `jira_search_issues` - Search with JQL

### GitHub (5)
- `github_get_commits` - Get commits
- `github_get_pull_requests` - Get PRs
- `github_search_commits_by_message` - Search commits
- `github_search_pull_requests_by_date` - Search PRs
- `github_find_commits_with_jira_references` - Find Jira refs

### Reporting (2)
- `generate_sprint_report` - Generate report
- `get_sprint_metrics` - Get metrics

### Utility (2)
- `health_check` - Server health
- `cache_stats` - Cache statistics

## 📊 Cost Estimation

| Query Type | Typical Cost |
|------------|--------------|
| Simple (1 tool) | $0.01-0.02 |
| Medium (2-3 tools) | $0.02-0.05 |
| Complex (5+ tools) | $0.05-0.10 |
| Full report | $0.10-0.25 |

## 🎨 Integration Code

### React
```tsx
const response = await fetch('/api/agent/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: input })
});
const data = await response.json();
console.log(data.data.answer);
```

### Node.js
```typescript
import { AIAgent } from '@/agent/ai-agent';

const agent = new AIAgent(apiKey, toolRegistry, context);
const response = await agent.query('Your question');
console.log(response.answer);
```

### Streaming
```typescript
for await (const chunk of agent.queryStream('Question')) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.content);
  }
}
```

## 🐛 Troubleshooting

### API Key Error
```bash
export ANTHROPIC_API_KEY=sk-ant-api03-...
# Or add to .env file
```

### Tool Execution Error
- Check MCP server is running
- Verify Jira/GitHub credentials
- Check tool parameter types

### High Costs
- Use Claude Haiku for simple queries
- Reduce maxIterations (default: 10)
- Lower maxTokens (default: 4096)
- Implement caching

### Slow Responses
- Use streaming API
- Switch to Haiku model
- Reduce maxTokens

## 📚 Documentation

- Full Guide: `docs/AI_AGENT_SETUP.md`
- Agent README: `src/agent/README.md`
- MCP Logging Fix: `docs/MCP_STDIO_LOGGING_FIX.md`

## 🔗 Resources

- Anthropic Console: https://console.anthropic.com/
- API Docs: https://docs.anthropic.com/
- Tool Use: https://docs.anthropic.com/en/docs/build-with-claude/tool-use
- MCP Protocol: https://modelcontextprotocol.io/
