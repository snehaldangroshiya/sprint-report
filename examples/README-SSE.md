# SSE MCP Server - Quick Start

## What is SSE?

**Server-Sent Events (SSE)** is a standard HTTP-based technology that enables servers to push real-time updates to clients over a single, long-lived HTTP connection. Unlike WebSockets, SSE is unidirectional (server → client) and uses standard HTTP, making it simpler and more firewall-friendly.

## Why SSE for MCP?

The SSE server provides an MCP implementation that's:
- ✅ **Browser-Native**: Uses the built-in `EventSource` API
- ✅ **Auto-Reconnecting**: Automatic reconnection on connection loss
- ✅ **Simple**: Standard HTTP + SSE, easy to debug
- ✅ **Real-time**: Server pushes updates instantly
- ✅ **Web-Friendly**: Works in all modern browsers

## Quick Start

### 1. Start the Server

```bash
# Development mode (with hot reload)
npm run dev:sse

# Production mode
npm run build
npm run start:sse
```

The server will start on port **3002** (or `MCP_SSE_PORT` from `.env`).

### 2. Test the Connection

```bash
# Health check
curl http://localhost:3002/health

# List active sessions
curl http://localhost:3002/sessions
```

### 3. Connect with a Client

#### Browser (JavaScript)

```javascript
const eventSource = new EventSource('http://localhost:3002/sse');
let sessionId = null;

eventSource.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  
  // Get session ID from initialization
  if (msg.result?.sessionId) {
    sessionId = msg.result.sessionId;
    console.log('Connected:', sessionId);
  }
});

// Send a request
async function listTools() {
  const response = await fetch(
    `http://localhost:3002/message?sessionId=${sessionId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })
    }
  );
}
```

#### Using the Example Client

```bash
# Install dependencies for Node.js client
npm install eventsource node-fetch

# Run the example client
node examples/sse-client.js
```

## Architecture

```
┌─────────────┐                    ┌─────────────┐
│   Browser   │                    │ SSE Server  │
│   Client    │                    │  (Port 3002)│
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ 1. GET /sse                      │
       ├─────────────────────────────────>│
       │                                  │
       │ 2. SSE Stream (session ID)       │
       │<─────────────────────────────────┤
       │    (connection stays open)       │
       │                                  │
       │ 3. POST /message?sessionId=xyz   │
       ├─────────────────────────────────>│
       │                                  │
       │ 4. Response via SSE              │
       │<─────────────────────────────────┤
       │                                  │
```

## Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health and status |
| `/sse` | GET | Establish SSE connection |
| `/message?sessionId=<id>` | POST | Send JSON-RPC messages |
| `/sessions` | GET | List active sessions (debug) |

## Configuration

Set these environment variables in `.env`:

```bash
# SSE Server Port
MCP_SSE_PORT=3002

# Server Host
MCP_SSE_HOST=localhost

# CORS Origins (production)
ALLOWED_ORIGINS=https://yourdomain.com

# Standard MCP configuration
JIRA_HOST=...
JIRA_API_TOKEN=...
GITHUB_TOKEN=...
```

## Testing Tools

### cURL

```bash
# Establish SSE connection (keep terminal open)
curl -N http://localhost:3002/sse

# In another terminal, send a message
# (replace SESSION_ID with the ID from SSE response)
curl -X POST "http://localhost:3002/message?sessionId=SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Browser Console

```javascript
// Open browser console and run:
const es = new EventSource('http://localhost:3002/sse');
es.onmessage = (e) => console.log(JSON.parse(e.data));
```

## Common Use Cases

### 1. Web-Based Dashboard
Real-time sprint reports streaming to web UI

### 2. Browser Extension
MCP client running in browser extension

### 3. Progressive Web App
Offline-capable app with real-time updates

### 4. Monitoring Dashboard
Live status updates for CI/CD pipelines

## Comparison with Other Modes

| Mode | Port | Best For |
|------|------|----------|
| **stdio** | - | Claude Desktop, local CLI |
| **Web API** | 3000 | REST API clients |
| **HTTP** | 3001 | Advanced streaming |
| **SSE** | 3002 | **Browser clients** |

## Troubleshooting

### Server Won't Start
```bash
# Check if port is in use
lsof -ti:3002 | xargs kill -9

# Check configuration
cat .env | grep MCP_SSE
```

### Connection Drops
- SSE auto-reconnects by default
- Check network/proxy settings
- Verify CORS configuration

### Session Not Found
- Ensure you're using the session ID from the SSE stream
- Check if connection is still active
- Session expires when SSE connection closes

## Documentation

- [Full SSE Server Guide](../docs/SSE_SERVER_GUIDE.md)
- [Server Modes Comparison](../docs/SERVER_MODES.md)
- [API Documentation](../docs/api-documentation.md)

## Examples

See the [examples/sse-client.js](./sse-client.js) for a complete working example.

## Production Deployment

```bash
# Build
npm run build

# Start with PM2
pm2 start dist/sse-server.js --name mcp-sse

# Monitor
pm2 logs mcp-sse
pm2 status

# Stop
pm2 stop mcp-sse
```

## Security

1. **Enable CORS restrictions** in production
2. **Use HTTPS** with reverse proxy (nginx/Apache)
3. **Implement authentication** on endpoints
4. **Rate limiting** on POST endpoint
5. **Session timeout** for inactive connections

## Next Steps

1. ✅ Server is running
2. 📖 Read the [Full Guide](../docs/SSE_SERVER_GUIDE.md)
3. 🧪 Try the example client
4. 🏗️ Build your own client
5. 🚀 Deploy to production

---

**Need Help?** See [TROUBLESHOOTING.md](../docs/VSCODE_MCP_TROUBLESHOOTING.md)
