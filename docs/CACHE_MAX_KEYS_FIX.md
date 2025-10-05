# Cache Max Keys Error Fix

## Problem
The application was throwing a `CacheError: Cache operation failed: set:jira:5283472` error with the message "Cache max keys amount exceeded". This occurred when the in-memory cache reached its maximum capacity.

## Root Cause
1. **Configuration Issue**: The `.env` file had `MEMORY_CACHE_MAX_SIZE=100`, meaning only 100 cache entries were allowed
2. **Hard Failure**: When the cache reached its limit, `node-cache` threw an error that was not handled gracefully
3. **Error Propagation**: The error was thrown in `cache-manager.ts` and propagated up, causing the entire operation to fail

## Changes Made

### 1. Configuration Updates

**File: `src/config/environment.ts`**
- Increased max allowed cache size from 100,000 to 1,000,000 entries
- Changed default from 10,000 to 50,000 entries
```typescript
maxSize: z.number().int().min(10).max(1000000).default(50000)
```

**File: `.env`**
- Updated `MEMORY_CACHE_MAX_SIZE` from 100 to 50,000
```bash
MEMORY_CACHE_MAX_SIZE=50000
```

**File: `.env.example`**
- Updated example value to match new default
```bash
MEMORY_CACHE_MAX_SIZE=50000
```

### 2. Improved Error Handling

**File: `src/cache/cache-manager.ts`**

#### `set()` method improvements:
- Wrapped memory cache operations in try-catch
- Added automatic cleanup when cache is near capacity (95%)
  - Clears 10% of oldest entries when limit is reached
  - Retries the set operation after cleanup
- **Changed from hard failure to graceful degradation**: Removed the `throw new CacheError()` statement
- Logs warnings instead of throwing errors
- Continues operation even if memory cache fails (Redis may still work)

#### `setMany()` method improvements:
- Tracks success/failure counts for batch operations
- Automatic cleanup when 30% or more operations fail
  - Clears 20% of oldest entries when many failures occur
- **Changed from hard failure to graceful degradation**: Removed the `throw new CacheError()` statement
- Logs warnings but continues operation

## Benefits

1. **Higher Capacity**: Supports up to 50,000 cache entries (500x increase from 100)
2. **Automatic Management**: Cache automatically cleans old entries when near capacity
3. **Graceful Degradation**: System continues to work even if cache is full
4. **Better Monitoring**: Added detailed logging for cache capacity issues
5. **No Application Crashes**: Errors no longer propagate up and crash the application

## Testing

To verify the fix:
1. Restart the servers to pick up the new configuration
2. Monitor logs for any cache capacity warnings
3. Check that Jira issue enhancement operations complete successfully

## Monitoring

Watch for these log messages to understand cache behavior:
- `Memory cache near capacity (X/50000), clearing old entries` - Automatic cleanup triggered
- `Memory cache batch set had X failures, clearing old entries` - Batch operation cleanup triggered
- `Continuing without caching for key X` - Cache failed but operation continues

## Future Improvements

Consider these enhancements:
1. **Redis-first Strategy**: For large datasets, prefer Redis over memory cache
2. **LRU Eviction**: Implement least-recently-used eviction strategy
3. **Cache Warming**: Pre-populate frequently accessed data
4. **Monitoring Dashboard**: Track cache hit/miss ratios and capacity usage
5. **Dynamic Sizing**: Adjust cache size based on available memory

## Configuration Reference

| Environment Variable | Old Value | New Value | Purpose |
|---------------------|-----------|-----------|---------|
| `MEMORY_CACHE_MAX_SIZE` | 100 | 50,000 | Maximum number of cache entries |
| `MEMORY_CACHE_TTL` | 300 | 300 | Time to live in seconds (unchanged) |

## Rollback Instructions

If issues occur, you can:
1. Reduce `MEMORY_CACHE_MAX_SIZE` in `.env` to a lower value
2. Enable Redis for distributed caching (recommended for production)
3. Revert changes to `cache-manager.ts` if graceful degradation causes issues

---

**Date**: October 5, 2025  
**Issue**: Cache max keys exceeded error  
**Status**: Fixed  
