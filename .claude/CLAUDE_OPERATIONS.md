# NextReleaseMCP - Operations Guide

## Daily Operations

### Starting the System

#### Development Mode (Recommended)
```bash
# Terminal 1: Web API Server (includes MCP)
npm run dev:web

# Terminal 2: Web Application
cd web && npm run dev

# Services will be available at:
# - API Server: http://localhost:3000
# - Web App: http://localhost:3002
```

#### Separate Services Mode
```bash
# Terminal 1: MCP Server only (stdio)
npm run dev

# Terminal 2: Web API Server
npm run dev:web

# Terminal 3: Web Application
cd web && npm run dev
```

#### Production Mode
```bash
# Build first
npm run build
cd web && npm run build

# Run servers
npm run start:web  # Web API + MCP
cd web && npm run preview  # Web app
```

### Stopping the System

```bash
# Ctrl+C in each terminal

# Or kill processes by port
lsof -ti:3000 | xargs kill -9  # API server
lsof -ti:3002 | xargs kill -9  # Web app
```

### Health Monitoring

#### Quick Health Check
```bash
curl http://localhost:3000/api/health | jq '.'
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-01T10:00:00.000Z",
  "uptime": 3600,
  "version": "2.0.0",
  "checks": [
    {"name": "jira", "status": "healthy", "responseTime": 200},
    {"name": "github", "status": "healthy", "responseTime": 400},
    {"name": "cache", "status": "healthy", "responseTime": 1}
  ]
}
```

#### Detailed System Info
```bash
curl http://localhost:3000/api/info | jq '.'
```

#### Performance Metrics
```bash
curl http://localhost:3000/api/metrics | jq '.'
```

### Log Monitoring

#### Real-time Logs
```bash
# Follow MCP server logs
npm run dev:web 2>&1 | tee server.log

# Filter for errors only
npm run dev:web 2>&1 | grep -i error

# Filter for specific service
npm run dev:web 2>&1 | grep -i jira
```

#### Log Levels
```
ERROR: Critical issues requiring immediate attention
WARN:  Potential problems, degraded performance
INFO:  Normal operational events
DEBUG: Detailed diagnostic information
```

#### Common Log Patterns
```typescript
// Successful API call
{
  service: 'jira',
  method: 'GET',
  url: '/rest/api/2/myself',
  status: 200,
  duration: 184,
  requestId: 'abc123'
}

// Error
{
  level: 'error',
  message: 'Jira API error',
  error: { name: 'AxiosError', code: 'ECONNREFUSED' },
  context: { url: '/rest/api/2/myself' }
}

// Performance alert
{
  level: 'warn',
  message: 'High memory usage',
  memory: { heapUsed: 250000000, heapTotal: 300000000 }
}
```

---

## Configuration Management

### Environment Variables

**Location**: `.env` file in project root

**Required Variables**:
```bash
# Jira (REQUIRED)
JIRA_BASE_URL=https://jira.sage.com
JIRA_API_TOKEN=your_bearer_token
JIRA_EMAIL=your.email@company.com

# GitHub (REQUIRED)
GITHUB_TOKEN=ghp_your_token
```

**Optional Variables**:
```bash
# Server
MCP_SERVER_PORT=3000
MCP_SERVER_HOST=localhost
NODE_ENV=development

# Cache
MEMORY_CACHE_MAX_SIZE=100
MEMORY_CACHE_TTL=300
REDIS_HOST=localhost  # If using Redis
REDIS_PORT=6379

# Logging
LOG_LEVEL=info
ENABLE_API_LOGGING=true

# Security
RATE_LIMIT_PER_MINUTE=100
ENABLE_HELMET=true
CORS_ORIGIN=http://localhost:3002

# Reports
REPORT_OUTPUT_DIR=./sprint-reports
REPORT_MAX_SIZE=52428800
```

### Configuration Validation

```bash
# Test Jira connection
curl -H "Authorization: Bearer $JIRA_API_TOKEN" \
  https://jira.sage.com/rest/api/2/myself

# Test GitHub connection
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user

# Validate config on startup
npm run dev:web
# Check logs for "Server initialized" message
```

### Updating Configuration

```bash
# 1. Update .env file
vi .env

# 2. Restart services (dev mode auto-reloads)
# In dev mode: Changes to .env require restart

# 3. Verify changes
curl http://localhost:3000/api/health
```

---

## Cache Management

### Cache Statistics

```bash
curl http://localhost:3000/api/metrics | jq '.summary.cacheHitRate'
```

### Manual Cache Operations

```typescript
// Clear all cache
// Not exposed via API for safety

// Cache is automatically cleared on:
// 1. TTL expiration (5 minutes default)
// 2. Periodic optimization (15 minutes)
// 3. Server restart
```

### Cache Performance Monitoring

**Good Performance**:
- Hit rate: >70%
- Memory usage: <100MB
- Response time (hit): <1ms

**Poor Performance**:
- Hit rate: <50%
- Memory usage: >200MB
- Response time (hit): >5ms

**Actions**:
```bash
# If hit rate low:
# - Check if data changes too frequently
# - Increase TTL in config

# If memory high:
# - Reduce MEMORY_CACHE_MAX_SIZE
# - Enable Redis for overflow
# - Clear cache by restarting

# If response time high:
# - Check if entries too large
# - Consider Redis for large objects
```

---

## Backup & Recovery

### Configuration Backup

```bash
# Backup environment file (SENSITIVE!)
cp .env .env.backup.$(date +%Y%m%d)
chmod 600 .env.backup.*

# Store securely (NOT in git!)
# Consider using:
# - Password manager
# - Encrypted storage
# - Secrets management service
```

### Report Archive

```bash
# Reports are generated on-demand
# To save reports:

# Generate report via API
curl -X POST http://localhost:3000/api/reports/sprint \
  -H "Content-Type: application/json" \
  -d '{
    "sprint_id": "44298",
    "format": "markdown",
    "include_github": false,
    "template_type": "detailed"
  }' | jq -r '.report' > sprint-44298-$(date +%Y%m%d).md

# Archive old reports
mkdir -p ~/sprint-reports/archive
mv sprint-*.md ~/sprint-reports/archive/
```

### Database Backup

**Note**: This application does not use a persistent database. All data is fetched from Jira/GitHub APIs in real-time.

**Cache Persistence** (if using Redis):
```bash
# Redis backup
redis-cli SAVE
cp /var/lib/redis/dump.rdb /backup/redis-$(date +%Y%m%d).rdb

# Redis restore
redis-cli FLUSHALL
cp /backup/redis-20251001.rdb /var/lib/redis/dump.rdb
redis-cli
```

---

## Performance Optimization

### Monitoring Performance

```bash
# Get performance metrics
curl http://localhost:3000/api/metrics | jq '.summary'

# Expected metrics:
{
  "cacheHitRate": 0.75,  # >70% is good
  "averageResponseTime": 250,  # <500ms is good
  "memoryUsage": 150000000,  # <250MB is good
  "requestsPerMinute": 50  # <100 is normal
}
```

### Optimization Techniques

#### 1. Cache Tuning
```bash
# Increase cache size for better hit rates
MEMORY_CACHE_MAX_SIZE=200  # Default: 100

# Increase TTL for stable data
MEMORY_CACHE_TTL=600  # Default: 300 (5 min)

# Enable Redis for larger cache
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### 2. Rate Limiting
```bash
# Adjust rate limits
RATE_LIMIT_PER_MINUTE=200  # Default: 100

# Per-user rate limiting
# Configured in src/middleware/validation.ts
```

#### 3. Request Optimization
```typescript
// Batch API calls
// Use pagination with max_results
// Filter fields to reduce payload
```

### Performance Benchmarks

**API Response Times** (typical):
```
GET  /api/health         3ms
GET  /api/sprints        200ms
GET  /api/sprints/:id/issues (100)  300ms
POST /api/reports/sprint  2-5s
GET  /api/github/commits  400ms
```

**Memory Usage** (typical):
```
Startup:    140MB
Per request: 2-5MB
Peak:       250MB
```

**Cache Performance**:
```
Hit rate:    70-80%
Hit time:    <1ms
Miss time:   200-500ms
```

---

## Scaling Considerations

### Horizontal Scaling

**Current Architecture**: Single server instance

**To Scale Horizontally**:
1. Deploy multiple API servers
2. Add load balancer (nginx, HAProxy)
3. Use Redis for shared cache
4. Configure session affinity if needed

```
┌─────────────┐
│ Load Balancer│
└──────┬───────┘
       │
   ┌───┴───┬────────┬────────┐
   │       │        │        │
┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐
│API 1│ │API 2│ │API 3│ │API 4│
└──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘
   │       │        │        │
   └───────┴────────┴────────┘
            │
      ┌─────▼─────┐
      │   Redis   │
      │  (Shared  │
      │   Cache)  │
      └───────────┘
```

### Vertical Scaling

**Resource Recommendations**:

**Minimal**:
- CPU: 2 cores
- RAM: 512MB
- Storage: 1GB

**Recommended**:
- CPU: 4 cores
- RAM: 2GB
- Storage: 10GB

**High Load**:
- CPU: 8 cores
- RAM: 8GB
- Storage: 50GB

### Database Scaling

**Current**: No persistent database

**If Needed**:
1. Add PostgreSQL for report history
2. Add MongoDB for analytics
3. Use TimescaleDB for metrics

---

## Security Operations

### Token Rotation

```bash
# 1. Generate new tokens
# Jira: Settings → Personal Access Tokens
# GitHub: Settings → Developer settings → Personal access tokens

# 2. Update .env
JIRA_API_TOKEN=new_token
GITHUB_TOKEN=new_token

# 3. Restart services
# Dev mode: Auto-reload
# Production: Restart manually

# 4. Verify
curl http://localhost:3000/api/health
```

### Access Control

**API Key Authentication** (optional):
```typescript
// Add to .env
X_API_KEY=your_secret_key

// Middleware validates
if (req.headers['x-api-key'] !== process.env.X_API_KEY) {
  return res.status(401).json({ error: 'Unauthorized' })
}
```

**CORS Configuration**:
```typescript
// Location: src/web/api-server.ts:56
// Add allowed origins for production
origin: process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://your-domain.com'
]
```

### Audit Logging

**Current Logging**:
```typescript
// All API requests logged
{
  type: 'api_request',
  method: 'GET',
  path: '/api/sprints',
  ip: '127.0.0.1',
  userAgent: 'Mozilla/5.0...',
  timestamp: '2025-10-01T10:00:00.000Z'
}
```

**Enhanced Logging** (if needed):
```typescript
// Add user tracking
// Add action auditing
// Add data access logs
// Store in persistent storage
```

---

## Maintenance Tasks

### Daily Tasks
- ✓ Monitor health endpoint
- ✓ Check error logs
- ✓ Review performance metrics

### Weekly Tasks
- ✓ Review cache performance
- ✓ Check disk space
- ✓ Update dependencies (if needed)
- ✓ Backup configuration

### Monthly Tasks
- ✓ Review security patches
- ✓ Rotate API tokens
- ✓ Archive old reports
- ✓ Performance optimization review

### Quarterly Tasks
- ✓ Dependency major updates
- ✓ Security audit
- ✓ Performance testing
- ✓ Documentation review

---

## Deployment

### Development Deployment
```bash
git clone <repository>
npm install
cp .env.example .env
# Edit .env with credentials
npm run dev:web
```

### Production Deployment
```bash
# 1. Build
npm run build
cd web && npm run build

# 2. Copy files to server
rsync -avz dist/ user@server:/app/dist/
rsync -avz web/dist/ user@server:/app/web/dist/

# 3. Set up environment
cp .env user@server:/app/.env

# 4. Install production dependencies
npm ci --production

# 5. Start with process manager
pm2 start dist/web-server.js --name nextrelease-api
pm2 start web/dist/index.html --name nextrelease-web

# 6. Setup nginx reverse proxy
# See nginx.conf example
```

### Docker Deployment
```dockerfile
# Dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY dist ./dist
COPY .env ./

EXPOSE 3000

CMD ["node", "dist/web-server.js"]
```

```bash
# Build image
docker build -t nextrelease-mcp .

# Run container
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/.env:/app/.env \
  --name nextrelease \
  nextrelease-mcp

# Check logs
docker logs -f nextrelease
```

---

**Last Updated**: October 1, 2025
**Operations Team**: DevOps
