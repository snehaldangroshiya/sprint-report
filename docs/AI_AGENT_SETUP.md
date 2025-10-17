# AI Agent Setup Guide

Complete guide to setting up and using the AI Agent with your MCP server.

## Quick Start (5 minutes)

### 1. Get Your API Key

1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to "API Keys"
4. Create a new key
5. Copy the key (starts with `sk-ant-api03-...`)

### 2. Configure Environment

Add to your `.env` file:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Optional (defaults shown)
AGENT_MODEL=claude-3-5-sonnet-20241022
AGENT_MAX_TOKENS=4096
AGENT_TEMPERATURE=0.7
AGENT_MAX_ITERATIONS=10
```

### 3. Try the CLI

```bash
npm run agent
```

You'll see:
```
🤖 AI Agent CLI

Initializing MCP server...
✅ Agent ready!

Type your question or command:
  - "exit" or "quit" to exit
  - "clear" to clear conversation history
  - "tools" to list available tools
  - "history" to show conversation

You: _
```

### 4. Ask Questions

```
You: What are the active sprints in project SCRUM?

Agent: I found 3 active sprints in project SCRUM:

1. **Sprint 45: Development Phase**
   - 20 issues total
   - 13 completed (65%)
   - 7 in progress

2. **Sprint 46: Testing Phase**
   - 15 issues total
   - 6 completed (40%)
   - 9 in progress

3. **Sprint 47: Planning Phase**
   - 8 issues total
   - 1 completed (13%)
   - 7 in progress

[Tools: jira_get_sprints, jira_get_sprint_issues | Iterations: 2 | Time: 3.2s]
```

## Integration Options

### Option A: Add to Web Server (Recommended)

1. **Update your web server** (`src/web-server.ts`):

```typescript
import { createAgentRouter } from '@/agent/agent-api';

// After MCP server initialization
const context = mcpServer.getContext();
const toolRegistry = mcpServer.getToolRegistry();

// Add agent routes
const agentRouter = createAgentRouter(toolRegistry, context);
app.use('/api/agent', agentRouter);

console.log('✅ AI Agent API available at /api/agent');
```

2. **Restart your server**:

```bash
npm run dev:web
```

3. **Test the API**:

```bash
# Simple query
curl -X POST http://localhost:3002/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What are the active sprints?"}'

# List tools
curl http://localhost:3002/api/agent/tools

# Check config
curl http://localhost:3002/api/agent/config
```

### Option B: Standalone Service

Create a dedicated agent server (`src/agent-server.ts`):

```typescript
import express from 'express';
import { createAgentRouter } from '@/agent/agent-api';
import { EnhancedMCPServer } from '@/server/enhanced-mcp-server';

const app = express();
app.use(express.json());

async function start() {
  // Initialize MCP server
  const mcpServer = new EnhancedMCPServer();
  await mcpServer.initialize();
  
  const context = (mcpServer as any).context;
  const toolRegistry = (mcpServer as any).toolRegistry;
  
  // Add agent routes
  const agentRouter = createAgentRouter(toolRegistry, context);
  app.use('/api/agent', agentRouter);
  
  const PORT = process.env.AGENT_PORT || 3003;
  app.listen(PORT, () => {
    console.log(`🤖 Agent server running on http://localhost:${PORT}`);
  });
}

start();
```

### Option C: Programmatic Usage

Use directly in your code:

```typescript
import { AIAgent } from '@/agent/ai-agent';

// Initialize
const agent = new AIAgent(
  process.env.ANTHROPIC_API_KEY!,
  toolRegistry,
  context
);

// Query
const response = await agent.query('Analyze sprint 123');
console.log(response.answer);

// Stream
for await (const chunk of agent.queryStream('Generate report')) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.content);
  }
}
```

## Building a Chat UI

### React Component

```tsx
// components/AgentChat.tsx
import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
}

export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          conversationHistory
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.data.answer,
          toolsUsed: data.data.toolsUsed
        }]);
        setConversationHistory(data.data.conversationHistory);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error processing your request.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-content">{msg.content}</div>
            {msg.toolsUsed && msg.toolsUsed.length > 0 && (
              <div className="tools-used">
                🔧 Used: {msg.toolsUsed.join(', ')}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="message assistant loading">Thinking...</div>}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask me anything about your sprints..."
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
```

### Streaming UI

```tsx
export function AgentChatStreaming() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setStreaming(true);

    // Add empty assistant message
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/agent/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'text') {
                // Append text to last message
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1].content += parsed.content;
                  return updated;
                });
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      setStreaming(false);
      setInput('');
    }
  };

  return <div>{/* Same UI as before */}</div>;
}
```

## Example Queries

### Sprint Management
```
"What are the current active sprints?"
"Show me sprint 123 details"
"List blocked issues in sprint 123"
"What's the completion rate for the current sprint?"
"Generate a sprint report for SCRUM-45"
```

### Analytics
```
"What's the velocity trend over the last 5 sprints?"
"Compare sprint 123 and 124"
"Show me the most active contributors this month"
"Which team member has the most completed stories?"
```

### GitHub Integration
```
"Find commits from last week with Jira references"
"Show PRs merged in sprint 123"
"Which commits don't have Jira issue references?"
"List all PRs by john.doe@example.com"
```

### Complex Queries
```
"Analyze sprint 123: show completion rate, list blockers, and compare with sprint 122. Then suggest improvements for the next sprint."

"Find all high-priority bugs in active sprints, check if they have GitHub PRs, and generate a summary report in markdown format."

"Calculate the average time from commit to PR merge for the last 50 commits, and identify any bottlenecks."
```

## Advanced Configuration

### Custom System Prompts

Modify the agent behavior by adding system prompts:

```typescript
// In ai-agent.ts, add to message history:
const systemPrompt = {
  role: 'user',
  content: `You are a sprint management expert. When analyzing sprints:
  - Always check for blockers
  - Calculate velocity trends
  - Suggest actionable improvements
  - Format responses in markdown
  - Be concise but thorough`
};

history.unshift(systemPrompt);
```

### Rate Limiting

Add rate limiting to prevent abuse:

```typescript
import rateLimit from 'express-rate-limit';

const agentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  message: 'Too many requests, please try again later.'
});

app.use('/api/agent/chat', agentLimiter);
```

### Caching

Cache frequent queries:

```typescript
const cache = new Map<string, any>();

router.post('/chat', async (req, res) => {
  const { message } = req.body;
  const cacheKey = message.toLowerCase().trim();
  
  // Check cache (valid for 5 minutes)
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 300000) {
    return res.json(cached.response);
  }
  
  // Query agent...
  
  // Cache result
  cache.set(cacheKey, {
    response: data,
    timestamp: Date.now()
  });
});
```

### Authentication

Add authentication to protect the API:

```typescript
import jwt from 'jsonwebtoken';

const authenticateAgent = (req: Request, res: Response, next: Function) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

app.use('/api/agent', authenticateAgent, agentRouter);
```

## Monitoring

### Track Usage

```typescript
let stats = {
  totalQueries: 0,
  totalTokens: 0,
  totalCost: 0,
  toolUsage: {} as Record<string, number>
};

router.post('/chat', async (req, res) => {
  // ... process query ...
  
  stats.totalQueries++;
  stats.totalTokens += response.usage?.total_tokens || 0;
  stats.totalCost += estimateCost(response);
  
  response.toolsUsed.forEach(tool => {
    stats.toolUsage[tool] = (stats.toolUsage[tool] || 0) + 1;
  });
});

router.get('/stats', (req, res) => {
  res.json({ success: true, data: stats });
});
```

### Cost Estimation

```typescript
function estimateCost(response: any): number {
  const model = 'claude-3-5-sonnet-20241022';
  const rates = {
    'claude-3-5-sonnet-20241022': { input: 3, output: 15 }, // per million tokens
    'claude-3-opus-20240229': { input: 15, output: 75 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 }
  };
  
  const rate = rates[model];
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  
  return (
    (inputTokens / 1000000) * rate.input +
    (outputTokens / 1000000) * rate.output
  );
}
```

## Troubleshooting

### Error: API Key Not Found

```bash
export ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

Or add to `.env`:
```
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

### Error: Tool Execution Failed

Check:
1. MCP server is initialized
2. Jira/GitHub credentials are valid
3. Tool parameters match schema

### High Latency

Solutions:
1. Use streaming API
2. Switch to Claude Haiku for simple queries
3. Cache common queries
4. Reduce `maxTokens`

### High Costs

Solutions:
1. Use Claude Haiku instead of Sonnet
2. Reduce `maxIterations`
3. Lower `maxTokens`
4. Implement caching
5. Add rate limiting

## Next Steps

1. ✅ Set up API key
2. ✅ Test with CLI
3. ✅ Add to web server
4. ✅ Build chat UI
5. ✅ Add authentication
6. ✅ Monitor usage
7. ✅ Optimize costs

## Resources

- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Claude Tool Use Guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Agent README](./README.md)
