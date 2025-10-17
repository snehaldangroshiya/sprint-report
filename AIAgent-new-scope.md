---
description: New prompt created from chat session
mode: agent
tools: ['runCommands', 'runTasks', 'edit', 'runNotebooks', 'search', 'new', 'extensions', 'usages', 'vscodeAPI', 'problems', 'changes', 'testFailure', 'openSimpleBrowser', 'fetch', 'githubRepo', 'todos']
model: Claude Sonnet 4.5 (copilot)
---
<user>
what is the agentic functionlity which we have implemeted using `OllamaAgent` in this #codebase 
</user>
<assistant>
I'll analyze the agentic functionality implemented using `OllamaAgent` in this codebase. Let me look at more files to understand the full implementation: Now let me check what MCP tools are available: Based on my analysis of the codebase, here's a comprehensive overview of the **agentic functionality** implemented using `OllamaAgent`:

## 🦙 OllamaAgent - Agentic Functionality Overview

The `OllamaAgent` class implements a **FREE, local, privacy-first AI agent system** that provides natural language access to your sprint management tools. Here's what has been implemented:

---

### 🎯 **Core Agentic Capabilities**

#### **1. Natural Language Tool Orchestration**
The agent can:
- **Understand natural language queries** (e.g., "List all high priority bugs in the current sprint")
- **Automatically select and chain multiple MCP tools** to accomplish tasks
- **Iteratively call tools** based on previous results (up to 10 iterations by default)
- **Synthesize results** into human-readable answers

#### **2. 14 MCP Tools Available**
The agent has access to:

**Jira Tools (5):**
- `jira_get_sprints` - Get sprints for a board
- `jira_get_sprint_issues` - Get issues in a specific sprint
- `jira_get_sprint` - Get sprint details
- `jira_get_issue_details` - Get issue information
- `jira_search_issues` - Search using JQL queries

**GitHub Tools (5):**
- `github_get_commits` - Get repository commits
- `github_get_pull_requests` - Get PRs
- `github_search_commits_by_message` - Search commits
- `github_search_pull_requests_by_date` - Date-based PR search
- `github_find_commits_with_jira_references` - Link commits to Jira

**Reporting Tools (3):**
- `generate_sprint_report` - Generate sprint reports
- `generate_comprehensive_report` - Full sprint analysis
- `get_sprint_metrics` - Calculate sprint statistics

**Utility Tools (1):**
- `health_check` - Check service health

---

### 🔧 **Technical Implementation**

#### **Multi-Turn Conversation Loop**
```typescript
// The agent iteratively:
1. Receives user query
2. Generates response with Ollama LLM
3. Detects if tool call is needed (pattern matching: "TOOL_CALL: name")
4. Executes the tool via MCP server
5. Adds result to conversation history
6. Repeats until final answer (pattern: "FINAL_ANSWER: ...")
```

#### **Custom Prompt Engineering**
Since Ollama models don't have native tool calling, the agent uses:
- **Structured prompt format** with tool descriptions
- **Pattern-based tool extraction** (`TOOL_CALL:` and `PARAMETERS:`)
- **Conversation memory** maintaining context across turns
- **Graceful error handling** with recovery strategies

---

### 🌟 **Key Features**

#### **1. Conversation Memory**
- Maintains conversation history across multiple queries
- Understands context from previous interactions
- Supports follow-up questions

#### **2. Streaming Responses**
- Real-time output via Server-Sent Events (SSE)
- Shows tool usage as it happens
- Better user experience for long-running queries

#### **3. Multiple Interfaces**
- **REST API** (6 endpoints for web integration)
- **Interactive CLI** (terminal-based interface)
- **Programmatic usage** (TypeScript/JavaScript library)

#### **4. Intelligent Behavior**
- **Auto-retries** failed tool calls
- **Chain tools** (use result from one tool as input to another)
- **Adaptive responses** based on available data
- **Error explanations** in natural language

---

### 💡 **Example Agentic Workflow**

**User Query:** *"Show me all bugs in the current sprint and their reviewers from GitHub"*

**Agent's Execution:**
```
Iteration 1: Analyzes query → Needs Jira data
  └─ Calls: jira_search_issues(jql="type=Bug AND sprint in openSprints()")
  
Iteration 2: Gets 5 bugs → Needs GitHub data for each
  └─ Calls: github_get_pull_requests(state="all")
  
Iteration 3: Links bugs to PRs → Generates final answer
  └─ Returns: Formatted report with bugs, assignees, PR reviewers, status
```

---

### 🆚 **Why "Agentic"?**

This implementation is truly "agentic" because it:

1. **Reasons autonomously** - Decides which tools to use without explicit instructions
2. **Plans multi-step actions** - Breaks complex queries into tool chains
3. **Adapts to results** - Changes strategy based on tool outputs
4. **Maintains context** - Remembers conversation for follow-ups
5. **Recovers from failures** - Handles errors and retries intelligently
6. **Synthesizes information** - Combines data from multiple sources into coherent answers

---

### 🎯 **Unique Ollama Benefits**

- **100% FREE** - No API costs, unlimited queries
- **Full Privacy** - All processing stays local
- **Offline capable** - Works without internet (after setup)
- **No rate limits** - Query as much as needed
- **GDPR compliant** - No third-party data sharing

---

### 📊 **Use Cases Implemented**

1. **Sprint Analysis** - "Summarize sprint 123 performance"
2. **Bug Tracking** - "List all critical bugs assigned to John"
3. **PR Reviews** - "Which PRs are waiting for review?"
4. **Progress Monitoring** - "How many story points completed this week?"
5. **Cross-referencing** - "Show commits linked to bug PROJ-456"
6. **Report Generation** - "Generate a comprehensive sprint report for last sprint"

The `OllamaAgent` gives you a **ChatGPT-like interface to your Jira and GitHub data**, but running entirely on your local machine! 🚀
</assistant>