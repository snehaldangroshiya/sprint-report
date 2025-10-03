# NextReleaseMCP API Documentation

## Overview

The NextReleaseMCP API provides comprehensive sprint reporting capabilities with Jira and GitHub integration. This RESTful API enables automated generation of sprint reports, analytics, and performance metrics.

## Base URL

- **Development**: `http://localhost:8080/api`
- **Production**: `https://your-domain.com/api`

## Authentication

Currently, the API uses rate limiting and optional API key authentication for external integrations.

### API Key Authentication (Optional)

For external integrations, include the API key in the request header:

```
X-API-Key: your-api-key-here
```

## Rate Limiting

- **Limit**: 100 requests per 15-minute window per IP
- **Headers**: Rate limit information is included in response headers
- **Error Response**: 429 status code when limit exceeded

## Security Features

- **Input Validation**: All endpoints validate input using Joi schemas
- **Request Sanitization**: SQL injection and XSS protection
- **Security Headers**: CSP, X-Content-Type-Options, X-Frame-Options
- **CORS Configuration**: Restricted origins for production
- **Request Size Limits**: 10MB maximum request size

## Core Endpoints

### Health Check

#### GET /health

Returns system health status and service availability.

**Response:**
```json
{
  "status": "healthy|degraded|unhealthy",
  "uptime": 3600000,
  "services": {
    "jira": {
      "healthy": true,
      "latency": 150
    },
    "github": {
      "healthy": true,
      "latency": 200
    }
  }
}
```

### Performance Metrics

#### GET /metrics

Returns performance metrics and optimization recommendations.

**Response:**
```json
{
  "summary": {
    "cacheHitRate": 85,
    "memoryTrend": "stable|increasing|decreasing"
  },
  "cacheOptimization": {
    "recommendations": ["Enable Redis clustering"]
  }
}
```

## Sprint Management

### Get Boards

#### GET /boards

Retrieve available Jira boards.

**Response:**
```json
[
  {
    "id": "123",
    "name": "Development Board",
    "type": "scrum"
  }
]
```

### Get Sprints

#### GET /sprints/{boardId}

Retrieve sprints for a specific board.

**Parameters:**
- `boardId` (path): Jira board ID

**Response:**
```json
[
  {
    "id": "456",
    "name": "Sprint 1",
    "state": "active",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-14T23:59:59Z"
  }
]
```

### Get Sprint Details

#### GET /sprint/{sprintId}

Get detailed information about a specific sprint.

**Parameters:**
- `sprintId` (path): Sprint ID

**Response:**
```json
{
  "id": "456",
  "name": "Sprint 1",
  "state": "active",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-14T23:59:59Z",
  "issues": [
    {
      "id": "10001",
      "key": "PROJ-123",
      "summary": "Implement user authentication",
      "status": "In Progress"
    }
  ]
}
```

## Report Generation

### Generate Sprint Report

#### POST /generate-report

Generate a comprehensive sprint report.

**Request Body:**
```json
{
  "sprint_id": "456",
  "github_owner": "myorg",
  "github_repo": "myrepo",
  "format": "html|markdown|json|csv",
  "include_commits": true,
  "include_prs": true,
  "include_velocity": true,
  "include_burndown": true,
  "theme": "default|dark|corporate"
}
```

**Validation:**
- `sprint_id`: Required, 1-50 characters
- `github_owner`: Optional, 1-100 characters
- `github_repo`: Optional, 1-100 characters
- `format`: Required, one of: html, markdown, json, csv
- All include flags: Required boolean values
- `theme`: Required, one of: default, dark, corporate

**Response:**
- Content-Type varies based on format
- Raw report content in specified format

### Get Reports

#### GET /reports

List previously generated reports.

**Response:**
```json
[
  {
    "id": "report-123",
    "sprint_id": "456",
    "format": "html",
    "created_at": "2024-01-15T10:30:00Z",
    "size": 1024768
  }
]
```

### Get Report

#### GET /report/{reportId}

Retrieve a specific report.

**Parameters:**
- `reportId` (path): Report ID

**Response:**
```json
{
  "id": "report-123",
  "sprint_id": "456",
  "format": "html",
  "created_at": "2024-01-15T10:30:00Z",
  "content": "<html>...</html>"
}
```

### Delete Report

#### DELETE /report/{reportId}

Delete a specific report.

**Parameters:**
- `reportId` (path): Report ID

**Response:**
```json
{
  "success": true
}
```

## GitHub Integration

### Get Commits

#### GET /github/commits/{owner}/{repo}

Retrieve commits from a GitHub repository.

**Parameters:**
- `owner` (path): GitHub organization/username
- `repo` (path): Repository name
- `since` (query): ISO date string
- `until` (query): ISO date string
- `author` (query): Filter by author
- `per_page` (query): Number of results (1-100, default: 30)
- `page` (query): Page number (1-1000, default: 1)

**Response:**
```json
[
  {
    "sha": "abc123",
    "message": "Fix authentication bug",
    "author": "john.doe",
    "date": "2024-01-15T10:30:00Z",
    "url": "https://github.com/owner/repo/commit/abc123"
  }
]
```

### Get Pull Requests

#### GET /github/prs/{owner}/{repo}

Retrieve pull requests from a repository.

**Parameters:**
- `owner` (path): GitHub organization/username
- `repo` (path): Repository name
- `state` (query): open, closed, or all (default: all)

**Response:**
```json
[
  {
    "number": 42,
    "title": "Add user authentication",
    "state": "open",
    "author": "jane.doe",
    "created_at": "2024-01-10T09:00:00Z",
    "merged_at": null,
    "url": "https://github.com/owner/repo/pull/42"
  }
]
```

## Analytics

### Get Velocity Data

#### GET /velocity/{boardId}

Calculate velocity data for a board.

**Parameters:**
- `boardId` (path): Jira board ID
- `sprints` (query): Number of sprints to analyze (default: 5)

**Response:**
```json
{
  "sprints": [
    {
      "id": "sprint-1",
      "name": "Sprint 1",
      "velocity": 25,
      "commitment": 30,
      "completed": 25
    }
  ],
  "average": 27.5,
  "trend": "increasing|decreasing|stable"
}
```

### Get Commit Trends

#### GET /analytics/commit-trends/{owner}/{repo}

Analyze commit activity trends.

**Parameters:**
- `owner` (path): GitHub organization/username
- `repo` (path): Repository name
- `period` (query): 1month, 3months, 6months, 1year (default: 6months)

**Response:**
```json
[
  {
    "date": "2024-01",
    "commits": 45,
    "prs": 12
  }
]
```

### Get Team Performance

#### GET /analytics/team-performance/{boardId}

Analyze team performance metrics.

**Parameters:**
- `boardId` (path): Jira board ID
- `sprints` (query): Number of sprints to analyze (default: 10)

**Response:**
```json
[
  {
    "name": "Sprint 1",
    "planned": 30,
    "completed": 25,
    "velocity": 25
  }
]
```

### Get Burndown Data

#### GET /burndown/{sprintId}

Get burndown chart data for a sprint.

**Parameters:**
- `sprintId` (path): Sprint ID

**Response:**
```json
{
  "sprint_id": "456",
  "days": [
    {
      "date": "2024-01-01",
      "remaining": 30,
      "ideal": 28,
      "completed": 2
    }
  ]
}
```

## Export Endpoints

### Export Sprint Report to PDF

#### POST /export/sprint-report/pdf

Generate a PDF version of a sprint report.

**Request Body:**
```json
{
  "reportData": {
    "sprint": {
      "name": "Sprint 1"
    },
    "metrics": {
      "totalIssues": 25,
      "completedIssues": 20,
      "velocity": 40,
      "completionRate": 80
    },
    "issues": [...],
    "commits": [...]
  },
  "options": {
    "format": "A4|A3|Letter",
    "orientation": "portrait|landscape"
  }
}
```

**Response:**
- Content-Type: application/pdf
- Binary PDF content

### Export Analytics to PDF

#### POST /export/analytics/pdf

Generate a PDF version of analytics data.

**Request Body:**
```json
{
  "analyticsData": {
    "averageVelocity": 27.5,
    "sprintsAnalyzed": 5,
    "completionRate": 87,
    "velocityTrend": "increasing",
    "sprintComparison": [...]
  },
  "options": {
    "format": "A4",
    "orientation": "portrait"
  }
}
```

**Response:**
- Content-Type: application/pdf
- Binary PDF content

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": "Error type",
  "message": "Human-readable error description",
  "details": [
    {
      "field": "sprint_id",
      "message": "sprint_id is required",
      "value": null
    }
  ]
}
```

### HTTP Status Codes

- **200**: Success
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (missing API key)
- **403**: Forbidden (invalid API key)
- **404**: Not Found
- **413**: Request Too Large
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal Server Error

### Common Error Scenarios

#### Validation Errors (400)

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "sprint_id",
      "message": "\"sprint_id\" is required",
      "value": null
    }
  ]
}
```

#### Rate Limit Exceeded (429)

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 900
}
```

#### Server Error (500)

```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

## SDK Examples

### cURL Examples

#### Generate Report

```bash
curl -X POST http://localhost:8080/api/generate-report \
  -H "Content-Type: application/json" \
  -d '{
    "sprint_id": "456",
    "format": "html",
    "include_commits": true,
    "include_prs": true,
    "include_velocity": true,
    "include_burndown": true,
    "theme": "default"
  }'
```

#### Get Health Status

```bash
curl http://localhost:8080/api/health
```

### JavaScript/TypeScript

```typescript
// Generate report
const response = await fetch('/api/generate-report', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sprint_id: '456',
    format: 'html',
    include_commits: true,
    include_prs: true,
    include_velocity: true,
    include_burndown: true,
    theme: 'default'
  })
});

const report = await response.text();
```

### Python

```python
import requests

# Generate report
response = requests.post('http://localhost:8080/api/generate-report', json={
    'sprint_id': '456',
    'format': 'html',
    'include_commits': True,
    'include_prs': True,
    'include_velocity': True,
    'include_burndown': True,
    'theme': 'default'
})

report = response.text
```

## Performance Considerations

- **Caching**: The API implements intelligent caching for frequently accessed data
- **Rate Limiting**: 100 requests per 15-minute window per IP
- **Request Size**: Maximum 10MB request size
- **Timeout**: API calls timeout after 30 seconds
- **Compression**: Responses are automatically compressed when supported

## Support

For API support and questions:
- **Documentation**: This API documentation
- **Issues**: Report bugs and feature requests in the project repository
- **Monitoring**: Use `/health` and `/metrics` endpoints for system monitoring