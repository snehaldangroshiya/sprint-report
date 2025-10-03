# NextReleaseMCP - Troubleshooting Guide

## Quick Diagnostic Commands

```bash
# Check server health
curl http://localhost:3000/api/health | jq '.'

# Check if services are running
lsof -ti:3000  # MCP Server
lsof -ti:3002  # Web App

# Check environment variables
grep -E "^(JIRA|GITHUB)_" .env

# View recent logs
npm run dev:web 2>&1 | tail -50

# Check build status
npm run build && echo "Build successful"
```

---

## Common Issues & Solutions

### 1. Jira Server Authentication Failures

#### Symptom: 500 Internal Server Error from Jira
```json
{
  "error": "Jira API error",
  "details": "Request failed with status code 500"
}
```

**Root Cause**: Using wrong API version or authentication method

**Solution**:
```bash
# 1. Verify you're using API v2 (not v3)
# ❌ Wrong: https://jira.sage.com/rest/api/3/myself
# ✅ Correct: https://jira.sage.com/rest/api/2/myself

# 2. Verify Bearer token format in .env
JIRA_API_TOKEN=your_actual_bearer_token  # NOT "Bearer your_token"

# 3. Test authentication directly
curl -H "Authorization: Bearer $JIRA_API_TOKEN" \
  https://jira.sage.com/rest/api/2/myself

# 4. If still failing, regenerate token:
# Jira → Settings → Personal Access Tokens → Create new token
```

**Detection**: Check `src/clients/jira-client.ts:50` for correct API version

---

### 2. CORS Policy Blocking Web Requests

#### Symptom: Browser Console Error
```
Access to fetch at 'http://localhost:3000/api/sprints'
from origin 'http://localhost:3002' has been blocked by CORS policy
```

**Root Cause**: Web app port not in CORS allowed origins

**Solution**:
```bash
# 1. Check current CORS configuration
grep -A 10 "cors({" src/web/api-server.ts

# 2. Verify your web app port is included
# Should include: http://localhost:3002

# 3. If missing, add to allowed origins array at line 56:
# ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173']

# 4. Rebuild and restart
npm run build
npm run dev:web

# 5. Test CORS
curl -s -H "Origin: http://localhost:3002" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS http://localhost:3000/api/health -i | grep -i "access-control"
```

**Prevention**: Always add new web app ports to CORS config before starting

---

### 3. Module Path Resolution Errors

#### Symptom: Cannot Find Module
```
Error: Cannot find module '@/clients/jira-client'
Require stack:
- /home/sd/data/project-2025/NextReleaseMCP/dist/server/enhanced-mcp-server.js
```

**Root Cause**: TypeScript path aliases not resolved in production build

**Solution**:
```bash
# Option 1: Use development mode (recommended)
npm run dev:web  # Uses tsx with proper path resolution

# Option 2: Fix production build
# Add to package.json in production start script:
"start:web": "node -r module-alias/register dist/web-server.js"

# Verify path aliases in tsconfig.json
cat tsconfig.json | jq '.compilerOptions.paths'

# Should show:
# {
#   "@/*": ["./src/*"]
# }
```

**Detection**: Production mode failing but dev mode works = path alias issue

---

### 4. Express 5 Compatibility Errors

#### Symptom: Request Properties Read-Only
```
TypeError: Cannot assign to read only property 'requestId' of object '#<IncomingMessage>'
```

**Root Cause**: Express 5 made request/response properties read-only

**Solution**:
```typescript
// ❌ Wrong (Express 4 style)
req.requestId = uuid();

// ✅ Correct (Express 5 compatible)
res.locals.requestId = uuid();

// Access via res.locals everywhere
console.log(res.locals.requestId);
```

**Prevention**: Always use `res.locals` for custom properties, never modify `req` directly

---

### 5. Tool Registry Initialization Failures

#### Symptom: Server Starts But Tools Don't Work
```
Warning: Tool registry not initialized
Error: Tool 'get_sprint_issues' not found
```

**Root Cause**: Tools not registered before server starts

**Solution**:
```typescript
// Check src/server/enhanced-mcp-server.ts

// Verify tool registration happens in constructor
constructor() {
  this.toolRegistry = new ToolRegistry();
  this.registerTools();  // ✅ Must be called in constructor
}

// Verify all tools are registered
private registerTools() {
  // Jira tools
  this.toolRegistry.register(jiraTools.getSprintIssues);
  this.toolRegistry.register(jiraTools.listSprints);
  // ... all other tools
}
```

**Verification**:
```bash
# Check tool list via API
curl http://localhost:3000/api/info | jq '.tools'

# Should show all registered tools
```

---

### 6. TypeScript Build Errors

#### Symptom: 200+ Type Errors During Build
```
src/clients/jira-client.ts(45,12): error TS2345: Argument of type 'string'
is not assignable to parameter of type 'JiraIssue'
```

**Root Cause**: Incorrect type definitions or missing type annotations

**Solution**:
```bash
# 1. Check for common issues
npm run type-check

# 2. Fix Promise return types
// ❌ Wrong
async function getData(): string { ... }

// ✅ Correct
async function getData(): Promise<string> { ... }

# 3. Fix Express 5 error handlers (must have 4 parameters)
// ❌ Wrong
app.use((err, req, res) => { ... });

// ✅ Correct
app.use((err: any, req: Request, res: Response, next: NextFunction) => { ... });

# 4. Clean and rebuild
rm -rf dist/
npm run build
```

---

### 7. Web Application Not Loading

#### Symptom: Blank Page or Loading Spinner Forever

**Root Cause**: API calls failing or web app not built

**Solution**:
```bash
# 1. Check if web app is built
ls -la web/dist/

# 2. Build web app if needed
cd web && npm run build

# 3. Check if API server is running
curl http://localhost:3000/api/health

# 4. Check browser console for errors
# Open DevTools → Console → Look for network errors

# 5. Verify web app dev server is running
cd web && npm run dev

# 6. Check correct ports
# API: http://localhost:3000
# Web: http://localhost:3002
```

---

### 8. Sprint Data Not Loading

#### Symptom: "No sprints found" or Empty Sprint List

**Root Cause**: Wrong board ID or API parameters

**Solution**:
```bash
# 1. Test sprint API directly
curl "http://localhost:3000/api/sprints?board_id=6306&state=active" | jq '.'

# 2. Verify board ID exists
curl "http://localhost:3000/api/boards" | jq '.'

# 3. Check state parameter (active, closed, future)
# Try different states if needed

# 4. Common board IDs:
# 6306 - Sage Connect (primary board)
# Check Jira UI for your board ID in URL

# 5. Check Jira credentials
curl -H "Authorization: Bearer $JIRA_API_TOKEN" \
  "https://jira.sage.com/rest/api/2/board/6306/sprint?state=active"
```

---

### 9. Report Generation Failures

#### Symptom: Report Generation Returns 500 Error

**Root Cause**: Missing required parameters or invalid sprint ID

**Solution**:
```bash
# 1. Test report generation
curl -X POST http://localhost:3000/api/reports/sprint \
  -H "Content-Type: application/json" \
  -d '{
    "sprint_id": "44298",
    "format": "markdown",
    "include_github": false,
    "template_type": "executive"
  }' | jq '.'

# 2. Verify required parameters:
# ✅ sprint_id (string)
# ✅ format (html | markdown | json)
# ✅ include_github (boolean)
# ⚠️ template_type (optional: executive | detailed | technical)

# 3. Check sprint exists
curl "http://localhost:3000/api/sprints/44298" | jq '.'

# 4. If GitHub integration fails, set include_github: false
```

---

### 10. Cache Not Working

#### Symptom: Slow Responses, High API Usage

**Root Cause**: Cache not configured or disabled

**Solution**:
```bash
# 1. Check cache status
curl http://localhost:3000/api/metrics | jq '.summary.cacheHitRate'

# 2. Expected cache hit rate: >70%

# 3. If hit rate low, check configuration
grep MEMORY_CACHE .env

# 4. Default cache settings (in .env if needed)
MEMORY_CACHE_MAX_SIZE=100
MEMORY_CACHE_TTL=300

# 5. Monitor cache performance
curl http://localhost:3000/api/metrics | jq '{
  hitRate: .summary.cacheHitRate,
  memoryUsage: .summary.memoryUsage,
  avgResponseTime: .summary.averageResponseTime
}'
```

---

## Performance Issues

### Slow API Responses

**Diagnosis**:
```bash
# Check response times
curl -w "@-" -o /dev/null -s "http://localhost:3000/api/sprints?board_id=6306" <<'EOF'
time_total: %{time_total}s
EOF

# Expected times:
# /api/health: <50ms
# /api/sprints: <500ms
# /api/sprints/:id/issues: <1s
# /api/reports/sprint: 2-5s
```

**Solutions**:
1. **Enable caching**: Set `MEMORY_CACHE_MAX_SIZE=200` in .env
2. **Reduce max_results**: Use pagination for large issue lists
3. **Optimize Jira queries**: Use field filtering to reduce payload
4. **Add Redis**: Configure `REDIS_HOST` for persistent cache

---

### High Memory Usage

**Diagnosis**:
```bash
# Check memory usage
curl http://localhost:3000/api/metrics | jq '.summary.memoryUsage'

# Expected: <250MB
# Warning: >400MB
# Critical: >500MB
```

**Solutions**:
1. **Reduce cache size**: `MEMORY_CACHE_MAX_SIZE=50` in .env
2. **Lower TTL**: `MEMORY_CACHE_TTL=180` (3 minutes)
3. **Restart server**: Clear memory cache with server restart
4. **Check for leaks**: Look for unclosed connections in logs

---

## Environment Configuration Issues

### Missing Required Variables

**Check Required Variables**:
```bash
# Required variables
echo "JIRA_BASE_URL: $JIRA_BASE_URL"
echo "JIRA_API_TOKEN: ${JIRA_API_TOKEN:0:10}..."
echo "JIRA_EMAIL: $JIRA_EMAIL"
echo "GITHUB_TOKEN: ${GITHUB_TOKEN:0:10}..."

# If any are empty, add to .env:
JIRA_BASE_URL=https://jira.sage.com
JIRA_API_TOKEN=your_bearer_token
JIRA_EMAIL=your.email@company.com
GITHUB_TOKEN=ghp_your_token
```

### Invalid Token Format

**Test Tokens**:
```bash
# Test Jira token
curl -H "Authorization: Bearer $JIRA_API_TOKEN" \
  https://jira.sage.com/rest/api/2/myself

# Test GitHub token
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user

# Both should return 200 OK with user info
# 401 = invalid token
# 403 = token lacks permissions
```

---

## Logs Analysis

### Enable Debug Logging

```bash
# Add to .env
LOG_LEVEL=debug
ENABLE_API_LOGGING=true

# Restart server
npm run dev:web

# View logs with filtering
npm run dev:web 2>&1 | grep -i error    # Errors only
npm run dev:web 2>&1 | grep -i jira     # Jira requests
npm run dev:web 2>&1 | grep -i github   # GitHub requests
```

### Important Log Patterns

**Successful Request**:
```json
{
  "service": "jira",
  "method": "GET",
  "url": "/rest/api/2/myself",
  "status": 200,
  "duration": 184
}
```

**Failed Request**:
```json
{
  "level": "error",
  "message": "Jira API error",
  "error": {
    "name": "AxiosError",
    "code": "ECONNREFUSED"
  }
}
```

---

## Port Conflicts

### Check Port Usage

```bash
# Check if ports are in use
lsof -ti:3000  # MCP Server
lsof -ti:3002  # Web App

# Kill processes on ports if needed
lsof -ti:3000 | xargs kill -9
lsof -ti:3002 | xargs kill -9

# Change ports if needed (in .env)
MCP_SERVER_PORT=3000
# Web app port set in web/vite.config.ts
```

---

## Network Issues

### Connection Refused Errors

```bash
# Test Jira connectivity
ping jira.sage.com

# Test with curl
curl -v https://jira.sage.com/rest/api/2/myself

# Check DNS resolution
nslookup jira.sage.com

# Check firewall/proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

---

## Emergency Recovery

### Complete System Reset

```bash
# 1. Stop all processes
lsof -ti:3000 | xargs kill -9
lsof -ti:3002 | xargs kill -9

# 2. Clean build artifacts
rm -rf dist/
rm -rf web/dist/
rm -rf node_modules/
rm -rf web/node_modules/

# 3. Reinstall dependencies
npm install
cd web && npm install && cd ..

# 4. Rebuild everything
npm run build
cd web && npm run build && cd ..

# 5. Verify environment
cat .env | grep -E "^(JIRA|GITHUB)_"

# 6. Start fresh
npm run dev:web
```

### Rollback to Known Good State

```bash
# If using git
git status
git stash  # Save current changes
git checkout <last-known-good-commit>
npm install
npm run build
npm run dev:web

# Restore changes if needed
git stash pop
```

---

## Getting Help

### Information to Collect

When reporting issues, collect:

1. **System Info**:
```bash
node --version
npm --version
cat package.json | jq '.version'
uname -a
```

2. **Error Logs**:
```bash
npm run dev:web 2>&1 | tail -100 > error-log.txt
```

3. **Configuration** (redact sensitive data):
```bash
cat .env | sed 's/=.*/=<REDACTED>/' > env-sanitized.txt
```

4. **Health Status**:
```bash
curl http://localhost:3000/api/health | jq '.' > health.json
curl http://localhost:3000/api/info | jq '.' > info.json
```

---

## Preventive Maintenance

### Daily Checks
```bash
# Health check
curl http://localhost:3000/api/health | jq '.status'

# Should return: "healthy"
```

### Weekly Tasks
```bash
# Check cache performance
curl http://localhost:3000/api/metrics | jq '.summary.cacheHitRate'

# Update dependencies (carefully)
npm outdated
```

### Monthly Tasks
```bash
# Rotate API tokens
# Jira → Settings → Personal Access Tokens → Regenerate
# GitHub → Settings → Developer settings → Regenerate

# Update .env with new tokens
# Restart services
```

---

**Last Updated**: October 1, 2025
**Status**: Production Ready
**Health**: All Systems Operational

