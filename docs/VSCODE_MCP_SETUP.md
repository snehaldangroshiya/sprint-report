# VSCode MCP Server Configuration Guide

## Overview

This guide shows how to configure VSCode to connect to your NextReleaseMCP server using HTTP transport instead of stdio.

---

## Prerequisites

1. **MCP Server Running**: Ensure your HTTP MCP server is running
   ```bash
   npm run dev:http
   ```

2. **VSCode MCP Extension**: Install the MCP extension for VSCode (if available)
   - Search for "Model Context Protocol" or "MCP" in VSCode Extensions
   - Or use Claude Code if available

---

## Configuration Methods

### Method 1: Project-Level Configuration (Recommended)

**File**: `.vscode/mcp-settings.json`

```json
{
  "mcpServers": {
    "jira-github-sprint-reporter": {
      "type": "http",
      "url": "http://localhost:3001/sse",
      "name": "Jira-GitHub Sprint Reporter",
      "description": "MCP server for Jira and GitHub sprint reporting",
      "transport": {
        "type": "sse",
        "endpoint": "/sse",
        "messageEndpoint": "/message"
      }
    }
  }
}
```

**Status**: ✅ Already created in your project

---

### Method 2: VSCode User Settings

**Location**: `Settings (JSON)` → Search for "MCP" → Edit `settings.json`

**Add this configuration**:

```json
{
  "mcp.servers": {
    "jira-github-sprint-reporter": {
      "type": "http",
      "url": "http://localhost:3001/sse",
      "enabled": true,
      "autoStart": false
    }
  }
}
```

**Steps**:
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Preferences: Open Settings (JSON)"
3. Add the MCP configuration
4. Save the file
5. Reload VSCode

---

### Method 3: Workspace Settings

**File**: `.vscode/settings.json`

```json
{
  "mcp.servers": {
    "nextrelease": {
      "type": "http",
      "url": "http://localhost:3001/sse",
      "transport": "sse",
      "headers": {
        "Content-Type": "application/json"
      }
    }
  }
}
```

---

## Alternative Configuration Formats

### For Claude Code Extension

If you're using Claude Code, the configuration might be:

**File**: `~/.config/claude-code/mcp_config.json` or `.claude/mcp_config.json`

```json
{
  "mcpServers": {
    "nextrelease-mcp": {
      "command": null,
      "type": "http",
      "url": "http://localhost:3001",
      "endpoints": {
        "sse": "/sse",
        "message": "/message",
        "health": "/health"
      },
      "tools": [
        "jira_get_sprints",
        "jira_get_sprint_issues",
        "jira_get_issue_details",
        "jira_search_issues",
        "github_get_commits",
        "github_get_pull_requests",
        "github_search_commits_by_message",
        "github_find_commits_with_jira_references",
        "generate_sprint_report",
        "get_sprint_metrics",
        "health_check",
        "cache_stats"
      ]
    }
  }
}
```

---

## Standard MCP HTTP Configuration

**Minimal Configuration**:

```json
{
  "type": "http",
  "url": "http://localhost:3001/sse"
}
```

**Full Configuration**:

```json
{
  "type": "http",
  "url": "http://localhost:3001/sse",
  "name": "NextReleaseMCP",
  "description": "Jira and GitHub sprint reporting tools",
  "version": "2.0.0",
  "transport": {
    "type": "sse",
    "endpoint": "/sse",
    "messageEndpoint": "/message"
  },
  "headers": {
    "Content-Type": "application/json"
  },
  "timeout": 30000,
  "reconnect": true,
  "reconnectDelay": 5000,
  "healthCheck": {
    "enabled": true,
    "endpoint": "/health",
    "interval": 60000
  }
}
```

---

## Connection Details

### Server Information

| Property | Value |
|----------|-------|
| **Server Name** | Jira-GitHub Sprint Reporter |
| **Server Type** | HTTP/SSE |
| **Base URL** | http://localhost:3001 |
| **SSE Endpoint** | http://localhost:3001/sse |
| **Message Endpoint** | http://localhost:3001/message |
| **Health Check** | http://localhost:3001/health |
| **Transport** | Server-Sent Events (SSE) |
| **Tools Available** | 12 |

### Available Tools

```
Jira Tools:
  - jira_get_sprints
  - jira_get_sprint_issues
  - jira_get_issue_details
  - jira_search_issues

GitHub Tools:
  - github_get_commits
  - github_get_pull_requests
  - github_search_commits_by_message
  - github_find_commits_with_jira_references

Report Tools:
  - generate_sprint_report
  - get_sprint_metrics

Utility Tools:
  - health_check
  - cache_stats
```

---

## Verification Steps

### 1. Check Server is Running

```bash
curl http://localhost:3001/health
```

**Expected Output**:
```json
{
  "status": "healthy",
  "mode": "http-sse",
  "timestamp": "2025-10-01T15:21:42.198Z",
  "tools": 12
}
```

### 2. Test SSE Connection

```bash
# Test SSE endpoint
curl -N -H "Accept: text/event-stream" http://localhost:3001/sse
```

**Expected**: Connection should stay open and receive SSE messages

### 3. Verify Tools List

Using MCP client in VSCode, you should see:
- Server: "Jira-GitHub Sprint Reporter"
- Status: Connected (green indicator)
- Tools: 12 available

---

## Troubleshooting

### Issue: VSCode Can't Connect

**Solutions**:
1. **Verify Server is Running**:
   ```bash
   lsof -ti:3001
   # Should show a process ID
   ```

2. **Check Firewall**:
   ```bash
   # Allow port 3001
   sudo ufw allow 3001/tcp
   ```

3. **Check CORS Configuration**:
   - File: `src/http-server.ts:27`
   - Ensure `http://localhost` or your VSCode extension origin is allowed

4. **Restart VSCode**: Sometimes VSCode needs a restart to pick up new MCP servers

### Issue: Connection Timeout

**Solutions**:
1. Increase timeout in configuration:
   ```json
   {
     "timeout": 60000,
     "reconnect": true,
     "reconnectDelay": 5000
   }
   ```

2. Check server logs:
   ```bash
   # View HTTP server logs
   npm run dev:http
   ```

### Issue: Tools Not Showing

**Solutions**:
1. **Verify tools are registered**:
   ```bash
   curl http://localhost:3001/health | jq '.tools'
   # Should return: 12
   ```

2. **Check MCP protocol messages**:
   - Open VSCode Developer Tools: `Help > Toggle Developer Tools`
   - Check Console for MCP messages

3. **Reload VSCode Window**:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P`)
   - Type "Developer: Reload Window"

---

## Testing from VSCode

### Using MCP Tools

Once connected, you can use tools directly in VSCode:

**Example 1: Get Active Sprints**
```
Use tool: jira_get_sprints
Parameters:
  - board_id: "6306"
  - state: "active"
```

**Example 2: Generate Sprint Report**
```
Use tool: generate_sprint_report
Parameters:
  - sprint_id: "44298"
  - format: "markdown"
  - include_github: false
  - template_type: "executive"
```

**Example 3: Get Sprint Metrics**
```
Use tool: get_sprint_metrics
Parameters:
  - sprint_id: "44298"
  - include_velocity: true
  - include_burndown: true
```

---

## Switching Between stdio and HTTP

### Run Both Simultaneously

You can run both stdio and HTTP servers:

```bash
# Terminal 1: stdio mode (for Claude Desktop)
npm run dev

# Terminal 2: HTTP mode (for VSCode)
npm run dev:http
```

### Configuration Comparison

**stdio Mode**:
```json
{
  "type": "stdio",
  "command": "npm",
  "args": ["run", "dev"]
}
```

**HTTP Mode**:
```json
{
  "type": "http",
  "url": "http://localhost:3001/sse"
}
```

---

## Remote Access (Optional)

To access MCP server from another machine:

### 1. Update Server Configuration

**File**: `src/http-server.ts:21`

```typescript
const HOST = process.env.MCP_SERVER_HOST || '0.0.0.0'; // Listen on all interfaces
```

### 2. Update VSCode Configuration

```json
{
  "type": "http",
  "url": "http://your-server-ip:3001/sse"
}
```

### 3. Security Considerations

- Add authentication headers
- Use HTTPS in production
- Configure firewall rules
- Implement rate limiting

---

## Production Configuration

For production deployment:

**File**: `.vscode/mcp-settings.production.json`

```json
{
  "mcpServers": {
    "jira-github-sprint-reporter": {
      "type": "http",
      "url": "https://your-domain.com/mcp/sse",
      "transport": {
        "type": "sse",
        "endpoint": "/sse",
        "messageEndpoint": "/message"
      },
      "headers": {
        "Authorization": "Bearer ${MCP_API_TOKEN}",
        "Content-Type": "application/json"
      },
      "tls": {
        "rejectUnauthorized": true
      },
      "healthCheck": {
        "enabled": true,
        "endpoint": "/health",
        "interval": 60000
      }
    }
  }
}
```

---

## Additional Resources

### Documentation
- Main README: `README.md`
- Server Modes: `SERVER_MODES.md`
- Operations Guide: `.claude/CLAUDE_OPERATIONS.md`
- Troubleshooting: `.claude/CLAUDE_TROUBLESHOOTING.md`

### Quick Commands

```bash
# Start HTTP MCP server
npm run dev:http

# Check server health
curl http://localhost:3001/health

# View server logs
npm run dev:http 2>&1 | tee mcp-http.log

# Test SSE connection
curl -N http://localhost:3001/sse
```

### Support

If you encounter issues:
1. Check server is running: `lsof -ti:3001`
2. Check health endpoint: `curl http://localhost:3001/health`
3. Review server logs
4. Check `.claude/CLAUDE_TROUBLESHOOTING.md`

---

**Last Updated**: October 1, 2025
**Server Version**: 2.0.0
**Status**: HTTP MCP Server Operational ✅
