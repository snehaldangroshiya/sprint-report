# Sprint Details Page - Backend API Mapping

This document maps all backend functions and endpoints used by the **Sprint Details** page (`/sprint/:sprintId`).

## Table of Contents
- [Overview](#overview)
- [Frontend Data Flow](#frontend-data-flow)
- [API Endpoints Used](#api-endpoints-used)
- [Backend Functions Called](#backend-functions-called)
- [Complete Call Chain](#complete-call-chain)
- [Data Flow Diagram](#data-flow-diagram)

---

## Overview

The Sprint Details page (`web/src/pages/SprintDetails.tsx`) uses a **single aggregated hook** (`useSprintDetails`) that makes **4 parallel API calls** to fetch all necessary data efficiently.

### Performance Optimization
- **Before**: 7 sequential API calls
- **After**: 4 parallel API calls  
- **Improvement**: ~60% faster load times

---

## Frontend Data Flow

### 1. **Component Structure**
```
SprintDetails.tsx
    ↓
useSprintDetails hook (web/src/hooks/useSprintDetails.ts)
    ↓
API Client (web/src/lib/api.ts)
    ↓
Express API Server (src/web/api-server.ts)
```

### 2. **Hook Data Fetching**
The `useSprintDetails` hook makes 4 parallel queries using React Query:

```typescript
// Query 1: Core Sprint Data (Parallel)
Promise.all([
  getSprints(),              // All sprints for navigation
  getSprintMetrics(),        // Sprint metrics
  getSprintIssuesPaginated(), // Paginated issues
  getVelocityData()          // Velocity trends
])

// Query 2: Current Sprint Comprehensive Report
getComprehensiveSprintReport() // GitHub data + tier analytics

// Query 3: Previous Sprint Comprehensive Report
getComprehensiveSprintReport(previousSprintId) // For comparison
```

---

## API Endpoints Used

### 1. **GET /api/sprints**
**Frontend Call**: `getSprints(boardId, 'all')`

**Purpose**: Fetch all sprints for the board (for navigation/comparison)

**Parameters**:
- `board_id`: string (from config)
- `state`: 'all' (active + closed + future)

**Backend Route**: `src/web/routes/sprint.routes.ts:71`

**Backend Implementation**:
```typescript
router.get('/sprints', async (req, res) => {
  // Calls 3 MCP tools in parallel for 'all' state
  const [active, closed, future] = await Promise.all([
    callMCPTool('jira_get_sprints', { board_id, state: 'active' }),
    callMCPTool('jira_get_sprints', { board_id, state: 'closed' }),
    callMCPTool('jira_get_sprints', { board_id, state: 'future' }),
  ]);
  // Combines and sorts by start date (newest first)
});
```

**MCP Tool**: `jira_get_sprints`

**Backend Function**: 
- `src/server/mcp-tools.ts` → `JiraTools.getSprints()`
- `src/clients/jira-client.ts` → `JiraClient.getSprints()`

**External API**: Jira REST API v3
- Endpoint: `GET /rest/agile/1.0/board/{boardId}/sprint`
- Parameters: `state`, `startAt`, `maxResults`

---

### 2. **GET /api/sprints/:sprintId/metrics**
**Frontend Call**: `getSprintMetrics(sprintId)`

**Purpose**: Get sprint metrics (completion rate, velocity, story points, issue breakdown)

**Parameters**:
- `sprintId`: string (from URL)
- `include_velocity`: boolean (optional)
- `include_burndown`: boolean (optional)

**Backend Route**: `src/web/routes/sprint.routes.ts:192`

**Backend Implementation**:
```typescript
router.get('/sprints/:sprintId/metrics', async (req, res) => {
  // Checks cache first (dynamic TTL based on sprint state)
  const cacheKey = `sprint:${sprintId}:metrics:...`;
  
  // Calls MCP tool if cache miss
  const result = await callMCPTool('get_sprint_metrics', {
    sprint_id: sprintId,
    include_velocity: false,
    include_burndown: false,
  });
});
```

**MCP Tool**: `get_sprint_metrics`

**Backend Function**:
- `src/server/tool-registry.ts` → `handleGetSprintMetrics()`
- `src/services/sprint-service.ts` → `SprintService.getSprintDetails()`
- `src/services/sprint-service.ts` → `SprintService.calculateSprintMetrics()`

**External APIs**:
- Jira REST API v3
  - `GET /rest/agile/1.0/sprint/{sprintId}`
  - `GET /rest/agile/1.0/sprint/{sprintId}/issue`

**Response Structure**:
```typescript
{
  sprint: {
    id: string;
    name: string;
    state: 'active' | 'closed' | 'future';
    startDate: string;
    endDate: string;
    goal?: string;
  };
  metrics: {
    totalIssues: number;
    completedIssues: number;
    inProgressIssues: number;
    todoIssues: number;
    completionRate: number;
    totalStoryPoints: number;
    completedStoryPoints: number;
    issueTypeBreakdown: Record<string, number>;
    priorityBreakdown: Record<string, number>;
    assigneeBreakdown: Record<string, number>;
  };
}
```

---

### 3. **GET /api/sprints/:sprintId/issues**
**Frontend Call**: `getSprintIssuesPaginated(sprintId, page, perPage)`

**Purpose**: Get paginated list of issues in the sprint

**Parameters**:
- `sprintId`: string
- `page`: number (default: 1)
- `per_page`: number (default: 20, max: 100)
- `fields`: string[] (optional - specific fields to fetch)
- `max_results`: number (optional - total max issues)

**Backend Route**: `src/web/routes/sprint.routes.ts:123`

**Backend Implementation**:
```typescript
router.get('/sprints/:sprintId/issues', async (req, res) => {
  // Checks cache for full issue list
  const fullCacheKey = `sprint:${sprintId}:issues:full:${fields}`;
  let allIssues = await cacheManager.get(fullCacheKey);
  
  if (!allIssues) {
    // Fetch all issues from MCP tool
    const result = await callMCPTool('jira_get_sprint_issues', {
      sprint_id: sprintId,
      fields: fields?.split(','),
      max_results: maxResults,
    });
    
    // Cache with dynamic TTL based on sprint state
    await cacheManager.set(fullCacheKey, allIssues, { ttl });
  }
  
  // Server-side pagination from cached data
  const paginatedIssues = allIssues.slice(startIndex, endIndex);
  
  return res.json({
    issues: paginatedIssues,
    pagination: { page, per_page, total_issues, total_pages, has_next, has_prev }
  });
});
```

**MCP Tool**: `jira_get_sprint_issues`

**Backend Function**:
- `src/server/mcp-tools.ts` → `JiraTools.getSprintIssues()`
- `src/clients/jira-client.ts` → `JiraClient.getSprintIssues()`

**External API**: Jira REST API v3
- Endpoint: `GET /rest/agile/1.0/sprint/{sprintId}/issue`
- Parameters: `fields`, `startAt`, `maxResults`

**Response Structure**:
```typescript
{
  issues: Array<{
    id: string;
    key: string;
    summary: string;
    status: string;
    assignee: string;
    storyPoints?: number;
    priority: string;
    issueType: string;
    created: string;
    updated: string;
    resolved?: string;
    labels: string[];
    components: string[];
  }>;
  pagination: {
    page: number;
    per_page: number;
    total_issues: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}
```

---

### 4. **GET /api/velocity/:boardId**
**Frontend Call**: `getVelocityData(boardId, 15)`

**Purpose**: Get velocity trends for recent sprints (for sprint comparison)

**Parameters**:
- `boardId`: string (from config)
- `sprints`: number (default: 5, Sprint Details uses 15)

**Backend Route**: `src/web/routes/velocity.routes.ts:21`

**Backend Implementation**:
```typescript
router.get('/:boardId', async (req, res) => {
  const result = await callMCPTool('get_velocity_data', {
    board_id: boardId,
    sprint_count: sprintCount,
  });
});
```

**MCP Tool**: `get_velocity_data`

**Backend Function**:
- `src/server/mcp-tools.ts` → `ReportTools.getVelocityData()`
- `src/services/sprint-service.ts` → `SprintService.getVelocityData()`

**Process**:
1. Fetch recent sprints for board
2. For each closed sprint:
   - Get sprint details
   - Calculate metrics (velocity, commitment, completed story points)
3. Calculate average velocity
4. Determine trend (increasing/decreasing/stable)

**External API**: Jira REST API v3
- `GET /rest/agile/1.0/board/{boardId}/sprint`
- `GET /rest/agile/1.0/sprint/{sprintId}/issue`

**Response Structure**:
```typescript
{
  sprints: Array<{
    id: string;
    name: string;
    velocity: number;
    commitment: number;
    completed: number;
  }>;
  average: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}
```

---

### 5. **GET /api/sprints/:sprintId/comprehensive** ⭐ **MOST IMPORTANT**
**Frontend Call**: `getComprehensiveSprintReport(sprintId, options)`

**Purpose**: Get comprehensive sprint report with GitHub data and tier analytics

**Parameters**:
- `sprintId`: string
- `github_owner`: string (from config)
- `github_repo`: string (from config)
- `include_tier1`: boolean (default: true) - Sprint goal, scope changes, spillover
- `include_tier2`: boolean (default: true) - Blockers, bugs, cycle time
- `include_tier3`: boolean (default: false) - Epic progress, tech debt, risks
- `include_forward_looking`: boolean (default: false) - Next sprint forecast
- `include_enhanced_github`: boolean (default: true) - GitHub PR stats, commit activity

**Backend Route**: `src/web/routes/sprint.routes.ts:227`

**Backend Implementation**:
```typescript
router.get('/sprints/:sprintId/comprehensive', async (req, res) => {
  // Complex cache key including all parameters
  const cacheKey = `comprehensive:${sprintId}:${github_owner}:${github_repo}:...`;
  
  // Check cache with background refresh for popular sprints
  const cachedData = await cacheManager.get(cacheKey);
  if (cachedData) {
    // Schedule background refresh if cache > 50% expired
    scheduleBackgroundRefresh(...);
    return res.json(cachedData);
  }
  
  // Call MCP tool with all comprehensive flags
  const result = await callMCPTool('generate_sprint_report', {
    sprint_id: sprintId,
    github_owner,
    github_repo,
    format: 'json',
    include_commits: true,
    include_prs: true,
    include_velocity: true,
    include_burndown: true,
    include_tier1,
    include_tier2,
    include_tier3,
    include_forward_looking,
    include_enhanced_github,
  });
  
  // Parse and reorganize data to match frontend expectations
  const reportData = typeof result.content === 'string' 
    ? JSON.parse(result.content) 
    : result.content;
});
```

**MCP Tool**: `generate_sprint_report`

**Backend Function Chain** (THE MAIN ONE):
```
src/server/tool-registry.ts
  → handleGenerateSprintReport()
    ↓
src/reporting/report-generator.ts
  → ReportGenerator.generateReport()
    ↓
src/services/sprint-service.ts
  → SprintService.generateSprintReport() ← THIS IS WHERE YOU ARE!
    ↓ (Makes 6+ parallel calls)
    ├─ getSprintDetails()
    ├─ calculateSprintMetrics()
    ├─ getSprintCommits() → GitHubClient.getCommits()
    ├─ getSprintPullRequests() → GitHubGraphQLClient.searchPullRequestsByDateRange() 🎯 **USES GRAPHQL v4**
    ├─ getVelocityData()
    └─ getBurndownData()
```

**External APIs Used**:
1. **Jira REST API v3**:
   - `GET /rest/agile/1.0/sprint/{sprintId}`
   - `GET /rest/agile/1.0/sprint/{sprintId}/issue`
   - Issue changelog for Tier 1-3 analytics

2. **GitHub GraphQL API v4** ⭐ **NEW**:
   - Query: `searchPullRequestsByDateRange()`
   - Native date filtering: `created:2025-08-06..2025-08-20`
   - 100 PRs per page (vs REST's 30)
   - Cursor-based pagination
   - **File**: `src/clients/github-graphql-client.ts`

3. **GitHub REST API v3** (Fallback):
   - `GET /repos/{owner}/{repo}/commits`
   - `GET /search/issues` (for PRs if GraphQL unavailable)

**Response Structure** (Comprehensive):
```typescript
{
  sprint: { id, name, state, startDate, endDate, goal, issues },
  metadata: { generatedAt, version, include flags },
  metrics: {
    totalIssues, completedIssues, storyPoints, completedStoryPoints,
    completionRate, velocity, issuesByType, issuesByStatus
  },
  commits: Array<{ sha, message, author, date, url }>,
  pullRequests: Array<{
    number, title, state, author, createdAt, mergedAt, closedAt,
    url, linkedIssues, reviewComments, additions, deletions
  }>,
  velocity: { sprints, average, trend },
  burndown: { sprint_id, days: [{ date, remaining, ideal, completed }] },
  teamPerformance: Array<{ name, planned, completed, velocity }>,
  
  // Enhanced GitHub Metrics (include_enhanced_github=true)
  enhanced_github: {
    commit_activity: {
      totalCommits, totalAuthors, averageCommitsPerDay,
      authorStats, dailyActivity
    },
    pull_request_stats: {
      totalPRs, mergedPRs, openPRs, closedWithoutMerge,
      mergeRate, averageTimeToFirstReview, averageTimeToMerge,
      averageReviewComments, prsByAuthor
    },
    code_changes: {
      totalAdditions, totalDeletions, netChange,
      averageAdditionsPerCommit, averageDeletionsPerCommit
    },
    pr_to_issue_traceability: Array<{
      issueKey, prs, commits, totalChanges, status
    }>,
    code_review_stats: {
      averageReviewTime, averageReviewComments,
      reviewParticipation
    }
  },
  
  // Tier 1 Analytics (include_tier1=true)
  sprintGoal: {
    goalText, alignment, achievementStatus, keyDeliverables
  },
  scopeChanges: {
    added, removed, totalChanges, impactAnalysis
  },
  spilloverAnalysis: {
    spilledIssues, spilledPoints, spilloverRate, reasons
  },
  
  // Tier 2 Analytics (include_tier2=true)
  blockers: Array<{ issue, blockingDuration, impact }>,
  bugMetrics: {
    totalBugs, bugsFixed, bugEscapeRate, severityBreakdown
  },
  cycleTimeMetrics: {
    averageCycleTime, p50, p90, p95
  },
  teamCapacity: {
    totalCapacity, utilization, availableMembers
  },
  
  // Tier 3 Analytics (include_tier3=true)
  epicProgress: Array<{ epic, planned, completed, progress }>,
  technicalDebt: {
    totalDebtIssues, priorityBreakdown, estimatedEffort
  },
  risks: Array<{ description, impact, mitigation }>,
  
  // Forward Looking (include_forward_looking=true)
  nextSprintForecast: {
    predictedVelocity, confidence, recommendedCommitment
  },
  carryoverItems: Array<{
    issue, priority, estimatedCompletion
  }>
}
```

---

## Backend Functions Called

### Core Services

#### 1. **SprintService** (`src/services/sprint-service.ts`)
Main orchestrator for sprint data:

- **`generateSprintReport(request)`** ⭐ **MAIN FUNCTION**
  - Orchestrates all sprint data fetching
  - Makes 6+ parallel API calls
  - Uses GitHub GraphQL v4 for PRs
  - Calls AnalyticsService for tier metrics
  - Returns comprehensive SprintReport object

- **`getSprintDetails(sprintId)`**
  - Fetches sprint info from Jira
  - Cached with dynamic TTL

- **`calculateSprintMetrics(sprint)`**
  - Calculates completion rate, velocity, story points
  - Issue breakdown by type, status, priority

- **`getSprintCommits(owner, repo, startDate, endDate)`**
  - Fetches commits from GitHub REST API
  - Filters by sprint date range

- **`getSprintPullRequests(owner, repo, startDate, endDate)`** 🎯 **GRAPHQL**
  - **NEW**: Uses GitHub GraphQL v4 API preferentially
  - Falls back to REST API if GraphQL client unavailable
  - Filters PRs by sprint date range
  - Returns normalized PullRequest objects

- **`getVelocityData(boardId, sprintCount)`**
  - Calculates velocity trends
  - Returns average and trend direction

- **`getBurndownData(sprintId)`**
  - Simplified burndown calculation
  - Returns daily remaining/ideal/completed points

---

#### 2. **GitHubGraphQLClient** ⭐ **NEW** (`src/clients/github-graphql-client.ts`)
Dedicated GitHub GraphQL v4 client:

- **`searchPullRequestsByDateRange(owner, repo, startDate, endDate, state)`**
  - Uses GraphQL query with native date filtering
  - `repo:{owner}/{repo} is:pr created:{start}..{end}`
  - Fetches 100 PRs per page (vs REST's 30)
  - Automatic cursor-based pagination
  - Returns up to 1000 PRs
  - Transforms GraphQL response to PullRequest type

**GraphQL Query**:
```graphql
query SearchPullRequests($query: String!, $after: String) {
  search(query: $query, type: ISSUE, first: 100, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      ... on PullRequest {
        number
        title
        state
        createdAt
        updatedAt
        mergedAt
        closedAt
        author { login }
        url
        additions
        deletions
        commits { totalCount }
        reviewRequests { totalCount }
        reviews { totalCount }
        comments { totalCount }
        # More fields...
      }
    }
  }
}
```

---

#### 3. **GitHubClient** (`src/clients/github-client.ts`)
Legacy GitHub REST API client:

- **`getCommits(owner, repo, options)`**
  - Fetches commits from REST API
  - Pagination support
  - Date filtering with `since` and `until`

- **`searchPullRequestsByDateRange(owner, repo, startDate, endDate, state)`**
  - Fallback method for PRs
  - Uses GitHub Search API
  - Limited to 30 PRs per page

- **`calculateCommitActivityStats(commits)`**
  - Analyzes commit patterns
  - Author statistics
  - Daily activity trends

- **`calculateCodeChangeStats(commits)`**
  - Total additions/deletions
  - Net change calculation
  - Averages per commit

- **`calculateCodeReviewStats(prs)`**
  - Review time metrics
  - Comment statistics
  - Participation rates

---

#### 4. **AnalyticsService** (`src/services/analytics-service.ts`)
Advanced analytics for tier metrics:

- **Tier 1 Analytics**:
  - `analyzeSprintGoal()` - Goal alignment analysis
  - `detectScopeChanges()` - Added/removed issues during sprint
  - `analyzeSpillover()` - Incomplete work analysis

- **Tier 2 Analytics**:
  - `extractBlockers()` - Blocked issues analysis
  - `calculateBugMetrics()` - Bug escape rate, severity
  - `calculateCycleTimeMetrics()` - Time-based metrics
  - `calculateTeamCapacity()` - Capacity utilization

- **Tier 3 Analytics**:
  - `calculateEpicProgress()` - Epic completion tracking
  - `calculateTechnicalDebt()` - Tech debt assessment
  - `extractRisks()` - Risk identification

- **Forward Looking**:
  - `generateNextSprintForecast()` - Velocity prediction
  - `analyzeCarryoverItems()` - Incomplete items analysis

---

#### 5. **JiraClient** (`src/clients/jira-client.ts`)
Jira API client:

- **`getSprints(boardId, state)`**
  - Fetches sprints for board
  - Filters by state (active/closed/future)

- **`getSprintData(sprintId)`**
  - Detailed sprint information

- **`getSprintIssues(sprintId, options)`**
  - Issues in sprint with full details

- **`getEnhancedSprintIssues(sprintId)`**
  - Issues with changelog data for tier analytics

---

#### 6. **ReportGenerator** (`src/reporting/report-generator.ts`)
Report formatting service:

- **`generateReport(request)`**
  - Calls SprintService.generateSprintReport()
  - Formats output (HTML/Markdown/JSON/CSV)
  - Stores report with metadata

---

#### 7. **CacheManager** (`src/cache/cache-manager.ts`)
Caching layer:

- **`get(key)`** - Retrieve cached data
- **`set(key, value, options)`** - Store with TTL
- **Dynamic TTL based on sprint state**:
  - Active sprints: 3 minutes
  - Closed sprints: 30 minutes
  - Velocity/burndown: 30 minutes

---

## Complete Call Chain

Here's the complete end-to-end call chain when loading Sprint Details page:

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: SprintDetails.tsx                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ HOOK: useSprintDetails.ts                                        │
│                                                                   │
│ Makes 4 parallel React Query calls:                              │
│                                                                   │
│ 1. Core Sprint Data (4 API calls in Promise.all):                │
│    ├─ getSprints(boardId, 'all')                                 │
│    ├─ getSprintMetrics(sprintId)                                 │
│    ├─ getSprintIssuesPaginated(sprintId, page, perPage)          │
│    └─ getVelocityData(boardId, 15)                               │
│                                                                   │
│ 2. Comprehensive Report (current sprint):                        │
│    └─ getComprehensiveSprintReport(sprintId, options)            │
│                                                                   │
│ 3. Previous Sprint Comprehensive (for comparison):               │
│    └─ getComprehensiveSprintReport(previousSprintId, options)    │
│                                                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ API CLIENT: api.ts                                               │
│ Makes HTTP requests to Express API server                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: Express API Server (api-server.ts)                      │
│                                                                   │
│ Routes traffic to appropriate route handlers:                    │
│ ├─ /api/sprints          → sprint.routes.ts                      │
│ ├─ /api/sprints/:id/*    → sprint.routes.ts                      │
│ └─ /api/velocity/:id     → velocity.routes.ts                    │
│                                                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ ROUTES: sprint.routes.ts, velocity.routes.ts                     │
│                                                                   │
│ Each route:                                                       │
│ 1. Checks Redis cache (CacheManager)                             │
│ 2. If cache miss, calls MCP tool via callMCPTool()               │
│ 3. Caches result with dynamic TTL                                │
│ 4. Returns JSON response                                         │
│                                                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ MCP LAYER: callMCPTool() → tool-registry.ts                      │
│                                                                   │
│ MCP Tools invoked:                                                │
│ ├─ jira_get_sprints       → JiraTools.getSprints()               │
│ ├─ get_sprint_metrics     → OptimizedMetricsHandler              │
│ ├─ jira_get_sprint_issues → JiraTools.getSprintIssues()          │
│ ├─ get_velocity_data      → ReportTools.getVelocityData()        │
│ └─ generate_sprint_report → ReportTools.generateSprintReport()   │
│                                                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ SERVICES: sprint-service.ts, jira-client.ts, github clients      │
│                                                                   │
│ Key Service Methods:                                              │
│                                                                   │
│ SprintService.generateSprintReport() ⭐ MAIN ORCHESTRATOR         │
│     │                                                             │
│     ├─ getSprintDetails(sprintId)                                │
│     │   └─ JiraClient.getSprintData()                            │
│     │       └─ Jira REST API: GET /sprint/{id}                   │
│     │                                                             │
│     ├─ calculateSprintMetrics(sprint)                            │
│     │   └─ Local calculation from sprint.issues                  │
│     │                                                             │
│     ├─ getSprintCommits(owner, repo, dates)                      │
│     │   └─ GitHubClient.getCommits()                             │
│     │       └─ GitHub REST: GET /repos/{owner}/{repo}/commits    │
│     │                                                             │
│     ├─ getSprintPullRequests(owner, repo, dates) 🎯 GRAPHQL      │
│     │   └─ if (githubGraphQLClient exists):                      │
│     │       ├─ GitHubGraphQLClient.searchPullRequestsByDateRange()│
│     │       │   └─ GitHub GraphQL v4 API                         │
│     │       │       Query: repo:sage/connect is:pr created:...   │
│     │       │       Pagination: 100 PRs/page, up to 1000 total   │
│     │       │                                                     │
│     │       └─ else (fallback):                                  │
│     │           └─ GitHubClient.searchPullRequestsByDateRange()  │
│     │               └─ GitHub REST: GET /search/issues           │
│     │                                                             │
│     ├─ getVelocityData(boardId, sprintCount)                     │
│     │   └─ JiraClient.getSprints() + calculateSprintMetrics()    │
│     │                                                             │
│     ├─ getBurndownData(sprintId)                                 │
│     │   └─ Calculated from sprint data                           │
│     │                                                             │
│     └─ AnalyticsService (if tier flags enabled)                  │
│         ├─ analyzeSprintGoal()                                   │
│         ├─ detectScopeChanges()                                  │
│         ├─ analyzeSpillover()                                    │
│         ├─ extractBlockers()                                     │
│         ├─ calculateBugMetrics()                                 │
│         └─ ... (more tier analytics)                             │
│                                                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ EXTERNAL APIs                                                     │
│                                                                   │
│ 1. Jira REST API v3 (api.atlassian.com)                          │
│    ├─ GET /rest/agile/1.0/board/{id}/sprint                      │
│    ├─ GET /rest/agile/1.0/sprint/{id}                            │
│    └─ GET /rest/agile/1.0/sprint/{id}/issue                      │
│                                                                   │
│ 2. GitHub GraphQL API v4 ⭐ NEW (api.github.com/graphql)          │
│    └─ POST /graphql                                              │
│        Body: { query: "search(...)" }                            │
│        Features:                                                  │
│        - Native date filtering: created:2025-08-06..2025-08-20   │
│        - 100 PRs per page (vs REST's 30)                         │
│        - Single query returns all needed fields                  │
│        - Cursor-based pagination (up to 1000 results)            │
│                                                                   │
│ 3. GitHub REST API v3 (Fallback) (api.github.com)                │
│    ├─ GET /repos/{owner}/{repo}/commits                          │
│    └─ GET /search/issues?q=repo:... is:pr created:...            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         SPRINT DETAILS PAGE                           │
│                                                                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │ Executive       │  │ Sprint vs        │  │ Main Content       │  │
│  │ Summary Cards   │  │ Previous         │  │ Tabs               │  │
│  │                 │  │ Comparison       │  │                    │  │
│  │ • Completion    │  │                  │  │ • Deliverables     │  │
│  │ • Velocity      │  │ • Velocity Δ     │  │ • Commits          │  │
│  │ • Story Points  │  │ • Commitment Δ   │  │ • Metrics          │  │
│  │ • In Progress   │  │ • Merged PRs Δ   │  │                    │  │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬───────────┘  │
│           │                    │                      │              │
└───────────┼────────────────────┼──────────────────────┼──────────────┘
            │                    │                      │
            └────────────────────┴──────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  useSprintDetails Hook  │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
    ┌────▼─────┐          ┌─────▼──────┐         ┌─────▼──────┐
    │ Query #1 │          │ Query #2   │         │ Query #3   │
    │ Core Data│          │ Current    │         │ Previous   │
    │ (4 APIs) │          │ Report     │         │ Report     │
    └────┬─────┘          └─────┬──────┘         └─────┬──────┘
         │                      │                       │
    ┌────┴──────┐               │                       │
    │           │               │                       │
 ┌──▼───┐  ┌───▼────┐      ┌───▼──────┐           ┌────▼──────┐
 │Sprint│  │Metrics │      │Comprehen-│           │Comprehen- │
 │List  │  │        │      │sive      │           │sive       │
 └──┬───┘  └───┬────┘      │Report    │           │Report     │
    │          │           │(current) │           │(previous) │
 ┌──▼───┐  ┌───▼────┐      └───┬──────┘           └────┬──────┘
 │Issues│  │Velocity│          │                       │
 │      │  │Data    │          │                       │
 └──────┘  └────────┘          │                       │
                               │                       │
      ┌────────────────────────┴───────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│                  BACKEND API ENDPOINTS                       │
│                                                              │
│  /api/sprints?board_id=6306&state=all                       │
│  /api/sprints/43577/metrics                                 │
│  /api/sprints/43577/issues?page=1&per_page=20               │
│  /api/velocity/6306?sprints=15                              │
│  /api/sprints/43577/comprehensive?github_owner=Sage&...     │
│  /api/sprints/{prev}/comprehensive?github_owner=Sage&...    │
│                                                              │
└────────────────────────┬─────────────────────────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
┌───▼────┐       ┌───────▼──────┐     ┌──────▼─────┐
│ Jira   │       │ GitHub       │     │ GitHub     │
│ API v3 │       │ GraphQL v4   │     │ REST API   │
│        │       │ ⭐ PRIMARY    │     │ (Fallback) │
└────────┘       └──────────────┘     └────────────┘
```

---

## Summary

### API Endpoints Used by Sprint Details Page

| Endpoint | Purpose | MCP Tool | Backend Service | External API |
|----------|---------|----------|-----------------|--------------|
| `GET /api/sprints` | Get all sprints | `jira_get_sprints` | JiraClient.getSprints() | Jira REST v3 |
| `GET /api/sprints/:id/metrics` | Sprint metrics | `get_sprint_metrics` | SprintService.calculateSprintMetrics() | Jira REST v3 |
| `GET /api/sprints/:id/issues` | Paginated issues | `jira_get_sprint_issues` | JiraClient.getSprintIssues() | Jira REST v3 |
| `GET /api/velocity/:boardId` | Velocity trends | `get_velocity_data` | SprintService.getVelocityData() | Jira REST v3 |
| `GET /api/sprints/:id/comprehensive` | **Full report** | `generate_sprint_report` | **SprintService.generateSprintReport()** | **GitHub GraphQL v4** ⭐ |

### Key Backend Functions

1. **SprintService.generateSprintReport()** - Main orchestrator
2. **GitHubGraphQLClient.searchPullRequestsByDateRange()** - GraphQL PR fetching ⭐ NEW
3. **AnalyticsService (various methods)** - Tier 1-3 analytics
4. **JiraClient.getSprints/getSprintIssues()** - Jira data fetching
5. **GitHubClient.getCommits()** - Commit fetching

### Performance Characteristics

- **Parallel Execution**: 4 React Query calls run simultaneously
- **Caching**: Redis with dynamic TTL (3-30 minutes based on sprint state)
- **Background Refresh**: Popular sprints auto-refresh in background
- **GraphQL Optimization**: 86 PRs fetched in 1.2s (single query vs 3+ REST pages)
- **Server-side Pagination**: Issues cached fully, paginated in memory

---

## Configuration

Sprint Details page reads configuration from **ConfigurationContext**:

```typescript
const { config } = useConfiguration();

// Used in API calls:
- config.jira.boardId      // Default: "6306" (SCNT Board)
- config.github.owner      // Default: "Sage"
- config.github.repo       // Default: "sage-connect"
```

Configuration is stored in browser localStorage and synced across components.

---

## Related Documentation

- [GitHub GraphQL Integration](./GITHUB_GRAPHQL_INTEGRATION.md) - Details on GraphQL v4 implementation
- [API Documentation](./api-documentation.md) - Complete API reference
- [Cache Management](./CACHE_MANAGEMENT.md) - Caching strategy details
- [Performance Improvements](./PERFORMANCE_IMPROVEMENTS_OCT2025.md) - Optimization details

---

*Last Updated: October 14, 2025*
*Version: 2.2.0*
