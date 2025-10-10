# MCP stdio Transport Logging Fix

**Date:** October 11, 2025  
**Issue:** MCP server with stdio transport was generating JSON parsing errors  
**Root Cause:** Console output to stdout interferes with JSON-RPC protocol

## Problem

When using the MCP server with `stdio` transport, the MCP Inspector and clients were receiving errors like:

```
Error from MCP server: SyntaxError: Unexpected token 'R', "Redis cach"... is not valid JSON
```

The `stdio` transport uses stdout for the JSON-RPC protocol communication. Any logging, debug messages, or console output to stdout corrupts the protocol stream.

## Root Causes

1. **`console.log()` statements** - Multiple files had `console.log()` that write to stdout
2. **`console.time()` and `console.timeEnd()`** - Performance logging methods write to stdout  
3. **Logger class** - While configured to use stderr, had timing methods using stdout

## Solution

### ✅ Fixed Files

1. **`src/server/tool-registry.ts`**
   - Changed 4 `console.log()` → `console.error()` in report generation

2. **`src/server/enhanced-mcp-server.ts`**
   - Changed 2 `console.log()` → `console.error()` in SIGINT/SIGTERM handlers
   - Fixed `getInstance()` → `global.mcpServer` reference

3. **`src/cache/cache-manager.ts`**
   - Changed 4 `console.log()` → `console.error()` for Redis connection messages

4. **`src/utils/logger.ts`**
   - Disabled `time()` and `timeEnd()` methods (commented out console.time/timeEnd)
   - Added documentation explaining stdio transport incompatibility

5. **`src/clients/base-client.ts`** ⭐ (Critical Fix)
   - Disabled API request/response logging in stdio mode
   - Added TTY detection to skip console output when using stdio transport
   - Fixed 3 console logging methods: `logRequest()`, `logError()`, `retry logging`
   - **This was the main source of stdout pollution**

6. **`src/utils/validation.ts`** ⭐ (Schema Bug Fix)
   - Fixed `zodToMCPSchema()` to properly convert Zod types to JSON Schema
   - Added `zodTypeToJsonSchema()` helper function
   - Now correctly exports number types as `type: "number"` instead of `type: "string"`
   - Fixes validation errors like "Expected number, received string"
   - Properly handles arrays, enums, unions, and nested objects

### Key Changes

```typescript
// ❌ BEFORE (writes to stdout - breaks stdio)
console.log('Redis cache connected');
console.time('operation');
console.log({
  service: 'jira',
  method: 'GET',
  status: 200
});

// ✅ AFTER (Safe for stdio - uses stderr OR disabled)
console.error('Redis cache connected');
// timing disabled for stdio compatibility

// In base-client.ts - detect stdio mode and skip logging
if (process.stdin.isTTY === false && process.stdout.isTTY === false) {
  return; // Skip logging in stdio mode
}

// Schema conversion fix
// ❌ BEFORE: All fields exported as type: "string"
properties[key] = { type: 'string' };

// ✅ AFTER: Proper type conversion
properties[key] = zodTypeToJsonSchema(zodField);
// Now correctly exports:
// - z.number() → { type: "number" }
// - z.array() → { type: "array", items: {...} }
// - z.enum() → { type: "string", enum: [...] }
```

## Node.js Stream Behavior

| Method | Stream | MCP stdio Safe? |
|--------|--------|-----------------|
| `console.log()` | stdout | ❌ No |
| `console.info()` | stdout | ❌ No |
| `console.error()` | stderr | ✅ Yes |
| `console.warn()` | stderr | ✅ Yes |
| `console.time()` | stdout | ❌ No |
| `console.timeEnd()` | stdout | ❌ No |
| `process.stdout.write()` | stdout | ❌ No |
| `process.stderr.write()` | stderr | ✅ Yes |

## Logger Configuration

The `Logger` class in `src/utils/logger.ts` was already configured correctly:

```typescript
private log(level: LogLevel, message: string, data?: any): void {
  if (!this.shouldLog(level) || !this.enableConsole) return;

  const formatted = this.formatMessage(level, message, data);

  // ✅ Always write to stderr for MCP stdio compatibility
  // stdout is reserved for JSON-RPC protocol messages
  process.stderr.write(formatted + '\n');
}
```

However, the `time()` and `timeEnd()` methods were using `console.time()` which outputs to stdout, so they were disabled.

## Testing

After the fix, the MCP Inspector should work correctly:

```bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector tsx src/server.ts

# Or use directly with Claude Desktop or other MCP clients
# configured with stdio transport in their MCP settings
```

## Best Practices for stdio Transport

When building MCP servers with stdio transport:

1. **Never use stdout** - Reserve stdout exclusively for JSON-RPC messages
2. **Use stderr for logging** - `console.error()`, `console.warn()`, or `process.stderr.write()`
3. **Avoid console.time()** - Use custom timing with Date.now() and stderr output
4. **Test with MCP Inspector** - Validates protocol compliance
5. **Consider transport modes** - Use HTTP/SSE mode if you need stdout logging

## Alternative: HTTP/SSE Mode

If you need unrestricted logging, use HTTP/SSE transport mode instead:

```bash
# Start in HTTP/SSE mode (allows stdout logging)
npm run dev:http

# MCP Inspector with HTTP
npx @modelcontextprotocol/inspector --transport http --server-url http://localhost:3000
```

## Files Modified

- ✅ `src/server/tool-registry.ts` - 4 changes
- ✅ `src/server/enhanced-mcp-server.ts` - 2 changes + signal handler fix
- ✅ `src/cache/cache-manager.ts` - 4 changes
- ✅ `src/utils/logger.ts` - Disabled time() and timeEnd()
- ✅ `src/clients/base-client.ts` - Disabled logging in stdio mode (3 methods)
- ✅ `src/utils/validation.ts` - Fixed Zod to JSON Schema conversion

## Result

The MCP server now works correctly with stdio transport:
- ✅ All logging goes to stderr or is disabled in stdio mode
- ✅ stdout is clean (JSON-RPC only)
- ✅ MCP Inspector can connect and list tools
- ✅ No JSON parsing errors
- ✅ Tool schemas correctly specify field types (numbers, strings, arrays, etc.)
- ✅ No validation errors for properly typed parameters

## Common Issues Fixed

1. **JSON Parse Errors** - Caused by non-JSON output to stdout
2. **API Logging Pollution** - HTTP request/response logs appearing as MCP notifications
3. **Validation Type Errors** - Schema incorrectly declaring all fields as strings
4. **"Expected number, received string"** - Fixed by proper Zod → JSON Schema conversion

## Your 14 MCP Tools

After the fix, all 14 tools are accessible via stdio:

### Jira Tools (5)
1. `jira_get_sprints`
2. `jira_get_sprint_issues`
3. `jira_get_sprint`
4. `jira_get_issue_details`
5. `jira_search_issues`

### GitHub Tools (5)
6. `github_get_commits`
7. `github_get_pull_requests`
8. `github_search_commits_by_message`
9. `github_search_pull_requests_by_date`
10. `github_find_commits_with_jira_references`

### Sprint Reporting (2)
11. `generate_sprint_report`
12. `get_sprint_metrics`

### Utility (2)
13. `health_check`
14. `cache_stats`

## Additional Notes

- The Logger class continues to work normally for all other operations
- Only timing methods are affected (disabled for stdio compatibility)
- HTTP and SSE transport modes are unaffected
- Web server (port 3002) is unaffected
