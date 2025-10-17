# AI Agent with MCP Tools

This directory contains an AI agent implementation that uses Claude API to intelligently interact with your MCP server tools.

## Features

✅ **Natural Language Interface** - Ask questions in plain English  
✅ **Multi-Tool Orchestration** - Agent automatically selects and chains tools  
✅ **Conversation Memory** - Maintains context across multiple turns  
✅ **Streaming Responses** - Real-time output for better UX  
✅ **14 MCP Tools** - Full access to Jira, GitHub, and reporting tools  
✅ **RESTful API** - Easy integration with web/mobile apps  

## Architecture

```
┌─────────────┐
│   User      │
│  Query      │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│   AI Agent      │  ← Uses Claude API
│  (ai-agent.ts)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Tool Registry  │  ← 14 MCP Tools
│  (MCP Server)   │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌──────┐  ┌────────┐
│ Jira │  │ GitHub │
└──────┘  └────────┘
```

## Setup

### 1. Install Dependencies

```bash
npm install @anthropic-ai/sdk
```

### 2. Configure Environment

Add to your `.env` file:

```bash
# Required: Anthropic API key
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional: Agent configuration
AGENT_MODEL=claude-3-5-sonnet-20241022
AGENT_MAX_TOKENS=4096
AGENT_TEMPERATURE=0.7
AGENT_MAX_ITERATIONS=10
```

Get your API key from: https://console.anthropic.com/

### 3. Add to Your Server

In `src/web-server.ts` or `src/http-server.ts`:

```typescript
import { createAgentRouter } from '@/agent/agent-api';

// After initializing your MCP server
const agentRouter = createAgentRouter(toolRegistry, context);
app.use('/api/agent', agentRouter);
```

## Usage

### Option 1: API Endpoints

#### Chat (Single Response)

```bash
curl -X POST http://localhost:3002/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the active sprints in project SCRUM?"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "answer": "I found 3 active sprints in project SCRUM:\n\n1. Sprint 45: Development Phase (20 issues, 65% complete)\n2. Sprint 46: Testing Phase (15 issues, 40% complete)\n3. Sprint 47: Planning Phase (8 issues, 10% complete)",
    "toolsUsed": ["jira_get_sprints", "jira_get_sprint_issues"],
    "iterations": 2,
    "conversationHistory": [...]
  }
}
```

#### Chat (Streaming)

```bash
curl -X POST http://localhost:3002/api/agent/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Generate a comprehensive report for sprint 123"
  }'
```

Response (Server-Sent Events):
```
data: {"type":"tool_use","content":"Using tool...","toolName":"jira_get_sprint"}

data: {"type":"tool_result","content":"✓ jira_get_sprint completed","toolName":"jira_get_sprint"}

data: {"type":"text","content":"# Sprint 123 Report\n\n"}

data: {"type":"text","content":"## Overview\nThis sprint..."}

data: [DONE]
```

#### List Available Tools

```bash
curl http://localhost:3002/api/agent/tools
```

### Option 2: Programmatic Usage

```typescript
import { AIAgent } from '@/agent/ai-agent';

// Initialize agent
const agent = new AIAgent(
  process.env.ANTHROPIC_API_KEY!,
  toolRegistry,
  context
);

// Simple query
const response = await agent.query(
  'What are the top 3 issues with the highest priority in sprint 123?'
);
console.log(response.answer);
console.log('Tools used:', response.toolsUsed);

// Multi-turn conversation
let history = [];

const turn1 = await agent.query('List all sprints', history);
history = turn1.conversationHistory;

const turn2 = await agent.query('Show issues for the first sprint', history);
history = turn2.conversationHistory;

const turn3 = await agent.query('Which issues are blocked?', history);
```

### Option 3: Streaming

```typescript
for await (const chunk of agent.queryStream('Analyze sprint velocity trends')) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.content);
  } else if (chunk.type === 'tool_use') {
    console.log(`\n[Using: ${chunk.toolName}]`);
  }
}
```

## Example Queries

### Sprint Management
```
"What are the current active sprints?"
"Show me the completion rate for sprint 123"
"List all blocked issues in the current sprint"
"Generate a sprint report for SCRUM-45"
```

### GitHub Integration
```
"Find all commits from last week that reference Jira issues"
"Show me pull requests merged in sprint 123"
"Which commits don't have Jira references?"
```

### Analytics
```
"What's the velocity trend over the last 5 sprints?"
"Compare sprint 123 and sprint 124 completion rates"
"Show me the most active contributors this sprint"
```

### Complex Queries
```
"Analyze sprint 123: completion rate, blockers, and velocity. Then compare it to sprint 122 and suggest improvements."

"Find all high-priority bugs in active sprints, check if they have GitHub PRs, and generate a summary report."

"Show me the correlation between story points and actual time taken over the last 3 sprints."
```

## How It Works

1. **User sends query** → Natural language question
2. **Agent analyzes** → Claude decides which tools to use
3. **Tools execute** → Agent calls MCP tools (Jira, GitHub, etc.)
4. **Results processed** → Agent synthesizes information
5. **Answer returned** → Natural language response

The agent can:
- Call multiple tools in sequence
- Use results from one tool to inform the next
- Retry failed operations
- Handle errors gracefully
- Maintain conversation context

## Configuration

### Models

Available Claude models:
- `claude-3-5-sonnet-20241022` (Default - Best balance)
- `claude-3-opus-20240229` (Most capable, slower)
- `claude-3-haiku-20240307` (Fastest, less capable)

### Temperature

- `0.0` - Deterministic, focused responses
- `0.7` - Balanced (default)
- `1.0` - Creative, varied responses

### Max Iterations

Controls how many tool-use loops the agent can perform:
- Default: `10`
- Increase for complex multi-step queries
- Decrease to save API costs

## API Reference

### POST `/api/agent/chat`

Send a message to the agent.

**Request:**
```json
{
  "message": "string (required)",
  "conversationHistory": "array (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "answer": "string",
    "toolsUsed": ["string"],
    "iterations": number,
    "conversationHistory": [...]
  }
}
```

### POST `/api/agent/chat/stream`

Stream responses via Server-Sent Events.

**Request:** Same as `/chat`

**Response:** SSE stream with chunks:
```json
{"type": "text", "content": "..."}
{"type": "tool_use", "content": "...", "toolName": "..."}
{"type": "tool_result", "content": "...", "toolName": "..."}
{"type": "done", "content": ""}
```

### GET `/api/agent/tools`

List all available MCP tools.

**Response:**
```json
{
  "success": true,
  "data": {
    "tools": [{
      "name": "string",
      "description": "string",
      "parameters": {...}
    }],
    "count": number
  }
}
```

### GET `/api/agent/config`

Get current agent configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "model": "string",
    "maxTokens": number,
    "temperature": number,
    "maxIterations": number,
    "available": boolean
  }
}
```

## Integration Examples

### React Frontend

```tsx
import { useState } from 'react';

function AgentChat() {
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    setLoading(true);
    const response = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversationHistory: history })
    });
    
    const data = await response.json();
    setHistory(data.data.conversationHistory);
    setLoading(false);
  };

  return (
    <div>
      <input value={message} onChange={e => setMessage(e.target.value)} />
      <button onClick={sendMessage} disabled={loading}>Send</button>
      {/* Render conversation history */}
    </div>
  );
}
```

### CLI Tool

```typescript
// src/cli/agent-chat.ts
import readline from 'readline';
import { AIAgent } from '@/agent/ai-agent';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let history = [];

rl.on('line', async (input) => {
  const response = await agent.query(input, history);
  console.log('\nAgent:', response.answer);
  console.log('Tools:', response.toolsUsed.join(', '));
  history = response.conversationHistory;
  rl.prompt();
});

rl.setPrompt('You: ');
rl.prompt();
```

## Cost Estimation

Claude API pricing (as of 2024):

| Model | Input | Output |
|-------|-------|--------|
| Sonnet 3.5 | $3/M tokens | $15/M tokens |
| Opus 3 | $15/M tokens | $75/M tokens |
| Haiku 3 | $0.25/M tokens | $1.25/M tokens |

Typical query costs:
- Simple query (1 tool): ~$0.01-0.02
- Complex query (5+ tools): ~$0.05-0.10
- Full sprint report: ~$0.10-0.25

## Troubleshooting

### Agent not responding

Check:
1. `ANTHROPIC_API_KEY` is set correctly
2. API key has sufficient credits
3. Network connectivity to Anthropic API

### Tools failing

Check:
1. MCP server is initialized
2. Jira/GitHub credentials are valid
3. Tool inputs match schema requirements

### High costs

Solutions:
1. Use Claude Haiku for simple queries
2. Reduce `maxIterations`
3. Lower `maxTokens`
4. Cache conversation history client-side

## Testing

Run example queries:

```bash
tsx src/agent/example-usage.ts
```

## Next Steps

1. ✅ Add to your web server
2. ✅ Build a chat UI
3. ✅ Set up conversation persistence
4. ✅ Add user authentication
5. ✅ Monitor usage and costs
6. ✅ Fine-tune agent prompts

## Resources

- [Anthropic API Docs](https://docs.anthropic.com/)
- [Claude Tool Use Guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [MCP Protocol](https://modelcontextprotocol.io/)
