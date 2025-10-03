# VSCode MCP Server Troubleshooting Guide

## Error: "MCP server nextrelease-mcp was unable to start successfully"

### Root Cause
The MCP server uses **stdio transport**, which means:
- **stdout** is reserved EXCLUSIVELY for JSON-RPC protocol messages
- **stderr** is for all logging output
- ANY non-JSON output on stdout breaks the MCP protocol

### Solution Applied

Updated `.vscode/mcp.json` to use the production build with clean output:

```json
{
  "servers": {
    "nextrelease-mcp": {
      "command": "node",
      "args": ["dist/server.js"],
      "cwd": "/home/sd/data/project-2025/NextReleaseMCP",
      "env": {
        "LOG_LEVEL": "error",
        "ENABLE_API_LOGGING": "false"
      },
      "name": "NextRelease MCP Server",
      "description": "Jira and GitHub sprint reporting with 12 tools"
    }
  }
}
```

### Key Changes

1. **Use Production Build**: `node dist/server.js` instead of `tsx watch src/server.ts`
   - **Why**: `tsx watch` outputs status messages like "[tsx] rerunning" to stdout
   - **Result**: Clean stdout with no build tool noise

2. **Set LOG_LEVEL=error**: Only critical errors are logged
   - **Why**: INFO and DEBUG logs were being written during startup
   - **Result**: Minimal logging during server initialization

3. **Disable API Logging**: Set `ENABLE_API_LOGGING=false`
   - **Why**: API request/response logs were using `console.log` (stdout)
   - **Result**: No HTTP request logs interfering with MCP protocol

### Verification Steps

1. **Rebuild the project**:
   ```bash
   npm run build
   ```

2. **Reload VSCode**:
   - Press `Ctrl+Shift+P` (Linux/Windows) or `Cmd+Shift+P` (Mac)
   - Type "Developer: Reload Window"
   - Press Enter

3. **Check MCP Connection**:
   - Open the MCP tools panel in VSCode
   - You should see "NextRelease MCP Server" connected
   - Verify 12 tools are available

### Testing the Server Manually

To test if the server produces clean output:

```bash
# Test with production build
LOG_LEVEL=error ENABLE_API_LOGGING=false node dist/server.js

# You should see NO output on stdout
# The server is running and waiting for JSON-RPC messages on stdin
```

### Common Issues

#### Issue: "Cannot find module" error
**Solution**: Run `npm run build` to compile TypeScript to JavaScript

#### Issue: Server starts but no tools visible
**Solution**: Check environment variables (JIRA_BASE_URL, JIRA_API_TOKEN, GITHUB_TOKEN) are set in `.env` file

#### Issue: Server restarts frequently
**Solution**:
- Make sure no other processes are using the same command
- Kill old tsx watch processes: `pkill -f "tsx watch src/server.ts"`

#### Issue: Changes not reflecting
**Solution**: After code changes, run:
1. `npm run build`
2. Reload VSCode window

### Development vs Production Mode

**Development Mode** (`tsx watch src/server.ts`):
- ❌ Outputs "[tsx] rerunning" messages to stdout
- ❌ Hot reload causes restart messages
- ❌ Not suitable for MCP stdio transport
- ✅ Good for terminal-based testing

**Production Mode** (`node dist/server.js`):
- ✅ Clean stdout output
- ✅ No build tool messages
- ✅ Perfect for MCP stdio transport
- ✅ Requires rebuild after changes

### Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level: error, warn, info, debug |
| `ENABLE_API_LOGGING` | `true` | Enable/disable API request/response logs |
| `JIRA_BASE_URL` | - | Jira Server URL (required) |
| `JIRA_EMAIL` | - | Jira email (required) |
| `JIRA_API_TOKEN` | - | Jira API token (required) |
| `GITHUB_TOKEN` | - | GitHub personal access token (required) |

### VSCode MCP Log Location

VSCode MCP logs can be found:
- **Location**: VSCode Output panel → "MCP" dropdown
- **Useful for**: Seeing actual error messages from server startup

### Success Indicators

When working correctly, you should see:
1. ✅ No "unable to start" error in VSCode
2. ✅ "NextRelease MCP Server" shows as connected
3. ✅ 12 tools listed in MCP panel:
   - `get_sprints`
   - `get_sprint_issues`
   - `get_issue_details`
   - `create_sprint_report`
   - And 8 more...

### Still Having Issues?

1. Check `.env` file has all required credentials
2. Verify `dist/server.js` exists (run `npm run build`)
3. Check VSCode MCP output logs for specific errors
4. Test server manually with the command above
5. Ensure no conflicting MCP server processes are running

---

**Last Updated**: October 1, 2025
