# StreamableHttp Transport Migration

## Overview
The MCP server has been upgraded from the deprecated SSE transport to the modern **StreamableHttp** transport.

## Changes

### Endpoint Changes
| Old (SSE) | New (StreamableHttp) |
|-----------|---------------------|
| `GET /sse` | `GET /mcp` |
| `POST /message` | `POST /mcp` |

### Connection URL
**Old:** `http://localhost:3001/sse`  
**New:** `http://localhost:3001/mcp`

### Features

#### Session Management
- Automatic UUID-based session IDs
- Session lifecycle callbacks (`onsessioninitialized`, `onsessionclosed`)
- Proper session validation

#### Transport Capabilities
- ✅ SSE streaming support (for long-running operations)
- ✅ Direct JSON responses (for simple request/response)
- ✅ Session resumability support
- ✅ DNS rebinding protection (configurable)
- ✅ Modern MCP protocol compliance

## Using with MCP Inspector

### Command Line
```bash
# Start the server
npm run dev:http

# In another terminal, start the inspector
npx @modelcontextprotocol/inspector
```

Then connect to: `http://localhost:3001/mcp`

### Configuration
The transport uses:
- **Session ID Generation**: Secure UUIDs via `crypto.randomUUID()`
- **Mode**: Stateful (maintains session state)
- **Response Type**: SSE streaming (default)

## Health Check
```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "mode": "http-streamable",
  "timestamp": "2025-10-11T10:00:38.476Z",
  "tools": 14
}
```

## Benefits

1. **No Deprecation Warnings** - Uses the recommended transport
2. **Better Session Management** - Automatic, secure session handling
3. **Unified Endpoint** - Single `/mcp` endpoint for all operations
4. **Future-Proof** - Aligned with MCP specification
5. **Resumability** - Can be extended with event store for reconnections

## Implementation Details

### Transport Initialization
```typescript
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  onsessioninitialized: async (sid: string) => {
    logger.info(`Session initialized: ${sid}`);
  },
  onsessionclosed: async (sid: string) => {
    logger.info(`Session closed: ${sid}`);
    activeSessions.delete(sid);
  },
});
```

### Request Handling
The transport automatically handles:
- GET requests for SSE streams
- POST requests for JSON-RPC messages  
- DELETE requests for session termination
- Session ID validation
- Protocol version negotiation

## Migration Notes

If you have existing clients connecting to the old `/sse` endpoint:
1. Update connection URL from `/sse` to `/mcp`
2. Remove any manual session management code
3. The server will handle session IDs automatically via headers

## References
- [MCP Streamable HTTP Specification](https://modelcontextprotocol.io/docs/specification/transports/streamable-http)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
