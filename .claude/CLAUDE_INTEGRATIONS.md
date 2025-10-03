# NextReleaseMCP - Integrations Documentation

## Integration Overview

This document details the external integrations, their configurations, common issues, and how they work together.

## Jira Server Integration

### Critical Configuration

**⚠️ IMPORTANT**: This project uses **Jira Server** (not Jira Cloud)

| Aspect | Jira Cloud | **Jira Server** (This Project) |
|--------|------------|--------------------------------|
| API Version | `/rest/api/3/` | **`/rest/api/2/`** ✓ |
| Authentication | Basic Auth (email:token base64) | **Bearer Token** ✓ |
| Endpoint Example | `https://company.atlassian.net` | **`https://jira.sage.com`** ✓ |
| User Endpoint | `/rest/api/3/myself` | **`/rest/api/2/myself`** ✓ |

### Server Information
```json
{
  "baseUrl": "https://jira.sage.com",
  "version": "9.12.27",
  "versionNumbers": [9, 12, 27],
  "deploymentType": "Server",
  "buildNumber": 9120027,
  "buildDate": "2025-09-02T00:00:00.000+0000"
}
```

### Authentication Setup

**Environment Variables** (`.env`):
```bash
JIRA_BASE_URL=https://jira.sage.com
JIRA_API_TOKEN=your_bearer_token_here
JIRA_EMAIL=your.email@sage.com
```

**Implementation** (`src/clients/jira-client.ts:112-113`):
```typescript
headers: {
  'Authorization': `Bearer ${config.jira.apiToken}`,  // NOT Basic Auth!
  'Accept': 'application/json',
  'Content-Type': 'application/json'
}
```

### Common Issues & Fixes

#### Issue 1: 500 Internal Server Error

**Symptoms**:
```
HTTP 500: Internal Server Error
Response: No body or generic error message
```

**Cause**: Using wrong authentication method (Basic Auth instead of Bearer)

**Fix**:
```typescript
// ❌ WRONG (Jira Cloud style)
auth: {
  username: config.jira.email,
  password: config.jira.apiToken
}

// ✅ CORRECT (Jira Server style)
headers: {
  'Authorization': `Bearer ${config.jira.apiToken}`
}
```

**Files Fixed**:
- `src/clients/jira-client.ts:113`
- `src/config/environment.ts:229`

#### Issue 2: Wrong API Version

**Symptoms**:
```
404 Not Found
URL: /rest/api/3/myself
```

**Cause**: Using Jira Cloud API v3 endpoints

**Fix**: Change ALL endpoints from `/rest/api/3/` to `/rest/api/2/`

**Files Fixed**:
- `src/clients/jira-client.ts:215` (getIssueDetails)
- `src/clients/jira-client.ts:259` (searchIssues)
- `src/clients/jira-client.ts:315` (performHealthCheck)
- `src/clients/jira-client.ts:394` (validateConnection)
- `src/clients/jira-client.ts:413` (getServerInfo)

### Available Endpoints

#### Agile API (v1.0)
```typescript
// Get boards
GET /rest/agile/1.0/board
Query: maxResults=50

// Get sprints for board
GET /rest/agile/1.0/board/{boardId}/sprint
Query: state=active|closed|future

// Get sprint by ID
GET /rest/agile/1.0/sprint/{sprintId}

// Get issues in sprint
GET /rest/agile/1.0/sprint/{sprintId}/issue
Query: maxResults=100, startAt=0, fields=summary,status,...
```

#### Core API (v2)
```typescript
// Get current user (health check)
GET /rest/api/2/myself

// Get issue details
GET /rest/api/2/issue/{issueKey}
Query: expand=changelog,comments

// Search issues (JQL)
POST /rest/api/2/search
Body: {
  jql: "project = SCNT AND sprint = 44298",
  maxResults: 100,
  startAt: 0,
  fields: ["summary", "status", "assignee", ...]
}

// Get server info
GET /rest/api/2/serverInfo
```

### Response Handling

#### Sprint Response
```typescript
{
  values: [{
    id: 44298,
    name: "SCNT-2025-26",
    state: "active",
    startDate: "2025-09-17T06:51:00.000Z",
    endDate: "2025-10-01T06:51:00.000Z",
    originBoardId: 6306,
    goal: "Sprint goals here"
  }]
}
```

#### Issue Response
```typescript
{
  issues: [{
    id: "5585838",
    key: "SCNT-5305",
    fields: {
      summary: "Issue title",
      status: {
        name: "Done",
        statusCategory: { key: "done" }
      },
      assignee: {
        displayName: "John Doe",
        accountId: "123abc"
      },
      priority: { name: "Minor" },
      issuetype: { name: "Task" },
      customfield_10016: 5,  // Story Points
      labels: ["A11Y", "Bug"],
      components: [{ name: "Message Squad" }],
      created: "2025-09-15T20:00:44.000+0000",
      updated: "2025-09-26T13:35:27.000+0000",
      resolutiondate: "2025-09-26T13:35:27.000+0000"
    }
  }]
}
```

### Pagination Strategy

```typescript
// Automatic pagination in getSprintIssues
let allIssues = []
let startAt = 0
let hasMore = true

while (hasMore) {
  const response = await this.makeRequest(
    `/rest/agile/1.0/sprint/${sprintId}/issue`,
    { params: { maxResults: 100, startAt } }
  )

  allIssues = allIssues.concat(response.issues)
  hasMore = response.issues.length === 100
  startAt += 100

  // Safety limit
  if (allIssues.length >= 1000) break
}
```

### Story Points Extraction

```typescript
// Story points can be in multiple custom fields
const storyPointFields = [
  'customfield_10016',  // Most common
  'customfield_10004',
  'customfield_10002',
  'storyPoints',
  'story_points'
]

// Try each field until we find a valid number
for (const field of storyPointFields) {
  if (typeof fields[field] === 'number' && fields[field] >= 0) {
    return fields[field]
  }
}
```

### Current Production Data

**Board**: 6306 (Sage Connect)
**Active Sprint**: SCNT-2025-26 (ID: 44298)
**Period**: Sept 17 - Oct 1, 2025
**Issues**: 121 total
**Story Points**: 207 total

---

## GitHub Integration

### Configuration

**Environment Variables** (`.env`):
```bash
GITHUB_TOKEN=ghp_your_personal_access_token
GITHUB_API_URL=https://api.github.com  # Optional, defaults to this
```

**Implementation** (`src/clients/github-client.ts:29-36`):
```typescript
headers: {
  'Authorization': `token ${config.github.token}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'JiraGitHubReporter/1.0.0'
}
```

### Token Requirements

**Required Scopes**:
- `repo` - Full control of private repositories
- `read:org` - Read org and team data (optional)

**Token Types Supported**:
- Personal Access Token (Classic): `ghp_*`
- Fine-grained Personal Access Token: `github_pat_*`

### Rate Limiting

**GitHub Rate Limits**:
- **Authenticated**: 5,000 requests/hour
- **Unauthenticated**: 60 requests/hour

**Rate Limit Headers**:
```
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4831
X-RateLimit-Reset: 1759318098  (Unix timestamp)
```

**Implementation**:
```typescript
async checkRateLimit() {
  const response = await this.httpClient.get('/rate_limit')
  const { limit, remaining, reset } = response.data.rate

  if (remaining < 100) {
    const resetTime = new Date(reset * 1000)
    // Wait until reset or throttle requests
  }

  return { limit, remaining, reset }
}
```

### Available Endpoints

```typescript
// Get commits
GET /repos/{owner}/{repo}/commits
Query: {
  since: "2025-09-01T00:00:00Z",
  until: "2025-10-01T00:00:00Z",
  author: "username",
  per_page: 100,
  page: 1
}

// Get pull requests
GET /repos/{owner}/{repo}/pulls
Query: {
  state: "open|closed|all",
  sort: "created|updated|popularity",
  direction: "asc|desc",
  per_page: 100,
  page: 1
}

// Get repository info
GET /repos/{owner}/{repo}

// Get user info (health check)
GET /user

// Check rate limit
GET /rate_limit
```

### Response Examples

#### Commits
```typescript
[{
  sha: "abc123...",
  commit: {
    message: "Fix authentication bug",
    author: {
      name: "John Doe",
      email: "john@example.com",
      date: "2025-09-20T10:30:00Z"
    }
  },
  html_url: "https://github.com/org/repo/commit/abc123",
  author: {
    login: "johndoe",
    avatar_url: "https://..."
  }
}]
```

#### Pull Requests
```typescript
[{
  number: 123,
  title: "Add new feature",
  state: "closed",
  user: { login: "johndoe" },
  created_at: "2025-09-15T10:00:00Z",
  merged_at: "2025-09-20T15:30:00Z",
  closed_at: "2025-09-20T15:30:00Z",
  html_url: "https://github.com/org/repo/pull/123",
  base: { ref: "main" },
  head: { ref: "feature/new-thing" }
}]
```

### Pagination Strategy

```typescript
// GitHub uses Link headers for pagination
async getAllCommits(owner: string, repo: string) {
  let allCommits = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await this.httpClient.get(
      `/repos/${owner}/${repo}/commits`,
      { params: { per_page: 100, page } }
    )

    allCommits = allCommits.concat(response.data)

    // Check Link header for next page
    const linkHeader = response.headers.link
    hasMore = linkHeader?.includes('rel="next"')
    page++
  }

  return allCommits
}
```

### Error Handling

```typescript
// Common GitHub errors
switch (error.response?.status) {
  case 401:
    // Invalid or expired token
    throw new Error('GitHub authentication failed')

  case 403:
    // Rate limit exceeded or forbidden
    if (error.response.headers['x-ratelimit-remaining'] === '0') {
      throw new Error('GitHub rate limit exceeded')
    }
    throw new Error('GitHub access forbidden')

  case 404:
    // Repository not found
    throw new Error('Repository not found')

  default:
    throw new Error(`GitHub API error: ${error.message}`)
}
```

---

## Cross-Service Correlation

### Sprint + GitHub Correlation

**Use Case**: Link Jira issues with GitHub commits/PRs

**Strategy 1: Issue Key in Commit Message**
```typescript
// Commit message: "SCNT-5305: Fix authentication bug"
// Extract: SCNT-5305
// Match with Jira issue

const issueKeyPattern = /([A-Z]+-\d+)/g
const keys = commitMessage.match(issueKeyPattern)

// Correlate commits to issues
for (const key of keys) {
  const issue = await jiraClient.getIssueDetails(key)
  correlations.push({ commit, issue })
}
```

**Strategy 2: Time-based Correlation**
```typescript
// Get commits during sprint period
const commits = await githubClient.getCommits(owner, repo, {
  since: sprint.startDate,
  until: sprint.endDate
})

// Get PRs merged during sprint
const prs = await githubClient.getPullRequests(owner, repo, {
  state: 'closed'
})
const sprintPRs = prs.filter(pr =>
  pr.merged_at >= sprint.startDate &&
  pr.merged_at <= sprint.endDate
)
```

**Strategy 3: Branch Name Matching**
```typescript
// PR branch: "feature/SCNT-5305-authentication"
// Extract: SCNT-5305

const pr = await githubClient.getPullRequest(owner, repo, number)
const issueKey = pr.head.ref.match(/([A-Z]+-\d+)/)

if (issueKey) {
  const issue = await jiraClient.getIssueDetails(issueKey[1])
  correlations.push({ pr, issue })
}
```

### Report Generation Integration

```typescript
async generateSprintReport(options) {
  // 1. Fetch Jira data
  const sprint = await jiraClient.getSprintData(options.sprint_id)
  const issues = await jiraClient.getSprintIssues(options.sprint_id)

  // 2. Calculate metrics
  const metrics = calculateSprintMetrics(sprint, issues)

  // 3. Fetch GitHub data (if requested)
  let githubData = null
  if (options.include_github && options.github_owner && options.github_repo) {
    const commits = await githubClient.getCommits(
      options.github_owner,
      options.github_repo,
      { since: sprint.startDate, until: sprint.endDate }
    )

    const prs = await githubClient.getPullRequests(
      options.github_owner,
      options.github_repo,
      'all'
    )

    // Correlate with issues
    githubData = correlateGitHubWithIssues(commits, prs, issues)
  }

  // 4. Generate report
  return reportGenerator.generate({
    sprint,
    issues,
    metrics,
    githubData,
    template: options.template_type,
    format: options.format
  })
}
```

---

## Cache Integration

### Cache Strategy

**Purpose**: Reduce API calls to Jira and GitHub

**Implementation** (`src/cache/cache-manager.ts`):
```typescript
class CacheManager {
  // Two-tier cache
  private memoryCache: LRUCache  // Fast, limited size
  private redisCache?: Redis     // Persistent, larger capacity

  async get(key: string) {
    // Try memory first (fastest)
    let value = this.memoryCache.get(key)
    if (value) return value

    // Try Redis if available
    if (this.redisCache) {
      value = await this.redisCache.get(key)
      if (value) {
        // Warm memory cache
        this.memoryCache.set(key, value)
        return value
      }
    }

    return null  // Cache miss
  }

  async set(key: string, value: any, ttl: number) {
    // Store in both caches
    this.memoryCache.set(key, value, ttl)
    if (this.redisCache) {
      await this.redisCache.setex(key, ttl, JSON.stringify(value))
    }
  }
}
```

### Cache Keys

```typescript
// Jira caching
`jira:sprint:${boardId}:${state}`              // 5 min
`jira:sprint:issues:${sprintId}`               // 5 min
`jira:issue:${issueKey}`                       // 10 min
`jira:search:${jqlHash}`                       // No cache

// GitHub caching
`github:commits:${owner}:${repo}:${since}:${until}`  // 15 min
`github:prs:${owner}:${repo}:${state}`               // 10 min
`github:repo:${owner}:${repo}`                       // 30 min
```

### Cache Invalidation

**Time-based**:
```typescript
// Automatic TTL expiration
memoryCache.set(key, value, 300)  // 5 minutes
```

**Event-based**:
```typescript
// Manual invalidation on data changes
cacheManager.delete(`jira:sprint:issues:${sprintId}`)
```

**Optimization-based**:
```typescript
// Cache optimizer runs every 15 minutes
async optimizeCache() {
  // 1. Remove expired entries
  // 2. Analyze access patterns
  // 3. Warm frequently accessed data
  // 4. Remove rarely used entries
}
```

### Cache Performance

**Hit Rates** (typical):
- Sprint data: 80-90% (stable, infrequent changes)
- Issue data: 70-80% (moderate changes)
- GitHub data: 60-70% (more frequent changes)

**Response Times**:
- Cache hit: <1ms (memory)
- Cache miss + API: 200-500ms (Jira/GitHub)
- Warm cache: 2-3ms (Redis)

---

## Web Application Integration

### API Client Configuration

**File**: `web/src/lib/api.ts`

```typescript
const API_BASE = import.meta.env.PROD
  ? '/api'  // Production: relative path
  : 'http://localhost:3000/api'  // Development: full URL
```

### CORS Setup

**Critical**: Web app runs on port 3002, must be allowed

**Server Configuration** (`src/web/api-server.ts:56`):
```typescript
cors({
  origin: [
    'http://localhost:3000',  // Self
    'http://localhost:3001',  // Alt dev server
    'http://localhost:3002',  // ✓ Web app (Vite)
    'http://localhost:5173'   // Alt web app
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
})
```

### API Endpoints

```typescript
// Sprint Management
api.getSprints(boardId, state?)
  → GET /api/sprints?board_id={id}&state={state}

api.getSprintIssues(sprintId, maxResults?)
  → GET /api/sprints/{id}/issues?max_results={n}

api.getSprintMetrics(sprintId)
  → GET /api/sprints/{id}/metrics

// Report Generation
api.generateSprintReport(options)
  → POST /api/reports/sprint
  → Body: { sprint_id, format, include_github, ... }

// GitHub
api.getCommits(owner, repo, since?, until?, maxResults?)
  → GET /api/github/repos/{owner}/{repo}/commits

api.getPullRequests(owner, repo, state?, maxResults?)
  → GET /api/github/repos/{owner}/{repo}/pulls
```

### Error Handling

```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message)
  }
}

try {
  const data = await api.getSprints('6306', 'active')
} catch (error) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      // Authentication error
    } else if (error.status === 404) {
      // Not found
    } else if (error.status >= 500) {
      // Server error
    }
  }
}
```

---

## Testing Integrations

### Health Check Commands

```bash
# Jira health
curl -H "Authorization: Bearer $JIRA_API_TOKEN" \
  https://jira.sage.com/rest/api/2/myself

# GitHub health
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user

# MCP Server health
curl http://localhost:3000/api/health
```

### Integration Test Flow

```bash
# 1. Test Jira integration
curl "http://localhost:3000/api/sprints?board_id=6306&state=active"

# 2. Test issue fetching
curl "http://localhost:3000/api/sprints/44298/issues?max_results=10"

# 3. Test GitHub integration
curl "http://localhost:3000/api/github/repos/sage/repo/commits"

# 4. Test report generation
curl -X POST http://localhost:3000/api/reports/sprint \
  -H "Content-Type: application/json" \
  -d '{
    "sprint_id": "44298",
    "format": "markdown",
    "include_github": false,
    "template_type": "executive"
  }'
```

---

**Last Updated**: October 1, 2025
**Status**: All integrations operational
