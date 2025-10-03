# MCP Server Mode Recommendation

## Issue with HTTP/SSE Mode

The HTTP/SSE MCP server implementation has compatibility issues with the MCP SDK's `SSEServerTransport`. The SDK expects full control over the HTTP response, which conflicts with Express middleware.

**Error**: `Cannot write headers after they are sent to the client`

This is a known limitation with the current MCP SDK implementation.

---

## ✅ Recommended Approach: Use stdio Mode

For VSCode/Claude Code integration, **use the stdio mode** which is the standard and most reliable MCP transport:

### Configuration

**File**: `.vscode/mcp.json`

```json
{
  "servers": {
    "nextrelease-mcp": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "/home/sd/data/project-2025/NextReleaseMCP",
      "name": "NextRelease MCP Server",
      "description": "Jira and GitHub sprint reporting with 12 tools"
    }
  }
}
```

### Usage

1. **Start Server**: The MCP client (VSCode/Claude Code) will automatically start the server
2. **No Manual Start Needed**: Just reload VSCode
3. **Reliable**: stdio mode is the reference implementation

---

## Alternative: Use Web API for Custom Clients

If you're building a custom web-based client, use the **Web API Server** (not MCP protocol):

**URL**: `http://localhost:3000/api`

**Start**: `npm run dev:web`

### Available Endpoints

```bash
# Get sprints
GET /api/sprints?board_id=6306&state=active

# Get sprint issues
GET /api/sprints/:id/issues

# Generate report
POST /api/reports/sprint
{
  "sprint_id": "44298",
  "format": "markdown",
  "include_github": false,
  "template_type": "executive"
}

# Health check
GET /api/health
```

This REST API is production-ready and fully functional.

---

## Mode Comparison

| Feature | stdio Mode | Web API | HTTP/SSE Mode |
|---------|-----------|---------|---------------|
| **Stability** | ✅ Excellent | ✅ Excellent | ⚠️ SDK Issues |
| **VSCode Integration** | ✅ Native | ❌ No | ⚠️ Problematic |
| **Auto-start** | ✅ Yes | ❌ Manual | ❌ Manual |
| **MCP Protocol** | ✅ Full | ❌ No (REST) | ⚠️ Partial |
| **Web Access** | ❌ No | ✅ Yes | ✅ Yes (if working) |
| **Reliability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |

---

## Updated Configuration

### For VSCode/Claude Code: Use stdio

**File**: `.vscode/mcp.json`

```json
{
  "servers": {
    "nextrelease-mcp": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "/home/sd/data/project-2025/NextReleaseMCP"
    }
  }
}
```

### For Web Apps: Use REST API

**Start Server**:
```bash
npm run dev:web  # API on port 3000
cd web && npm run dev  # Web app on port 3002
```

**API Client**:
```typescript
const response = await fetch('http://localhost:3000/api/sprints?board_id=6306&state=active');
const sprints = await response.json();
```

---

## Why stdio is Better for MCP

1. **Standard Transport**: stdio is the reference MCP transport
2. **No Port Conflicts**: Uses stdin/stdout, no network ports needed
3. **Auto-managed**: Client handles server lifecycle
4. **Reliable**: No HTTP/SSE complexity
5. **Secure**: No network exposure

---

## Next Steps

1. **Remove HTTP/SSE Configuration**: Not needed for VSCode
2. **Update mcp.json**: Use stdio mode command
3. **Reload VSCode**: Server will auto-start
4. **Verify Connection**: Check MCP tools panel

---

**Recommendation**: Use **stdio mode for VSCode** and **Web API for web applications**. Skip HTTP/SSE mode until MCP SDK improves.

**Last Updated**: October 1, 2025
