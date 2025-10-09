# Web API Server Initialization Fix

**Date**: October 9, 2025
**Status**: ✅ Fixed and Tested
**Issue**: SERVER_NOT_INITIALIZED error preventing Web API server startup

## Problem Summary

The Web API server was failing to start with the error:
```
Failed to start Web API Server: BaseError: SERVER_NOT_INITIALIZED
    at EnhancedMCPServer.getContext
```

### Root Cause

Route setup functions were calling `getContext()` at **module initialization time** (during route creation) instead of **request handler execution time**. This caused the server to try to access the MCP server context before it was initialized.

**Problematic Pattern**:
```typescript
export function createCacheRouter(getContext: () => EnhancedServerContext, ...): Router {
  const router = Router();
  const { logger } = getContext();  // ❌ Called during route setup!

  router.get('/stats', async (req, res) => {
    logger.info('...');  // Using logger from outer scope
  });
}
```

## Solution

Move all `getContext()` calls **inside request handlers** where they execute at request time, after the server is initialized.

**Fixed Pattern**:
```typescript
export function createCacheRouter(getContext: () => EnhancedServerContext, ...): Router {
  const router = Router();  // ✅ No getContext() call here

  router.get('/stats', async (req, res) => {
    const { logger } = getContext();  // ✅ Called at request time
    logger.info('...');
  });
}
```

## Files Fixed

### 1. `src/web/routes/cache.routes.ts`
- **Changes**: Removed line 17 top-level `getContext()` call
- **Route Handlers Fixed**: 6 handlers updated to get logger inside request handlers
- **Pattern**: Used `let logger: any;` at function scope with conditional logging in catch blocks

### 2. `src/web/routes/sprint.routes.ts`
- **Changes**: Removed line 17 top-level logger destructuring
- **Route Handlers Fixed**: 3 handlers (`/sprints/:id/issues`, `/sprints/:id/metrics`, `/sprints/:id/comprehensive`)
- **Pattern**: Destructured `{ cacheManager, logger }` at request handler start

### 3. `src/web/routes/analytics.routes.ts`
- **Changes**: Removed line 18 top-level logger destructuring
- **Route Handlers Fixed**: 3 handlers (`/commit-trends/:owner/:repo`, `/team-performance/:boardId`, `/issue-types/:boardId`)
- **Pattern**: Destructured `{ cacheManager, logger }` at request handler start

### 4. `src/web/routes/velocity.routes.ts`
- **Changes**: Removed line 15 top-level `{ logger, cacheManager }` destructuring
- **Route Handlers Fixed**: 1 handler (`/:boardId`)
- **Pattern**: Moved destructuring inside request handler

## Initialization Flow

### Before Fix
```
1. new WebAPIServer()
2. ├─ new EnhancedMCPServer() [context = null]
3. ├─ setupRoutes()
4. │  ├─ createCacheRouter()
5. │  │  └─ getContext() ❌ FAILS! context not initialized yet
6. │  └─ Server crashes
7. └─ initialize() never reached
```

### After Fix
```
1. new WebAPIServer()
2. ├─ new EnhancedMCPServer() [context = null]
3. ├─ setupRoutes()
4. │  ├─ createCacheRouter() ✅ No getContext() call
5. │  ├─ createSprintRouter() ✅ No getContext() call
6. │  └─ All routes created successfully
7. └─ initialize()
8.    └─ mcpServer.initialize() [context = initialized]
9.       └─ Routes ready to handle requests
```

## Verification

### Build Status
```bash
$ npm run build
✅ TypeScript compilation successful
✅ No errors
```

### Server Startup
```bash
$ npm run start:web
✅ Enhanced MCP Server initialized
✅ Web API Server initialized
✅ Server listening on port 3000
```

### Endpoint Tests
```bash
$ curl http://localhost:3000/api/health
✅ {"status":"healthy",...}

$ curl http://localhost:3000/api/stats
✅ {"stats":{"hits":6,"misses":1,...}}

$ curl http://localhost:3000/api/boards
✅ [{"id":"6306","name":"SCNT Board",...}]

$ curl http://localhost:3000/api/info
✅ {"name":"enhanced-jira-github-sprint-reporter",...}
```

## Key Learnings

1. **Context Initialization Order Matters**: The MCP server context is only available after `initialize()` completes
2. **Route Setup ≠ Request Handling**: Route creation happens before initialization; request handlers run after
3. **Lazy Evaluation**: Get context lazily inside request handlers, not eagerly during setup
4. **Consistent Pattern**: Apply the same fix pattern across all route files for consistency

## Prevention Guidelines

### ✅ DO: Get context in request handlers
```typescript
router.get('/endpoint', async (req, res) => {
  const { logger, cacheManager } = getContext(); // ✅
  logger.info('Processing request');
});
```

### ❌ DON'T: Get context during route setup
```typescript
const { logger } = getContext(); // ❌ Will fail!
router.get('/endpoint', async (req, res) => {
  logger.info('Processing request');
});
```

## Impact

- **Performance**: No impact (getContext() is lightweight)
- **Functionality**: All routes working correctly
- **Reliability**: Server starts successfully every time
- **Code Quality**: More explicit about when context is accessed

## Related Files

- `src/web/api-server.ts`: WebAPIServer class with setupRoutes()
- `src/server/enhanced-mcp-server.ts`: EnhancedMCPServer with getContext()
- `src/web-server.ts`: Entry point that creates WebAPIServer
- All route files in `src/web/routes/`

---

**Status**: ✅ Issue resolved, server operational, all tests passing
