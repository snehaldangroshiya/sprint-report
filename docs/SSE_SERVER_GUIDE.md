# MCP SSE (Server-Sent Events) Server Guide

## Overview

The SSE server provides an MCP (Model Context Protocol) server implementation using **Server-Sent Events (SSE)** for real-time, unidirectional streaming from server to client, combined with HTTP POST for client-to-server communication.

## Architecture

### Transport Mechanism

- **Server → Client**: SSE (Server-Sent Events) for streaming responses
- **Client → Server**: HTTP POST for sending requests
- **Session Management**: Each connection gets a unique session ID

### How It Works

```
┌──────────┐                           ┌──────────┐
│  Client  │                           │  Server  │
└────┬─────┘                           └────┬─────┘
     │                                      │
     │  1. GET /sse                         │
     ├──────────────────────────────────────>
     │                                      │
     │  2. SSE Stream + Session ID          │
     <──────────────────────────────────────┤
     │      (Connection stays open)         │
     │                                      │
     │  3. POST /message?sessionId=xyz      │
     │     { "method": "tools/list" }       │
     ├──────────────────────────────────────>
     │                                      │
     │  4. Response via SSE stream          │
     <──────────────────────────────────────┤
     │                                      │
     │  5. More POST requests...            │
     │                                      │
```

## Getting Started

### Installation

The SSE server is included in the main package. No additional dependencies needed.

### Configuration

Environment variables (`.env`):

```bash
# SSE Server Configuration
MCP_SSE_PORT=3002
MCP_SSE_HOST=localhost

# Standard MCP configuration
JIRA_HOST=your-jira-instance.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-token
GITHUB_TOKEN=your-github-token
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
```

### Starting the Server

#### Development Mode (with hot reload)

```bash
npm run dev:sse
```

#### Production Mode

```bash
# Build first
npm run build

# Start server
npm run start:sse
```

### Server Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sse` | GET | Establish SSE connection and get session ID |
| `/message?sessionId=<id>` | POST | Send JSON-RPC messages to server |
| `/health` | GET | Health check and server status |
| `/sessions` | GET | List active sessions (debugging) |

## Client Implementation

### JavaScript/TypeScript Example

```typescript
class MCPSSEClient {
  private eventSource: EventSource | null = null;
  private sessionId: string | null = null;
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3002') {
    this.baseUrl = baseUrl;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(`${this.baseUrl}/sse`);

      this.eventSource.onopen = () => {
        console.log('SSE connection established');
      };

      this.eventSource.addEventListener('endpoint', (event) => {
        const data = JSON.parse(event.data);
        console.log('Endpoint info:', data);
      });

      this.eventSource.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        
        // Extract session ID from initialization message
        if (message.method === 'notifications/initialized') {
          this.sessionId = message.params?.sessionId;
          console.log('Session initialized:', this.sessionId);
          resolve();
        }
        
        // Handle other messages
        this.handleMessage(message);
      });

      this.eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        reject(error);
      };

      // Timeout if no session ID received
      setTimeout(() => {
        if (!this.sessionId) {
          reject(new Error('Session initialization timeout'));
        }
      }, 5000);
    });
  }

  async sendMessage(message: any): Promise<void> {
    if (!this.sessionId) {
      throw new Error('Not connected - no session ID');
    }

    const response = await fetch(
      `${this.baseUrl}/message?sessionId=${this.sessionId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }
  }

  async listTools(): Promise<any> {
    await this.sendMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });
  }

  async callTool(toolName: string, args: any): Promise<any> {
    await this.sendMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    });
  }

  private handleMessage(message: any): void {
    console.log('Received message:', message);
    // Handle responses based on message type
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.sessionId = null;
    }
  }
}

// Usage
const client = new MCPSSEClient('http://localhost:3002');

try {
  await client.connect();
  await client.listTools();
  
  // Call a tool
  await client.callTool('get_sprint_report', {
    boardId: 123,
    sprintId: 456,
  });
  
} catch (error) {
  console.error('Error:', error);
} finally {
  client.disconnect();
}
```

### Python Example

```python
import requests
import json
from sseclient import SSEClient  # pip install sseclient-py

class MCPSSEClient:
    def __init__(self, base_url='http://localhost:3002'):
        self.base_url = base_url
        self.session_id = None
        self.sse_client = None
    
    def connect(self):
        """Establish SSE connection"""
        messages = SSEClient(f'{self.base_url}/sse')
        
        for msg in messages:
            if msg.event == 'message':
                data = json.loads(msg.data)
                
                # Get session ID from initialization
                if data.get('method') == 'notifications/initialized':
                    self.session_id = data['params']['sessionId']
                    print(f'Connected with session: {self.session_id}')
                    break
    
    def send_message(self, message):
        """Send a message via POST"""
        if not self.session_id:
            raise Exception('Not connected')
        
        response = requests.post(
            f'{self.base_url}/message',
            params={'sessionId': self.session_id},
            json=message
        )
        response.raise_for_status()
    
    def list_tools(self):
        """List available tools"""
        self.send_message({
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'tools/list',
            'params': {}
        })
    
    def call_tool(self, tool_name, arguments):
        """Call a specific tool"""
        self.send_message({
            'jsonrpc': '2.0',
            'id': 2,
            'method': 'tools/call',
            'params': {
                'name': tool_name,
                'arguments': arguments
            }
        })

# Usage
client = MCPSSEClient('http://localhost:3002')
client.connect()
client.list_tools()
client.call_tool('get_sprint_report', {
    'boardId': 123,
    'sprintId': 456
})
```

## Testing the Server

### Health Check

```bash
curl http://localhost:3002/health
```

Response:
```json
{
  "status": "healthy",
  "mode": "sse",
  "timestamp": "2025-10-11T10:30:00.000Z",
  "tools": 15,
  "activeSessions": 2
}
```

### List Active Sessions

```bash
curl http://localhost:3002/sessions
```

Response:
```json
{
  "count": 2,
  "sessions": [
    "abc123-def456",
    "xyz789-uvw012"
  ]
}
```

### Manual SSE Connection

```bash
curl -N http://localhost:3002/sse
```

This will keep the connection open and stream events.

### Send a Message

```bash
# Replace <SESSION_ID> with actual session ID from SSE connection
curl -X POST "http://localhost:3002/message?sessionId=<SESSION_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

## Architecture Details

### Session Management

- Each SSE connection creates a unique session with a UUID
- Sessions are stored in memory with their server and transport instances
- Sessions are automatically cleaned up on connection close
- Session IDs must be included in POST requests

### Request Flow

1. **Client connects**: `GET /sse`
2. **Server responds**: 
   - Sets SSE headers
   - Creates session with unique ID
   - Sends endpoint information
   - Keeps connection open
3. **Client sends request**: `POST /message?sessionId=<id>`
4. **Server processes**: 
   - Validates session ID
   - Routes to correct session handler
   - Executes tool/request
5. **Server responds**: Sends response via SSE stream

### Error Handling

- **Missing session ID**: 400 Bad Request
- **Invalid session ID**: 404 Not Found
- **Server errors**: 500 Internal Server Error
- **Connection errors**: Logged and session cleaned up

## Comparison with Other Modes

| Feature | stdio | Web API | HTTP/StreamableHttp | **SSE** |
|---------|-------|---------|---------------------|---------|
| **Transport** | stdin/stdout | REST API | HTTP Streaming | SSE + POST |
| **Real-time** | ✅ Stream | ❌ Polling | ✅ Stream | ✅ SSE Stream |
| **Browser Support** | ❌ No | ✅ Yes | ⚠️ Limited | ✅ Yes |
| **Connection** | Persistent | Request/Response | Persistent | Persistent (SSE) |
| **Complexity** | Low | Medium | High | Medium |
| **Use Case** | CLI/Desktop | Web Apps | Advanced Streaming | Web Apps (Real-time) |

## Advantages of SSE Mode

1. **Native Browser Support**: EventSource API built into browsers
2. **Auto-Reconnection**: EventSource automatically reconnects on disconnect
3. **Simple Protocol**: Standard SSE format, easy to debug
4. **Unidirectional Streaming**: Perfect for server-push notifications
5. **Text-Based**: Easy to test with curl and debug tools
6. **Firewall Friendly**: Uses standard HTTP/HTTPS ports

## Limitations

1. **One-Way Streaming**: SSE only supports server → client streaming
2. **Text Only**: SSE only supports text data (JSON encoded)
3. **Browser Connections**: Limited to ~6 concurrent SSE connections per domain
4. **No Binary**: All data must be text/JSON encoded

## Troubleshooting

### Connection Fails

```bash
# Check server is running
curl http://localhost:3002/health

# Check logs
npm run dev:sse
```

### Session Not Found

- Ensure session ID from SSE connection is used in POST requests
- Check if connection was closed (session expires)
- Verify session exists: `curl http://localhost:3002/sessions`

### Messages Not Received

- Check SSE connection is still open
- Verify Content-Type headers
- Check browser console for errors
- Test with curl to isolate client issues

### Port Already in Use

```bash
# Change port in .env
MCP_SSE_PORT=3003

# Or kill existing process
lsof -ti:3002 | xargs kill -9
```

## Security Considerations

### Production Configuration

```bash
# Enable CORS restrictions
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Use HTTPS in production
# Set up reverse proxy (nginx/Apache) with SSL
```

### DNS Rebinding Protection

The SSE server supports DNS rebinding protection:

```typescript
const sessionTransport = new SSEServerTransport(endpoint, res, {
  enableDnsRebindingProtection: true,
  allowedHosts: ['localhost', 'yourdomain.com'],
  allowedOrigins: ['https://yourdomain.com'],
});
```

### Authentication

Consider adding authentication middleware:

```typescript
app.use('/sse', authenticateMiddleware);
app.use('/message', authenticateMiddleware);
```

## Best Practices

1. **Handle Reconnections**: Implement exponential backoff for reconnections
2. **Heartbeat**: Send periodic messages to keep connection alive
3. **Error Boundaries**: Wrap SSE handlers in try-catch
4. **Session Cleanup**: Monitor and clean up stale sessions
5. **Rate Limiting**: Implement rate limits on POST endpoint
6. **Logging**: Log all connections and errors for debugging

## Integration Examples

### React Hook

```typescript
import { useEffect, useState } from 'react';

export function useMCPSSE(baseUrl = 'http://localhost:3002') {
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${baseUrl}/sse`);
    
    es.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'notifications/initialized') {
        setSessionId(msg.params?.sessionId);
        setConnected(true);
      }
    });

    setEventSource(es);

    return () => {
      es.close();
    };
  }, [baseUrl]);

  const sendMessage = async (message: any) => {
    if (!sessionId) throw new Error('Not connected');
    
    await fetch(`${baseUrl}/message?sessionId=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  };

  return { connected, sessionId, sendMessage };
}
```

## Additional Resources

- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)

## Support

For issues or questions:
- Check the [main documentation](./README.md)
- Review [troubleshooting guide](./VSCODE_MCP_TROUBLESHOOTING.md)
- Open an issue on GitHub
