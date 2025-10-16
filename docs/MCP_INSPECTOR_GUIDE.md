# MCP Inspector Usage Guide

## Overview

The MCP Inspector is a powerful interactive debugging tool for Model Context Protocol (MCP) servers. It provides a web-based interface to:
- 🔍 Discover all available tools
- 🧪 Test tools with custom parameters
- 📊 View real-time responses
- 🐛 Debug protocol interactions
- 📝 Inspect request/response formats

## Quick Start

### Option 1: Using the Convenience Script

```bash
# From project root
./scripts/start-mcp-inspector.sh
```

### Option 2: Manual Launch

```bash
# Build the project first
npm run build

# Start MCP Inspector
npx @modelcontextprotocol/inspector node dist/server.js
```

The inspector will:
1. Start your MCP server in stdio mode
2. Open a web interface (usually at `http://localhost:5173`)
3. Show all available tools and resources

## Inspector Interface

### **Main Sections**

1. **Tools Tab** - Interactive tool testing
   - Lists all 14 MCP tools
   - Shows parameter schemas
   - Execute tools with custom inputs
   - View responses in real-time

2. **Resources Tab** - Available resources
   - View resource URIs
   - Inspect resource contents

3. **Prompts Tab** - Pre-configured prompts
   - Test prompt templates

4. **Logs Tab** - Server logs and debug info
   - View server-side logging
   - Debug protocol messages

## Testing Tools with Inspector

### **Example 1: Get Sprint Data**

1. Open Inspector web interface
2. Click on **Tools** tab
3. Find `get_sprint_data` tool
4. Fill in parameters:
   ```json
   {
     "sprint_id": "43577"
   }
   ```
5. Click **Execute**
6. View response with sprint details

### **Example 2: Generate Comprehensive Report**

1. Select `generate_comprehensive_report`
2. Fill in parameters:
   ```json
   {
     "sprint_id": "43577",
     "github_owner": "Sage",
     "github_repo": "sage-connect",
     "format": "json",
     "include_commits": true,
     "include_prs": true,
     "include_velocity": true,
     "include_burndown": true,
     "include_enhanced_github": true
   }
   ```
3. Execute and verify:
   - ✅ 86 pull requests fetched via GraphQL
   - ✅ 30 commits
   - ✅ Enhanced GitHub metrics
   - ✅ Velocity data
   - ✅ Burndown data

### **Example 3: Search GitHub PRs**

1. Select `get_pull_requests`
2. Fill in:
   ```json
   {
     "owner": "Sage",
     "repo": "sage-connect",
     "start_date": "2025-08-06",
     "end_date": "2025-08-20",
     "state": "all"
   }
   ```
3. Verify GraphQL API returns 86 PRs

## Advanced Usage

### **Testing with Environment Variables**

Inspector uses your `.env` file automatically:

```bash
# Ensure .env has valid credentials
JIRA_HOST=https://your-jira.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-jira-token
GITHUB_TOKEN=your-github-token
```

### **Debugging Protocol Messages**

Enable detailed logging:

```bash
# Set debug level before starting
export LOG_LEVEL=debug
./scripts/start-mcp-inspector.sh
```

View protocol messages in:
- **Logs Tab** in Inspector UI
- **Browser Console** (F12)
- **Terminal output** (stdio messages)

### **Testing Error Handling**

1. Try invalid parameters:
   ```json
   {
     "sprint_id": "invalid-id"
   }
   ```
2. Verify error response format
3. Check error messages are clear

### **Performance Testing**

1. Open **Network Tab** in browser DevTools
2. Execute a tool (e.g., comprehensive report)
3. Monitor:
   - Request/response time
   - Payload size
   - Cache behavior

## Common Use Cases

### **1. Verify GraphQL Integration**

```bash
# Start inspector
./scripts/start-mcp-inspector.sh

# Test get_pull_requests tool
# Verify logs show: "Using GitHub GraphQL v4 API for PR search"
# Confirm response has 86 PRs for sprint 43577
```

### **2. Test Cache Behavior**

```bash
# First request - should fetch from API
execute: generate_comprehensive_report

# Second request - should serve from cache
execute: generate_comprehensive_report (same params)

# Check logs for "served from cache" message
```

### **3. Validate New Tool**

When adding a new tool:
1. Start inspector
2. Verify tool appears in Tools list
3. Check parameter schema is correct
4. Test with valid/invalid inputs
5. Verify response format

### **4. Debug Production Issues**

```bash
# Reproduce issue with exact parameters from logs
{
  "sprint_id": "43577",
  "github_owner": "Sage",
  "github_repo": "sage-connect"
}

# Check Inspector logs for errors
# Verify API responses
# Test with different parameter combinations
```

## Tips & Tricks

### **Quick Iterations**

```bash
# Keep inspector running
# In another terminal, rebuild code:
npm run build

# Restart inspector (Ctrl+C, then re-run)
./scripts/start-mcp-inspector.sh
```

### **Save Test Cases**

Create JSON files for common tests:

```bash
# test-cases/comprehensive-report.json
{
  "sprint_id": "43577",
  "github_owner": "Sage",
  "github_repo": "sage-connect",
  "format": "json",
  "include_enhanced_github": true
}
```

Copy/paste into Inspector UI.

### **Compare API Versions**

Test GraphQL vs REST:

1. Execute with GraphQL enabled (current)
2. Note response time and data
3. Temporarily disable GraphQL client
4. Execute same request with REST API
5. Compare results

### **Inspect Cache Keys**

```bash
# While inspector is running, in another terminal:
redis-cli KEYS "comprehensive:*"

# See what's being cached
redis-cli GET "comprehensive:43577:Sage:sage-connect:..."
```

## Troubleshooting

### **Inspector Won't Start**

```bash
# Check if port 5173 is in use
lsof -i :5173

# Kill existing process
kill -9 <PID>

# Restart inspector
./scripts/start-mcp-inspector.sh
```

### **"Cannot find module" Error**

```bash
# Rebuild project
npm run build

# Verify dist/server.js exists
ls -la dist/server.js
```

### **Tools Not Showing**

```bash
# Check server starts correctly
node dist/server.js

# Should see MCP initialization messages
# Press Ctrl+C and restart inspector
```

### **Authentication Errors**

```bash
# Verify credentials in .env
cat .env | grep -E "JIRA|GITHUB"

# Test credentials manually
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user
```

### **Slow Responses**

```bash
# Check if cache is working
redis-cli PING

# Monitor Redis
redis-cli MONITOR

# Check server logs
tail -f /tmp/server.log
```

## Inspector Architecture

```
┌─────────────────────┐
│  Browser UI         │
│  (localhost:5173)   │
└──────────┬──────────┘
           │ HTTP
           ▼
┌─────────────────────┐
│  Inspector Server   │
│  (Vite Dev Server)  │
└──────────┬──────────┘
           │ stdio
           ▼
┌─────────────────────┐
│  Your MCP Server    │
│  (dist/server.js)   │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌────────┐  ┌──────────┐
│  Jira  │  │  GitHub  │
└────────┘  └──────────┘
```

## Next Steps

1. **Start Inspector**: `./scripts/start-mcp-inspector.sh`
2. **Test All 14 Tools**: Verify each tool works
3. **Check GraphQL**: Confirm "Using GitHub GraphQL v4 API" logs
4. **Verify 86 PRs**: Test sprint 43577 returns correct data
5. **Test Cache**: Execute same request twice, verify cache hit

## Related Documentation

- [MCP Specification](https://modelcontextprotocol.io/specification)
- [Server Modes Documentation](../docs/SERVER_MODES.md)
- [API Documentation](../docs/api-documentation.md)
- [VS Code MCP Setup](../docs/VSCODE_MCP_SETUP.md)

## Support

If you encounter issues:
1. Check logs in Inspector UI
2. Check terminal output
3. Review `/tmp/server.log`
4. Test tools via Web API: `http://localhost:3000/api/sprints/43577/comprehensive`
5. Check GitHub Issues for known problems
