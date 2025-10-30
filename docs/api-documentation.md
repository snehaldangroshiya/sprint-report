# NextReleaseMCP API Documentation

## Overview

The NextReleaseMCP API provides comprehensive sprint reporting and analytics capabilities with Jira and GitHub integration. This RESTful API enables automated generation of sprint reports, advanced analytics across three tiers of metrics, and performance monitoring.

**Version**: 2.2.0 (October 4, 2025)
**Status**: Production Ready

## Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.com/api`

## Authentication

Currently, the API uses rate limiting for access control. Authentication via API keys is not implemented but can be added for production deployments.

## Rate Limiting

- **Limit**: 100 requests per 15-minute window per IP address
- **Headers**: Rate limit information is included in response headers
- **Error Response**: 429 status code when limit exceeded
- **Retry-After**: Header indicates when to retry (in seconds)

## Security Features

- **Input Validation**: All endpoints validate input using Joi schemas
- **Request Sanitization**: SQL injection and XSS protection
- **Security Headers**: CSP, X-Content-Type-Options, X-Frame-Options, HSTS
- **CORS Configuration**: Configurable origins (development allows localhost:3000-3002, 5173)
- **Request Size Limits**: 10MB maximum request size
- **Helmet Middleware**: Comprehensive security headers via Helmet.js
- **Compression**: Gzip compression for response optimization

## Core Endpoints

### Health Check

#### GET /api/health

Returns system health status and service availability with response times.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-10-04T10:28:32.346Z",
  "uptime": 13482,
  "version": "2.2.0",
  "checks": [
    { "name": "jira", "status": "healthy", "responseTime": 556 },
    { "name": "github", "status": "healthy", "responseTime": 457 },
    { "name": "cache", "status": "healthy", "responseTime": 3 }
  ]
}
```

**Status Codes:**

- `200 OK`: System is healthy
- `503 Service Unavailable`: One or more services are unhealthy

### Server Information

#### GET /api/info

Returns server configuration and version information.

**Response:**

```json
{
  "name": "NextReleaseMCP API",
  "version": "2.2.0",
  "environment": "development",
  "uptime": 13482,
  "node_version": "v20.x.x"
}
```

### Performance Metrics

#### GET /api/metrics

Returns performance metrics, cache statistics, and optimization recommendations.

**Response:**

```json
{
  "cache": {
    "hits": 8542,
    "misses": 1215,
    "hitRate": 87.5,
    "size": 245,
    "memoryUsage": "45.2 MB"
  },
  "requests": {
    "total": 15230,
    "perMinute": 25.4,
    "averageResponseTime": 145
  },
  "recommendations": ["Cache hit rate is excellent (>85%)", "Consider Redis clustering for scale"]
}
```

### System Status

#### GET /api/system-status

Returns detailed system status including all service health checks and performance indicators.

**Response:**

```json
{
  "status": "healthy",
  "services": {
    "jira": { "status": "healthy", "responseTime": 556, "lastCheck": "2025-10-04T10:28:32Z" },
    "github": { "status": "healthy", "responseTime": 457, "lastCheck": "2025-10-04T10:28:32Z" },
    "cache": { "status": "healthy", "responseTime": 3, "lastCheck": "2025-10-04T10:28:32Z" }
  },
  "performance": {
    "uptime": 13482,
    "memoryUsage": 125.5,
    "cpuUsage": 12.3
  }
}
```

## Sprint Management

### Get Boards

#### GET /api/boards

Retrieve all available Jira boards accessible with current credentials.

**Response:**

```json
[
  {
    "id": 6306,
    "name": "Sage Connect",
    "type": "scrum",
    "location": {
      "projectId": 12345,
      "projectName": "Sage Connect Project"
    }
  }
]
```

### Get Sprints

#### GET /api/sprints

Retrieve sprints for a specific board, filtered by state.

**Query Parameters:**

- `board_id` (required): Jira board ID (e.g., 6306)
- `state` (optional): `active`, `future`, `closed` (default: `active`)
- `max_results` (optional): Maximum number of sprints to return

**Example Request:**

```bash
GET /api/sprints?board_id=6306&state=active
```

**Response:**

```json
[
  {
    "id": "44298",
    "name": "SCNT-2025-26",
    "state": "active",
    "startDate": "2025-09-17T06:51:00.000Z",
    "endDate": "2025-10-01T06:51:00.000Z",
    "boardId": 6306,
    "goal": "Complete authentication and messaging features"
  }
]
```

### Get Sprint Issues

#### GET /api/sprints/:id/issues

Get all issues for a specific sprint with full metadata.

**Path Parameters:**

- `id` (required): Sprint ID

**Query Parameters:**

- `max_results` (optional): Number of issues to return (default: 100)
- `fields` (optional): Comma-separated list of fields to include
- `include_changelog` (optional): Include issue history (`true`/`false`)

**Example Request:**

```bash
GET /api/sprints/44298/issues?max_results=50
```

**Response:**

```json
[
  {
    "id": "5585838",
    "key": "SCNT-5305",
    "summary": "Remove Toast Confirmation: Adding or Editing Notes",
    "status": "Done",
    "assignee": "Rajesh Kumar",
    "storyPoints": 1,
    "priority": "Minor",
    "issueType": "Task",
    "created": "2025-09-15T20:00:44.000+0000",
    "updated": "2025-09-26T13:35:27.000+0000",
    "resolved": "2025-09-26T13:35:27.000+0000",
    "labels": ["A11Y"],
    "components": ["Message Squad"],
    "description": "Remove confirmation toast when adding or editing notes",
    "reporter": "Product Manager"
  }
]
```

### Get Sprint Metrics

#### GET /api/sprints/:id/metrics

Get basic sprint metrics and statistics (velocity, completion rate, issue breakdown).

**Path Parameters:**

- `id` (required): Sprint ID

**Query Parameters:**

- `include_velocity` (optional): Include historical velocity data
- `include_burndown` (optional): Include burndown chart data

**Example Request:**

```bash
GET /api/sprints/44298/metrics
```

**Response:**

```json
{
  "sprintId": "44298",
  "sprintName": "SCNT-2025-26",
  "metrics": {
    "totalIssues": 121,
    "completedIssues": 93,
    "completionRate": 76.86,
    "totalStoryPoints": 207,
    "completedStoryPoints": 147,
    "velocity": 147,
    "velocityPercentage": 71.01,
    "byStatus": {
      "Done": 93,
      "Testing": 12,
      "Building": 8,
      "To Do": 8
    },
    "byType": {
      "Task": 65,
      "Story": 28,
      "Bug": 18,
      "Sub-task": 10
    },
    "byPriority": {
      "Minor": 75,
      "Major": 32,
      "Blocker": 8,
      "Trivial": 6
    }
  }
}
```

### Get Comprehensive Sprint Analytics (NEW in v2.2.0) ⭐

#### GET /api/sprints/:id/comprehensive

Get comprehensive sprint analytics with Tier 1, 2, 3 metrics including next sprint forecasting, GitHub activity, team performance, and technical health monitoring.

**Path Parameters:**

- `id` (required): Sprint ID

**Query Parameters:**

- `github_owner` (optional): GitHub organization/owner name
- `github_repo` (optional): GitHub repository name
- `include_tier1` (optional): Include Tier 1 metrics (default: `true`)
- `include_tier2` (optional): Include Tier 2 metrics (default: `true`)
- `include_tier3` (optional): Include Tier 3 metrics (default: `true`)
- `include_forward_looking` (optional): Include next sprint forecast (default: `true`)
- `include_enhanced_github` (optional): Include enhanced GitHub metrics (default: `true`)

**Example Request:**

```bash
GET /api/sprints/44298/comprehensive?github_owner=my-org&github_repo=my-repo
```

**Response Structure:**

```json
{
  "sprint": {
    "id": "44298",
    "name": "SCNT-2025-26",
    "state": "closed",
    "startDate": "2025-09-17T06:51:00.000Z",
    "endDate": "2025-10-01T06:51:00.000Z",
    "boardId": 6306
  },
  "summary": {
    "totalIssues": 121,
    "completedIssues": 93,
    "completionRate": 76.86,
    "totalStoryPoints": 207,
    "completedStoryPoints": 147,
    "velocity": 147,
    "velocityPercentage": 71.01
  },
  "tier1": {
    "nextSprintForecast": {
      "forecastedVelocity": 152,
      "confidenceLevel": "high",
      "availableCapacity": 140,
      "carryoverPoints": 12,
      "recommendations": [
        "Plan for 140 story points (152 velocity - 12 carryover)",
        "Focus on completing carried over items first"
      ]
    },
    "carryoverItems": {
      "totalItems": 8,
      "totalPoints": 12,
      "items": [...],
      "mostCommonReasons": ["complexity", "dependencies"],
      "recommendations": ["Break down complex items into smaller tasks"]
    },
    "commitActivity": {
      "totalCommits": 187,
      "uniqueAuthors": 12,
      "commitsPerDay": 13.4,
      "peakDay": "2025-09-25",
      "peakDayCommits": 28,
      "commitsByAuthor": {...}
    },
    "pullRequestStats": {
      "totalPRs": 42,
      "merged": 38,
      "open": 2,
      "closed": 2,
      "mergeRate": 90.48,
      "averageTimeToMerge": "18.5 hours",
      "prsByAuthor": {...}
    },
    "codeChanges": {
      "linesAdded": 8542,
      "linesDeleted": 3215,
      "netChange": 5327,
      "filesChanged": 234,
      "changesByAuthor": {...}
    },
    "prToIssueTraceability": {
      "prsWithIssues": 36,
      "totalPRs": 42,
      "traceabilityRate": 85.71,
      "issuesCovered": 45
    }
  },
  "tier2": {
    "teamCapacity": {
      "totalPlannedPoints": 207,
      "actualCompletedPoints": 147,
      "utilizationRate": 71.01,
      "teamMembers": 12,
      "avgPointsPerMember": 12.25
    },
    "blockersAndDependencies": {
      "totalBlockers": 5,
      "activeBlockers": 2,
      "resolvedBlockers": 3,
      "blockers": [...]
    },
    "bugMetrics": {
      "bugsCreated": 18,
      "bugsResolved": 15,
      "netBugChange": 3,
      "bugResolutionRate": 83.33,
      "avgResolutionTime": "2.3 days"
    },
    "cycleTimeMetrics": {
      "averageCycleTime": "4.2 days",
      "medianCycleTime": "3.5 days",
      "p90CycleTime": "8.1 days",
      "byIssueType": {...}
    }
  },
  "tier3": {
    "epicProgress": [...],
    "technicalDebt": {
      "totalDebtItems": 12,
      "newDebt": 3,
      "resolvedDebt": 5,
      "netChange": -2,
      "debtByCategory": {...}
    },
    "riskItems": [...]
  }
}
```

**Tier Breakdown:**

- **Tier 1 (Must Have)**: Forward-looking metrics and code activity
  - Next sprint forecasting with velocity prediction
  - Carryover analysis with recommendations
  - Commit activity and frequency tracking
  - Pull request statistics and merge rates
  - Code changes (lines added/deleted)
  - PR-to-Issue traceability mapping

- **Tier 2 (Should Have)**: Team performance and quality metrics
  - Team capacity utilization analysis
  - Blockers and dependencies tracking
  - Bug metrics (created vs resolved)
  - Cycle time analysis (average, median, p90)

- **Tier 3 (Nice to Have)**: Long-term health and strategic metrics
  - Epic progress tracking
  - Technical debt monitoring
  - Risk items assessment

## GitHub Integration

### Get Commits

#### GET /api/github/repos/:owner/:repo/commits

Retrieve commits from a GitHub repository within a date range.

**Path Parameters:**

- `owner` (required): GitHub organization/username
- `repo` (required): Repository name

**Query Parameters:**

- `since` (optional): ISO date string for start date
- `until` (optional): ISO date string for end date
- `author` (optional): Filter by author username
- `per_page` (optional): Results per page (1-100, default: 30)
- `page` (optional): Page number (1-1000, default: 1)

**Example Request:**

```bash
GET /api/github/repos/my-org/my-repo/commits?since=2025-09-17&until=2025-10-01
```

**Response:**

```json
[
  {
    "sha": "abc123def456",
    "message": "Fix authentication timeout issue",
    "author": {
      "name": "John Doe",
      "email": "john.doe@company.com",
      "date": "2025-09-25T14:30:00Z"
    },
    "committer": {
      "name": "John Doe",
      "email": "john.doe@company.com",
      "date": "2025-09-25T14:30:00Z"
    },
    "url": "https://github.com/my-org/my-repo/commit/abc123def456",
    "stats": {
      "additions": 45,
      "deletions": 12,
      "total": 57
    }
  }
]
```

### Get Pull Requests

#### GET /api/github/repos/:owner/:repo/pulls

Retrieve pull requests from a repository with optional state filtering.

**Path Parameters:**

- `owner` (required): GitHub organization/username
- `repo` (required): Repository name

**Query Parameters:**

- `state` (optional): `open`, `closed`, `all` (default: `all`)
- `per_page` (optional): Results per page (1-100, default: 30)
- `page` (optional): Page number (default: 1)

**Example Request:**

```bash
GET /api/github/repos/my-org/my-repo/pulls?state=closed
```

**Response:**

```json
[
  {
    "number": 42,
    "title": "Add user authentication module",
    "state": "closed",
    "author": "jane.doe",
    "created_at": "2025-09-20T09:00:00Z",
    "updated_at": "2025-09-25T15:30:00Z",
    "merged_at": "2025-09-25T15:30:00Z",
    "url": "https://github.com/my-org/my-repo/pull/42",
    "reviews": 3,
    "comments": 8,
    "additions": 245,
    "deletions": 87,
    "changed_files": 12
  }
]
```

### Get Commits with Jira Mapping

#### GET /api/github/:owner/:repo/commits/jira

Get commits with Jira issue key extraction from commit messages.

**Path Parameters:**

- `owner` (required): GitHub organization/username
- `repo` (required): Repository name

**Query Parameters:**

- `since` (optional): ISO date string for start date
- `until` (optional): ISO date string for end date

**Response:**

```json
[
  {
    "sha": "abc123def456",
    "message": "SCNT-5305: Fix authentication timeout",
    "author": "john.doe",
    "date": "2025-09-25T14:30:00Z",
    "jiraIssues": ["SCNT-5305"],
    "stats": {
      "additions": 45,
      "deletions": 12
    }
  }
]
```

## Analytics Endpoints

### Get Commit Trends

#### GET /api/analytics/commit-trends/:owner/:repo

Analyze commit activity trends over time with aggregated statistics.

**Path Parameters:**

- `owner` (required): GitHub organization/username
- `repo` (required): Repository name

**Query Parameters:**

- `period` (optional): `1month`, `3months`, `6months`, `1year` (default: `6months`)

**Response:**

```json
{
  "period": "6months",
  "trends": [
    {
      "month": "2025-04",
      "commits": 187,
      "authors": 12,
      "prs": 42,
      "linesAdded": 8542,
      "linesDeleted": 3215
    }
  ],
  "summary": {
    "totalCommits": 1124,
    "avgCommitsPerMonth": 187,
    "totalAuthors": 15,
    "trend": "increasing"
  }
}
```

### Get Team Performance

#### GET /api/analytics/team-performance/:boardId

Analyze team performance metrics across multiple sprints.

**Path Parameters:**

- `boardId` (required): Jira board ID

**Query Parameters:**

- `sprints` (optional): Number of sprints to analyze (default: 10)

**Response:**

```json
{
  "boardId": "6306",
  "sprintsAnalyzed": 10,
  "performance": [
    {
      "sprintId": "44298",
      "sprintName": "SCNT-2025-26",
      "planned": 207,
      "completed": 147,
      "velocity": 147,
      "completionRate": 71.01
    }
  ],
  "averages": {
    "velocity": 152.3,
    "completionRate": 75.8
  },
  "trend": "stable"
}
```

### Get Issue Type Distribution

#### GET /api/analytics/issue-types/:boardId

Get distribution of issue types across sprints.

**Path Parameters:**

- `boardId` (required): Jira board ID

**Query Parameters:**

- `sprints` (optional): Number of sprints to analyze (default: 5)

**Response:**

```json
{
  "boardId": "6306",
  "distribution": {
    "Task": 325,
    "Story": 140,
    "Bug": 90,
    "Sub-task": 50
  },
  "percentages": {
    "Task": 53.7,
    "Story": 23.1,
    "Bug": 14.9,
    "Sub-task": 8.3
  }
}
```

## Report Generation

### Generate Sprint Report

#### POST /api/reports/sprint

Generate a comprehensive sprint report in various formats.

**Request Body:**

```json
{
  "sprint_id": "44298",
  "github_owner": "my-org",
  "github_repo": "my-repo",
  "format": "html",
  "include_commits": true,
  "include_prs": true,
  "include_velocity": true,
  "include_burndown": true,
  "theme": "default"
}
```

**Validation:**

- `sprint_id`: Required, 1-50 characters
- `github_owner`: Optional, 1-100 characters
- `github_repo`: Optional, 1-100 characters
- `format`: Required, one of: `html`, `markdown`, `json`
- `theme`: Optional, one of: `default`, `dark`, `corporate`

**Response:**

Returns the generated report in the requested format with appropriate Content-Type header.

### Export Sprint Report to PDF

#### POST /api/export/sprint-report/pdf

Generate a PDF version of a sprint report.

**Request Body:**

```json
{
  "reportData": {
    "sprint": {
      "id": "44298",
      "name": "SCNT-2025-26"
    },
    "metrics": {
      "totalIssues": 121,
      "completedIssues": 93,
      "velocity": 147,
      "completionRate": 76.86
    },
    "issues": [...],
    "commits": [...]
  },
  "options": {
    "format": "A4",
    "orientation": "portrait"
  }
}
```

**Response:**

- Content-Type: `application/pdf`
- Binary PDF content

### Export Analytics to PDF

#### POST /api/export/analytics/pdf

Generate a PDF version of analytics data.

**Request Body:**

```json
{
  "analyticsData": {
    "averageVelocity": 152.3,
    "sprintsAnalyzed": 10,
    "completionRate": 75.8,
    "velocityTrend": "stable",
    "sprintComparison": [...]
  },
  "options": {
    "format": "A4",
    "orientation": "landscape"
  }
}
```

**Response:**

- Content-Type: `application/pdf`
- Binary PDF content

## Velocity Tracking

### Get Velocity Data

#### GET /api/velocity/:boardId

Calculate historical velocity data for a board.

**Path Parameters:**

- `boardId` (required): Jira board ID

**Query Parameters:**

- `sprints` (optional): Number of sprints to analyze (default: 5)

**Response:**

```json
{
  "boardId": "6306",
  "sprints": [
    {
      "id": "44298",
      "name": "SCNT-2025-26",
      "velocity": 147,
      "commitment": 207,
      "completed": 147,
      "completionRate": 71.01
    }
  ],
  "statistics": {
    "average": 152.3,
    "median": 150,
    "min": 120,
    "max": 180,
    "trend": "stable"
  }
}
```

## Cache Management

### Get Cache Statistics

#### GET /api/cache/stats

Returns cache performance statistics and memory usage.

**Response:**

```json
{
  "memory": {
    "hits": 8542,
    "misses": 1215,
    "hitRate": 87.5,
    "size": 245,
    "memoryUsage": "45.2 MB"
  },
  "redis": {
    "connected": true,
    "hits": 15230,
    "misses": 2340,
    "hitRate": 86.7
  },
  "recommendations": ["Cache hit rate is excellent (>85%)", "Memory usage is within healthy limits"]
}
```

### Warm Cache

#### POST /api/cache/warm

Pre-warm cache with frequently accessed data for active sprints.

**Response:**

```json
{
  "success": true,
  "itemsWarmed": 45,
  "duration": 2345
}
```

### Warm Sprint Cache

#### POST /api/cache/warm-sprint/:id

Pre-warm cache for a specific sprint.

**Path Parameters:**

- `id` (required): Sprint ID

**Response:**

```json
{
  "success": true,
  "sprintId": "44298",
  "itemsWarmed": 12,
  "duration": 856
}
```

### Optimize Cache

#### POST /api/cache/optimize

Trigger cache optimization and cleanup of stale entries.

**Response:**

```json
{
  "success": true,
  "itemsRemoved": 34,
  "memoryFreed": "12.3 MB",
  "duration": 456
}
```

## MCP Tools

### List MCP Tools

#### GET /api/mcp/tools

List all available MCP tools registered in the system.

**Response:**

```json
{
  "tools": [
    {
      "name": "get_sprint_report",
      "description": "Generate comprehensive sprint report",
      "inputSchema": {...}
    },
    {
      "name": "list_sprints",
      "description": "List sprints for a board",
      "inputSchema": {...}
    }
  ]
}
```

### Clear MCP Cache

#### POST /api/mcp/cache/clear

Clear all MCP tool caches.

**Response:**

```json
{
  "success": true,
  "itemsCleared": 156
}
```

### Refresh MCP Tools

#### POST /api/mcp/tools/refresh

Refresh MCP tool registry and reload configurations.

**Response:**

```json
{
  "success": true,
  "toolsLoaded": 12
}
```

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": "ValidationError",
  "message": "Invalid request parameters",
  "details": {
    "field": "sprint_id",
    "message": "sprint_id is required",
    "value": null
  },
  "timestamp": "2025-10-04T10:30:00Z",
  "path": "/api/sprints/comprehensive"
}
```

### HTTP Status Codes

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request parameters or validation errors
- **404 Not Found**: Requested resource not found
- **413 Payload Too Large**: Request body exceeds 10MB limit
- **422 Unprocessable Entity**: Semantic validation errors
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Unexpected server error
- **503 Service Unavailable**: Service temporarily unavailable

### Common Error Scenarios

#### Validation Error (400)

```json
{
  "error": "ValidationError",
  "message": "Validation failed",
  "details": [
    {
      "field": "board_id",
      "message": "board_id is required",
      "type": "required"
    }
  ]
}
```

#### Not Found (404)

```json
{
  "error": "NotFoundError",
  "message": "Sprint with ID 44298 not found"
}
```

#### Rate Limit Exceeded (429)

```json
{
  "error": "RateLimitError",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 900,
  "limit": 100,
  "remaining": 0
}
```

#### Server Error (500)

```json
{
  "error": "InternalServerError",
  "message": "An unexpected error occurred",
  "requestId": "abc-123-def-456"
}
```

## SDK Examples

### cURL Examples

#### Get Health Status

```bash
curl http://localhost:3000/api/health | jq '.'
```

#### Get Comprehensive Analytics

```bash
curl "http://localhost:3000/api/sprints/44298/comprehensive?github_owner=my-org&github_repo=my-repo" | jq '.'
```

#### Generate Sprint Report

```bash
curl -X POST http://localhost:3000/api/reports/sprint \
  -H "Content-Type: application/json" \
  -d '{
    "sprint_id": "44298",
    "format": "html",
    "include_commits": true,
    "include_prs": true,
    "include_velocity": true,
    "include_burndown": true,
    "theme": "default"
  }'
```

### JavaScript/TypeScript

```typescript
// Get comprehensive analytics
const response = await fetch(
  'http://localhost:3000/api/sprints/44298/comprehensive?github_owner=my-org&github_repo=my-repo'
);
const analytics = await response.json();

// Access Tier 1 metrics
console.log('Next sprint forecast:', analytics.tier1.nextSprintForecast);
console.log('Commit activity:', analytics.tier1.commitActivity);

// Access Tier 2 metrics
console.log('Team capacity:', analytics.tier2.teamCapacity);
console.log('Bug metrics:', analytics.tier2.bugMetrics);

// Access Tier 3 metrics
console.log('Technical debt:', analytics.tier3.technicalDebt);
console.log('Epic progress:', analytics.tier3.epicProgress);
```

### Python

```python
import requests

API_URL = "http://localhost:3000/api"

# Get comprehensive analytics
response = requests.get(
    f"{API_URL}/sprints/44298/comprehensive",
    params={
        "github_owner": "my-org",
        "github_repo": "my-repo",
        "include_tier1": True,
        "include_tier2": True,
        "include_tier3": True
    }
)

analytics = response.json()

# Access metrics
print(f"Next sprint forecast: {analytics['tier1']['nextSprintForecast']['forecastedVelocity']} points")
print(f"Commit activity: {analytics['tier1']['commitActivity']['totalCommits']} commits")
print(f"Team capacity: {analytics['tier2']['teamCapacity']['utilizationRate']}%")
print(f"Technical debt: {analytics['tier3']['technicalDebt']['netChange']}")
```

### Axios (Node.js)

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function getSprintAnalytics(sprintId) {
  try {
    const { data } = await axios.get(`${API_URL}/sprints/${sprintId}/comprehensive`, {
      params: {
        github_owner: 'my-org',
        github_repo: 'my-repo',
        include_tier1: true,
        include_tier2: true,
        include_tier3: true,
      },
    });

    console.log(`Sprint: ${data.sprint.name}`);
    console.log(`Completion: ${data.summary.completionRate}%`);
    console.log(`Velocity: ${data.summary.velocity} points`);

    return data;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
}

getSprintAnalytics('44298');
```

## Performance Considerations

### Caching Strategy

- **Memory Cache**: In-memory caching for frequently accessed data (TTL: 5 minutes)
- **Redis Cache**: Distributed caching for larger datasets (TTL: 30 minutes)
- **Cache Warming**: Pre-warm cache for active sprints on server start
- **Cache Invalidation**: Automatic invalidation on data updates via webhooks

### Rate Limiting

- **Window**: 15 minutes rolling window
- **Limit**: 100 requests per IP address
- **Burst**: No burst allowance (steady rate limiting)
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Request Optimization

- **Compression**: Gzip compression for responses >1KB
- **Pagination**: Use `per_page` and `page` parameters for large datasets
- **Parallel Requests**: No server-side limits on parallel requests
- **Timeouts**: API calls timeout after 30 seconds
- **Connection Pooling**: HTTP keep-alive enabled for connection reuse

### Best Practices

1. **Use Comprehensive Endpoint**: Prefer `/comprehensive` over multiple separate requests
2. **Enable Caching**: Implement client-side caching for static data
3. **Batch Operations**: Group related requests when possible
4. **Handle Rate Limits**: Implement exponential backoff for 429 responses
5. **Monitor Health**: Use `/health` endpoint for service monitoring
6. **Optimize Queries**: Use query parameters to filter data server-side

## Monitoring and Observability

### Health Checks

- **Endpoint**: `/api/health`
- **Frequency**: Check every 30 seconds for production monitoring
- **Thresholds**:
  - Response time <500ms: Healthy
  - Response time 500-1000ms: Degraded
  - Response time >1000ms: Unhealthy

### Metrics Collection

- **Endpoint**: `/api/metrics`
- **Metrics Available**:
  - Cache hit/miss rates
  - Request rates and response times
  - Memory and CPU usage
  - Service availability

### Logging

- **Format**: Structured JSON logging
- **Levels**: ERROR, WARN, INFO, DEBUG
- **Fields**: timestamp, level, message, context, requestId
- **Storage**: Console (development), File rotation (production)

## Support and Resources

### Documentation

- **API Documentation**: This document
- **Quick Start**: See [API_WORKING_EXAMPLES.md](./API_WORKING_EXAMPLES.md)
- **Architecture**: See [CLAUDE.md](../.claude/CLAUDE.md)
- **Troubleshooting**: See [CLAUDE_TROUBLESHOOTING.md](../.claude/CLAUDE_TROUBLESHOOTING.md)

### Getting Help

- **GitHub Issues**: Report bugs and feature requests
- **Health Check**: Use `/api/health` for service status
- **System Status**: Use `/api/system-status` for detailed diagnostics

### Version History

- **v2.2.0** (October 4, 2025): Comprehensive analytics with Tier 1, 2, 3 metrics
- **v2.1.1** (October 3, 2025): Sprint sorting improvements and analytics enhancements
- **v2.1.0** (October 2, 2025): Web UI and Redis optimization
- **v2.0.0**: Full web integration with REST API

---

**Last Updated**: October 30, 2025
**API Version**: 2.2.0
**Status**: ✅ Production Ready
