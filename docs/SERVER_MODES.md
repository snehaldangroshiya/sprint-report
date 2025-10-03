# NextReleaseMCP - Server Modes

The NextReleaseMCP server supports three different modes of operation:

## 1. MCP Server (stdio) - Default Mode

**Purpose**: Standard Model Context Protocol server using stdio transport

**Use Case**: Integration with MCP clients (Claude Desktop, etc.)

**Start Command**:
```bash
npm run dev        # Development
npm run start      # Production
```

**Connection**: stdio transport (stdin/stdout)

**Features**:
- Full MCP protocol support
- Tool-based interaction
- Stream-based communication
- Optimized for AI assistant integration

---

## 2. Web API Server (HTTP REST)

**Purpose**: RESTful API server for web applications

**Use Case**: React/Vue/Angular web frontends, mobile apps, third-party integrations

**Start Command**:
```bash
npm run dev:web    # Development (port 3000)
npm run start:web  # Production (port 3000)
```

**Connection**: HTTP REST API at `http://localhost:3000`

**Key Endpoints**:
- `GET /api/health` - Health check
- `GET /api/sprints?board_id=6306&state=active` - Get sprints
- `GET /api/sprints/:id/issues` - Get sprint issues
- `POST /api/reports/sprint` - Generate report

**Features**:
- REST API with JSON responses
- CORS enabled for web apps
- Rate limiting and caching
- Comprehensive error handling
- Swagger-style documentation

**Web App**: `http://localhost:3002` (served by Vite)

---

## 3. MCP Server (HTTP/SSE) - **NEW**

**Purpose**: MCP protocol over HTTP with Server-Sent Events transport

**Use Case**: HTTP-based MCP clients, web-based AI assistants, remote MCP access

**Start Command**:
```bash
npm run dev:http    # Development (port 3001)
npm run start:http  # Production (port 3001)
```

**Connection**: HTTP/SSE at `http://localhost:3001`

**Key Endpoints**:
- `GET /health` - Health check
- `GET /sse` - MCP SSE endpoint (main connection)
- `POST /message` - MCP message handler

**Features**:
- Full MCP protocol support via HTTP
- Server-Sent Events for real-time updates
- Same tool set as stdio mode
- CORS enabled for web access
- No long-polling required

**Connection Example**:
```javascript
// Connect to MCP over HTTP
const eventSource = new EventSource('http://localhost:3001/sse');

eventSource.onmessage = (event) => {
  console.log('MCP Message:', event.data);
};

// Send tool call
fetch('http://localhost:3001/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'tools/call',
    params: {
      name: 'jira_get_sprints',
      arguments: { board_id: '6306', state: 'active' }
    }
  })
});
```

---

## Port Summary

| Mode | Port | Protocol | Purpose |
|------|------|----------|---------|
| MCP stdio | - | stdio | Claude Desktop, MCP clients |
| Web API | 3000 | HTTP REST | Web applications |
| Web App | 3002 | HTTP | React frontend |
| MCP HTTP | 3001 | HTTP/SSE | HTTP-based MCP clients |

---

## Comparison Matrix

| Feature | stdio Mode | Web API Mode | HTTP/SSE Mode |
|---------|-----------|--------------|---------------|
| **MCP Protocol** | ✅ Full | ❌ No | ✅ Full |
| **REST API** | ❌ No | ✅ Yes | ❌ No |
| **Web Browser Access** | ❌ No | ✅ Yes | ✅ Yes |
| **Real-time Updates** | ✅ Stream | ❌ Polling | ✅ SSE |
| **Tool Execution** | ✅ All 12 | ✅ All 12 | ✅ All 12 |
| **Authentication** | Local | Token-based | Token-based |
| **Remote Access** | ❌ No | ✅ Yes | ✅ Yes |
| **Best For** | AI Assistants | Web Apps | HTTP MCP Clients |

---

## When to Use Each Mode

### Use **stdio Mode** when:
- Integrating with Claude Desktop
- Running locally with MCP clients
- You need standard MCP protocol
- Maximum performance is required

### Use **Web API Mode** when:
- Building web/mobile applications
- Need REST API access
- Using React/Vue/Angular frontend
- Third-party integration required
- Want comprehensive API documentation

### Use **HTTP/SSE Mode** when:
- MCP client is web-based
- Need MCP protocol over HTTP
- Remote access to MCP server required
- Want real-time updates without WebSocket
- Building browser-based AI assistant

---

## Running Multiple Modes Simultaneously

You can run all three modes at the same time:

```bash
# Terminal 1: MCP stdio server
npm run dev

# Terminal 2: Web API server + Web app
npm run dev:web
cd web && npm run dev

# Terminal 3: MCP HTTP server
npm run dev:http
```

**Active Ports**:
- Port 3000: Web API (REST)
- Port 3001: MCP HTTP (SSE)
- Port 3002: Web App (React)

---

## Configuration

All modes share the same configuration (`.env`):

```bash
# Jira Configuration
JIRA_BASE_URL=https://jira.sage.com
JIRA_API_TOKEN=your_bearer_token
JIRA_EMAIL=your.email@company.com

# GitHub Configuration
GITHUB_TOKEN=ghp_your_token

# Optional: Port Customization
MCP_SERVER_PORT=3000      # Web API port
MCP_HTTP_PORT=3001        # MCP HTTP port
# Web app port configured in web/vite.config.ts
```

---

## Available Tools (All Modes)

All three modes provide access to the same 12 MCP tools:

**Jira Tools**:
1. `jira_get_sprints` - Get sprints for a board
2. `jira_get_sprint_issues` - Get issues in a sprint
3. `jira_get_issue_details` - Get detailed issue info
4. `jira_search_issues` - Search using JQL

**GitHub Tools**:
5. `github_get_commits` - Get repository commits
6. `github_get_pull_requests` - Get pull requests
7. `github_search_commits_by_message` - Search commits
8. `github_find_commits_with_jira_references` - Find Jira-linked commits

**Report Tools**:
9. `generate_sprint_report` - Generate comprehensive report
10. `get_sprint_metrics` - Calculate sprint statistics

**Utility Tools**:
11. `health_check` - Check service health
12. `cache_stats` - Get cache statistics

---

## Health Check Examples

### Web API Mode:
```bash
curl http://localhost:3000/api/health | jq '.'
```

### MCP HTTP Mode:
```bash
curl http://localhost:3001/health | jq '.'
```

**Expected Response**:
```json
{
  "status": "healthy",
  "mode": "http-sse",
  "timestamp": "2025-10-01T15:21:42.198Z",
  "tools": 12
}
```

---

**Last Updated**: October 1, 2025
**Version**: 2.0.0
**Status**: All Modes Operational ✅
