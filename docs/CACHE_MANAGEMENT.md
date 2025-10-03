# Cache Management Guide

**Last Updated**: October 3, 2025

## 📋 Overview

NextReleaseMCP uses a **multi-tier caching system** with in-memory cache and optional Redis for improved performance. This guide covers cache configuration, management, and troubleshooting.

## 🏗️ Cache Architecture

### Two-Tier System

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│  ┌─────────────────────────────────┐   │
│  │     In-Memory Cache (L1)        │   │
│  │  - Fast access (< 1ms)          │   │
│  │  - Process-specific             │   │
│  │  - Default: 100 items max       │   │
│  └─────────────────────────────────┘   │
│               ↓ (if configured)         │
│  ┌─────────────────────────────────┐   │
│  │     Redis Cache (L2)            │   │
│  │  - Persistent storage           │   │
│  │  - Shared across processes      │   │
│  │  - Optional (fallback to L1)    │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## ⚙️ Configuration

### Environment Variables

```bash
# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Memory Cache Configuration (Optional)
MEMORY_CACHE_MAX_SIZE=100    # Max items in memory
MEMORY_CACHE_TTL=300         # Default TTL in seconds
```

### Cache TTL (Time To Live)

Different data types have different cache durations:

| Data Type | Cache Key Pattern | TTL | Reason |
|-----------|------------------|-----|---------|
| Closed Sprints | `sprints:closed:*` | 30 min | Sprint data rarely changes |
| Sprint Velocity | `velocity:*` | 30 min | Analytics data is stable |
| Team Performance | `team-performance:*` | 5 min | More dynamic metrics |
| Issue Types | `issue-types:*` | 10 min | Moderate change frequency |
| Active Sprints | `sprints:active:*` | 1 min | Changes frequently |

## 🔧 Redis Setup

### Installation

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**macOS**:
```bash
brew install redis
brew services start redis
```

**Docker**:
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

### Verify Installation

```bash
# Check if Redis is running
redis-cli ping
# Expected output: PONG

# Check Redis info
redis-cli info server
```

### Configure NextReleaseMCP

1. Copy environment template:
```bash
cp .env.example .env
```

2. Update Redis settings in `.env`:
```bash
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
```

3. Restart the application:
```bash
npm run build
npm run start:web
```

## 📊 Cache Operations

### Viewing Cache Contents

```bash
# List all keys
redis-cli KEYS "*"

# List specific patterns
redis-cli KEYS "velocity:*"
redis-cli KEYS "team-performance:*"
redis-cli KEYS "issue-types:*"

# Count cached items
redis-cli DBSIZE

# View specific key
redis-cli GET "velocity:6306:6"

# Check TTL of a key
redis-cli TTL "velocity:6306:6"
```

### Clearing Cache

**Clear specific board (recommended)**:
```bash
# Clear all data for board 6306
redis-cli --scan --pattern "*6306*" | xargs redis-cli DEL

# Verify deletion
redis-cli --scan --pattern "*6306*" | wc -l
# Expected: 0
```

**Clear by data type**:
```bash
# Clear all velocity data
redis-cli --scan --pattern "velocity:*" | xargs redis-cli DEL

# Clear all team performance data
redis-cli --scan --pattern "team-performance:*" | xargs redis-cli DEL

# Clear all issue type data
redis-cli --scan --pattern "issue-types:*" | xargs redis-cli DEL
```

**Clear everything (use with caution)**:
```bash
# Flush current database
redis-cli FLUSHDB

# Flush all databases
redis-cli FLUSHALL
```

### Cache Warming

Pre-populate cache for better performance:

```bash
# Use the API to warm up cache
curl http://localhost:3000/api/analytics/velocity/6306?sprints=6
curl http://localhost:3000/api/analytics/team-performance/6306?sprints=6
curl http://localhost:3000/api/analytics/issue-types/6306?sprints=6
```

## 🐛 Troubleshooting

### Issue: Changes Not Appearing

**Symptom**: Code changes don't reflect in UI, old data still showing

**Diagnosis**:
```bash
# Check if Redis is being used
redis-cli DBSIZE

# Check cache age
redis-cli TTL "velocity:6306:6"
# If > 1800 (30 min), cache is fresh
```

**Solution**:
```bash
# Option 1: Clear specific board cache
redis-cli --scan --pattern "*6306*" | xargs redis-cli DEL

# Option 2: Wait for TTL to expire (up to 30 min)

# Option 3: Restart server to clear memory cache
npm run start:web
```

### Issue: Redis Connection Failed

**Symptom**: Application logs show Redis connection errors

**Diagnosis**:
```bash
# Check if Redis is running
redis-cli ping

# Check Redis logs
sudo journalctl -u redis-server -f
```

**Solution**:
```bash
# Start Redis
sudo systemctl start redis-server

# Or use in-memory only (remove from .env)
# REDIS_URL=
```

### Issue: High Memory Usage

**Symptom**: Redis using too much memory

**Diagnosis**:
```bash
# Check memory usage
redis-cli INFO memory

# Count keys
redis-cli DBSIZE
```

**Solution**:
```bash
# Clear old data
redis-cli FLUSHDB

# Configure max memory in redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### Issue: Cache Hit Rate Low

**Symptom**: Performance metrics show low cache hit rate

**Check metrics**:
```bash
curl http://localhost:3000/api/metrics
```

**Solutions**:
1. Increase cache TTL (edit api-server.ts)
2. Increase memory cache size (MEMORY_CACHE_MAX_SIZE=200)
3. Enable Redis if using memory-only
4. Review access patterns (are requests hitting uncached data?)

## 📈 Performance Monitoring

### Cache Metrics Endpoint

```bash
curl http://localhost:3000/api/metrics
```

**Response includes**:
- `cacheHitRate`: Percentage of requests served from cache
- `memoryTrend`: Memory usage trend (stable/increasing/decreasing)
- `uptime`: Server uptime in milliseconds

### Health Check

```bash
curl http://localhost:3000/api/health
```

**Response shows**:
- Cache service health status
- Cache latency (< 10ms is good)
- Overall cache hit rate

## 🔍 Cache Key Patterns

Understanding cache keys helps with debugging:

### Pattern Format
```
{type}:{boardId}:{sprintCount}:{optional-params}
```

### Examples
```
velocity:6306:6              → Velocity for board 6306, last 6 sprints
team-performance:6306:12     → Team metrics for board 6306, last 12 sprints
issue-types:6306:6           → Issue distribution for board 6306, last 6 sprints
sprints:closed:6306          → Closed sprints for board 6306
sprints:active:6306          → Active sprints for board 6306
```

### Wildcards for Searching
```bash
# All board 6306 data
redis-cli KEYS "*6306*"

# All velocity data
redis-cli KEYS "velocity:*"

# Specific sprint count
redis-cli KEYS "*:6:*"
```

## ⚡ Performance Best Practices

### 1. Use Appropriate TTL
- **Static data** (closed sprints): 30 minutes
- **Dynamic data** (active sprints): 1-5 minutes
- **Computed analytics**: 10-15 minutes

### 2. Cache Warming Strategy
- Pre-fetch common boards (e.g., 6306) on startup
- Cache popular sprint counts (6, 12, 24)
- Schedule background refresh before TTL expires

### 3. Batch Operations
```typescript
// Good: Batch Redis operations
const pipeline = redis.pipeline();
keys.forEach(key => pipeline.del(key));
await pipeline.exec();

// Bad: Individual operations
for (const key of keys) {
  await redis.del(key);
}
```

### 4. Monitor and Optimize
- Track cache hit rates (target > 70%)
- Monitor memory usage (keep < 80% max)
- Review slow queries (> 100ms)
- Adjust TTL based on data volatility

## 🔗 Related Files

- **Cache Manager**: `src/cache/cache-manager.ts` - Multi-tier cache logic
- **Cache Optimizer**: `src/cache/cache-optimizer.ts` - Intelligent optimization
- **API Server**: `src/web/api-server.ts` - Cache usage in endpoints
- **Performance Monitor**: `src/performance/performance-monitor.ts` - Metrics tracking

## 📚 Common Operations Reference

```bash
# Quick diagnostics
redis-cli ping                                    # Check connection
redis-cli DBSIZE                                  # Count keys
redis-cli INFO stats                              # Get statistics

# Cache inspection
redis-cli KEYS "*6306*"                          # List board keys
redis-cli TTL "velocity:6306:6"                  # Check expiry
redis-cli GET "velocity:6306:6"                  # View content

# Cache maintenance
redis-cli --scan --pattern "*6306*" | xargs redis-cli DEL  # Clear board
redis-cli FLUSHDB                                # Clear all
redis-cli BGSAVE                                 # Background save

# Monitoring
redis-cli MONITOR                                # Watch commands
redis-cli --stat                                 # Live stats
redis-cli --latency                              # Latency test
```

## 📝 Migration Notes

### Switching from Memory to Redis

1. Install and start Redis
2. Add REDIS_URL to .env
3. Restart application
4. Verify: `redis-cli KEYS "*"` should show cached data
5. Monitor metrics for performance improvement

### Switching from Redis to Memory

1. Remove REDIS_URL from .env
2. Restart application
3. Cache will use memory-only mode
4. Note: Cache not shared across processes

---

**Remember**: Cache is for performance, not correctness. Always design for cache misses.
