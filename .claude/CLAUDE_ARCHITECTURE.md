# NextReleaseMCP - Architecture Documentation

## System Architecture Overview

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATIONS                             │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────┐         ┌──────────────────────────────┐   │
│  │  Claude Desktop     │         │  Web Browser                 │   │
│  │  MCP Client         │         │  React Application           │   │
│  │  (stdio transport)  │         │  http://localhost:3002       │   │
│  └──────────┬──────────┘         └──────────────┬───────────────┘   │
│             │                                    │                   │
└─────────────┼────────────────────────────────────┼───────────────────┘
              │                                    │
              │ MCP Protocol                       │ HTTP/REST
              │ (stdio)                            │
              │                                    │
┌─────────────▼────────────────────────────────────▼───────────────────┐
│                      APPLICATION SERVER LAYER                         │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │           Enhanced MCP Server (Port 3000)                      │ │
│  │                                                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │ │
│  │  │ MCP Tools    │  │ REST API     │  │ Performance        │  │ │
│  │  │ - jira       │  │ - /api/*     │  │ Monitor            │  │ │
│  │  │ - github     │  │ - Express 5  │  │ - Metrics          │  │ │
│  │  │ - reports    │  │ - CORS       │  │ - Health Checks    │  │ │
│  │  └──────────────┘  └──────────────┘  └────────────────────┘  │ │
│  │                                                                │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │              Tool Registry & Execution                   │ │ │
│  │  │  - Tool registration                                     │ │ │
│  │  │  - Parameter validation                                  │ │ │
│  │  │  - Error recovery                                        │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
┌───────▼───────┐      ┌──────────▼─────────┐    ┌────────▼────────┐
│ Service Layer │      │   Data Layer       │    │  External APIs  │
├───────────────┤      ├────────────────────┤    ├─────────────────┤
│ - Sprint      │      │ Cache Manager      │    │ Jira Server     │
│ - Analytics   │      │ - Memory (LRU)     │    │ API v2          │
│ - Export      │      │ - Redis (Optional) │    │ Bearer Token    │
│ - Report Gen  │      │ - 5min TTL         │    │                 │
└───────────────┘      │ Cache Optimizer    │    │ GitHub API      │
                       │ - Auto cleanup     │    │ REST v3         │
                       │ - Predictive warm  │    │ PAT Token       │
                       └────────────────────┘    └─────────────────┘
```

## Component Architecture

### 1. Enhanced MCP Server

**File**: `src/server/enhanced-mcp-server.ts`

```typescript
class EnhancedMCPServer {
  // Core Components
  private server: Server                    // MCP SDK server
  private toolRegistry: ToolRegistry        // Tool registration
  private performanceMonitor: PerformanceMonitor
  private cacheOptimizer: CacheOptimizer

  // Clients
  private jiraClient: JiraClient
  private githubClient: GitHubClient
  private cacheManager: CacheManager

  // Lifecycle
  async initialize()    // Setup all services
  async run()          // Start listening
  async shutdown()     // Graceful cleanup
}
```

**Responsibilities**:
- Initialize and manage MCP server
- Register and execute tools
- Monitor performance metrics
- Optimize cache usage
- Handle health checks
- Coordinate service lifecycle

**Key Methods**:
```typescript
// Initialization
initialize(): Promise<void>
  - Create clients (Jira, GitHub)
  - Setup cache manager
  - Register all tools
  - Perform health checks
  - Schedule optimizations

// Tool Execution
CallToolRequestSchema handler
  - Validate tool exists
  - Parse parameters
  - Execute with monitoring
  - Return formatted results
  - Handle errors with recovery

// Health & Monitoring
getHealthStatus(): Promise<HealthStatus>
  - Check Jira connection
  - Check GitHub connection
  - Check cache health
  - Calculate uptime
  - Return status

// Optimization
schedulePeriodicOptimization()
  - Run every 15 minutes
  - Clean expired cache entries
  - Analyze access patterns
  - Warm frequently used data
```

### 2. Web API Server

**File**: `src/web/api-server.ts`

```typescript
class WebAPIServer {
  private app: express.Application
  private mcpServer: EnhancedMCPServer

  // Middleware Stack
  setupMiddleware() {
    1. Security headers (helmet)
    2. CORS configuration
    3. Rate limiting
    4. Request size validation
    5. Sanitization
    6. Compression
    7. JSON/URL parsing
    8. Logging
  }

  // Route Handlers
  setupRoutes() {
    // Health & Info
    GET  /api/health
    GET  /api/info
    GET  /api/metrics

    // Sprint Management
    GET  /api/sprints?board_id&state
    GET  /api/sprints/:id/issues
    GET  /api/sprints/:id/metrics

    // Report Generation
    POST /api/reports/sprint

    // GitHub Integration
    GET  /api/github/repos/:owner/:repo/commits
    GET  /api/github/repos/:owner/:repo/pulls
  }
}
```

**CORS Configuration**:
```typescript
// Location: src/web/api-server.ts:53-61
cors({
  origin: [
    'http://localhost:3000',  // MCP server
    'http://localhost:3001',  // Dev server alt
    'http://localhost:3002',  // Web app (Vite)
    'http://localhost:5173'   // Web app alt
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
})
```

### 3. Tool Registry

**File**: `src/server/tool-registry.ts`

```typescript
class ToolRegistry {
  private tools: Map<string, ToolDefinition>
  private errorRecovery: ErrorRecovery

  // Tool Registration
  registerAllTools() {
    // Jira Tools
    - jira_get_sprints
    - jira_get_sprint_issues
    - jira_get_issue_details
    - jira_search_issues

    // GitHub Tools
    - github_get_commits
    - github_get_pull_requests
    - github_get_repository_info

    // Report Tools
    - generate_sprint_report
    - generate_velocity_report
    - generate_burndown_report
  }

  // Tool Execution
  async executeTool(name, args, context) {
    1. Validate tool exists
    2. Validate parameters (Zod schemas)
    3. Execute with context
    4. Handle errors with recovery
    5. Format response
  }
}
```

### 4. Client Architecture

#### Base Client

**File**: `src/clients/base-client.ts`

```typescript
abstract class BaseAPIClient {
  protected httpClient: AxiosInstance
  protected cacheManager: CacheManager
  protected rateLimiter: RateLimiter

  // Request Pattern
  async makeRequest<T>(url, options, cacheOptions?) {
    1. Check cache
    2. Apply rate limiting
    3. Execute request
    4. Retry on failure (3 attempts)
    5. Cache successful response
    6. Track metrics
    7. Return data
  }

  // Health Check Pattern
  async healthCheck() {
    - Test connectivity
    - Measure latency
    - Return status
  }
}
```

#### Jira Client

**File**: `src/clients/jira-client.ts`

```typescript
class JiraClient extends BaseAPIClient {
  // Configuration
  baseURL: 'https://jira.sage.com'
  apiVersion: 'v2'  // CRITICAL: Not v3!
  auth: Bearer Token // CRITICAL: Not Basic Auth!

  // Key Methods
  async getSprints(boardId, state)
    → GET /rest/agile/1.0/board/{id}/sprint

  async getSprintIssues(sprintId, fields, maxResults)
    → GET /rest/agile/1.0/sprint/{id}/issue
    → Handles pagination automatically

  async getIssueDetails(issueKey)
    → GET /rest/api/2/issue/{key}

  async searchIssues(jql, fields, maxResults)
    → POST /rest/api/2/search
    → JQL validation
    → Pagination support

  // Health Check
  async validateConnection()
    → GET /rest/api/2/myself
    → Returns user info
}
```

**Critical Jira Configuration**:
```typescript
// MUST USE: Jira Server API v2 (not Cloud v3)
headers: {
  'Authorization': `Bearer ${token}`,  // Not Basic Auth!
  'Accept': 'application/json',
  'Content-Type': 'application/json'
}

// Endpoints
health: '/rest/api/2/myself'           // NOT /rest/api/3/
sprints: '/rest/agile/1.0/board/{id}/sprint'
issues: '/rest/agile/1.0/sprint/{id}/issue'
search: '/rest/api/2/search'           // NOT /rest/api/3/
```

#### GitHub Client

**File**: `src/clients/github-client.ts`

```typescript
class GitHubClient extends BaseAPIClient {
  // Configuration
  baseURL: 'https://api.github.com'
  auth: 'token ${PAT}'
  userAgent: 'JiraGitHubReporter/1.0.0'

  // Key Methods
  async getCommits(owner, repo, options)
    → GET /repos/{owner}/{repo}/commits
    → Filters: since, until, author

  async getPullRequests(owner, repo, state)
    → GET /repos/{owner}/{repo}/pulls
    → States: open, closed, all

  async getRepository(owner, repo)
    → GET /repos/{owner}/{repo}

  // Rate Limit Handling
  async checkRateLimit()
    → GET /rate_limit
    → Returns: limit, remaining, reset
    → Auto-throttles if low
}
```

### 5. Cache Architecture

**File**: `src/cache/cache-manager.ts`

```typescript
class CacheManager {
  private memoryCache: LRUCache<string, any>
  private redisClient?: RedisClient

  // Cache Strategy
  get(key: string): Promise<any | null> {
    1. Check memory cache (fast)
    2. Check Redis if enabled
    3. Return null if miss
  }

  set(key: string, value: any, ttl: number) {
    1. Store in memory cache
    2. Store in Redis if enabled
    3. Set expiration
  }

  // Cache Configuration
  memory: {
    maxSize: 100 entries
    ttl: 300 seconds (5 minutes)
  }

  redis: {
    optional: true
    ttl: 300 seconds
    db: 0
  }
}
```

**Cache Keys Pattern**:
```
jira:sprint:{boardId}:{state}
jira:sprint:issues:{sprintId}
jira:issue:{issueKey}
github:commits:{owner}:{repo}:{since}:{until}
github:prs:{owner}:{repo}:{state}
```

### 6. Performance Monitor

**File**: `src/performance/performance-monitor.ts`

```typescript
class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, Metric[]>
  private snapshots: PerformanceSnapshot[]

  // Monitoring
  async measureAsync(name, fn) {
    const start = Date.now()
    try {
      const result = await fn()
      this.recordMetric(name, Date.now() - start, true)
      return result
    } catch (error) {
      this.recordMetric(name, Date.now() - start, false)
      throw error
    }
  }

  // Alerting
  Events: 'alert', 'snapshot'

  Alerts when:
  - High memory usage (>80%)
  - Slow operations (>5s)
  - Error rate spike (>10%)
  - Cache hit rate drop (<50%)
}
```

### 7. Report Generator

**File**: `src/reporting/report-generator.ts`

```typescript
class ReportGenerator {
  // Report Types
  generateSprintReport(options: {
    sprint_id: string
    format: 'html' | 'markdown' | 'json'
    template_type: 'executive' | 'detailed' | 'technical'
    include_github: boolean
    github_owner?: string
    github_repo?: string
  })

  // Generation Pipeline
  1. Fetch sprint data from Jira
  2. Fetch issues for sprint
  3. Calculate metrics
  4. Fetch GitHub data if requested
  5. Apply template
  6. Format output
  7. Return report

  // Templates
  executive: High-level summary for stakeholders
  detailed: Comprehensive analysis with all data
  technical: Developer-focused metrics
}
```

## Data Flow

### Sprint Report Generation Flow

```
1. Client Request
   ├─ Web UI: Click "Generate Report"
   └─ MCP Client: Call generate_sprint_report tool

2. API Layer
   ├─ Validate parameters
   ├─ Check authentication
   └─ Forward to tool execution

3. Tool Execution
   ├─ Parse sprint_id
   ├─ Fetch sprint data (Jira)
   ├─ Fetch issues (Jira, paginated)
   ├─ Calculate metrics
   ├─ Fetch GitHub data (optional)
   └─ Pass to Report Generator

4. Report Generation
   ├─ Select template
   ├─ Aggregate data
   ├─ Apply formatting
   └─ Return formatted report

5. Response
   ├─ Web UI: Display + download
   └─ MCP Client: Return to Claude
```

### Caching Strategy

```
Request → Cache Check
          ├─ Hit: Return cached data (fast path)
          └─ Miss: Fetch from API
                   ├─ Success: Cache + Return
                   └─ Error: Return error

Cache Invalidation:
├─ TTL-based: 5 minutes default
├─ Manual: On data changes
└─ Optimization: Predictive warming
```

## Security Architecture

### Authentication Flow

```
1. Environment Variables
   ├─ JIRA_API_TOKEN (Bearer)
   └─ GITHUB_TOKEN (PAT)

2. Client Initialization
   ├─ Load from config
   └─ Validate on startup

3. Request Authentication
   ├─ Jira: Add Bearer token header
   └─ GitHub: Add token header

4. Token Validation
   ├─ Health check on startup
   └─ Periodic validation
```

### Security Layers

```
1. Input Validation
   ├─ Zod schemas for all inputs
   ├─ SQL injection prevention
   └─ XSS prevention

2. Rate Limiting
   ├─ API: 100 requests/minute
   ├─ Per-IP tracking
   └─ Graceful throttling

3. CORS Protection
   ├─ Whitelist allowed origins
   ├─ Credentials: true
   └─ Method restrictions

4. Request Sanitization
   ├─ Remove malicious content
   ├─ Validate content types
   └─ Size limits (10MB)

5. Error Handling
   ├─ Never expose internal details
   ├─ Sanitized error messages
   └─ Detailed logging (internal only)
```

## Performance Characteristics

### Response Times (Typical)
```
Health Check:        ~3ms   (cached)
Sprint Fetch:        ~200ms (Jira API)
Issue Fetch (100):   ~300ms (Jira API, paginated)
GitHub Commits:      ~400ms (GitHub API)
Report Generation:   2-5s   (aggregation + formatting)
Cache Hit:           <1ms   (memory)
```

### Scalability Limits
```
Concurrent Requests: 100/minute (rate limited)
Max Sprint Issues:   1000 (safety limit)
Max Search Results:  1000 (safety limit)
Cache Size:          100 entries (memory)
Request Timeout:     30 seconds
```

### Memory Usage
```
Base:                ~140MB (Node.js + dependencies)
Per Request:         ~2-5MB (temporary data)
Cache:               ~50MB (100 entries, full)
Peak:                ~250MB (under load)
```

## Deployment Architecture

### Development
```
├─ MCP Server (tsx watch)
├─ Web API (tsx watch)
└─ Web App (vite dev server)

Path aliases: Handled by tsx
Hot reload: Enabled
Source maps: Enabled
```

### Production
```
├─ MCP Server (node dist/server.js)
├─ Web API (node dist/web-server.js)
└─ Web App (static files from dist/)

Path aliases: Handled by module-alias
Minification: Enabled
Source maps: Disabled
```

## Technology Stack

### Backend
- **Runtime**: Node.js 22.x
- **Language**: TypeScript 5.x
- **HTTP Server**: Express 5.x
- **MCP SDK**: @modelcontextprotocol/sdk
- **HTTP Client**: Axios
- **Validation**: Zod
- **Cache**: LRU-Cache + optional Redis

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite 4
- **State**: TanStack Query (React Query)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Language**: TypeScript

### Development Tools
- **Build**: tsc (TypeScript Compiler)
- **Dev Server**: tsx (TypeScript Execute)
- **Testing**: Jest
- **Linting**: ESLint
- **Formatting**: Prettier

---

**Last Updated**: October 1, 2025
**Version**: 2.0.0
