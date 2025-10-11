# NextReleaseMCP - Server Modes

The NextReleaseMCP server supports **four** different modes of operation:

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

## 3. MCP Server (HTTP/StreamableHttp)

**Purpose**: MCP protocol over HTTP with StreamableHttp transport

**Use Case**: HTTP-based MCP clients with bidirectional streaming

**Start Command**:
```bash
npm run dev:http    # Development (port 3001)
npm run start:http  # Production (port 3001)
```

**Connection**: HTTP/StreamableHttp at `http://localhost:3001`

**Key Endpoints**:
- `GET /health` - Health check
- `GET /mcp` - MCP StreamableHttp endpoint (establishes session)
- `POST /mcp` - MCP message handler (requires session ID header)

**Features**:
- Full MCP protocol support via HTTP
- Bidirectional streaming
- Session management
- Same tool set as stdio mode
- CORS enabled for web access

---

## 4. MCP Server (SSE) - **NEW**

**Purpose**: MCP protocol over HTTP with Server-Sent Events transport

**Use Case**: HTTP-based MCP clients, web-based AI assistants, real-time updates

**Start Command**:
```bash
npm run dev:sse     # Development (port 3002)
npm run start:sse   # Production (port 3002)
```

**Connection**: HTTP/SSE at `http://localhost:3002`

**Key Endpoints**:
- `GET /health` - Health check
- `GET /sse` - MCP SSE endpoint (establishes SSE stream)
- `POST /message?sessionId=<id>` - Send messages to server
- `GET /sessions` - List active sessions (debugging)

**Features**:
- Full MCP protocol support via HTTP
- Server-Sent Events for real-time server → client streaming
- HTTP POST for client → server communication
- Native browser EventSource support
- Auto-reconnection capabilities
- Same tool set as stdio mode
- CORS enabled for web access

**Connection Example**:
```javascript
// Connect to MCP over SSE
const eventSource = new EventSource('http://localhost:3002/sse');

let sessionId = null;

eventSource.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  
  // Get session ID from initialization
  if (msg.method === 'notifications/initialized') {
    sessionId = msg.params?.sessionId;
    console.log('Connected with session:', sessionId);
  }
  
  console.log('MCP Message:', msg);
});

// Send tool call
fetch(`http://localhost:3002/message?sessionId=${sessionId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
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
| MCP HTTP (StreamableHttp) | 3001 | HTTP Streaming | HTTP-based MCP clients |
| MCP SSE | 3002 | HTTP/SSE | Real-time MCP over SSE |
| Web App | 5173 | HTTP | React frontend (dev) |

---

## Comparison Matrix

| Feature | stdio Mode | Web API Mode | HTTP/StreamableHttp | SSE Mode |
|---------|-----------|--------------|---------------------|----------|
| **MCP Protocol** | ✅ Full | ❌ No | ✅ Full | ✅ Full |
| **REST API** | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **Web Browser Access** | ❌ No | ✅ Yes | ⚠️ Limited | ✅ Yes |
| **Real-time Updates** | ✅ Stream | ❌ Polling | ✅ Stream | ✅ SSE Stream |
| **Tool Execution** | ✅ All | ✅ All | ✅ All | ✅ All |
| **Authentication** | Local | Token-based | Session-based | Session-based |
| **Remote Access** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Bidirectional** | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ POST + SSE |
| **Browser Native** | ❌ No | ✅ Yes | ❌ No | ✅ EventSource |
| **Best For** | AI Assistants | Web Apps | Advanced Streaming | Real-time Web Apps |

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

### Use **HTTP/StreamableHttp Mode** when:
- MCP client requires bidirectional streaming
- Need advanced HTTP-based MCP features
- Building custom MCP clients
- Session management is required

### Use **SSE Mode** when:
- Need real-time server → client updates
- Using browser-based clients (EventSource)
- Want automatic reconnection
- Building web-based AI assistant
- Simple unidirectional streaming is sufficient
- Maximum browser compatibility needed

---

## Running Multiple Modes Simultaneously

You can run all four modes at the same time:

```bash
# Terminal 1: MCP stdio server
npm run dev

# Terminal 2: Web API server
npm run dev:web

# Terminal 3: MCP HTTP (StreamableHttp) server
npm run dev:http

# Terminal 4: MCP SSE server
npm run dev:sse

# Terminal 5: Web app (React frontend)
cd web && npm run dev
```

**Active Ports**:
- Port 3000: Web API (REST)
- Port 3001: MCP HTTP (StreamableHttp)
- Port 3002: MCP SSE
- Port 5173: Web App (React, dev mode)

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
MCP_HTTP_PORT=3001        # MCP HTTP (StreamableHttp) port
MCP_SSE_PORT=3002         # MCP SSE port
# Web app port configured in web/vite.config.ts
```

---

## Available Tools (All Modes)

All four modes provide access to the same MCP tools:

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

### MCP HTTP (StreamableHttp) Mode:
```bash
curl http://localhost:3001/health | jq '.'
```

### MCP SSE Mode:
```bash
curl http://localhost:3002/health | jq '.'
```

**Expected Response**:
```json
{
  "status": "healthy",
  "mode": "sse",
  "timestamp": "2025-10-11T15:21:42.198Z",
  "tools": 12,
  "activeSessions": 0
}
```

---

**Last Updated**: October 11, 2025
**Version**: 2.0.0
**Status**: All Four Modes Operational ✅

For detailed SSE server documentation, see [SSE_SERVER_GUIDE.md](./SSE_SERVER_GUIDE.md)
