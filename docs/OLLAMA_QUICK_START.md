# 🦙 Ollama Agent - Quick Start (5 Minutes)

Get up and running with the **FREE local AI agent** in just 5 minutes!

---

## 🎯 What You'll Get

- ✅ **100% FREE** AI agent - no API costs
- ✅ **Full privacy** - all data stays on your machine
- ✅ **Offline capable** - works without internet
- ✅ Access to **14 MCP tools** (Jira + GitHub)
- ✅ **Streaming responses** - see answers in real-time
- ✅ **REST API** - integrate into any application

---

## ⚡ Quick Install

### Step 1: Install Ollama (2 minutes)

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

### Step 2: Start Ollama & Pull Model (2 minutes)

```bash
# Start the service
ollama serve

# In a new terminal, pull the recommended model
ollama pull llama3.1:8b
```

**Note:** First pull downloads ~4.7GB. Subsequent uses are instant.

### Step 3: Configure Environment (30 seconds)

```bash
# Add to your .env file (or export)
export OLLAMA_MODEL=llama3.1:8b

# Your existing MCP credentials
export JIRA_HOST=your-jira.atlassian.net
export JIRA_EMAIL=your-email@example.com
export JIRA_API_TOKEN=your-jira-token
export GITHUB_TOKEN=your-github-token
export GITHUB_OWNER=your-org
export GITHUB_REPO=your-repo
```

### Step 4: Run the Agent (30 seconds)

```bash
npm run agent:ollama
```

**Expected output:**
```
🦙 Ollama AI Agent CLI (FREE Local LLM)

Initializing MCP server...
Checking Ollama availability...
✅ Ollama ready! Using model: llama3.1:8b
Available models: llama3.1:8b

Type your question or command:
  - "exit" or "quit" to exit
  - "clear" to clear conversation history
  - "tools" to list available tools
  - "models" to list available models
  - "history" to show conversation

You: █
```

---

## 🎮 Try It Out!

### Example 1: List Jira Issues
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

### Example 2: GitHub Pull Requests
```
You: How many PRs were merged today?

🦙 Thinking locally...

Agent: 5 pull requests were merged today:

1. PR #234: Add user authentication
2. PR #235: Fix database migration
3. PR #236: Update documentation
4. PR #237: Refactor API handlers
5. PR #238: Add unit tests

[Tools: github_list_pull_requests | Iterations: 1 | Time: 2.8s | Cost: FREE!]
```

### Example 3: Cross-Service Query
```
You: Compare GitHub PRs merged vs Jira stories completed this sprint

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

The team merged slightly more PRs (15) than completed Jira stories (12),
which is normal as some PRs don't map to stories.

[Tools: github_list_pull_requests, jira_query | Iterations: 3 | Time: 5.1s | Cost: FREE!]
```

---

## 🌐 Use the API

### Start the HTTP Server
```bash
npm run dev:http
```

### Single Query
```bash
curl -X POST http://localhost:3001/api/agent/ollama/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "List all bugs in the current sprint",
    "conversationHistory": []
  }'
```

### Streaming Query
```bash
curl -X POST http://localhost:3001/api/agent/ollama/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Generate a sprint report",
    "conversationHistory": []
  }'
```

### Check Status
```bash
curl http://localhost:3001/api/agent/ollama/status
```

---

## 🎨 CLI Commands

| Command | Description |
|---------|-------------|
| `tools` | List all 14 available MCP tools |
| `models` | List installed Ollama models |
| `history` | Show conversation history |
| `clear` | Clear conversation history |
| `exit` or `quit` | Exit the CLI |

---

## 🔧 Configuration Options

### Environment Variables

```bash
# Model (default: llama3.1:8b)
export OLLAMA_MODEL=llama3.1:8b

# Host (default: http://localhost:11434)
export OLLAMA_HOST=http://localhost:11434

# Temperature (default: 0.7, range: 0.0-1.0)
# Lower = more focused, Higher = more creative
export OLLAMA_TEMPERATURE=0.7

# Max iterations (default: 5)
export OLLAMA_MAX_ITERATIONS=5
```

### Try Different Models

```bash
# Faster but less capable (good for quick queries)
ollama pull phi3:mini
export OLLAMA_MODEL=phi3:mini

# More capable (if you have 16GB+ RAM)
ollama pull llama3.1:70b
export OLLAMA_MODEL=llama3.1:70b

# Good for code (recommended by many)
ollama pull mistral:7b
export OLLAMA_MODEL=mistral:7b
```

---

## 🚨 Troubleshooting

### Issue: "Ollama is not running"

```bash
# Start Ollama in a separate terminal
ollama serve

# Or run in background (Linux/macOS)
ollama serve &
```

### Issue: "Model not found"

```bash
# Check installed models
ollama list

# Pull the model
ollama pull llama3.1:8b
```

### Issue: Slow responses

**Try a smaller/faster model:**
```bash
ollama pull phi3:mini
export OLLAMA_MODEL=phi3:mini
npm run agent:ollama
```

**Or get a GPU!** GPU acceleration makes it 5-10x faster.

### Issue: Out of memory

**Use smaller model:**
```bash
ollama pull phi3:mini  # Only 2GB
export OLLAMA_MODEL=phi3:mini
```

**Or close other apps** to free up RAM.

---

## 📊 Model Recommendations

### For Most Users (Balanced)
```bash
ollama pull llama3.1:8b
export OLLAMA_MODEL=llama3.1:8b
```
- Size: 4.7GB
- RAM: 8GB
- Speed: ⚡⚡ Medium
- Quality: ⭐⭐⭐⭐ Excellent

### For Speed (Quick queries)
```bash
ollama pull phi3:mini
export OLLAMA_MODEL=phi3:mini
```
- Size: 2GB
- RAM: 4GB
- Speed: ⚡⚡⚡ Fast
- Quality: ⭐⭐ Good enough

### For Best Quality (High-end hardware)
```bash
ollama pull llama3.1:70b
export OLLAMA_MODEL=llama3.1:70b
```
- Size: 40GB
- RAM: 64GB
- Speed: ⚡ Slow
- Quality: ⭐⭐⭐⭐⭐ Best

---

## 🎯 Next Steps

1. ✅ **Try the CLI** - Ask some questions!
2. ✅ **Test the API** - Integrate into your app
3. ✅ **Compare models** - Find the best fit for your hardware
4. ✅ **Read full docs** - See [OLLAMA_AGENT_SETUP.md](OLLAMA_AGENT_SETUP.md)
5. ✅ **Compare with Claude** - See [AGENT_COMPARISON.md](AGENT_COMPARISON.md)

---

## 💡 Pro Tips

### Keep Ollama Running in Background

**Linux/macOS:**
```bash
# Add to ~/.bashrc or ~/.zshrc
alias ollama-start='ollama serve > /dev/null 2>&1 &'

# Then just run:
ollama-start
```

**Or use systemd (Linux):**
```bash
sudo systemctl enable ollama
sudo systemctl start ollama
```

### Preload Model (Faster First Query)

```bash
# Keep model in memory for 30 minutes
ollama run llama3.1:8b --keep-alive 30m
```

### Switch Models on the Fly

```bash
# In the CLI, just change the env var and restart
export OLLAMA_MODEL=phi3:mini
npm run agent:ollama
```

---

## 🆚 Claude vs Ollama

| Feature | Claude | Ollama |
|---------|--------|--------|
| **Cost** | ~$0.01-0.05/query | **FREE** |
| **Privacy** | Data sent to Anthropic | **100% local** |
| **Speed** | Fast | Medium (hardware dependent) |
| **Quality** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Setup** | 1 min (API key) | 5 min (install + pull) |
| **Offline** | ❌ No | ✅ Yes |

**When to use Ollama:**
- ✅ Development and testing
- ✅ Privacy-sensitive data
- ✅ High volume queries (cost savings)
- ✅ Offline environments

**When to use Claude:**
- ✅ Production deployments
- ✅ Best quality needed
- ✅ No local hardware
- ✅ Want fastest setup

**Pro tip:** Use **both**! Ollama for dev, Claude for production.

---

## 📚 Resources

- **Full Setup Guide**: [OLLAMA_AGENT_SETUP.md](OLLAMA_AGENT_SETUP.md)
- **Comparison Guide**: [AGENT_COMPARISON.md](AGENT_COMPARISON.md)
- **Ollama Website**: [ollama.ai](https://ollama.ai/)
- **Model Library**: [ollama.ai/library](https://ollama.ai/library)
- **Discord**: [discord.gg/ollama](https://discord.gg/ollama)

---

**You're all set! Start querying with FREE local AI! 🦙✨**

```bash
npm run agent:ollama
```
