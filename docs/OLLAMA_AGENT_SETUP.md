# 🦙 Ollama AI Agent Setup Guide

## Overview

The Ollama AI Agent provides a **completely FREE and LOCAL** alternative to the Claude-based agent. It uses open-source LLMs running on your machine through [Ollama](https://ollama.ai/).

### 🎯 Why Use Ollama Agent?

| Feature | Claude Agent | Ollama Agent |
|---------|--------------|--------------|
| **Cost** | ~$0.01-0.05 per query | **100% FREE** |
| **Privacy** | Sends data to Anthropic | **All local, no data leaves your machine** |
| **Speed** | Fast (cloud API) | Depends on hardware (GPU recommended) |
| **Quality** | Excellent (GPT-4 class) | Good (varies by model) |
| **Availability** | Requires API key | **Works offline** |
| **Best For** | Production, complex queries | Development, privacy-sensitive data, cost savings |

---

## 📋 Prerequisites

- **Node.js** 18+ installed
- **8GB+ RAM** (16GB recommended for larger models)
- **GPU** (optional but highly recommended for faster inference)
- **Disk space**: 5-10GB per model

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Ollama

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from [ollama.ai/download](https://ollama.ai/download)

### Step 2: Start Ollama Service

```bash
ollama serve
```

This starts Ollama on `http://localhost:11434` (default).

### Step 3: Pull a Model

**Recommended starter model (balanced speed/quality):**
```bash
ollama pull llama3.1:8b
```

**Other popular options:**
```bash
# Faster but less capable
ollama pull llama3:8b
ollama pull phi3:mini

# Slower but more capable (requires 16GB+ RAM)
ollama pull llama3.1:70b
ollama pull mixtral:8x7b
```

### Step 4: Configure Environment

Create `.env` file or export:

```bash
# Optional: Change model (default: llama3.1:8b)
export OLLAMA_MODEL=llama3.1:8b

# Optional: Change host (default: http://localhost:11434)
export OLLAMA_HOST=http://localhost:11434

# Optional: Adjust temperature (default: 0.7)
export OLLAMA_TEMPERATURE=0.7

# Your existing MCP credentials
export JIRA_HOST=your-jira.atlassian.net
export JIRA_EMAIL=your-email@example.com
export JIRA_API_TOKEN=your-jira-token
export GITHUB_TOKEN=your-github-token
export GITHUB_OWNER=your-org
export GITHUB_REPO=your-repo
```

### Step 5: Run the Agent

**Interactive CLI:**
```bash
npm run agent:ollama
```

You should see:
```
🦙 Ollama AI Agent CLI (FREE Local LLM)

Initializing MCP server...
Checking Ollama availability...
✅ Ollama ready! Using model: llama3.1:8b
Available models: llama3.1:8b, llama3:8b

Type your question or command:
  - "exit" or "quit" to exit
  - "clear" to clear conversation history
  - "tools" to list available tools
  - "models" to list available models
  - "history" to show conversation

You:
```

---

## 🎨 Usage Examples

### Example 1: Query Jira Issues

```
You: List all high priority bugs in the current sprint

🦙 Thinking locally...

Agent: I found 3 high priority bugs in the current sprint:

1. BUG-123: Login fails on mobile browsers
   Status: In Progress
   Assignee: John Doe

2. BUG-124: Database connection timeout
   Status: To Do
   Assignee: Jane Smith

3. BUG-125: Payment processing errors
   Status: In Review
   Assignee: Bob Johnson

[Tools: jira_query | Iterations: 2 | Time: 3.2s | Cost: FREE!]
```

### Example 2: Cross-Service Query

```
You: Compare the number of GitHub PRs merged vs Jira stories completed this sprint

🦙 Thinking locally...

Agent: Here's the comparison for the current sprint:

GitHub PRs Merged: 15
- 8 feature PRs
- 5 bug fix PRs
- 2 documentation PRs

Jira Stories Completed: 12
- 7 features
- 4 bugs
- 1 technical debt

The team merged slightly more PRs (15) than completed Jira stories (12), which is normal as some PRs don't map to stories (docs, refactoring, etc.).

[Tools: github_list_pull_requests, jira_query | Iterations: 3 | Time: 5.1s | Cost: FREE!]
```

### Example 3: CLI Commands

```
You: tools

📦 Available Tools:

  • jira_query
    Search and retrieve Jira issues with flexible filtering
  • jira_get_issue
    Get detailed information about a specific Jira issue
  • jira_get_sprint
    Get detailed sprint information including start/end dates and goals
  • jira_list_sprints
    List sprints for a board with status filtering
  • jira_transition_issue
    Transition a Jira issue to a new status
  • github_list_pull_requests
    List and filter pull requests in a repository
  • github_get_pull_request
    Get detailed information about a specific pull request
  • github_search_code
    Search for code across the repository
  • github_get_commit
    Get detailed information about a specific commit
  • github_list_issues
    List and filter GitHub issues in a repository
  • generate_sprint_report
    Generate a comprehensive sprint report
  • generate_release_notes
    Generate release notes from Jira and GitHub data
  • calculate_velocity
    Calculate sprint velocity metrics
  • health_check
    Check the health status of all integrations
```

---

## 🔧 API Integration

### REST API Setup

The Ollama agent API runs alongside the Claude agent API on the same server.

**Start the HTTP server:**
```bash
npm run dev:http
```

### API Endpoints

#### 1. **POST /api/agent/ollama/chat** - Single Query

```bash
curl -X POST http://localhost:3001/api/agent/ollama/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "List all bugs in the current sprint",
    "conversationHistory": []
  }'
```

**Response:**
```json
{
  "answer": "I found 5 bugs in the current sprint...",
  "toolsUsed": ["jira_query"],
  "iterations": 2,
  "conversationHistory": [...]
}
```

#### 2. **POST /api/agent/ollama/chat/stream** - Streaming

```bash
curl -X POST http://localhost:3001/api/agent/ollama/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Generate a sprint report",
    "conversationHistory": []
  }'
```

Streams Server-Sent Events:
```
data: {"type":"token","content":"I"}
data: {"type":"token","content":" found"}
data: {"type":"token","content":" the"}
...
data: {"type":"done","toolsUsed":["generate_sprint_report"],"iterations":2}
```

#### 3. **GET /api/agent/ollama/status** - Check Availability

```bash
curl http://localhost:3001/api/agent/ollama/status
```

**Response (Success):**
```json
{
  "available": true,
  "modelPulled": true,
  "model": "llama3.1:8b",
  "host": "http://localhost:11434"
}
```

**Response (Ollama Not Running):**
```json
{
  "available": false,
  "modelPulled": false,
  "error": "Ollama is not running",
  "setup": [
    "1. Download from: https://ollama.ai/",
    "2. Install and run: ollama serve",
    "3. Pull a model: ollama pull llama3.1:8b"
  ]
}
```

#### 4. **GET /api/agent/ollama/models** - List Models

```bash
curl http://localhost:3001/api/agent/ollama/models
```

**Response:**
```json
{
  "models": ["llama3.1:8b", "llama3:8b", "phi3:mini"],
  "current": "llama3.1:8b"
}
```

#### 5. **GET /api/agent/ollama/tools** - List MCP Tools

```bash
curl http://localhost:3001/api/agent/ollama/tools
```

**Response:**
```json
{
  "tools": [
    {
      "name": "jira_query",
      "description": "Search and retrieve Jira issues with flexible filtering",
      "inputSchema": {...}
    },
    ...
  ]
}
```

#### 6. **GET /api/agent/ollama/config** - Get Configuration

```bash
curl http://localhost:3001/api/agent/ollama/config
```

**Response:**
```json
{
  "model": "llama3.1:8b",
  "host": "http://localhost:11434",
  "temperature": 0.7,
  "maxIterations": 5
}
```

---

## 🌐 React Integration

### Example Component

```tsx
import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function OllamaChatWidget() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'checking' | 'ready' | 'error'>('checking');

  // Check Ollama status on mount
  useEffect(() => {
    fetch('http://localhost:3001/api/agent/ollama/status')
      .then(res => res.json())
      .then(data => {
        if (data.available && data.modelPulled) {
          setStatus('ready');
        } else {
          setStatus('error');
          alert('Ollama is not ready. Please install and start Ollama.');
        }
      })
      .catch(() => setStatus('error'));
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('http://localhost:3001/api/agent/ollama/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: input,
          conversationHistory,
        }),
      });

      const data = await response.json();

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.answer },
      ]);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to get response from Ollama agent');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'checking') {
    return <div>Checking Ollama status...</div>;
  }

  if (status === 'error') {
    return (
      <div className="error">
        <h3>Ollama Not Available</h3>
        <p>Please install Ollama and pull a model:</p>
        <pre>ollama pull llama3.1:8b</pre>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <strong>{msg.role === 'user' ? 'You' : '🦙 Ollama'}:</strong>
            <p>{msg.content}</p>
          </div>
        ))}
        {loading && <div className="loading">🦙 Thinking locally...</div>}
      </div>

      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about your sprint..."
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading}>
          Send
        </button>
      </div>
    </div>
  );
}
```

### Streaming Example

```tsx
const sendStreamingMessage = async () => {
  const response = await fetch('http://localhost:3001/api/agent/ollama/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: input,
      conversationHistory: messages,
    }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let assistantMessage = '';

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));

        if (data.type === 'token') {
          assistantMessage += data.content;
          // Update UI with partial response
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              role: 'assistant',
              content: assistantMessage,
            };
            return newMessages;
          });
        } else if (data.type === 'done') {
          console.log('Tools used:', data.toolsUsed);
        }
      }
    }
  }
};
```

---

## 🔍 Troubleshooting

### Issue: "Ollama is not running"

**Solution:**
```bash
# Start Ollama service
ollama serve

# Check if it's running
curl http://localhost:11434
```

### Issue: "Model not found"

**Solution:**
```bash
# List installed models
ollama list

# Pull the model
ollama pull llama3.1:8b
```

### Issue: Slow responses

**Possible causes:**
1. **No GPU**: Install CUDA/ROCm for GPU acceleration
2. **Large model**: Try a smaller model like `phi3:mini`
3. **Low RAM**: Close other applications or use a smaller model

**Check GPU usage:**
```bash
# NVIDIA GPU
nvidia-smi

# AMD GPU
rocm-smi
```

### Issue: Out of memory

**Solutions:**
1. **Use smaller model:**
   ```bash
   export OLLAMA_MODEL=phi3:mini
   ```

2. **Reduce context window:**
   ```bash
   ollama run llama3.1:8b --ctx-size 2048
   ```

3. **Close other applications**

### Issue: Connection refused

**Check port:**
```bash
# Default port
lsof -i :11434

# Or try custom port
export OLLAMA_HOST=http://localhost:11435
ollama serve --port 11435
```

---

## 📊 Model Recommendations

| Model | Size | RAM Needed | Speed | Quality | Best For |
|-------|------|------------|-------|---------|----------|
| **phi3:mini** | 2GB | 4GB | ⚡⚡⚡ | ⭐⭐ | Quick queries, low-end hardware |
| **llama3:8b** | 4.7GB | 8GB | ⚡⚡ | ⭐⭐⭐ | Balanced performance |
| **llama3.1:8b** | 4.7GB | 8GB | ⚡⚡ | ⭐⭐⭐⭐ | **Recommended for most users** |
| **mistral:7b** | 4.1GB | 8GB | ⚡⚡ | ⭐⭐⭐ | Good for code |
| **llama3.1:70b** | 40GB | 64GB | ⚡ | ⭐⭐⭐⭐⭐ | Best quality (high-end hardware) |
| **mixtral:8x7b** | 26GB | 32GB | ⚡ | ⭐⭐⭐⭐ | Excellent reasoning |

### How to Switch Models

```bash
# Pull a new model
ollama pull mistral:7b

# Set as default
export OLLAMA_MODEL=mistral:7b

# Or in .env file
echo "OLLAMA_MODEL=mistral:7b" >> .env

# Restart the agent
npm run agent:ollama
```

---

## 🚀 Performance Tips

### 1. Use GPU Acceleration

**NVIDIA GPUs:**
```bash
# Install CUDA toolkit
# Ollama will automatically detect and use GPU
ollama serve
```

**AMD GPUs:**
```bash
# Install ROCm
# Ollama will automatically detect and use GPU
ollama serve
```

### 2. Optimize Model Loading

```bash
# Keep model in memory
ollama run llama3.1:8b --keep-alive 30m
```

### 3. Batch Queries

Instead of:
```javascript
await agent.query("Question 1");
await agent.query("Question 2");
```

Use conversation history:
```javascript
const response1 = await agent.query("Question 1", []);
const response2 = await agent.query("Question 2", response1.conversationHistory);
```

### 4. Adjust Temperature

```bash
# More focused (deterministic)
export OLLAMA_TEMPERATURE=0.3

# More creative
export OLLAMA_TEMPERATURE=0.9

# Default (balanced)
export OLLAMA_TEMPERATURE=0.7
```

---

## 🔒 Privacy & Security

### Advantages

- ✅ **All data stays on your machine** - no external API calls
- ✅ **No data logging** - conversations not stored by third parties
- ✅ **Works offline** - no internet required (after model download)
- ✅ **GDPR compliant** - no personal data leaves your infrastructure

### Best Practices

1. **Secure your machine**: Standard OS-level security applies
2. **Network isolation**: Can run completely air-gapped
3. **Audit logs**: Add custom logging if needed for compliance
4. **Access control**: Use standard authentication for the API

---

## 🆚 Claude vs Ollama Comparison

### When to Use Claude Agent

- ✅ Production deployments
- ✅ Complex reasoning tasks
- ✅ When quality is more important than cost
- ✅ Low-latency requirements (with good internet)
- ✅ No local hardware constraints

### When to Use Ollama Agent

- ✅ Development and testing
- ✅ Privacy-sensitive data
- ✅ Cost savings (high volume queries)
- ✅ Offline environments
- ✅ You have good local hardware (GPU)
- ✅ Learning and experimentation

### Use Both!

You can run both agents side-by-side:
```bash
# Terminal 1: Ollama for development
npm run agent:ollama

# Terminal 2: Claude for production queries
npm run agent
```

---

## 📚 Next Steps

1. **Try the CLI**: `npm run agent:ollama`
2. **Read the API docs**: See API Integration section above
3. **Experiment with models**: Try different models for your use case
4. **Integrate into your app**: Use the REST API or build custom integrations
5. **Compare with Claude**: Test both agents to find the best fit

---

## 🤝 Support

- **Ollama Issues**: [github.com/ollama/ollama/issues](https://github.com/ollama/ollama/issues)
- **Model List**: [ollama.ai/library](https://ollama.ai/library)
- **Discord**: [discord.gg/ollama](https://discord.gg/ollama)

---

**Happy querying! 🦙✨**
