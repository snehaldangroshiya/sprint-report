# Logger Architecture - MCP stdio Compatibility

## Critical Issue: stdout vs stderr

### The Problem
The MCP stdio transport uses **stdin/stdout for JSON-RPC protocol communication**. Any non-JSON output on stdout breaks the protocol, causing VSCode to show "MCP server unable to start successfully".

### The Solution
**ALL logging must go to stderr using `process.stderr.write()`**

## Logger Implementation

### File Location
`src/utils/logger.ts`

### Key Implementation Detail (Line 43-51)

```typescript
private log(level: LogLevel, message: string, data?: any): void {
  if (!this.shouldLog(level) || !this.enableConsole) return;

  const formatted = this.formatMessage(level, message, data);

  // Always write to stderr for MCP stdio compatibility
  // stdout is reserved for JSON-RPC protocol messages
  process.stderr.write(formatted + '\n');
}
```

### Why This Fix Was Necessary

**BEFORE (Broken)**:
```typescript
private log(level: LogLevel, message: string, data?: any): void {
  const formatted = this.formatMessage(level, message, data);

  switch (level) {
    case 'error': console.error(formatted); break;  // stderr ✓
    case 'warn': console.warn(formatted); break;    // stderr ✓
    case 'info': console.info(formatted); break;    // stdout ✗ BREAKS MCP
    case 'debug': console.debug(formatted); break;  // stdout ✗ BREAKS MCP
  }
}
```

**AFTER (Fixed)**:
```typescript
private log(level: LogLevel, message: string, data?: any): void {
  const formatted = this.formatMessage(level, message, data);

  // ALL logs go to stderr, regardless of level
  process.stderr.write(formatted + '\n');  // stderr ✓ MCP compatible
}
```

## Other Sources of stdout Pollution

### 1. API Request Logging (base-client.ts)

**Location**: `src/clients/base-client.ts:422`

```typescript
private logRequest(response: AxiosResponse): void {
  if (!this.config.logging.enableApiLogging) return;

  const config = response.config;
  const duration = Date.now() - (config.metadata?.startTime || Date.now());

  console.log({  // ✗ PROBLEM: Writes to stdout
    service: this.serviceName,
    method: config.method?.toUpperCase(),
    url: config.url,
    status: response.status,
    duration,
    requestId: config.metadata?.requestId,
  });
}
```

**Fix**: Disable with environment variable `ENABLE_API_LOGGING=false`

### 2. Build Tool Output (tsx watch)

**Problem**: `tsx watch src/server.ts` outputs status messages to stdout:
```
9:53:29 PM [tsx] rerunning
```

**Fix**: Use production build `node dist/server.js` instead

### 3. npm Script Output

**Problem**: `npm run dev` adds npm output to stdout:
```
> jira-github-sprint-reporter-mcp@1.0.0 dev
> tsx watch src/server.ts
```

**Fix**: Use direct node command in `.vscode/mcp.json`:
```json
{
  "command": "node",
  "args": ["dist/server.js"]
}
```

## Environment Variable Control

### LOG_LEVEL
Controls the unified logger verbosity:
- `error`: Only critical errors (recommended for MCP stdio)
- `warn`: Warnings and errors
- `info`: Informational messages (default)
- `debug`: Verbose debugging output

**Usage**:
```bash
LOG_LEVEL=error node dist/server.js
```

**In `.vscode/mcp.json`**:
```json
{
  "env": {
    "LOG_LEVEL": "error"
  }
}
```

### ENABLE_API_LOGGING
Controls HTTP request/response logging in base-client.ts:
- `false`: No API request logs (recommended for MCP stdio)
- `true`: Log all HTTP requests (default)

**Usage**:
```bash
ENABLE_API_LOGGING=false node dist/server.js
```

**In `.vscode/mcp.json`**:
```json
{
  "env": {
    "ENABLE_API_LOGGING": "false"
  }
}
```

## Configuration Flow

### Environment Config (src/config/environment.ts:132-135)

```typescript
// Logging configuration
logging: {
  level: process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug' | undefined,
  enableApiLogging: process.env.ENABLE_API_LOGGING ? process.env.ENABLE_API_LOGGING === 'true' : undefined,
}
```

### Logger Initialization

```typescript
// In server initialization
const config = createAppConfig();
const logger = getLogger(config.logging);

// Logger respects LOG_LEVEL from config
logger.info('Starting server');  // Only if LOG_LEVEL >= info
logger.error('Critical error');  // Always shown
```

### Base Client Initialization

```typescript
// In client initialization
const jiraClient = new JiraClient(config);

// API logging respects ENABLE_API_LOGGING from config
// If false, logRequest() exits early
```

## Testing Logger Configuration

### Test 1: Verify stderr Output
```bash
# Start server with error logging only
LOG_LEVEL=error ENABLE_API_LOGGING=false node dist/server.js

# Expected: NO output to stdout (clean for MCP protocol)
# Expected: Error logs only to stderr (if any errors occur)
```

### Test 2: Check Stream Separation
```bash
# Redirect stdout and stderr separately
LOG_LEVEL=info node dist/server.js 1>stdout.log 2>stderr.log

# Check stdout.log - should ONLY contain JSON-RPC messages (or be empty during startup)
# Check stderr.log - should contain all log messages
```

### Test 3: VSCode MCP Integration
```json
// .vscode/mcp.json
{
  "servers": {
    "nextrelease-mcp": {
      "command": "node",
      "args": ["dist/server.js"],
      "env": {
        "LOG_LEVEL": "error",
        "ENABLE_API_LOGGING": "false"
      }
    }
  }
}
```

**Expected Result**: VSCode MCP connects successfully without "unable to start" errors

## Logger API

### Creating Loggers

```typescript
// Default logger (from config)
const logger = getLogger(config.logging);

// Custom logger with service name
const logger = createLogger('my-service', { level: 'debug' });

// Child logger with namespacing
const childLogger = logger.child('sub-component');
```

### Logging Methods

```typescript
logger.info('Informational message', { extra: 'data' });
logger.warn('Warning message', { details: 'here' });
logger.error('Error message', { error: errorObject });
logger.debug('Debug message', { verbose: 'info' });

// Error logging with operation context
logger.error(new Error('Something failed'), 'operation_name', { context: 'data' });

// Alias for compatibility
logger.logError(new Error('Failed'), 'operation_name', { context: 'data' });
```

### Performance Timing

```typescript
logger.time('expensive_operation');
// ... do work ...
logger.timeEnd('expensive_operation');  // Logs duration
```

## Best Practices

### ✅ DO

1. **Use the logger** instead of console.log/info/warn/debug
2. **Set LOG_LEVEL=error** for VSCode MCP stdio mode
3. **Disable API logging** with ENABLE_API_LOGGING=false for stdio mode
4. **Use production build** (`node dist/server.js`) not dev mode
5. **Test stdout cleanliness** before deploying to MCP clients

### ❌ DON'T

1. **Never use console.log/info/warn/debug** directly in code
2. **Never write to stdout** using `process.stdout.write()`
3. **Never use printf-style logging** that might default to stdout
4. **Don't use tsx watch** for MCP stdio mode
5. **Don't run through npm scripts** for MCP stdio mode

## Debugging Logger Issues

### Issue: VSCode shows "unable to start successfully"

**Check**:
1. Is LOG_LEVEL set to error?
2. Is ENABLE_API_LOGGING set to false?
3. Are you using `node dist/server.js` not `npm run dev`?
4. Have you run `npm run build` recently?

**Test**:
```bash
# This should produce ZERO stdout output
LOG_LEVEL=error ENABLE_API_LOGGING=false node dist/server.js
```

### Issue: Logs not appearing

**Check**:
1. Look at stderr, not stdout
2. Check LOG_LEVEL - might be filtering your log level
3. Check enableConsole flag in logger config

### Issue: Still seeing stdout pollution

**Search for**:
```bash
# Find console.log statements
grep -r "console\.(log|info|warn|debug)" src/

# Find process.stdout.write
grep -r "process\.stdout\.write" src/
```

## Migration Guide

### Converting Existing Code

**BEFORE**:
```typescript
console.log('Starting operation');
console.info('Processing item:', item);
console.warn('Potential issue detected');
console.error('Operation failed:', error);
```

**AFTER**:
```typescript
logger.info('Starting operation');
logger.info('Processing item', { item });
logger.warn('Potential issue detected');
logger.error('Operation failed', { error });
```

### Handling Third-Party Libraries

Some libraries may write to stdout. Solutions:

1. **Check if library has logger config** - configure to use stderr
2. **Disable verbose output** - use quiet/silent modes
3. **Intercept stdout** - redirect library stdout to stderr (advanced)

## Related Files

- **Implementation**: `src/utils/logger.ts`
- **Configuration**: `src/config/environment.ts:132-135`
- **Usage**: All `src/` files should import and use logger
- **VSCode Config**: `.vscode/mcp.json`
- **Base Client**: `src/clients/base-client.ts:422` (API logging)

## Summary

**Key Insight**: The MCP stdio protocol requires **pristine stdout** for JSON-RPC messages. The logger fix ensures all application logging goes to stderr, allowing VSCode MCP integration to work correctly.

**Result**: Clean stdout → MCP protocol works → VSCode connects successfully

---

**Last Updated**: October 1, 2025
**Status**: ✅ Production Implementation
**Critical For**: VSCode MCP Integration
