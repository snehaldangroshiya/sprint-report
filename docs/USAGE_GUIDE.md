# Sprint Reporter MCP - Usage Guide

## Overview

This project provides two ways to interact with the Jira-GitHub Sprint Reporter:
1. **MCP Server** (stdio) - For AI assistants like Claude Desktop
2. **Web API Server** (HTTP) - For web applications and direct API calls

## Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- Jira API credentials
- GitHub API token

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root with your credentials:

```bash
# Jira Configuration
JIRA_BASE_URL=https://your-jira-instance.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-jira-api-token

# GitHub Configuration
GITHUB_TOKEN=your-github-personal-access-token

# MCP Server Required (mapped from above)
JIRA_BASE_URL=https://your-jira-instance.atlassian.net
JIRA_API_TOKEN=your-jira-api-token
GITHUB_TOKEN=your-github-personal-access-token

# Optional Configuration
NODE_ENV=development
LOG_LEVEL=info
CACHE_TTL=3600
```

### 3. Build the Project

```bash
npm run build
```

## Running the Servers

### Option 1: MCP Server (for AI Assistants)

The MCP server uses stdio for communication with AI assistants.

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

**What it does:**
- Starts the Enhanced MCP Server on stdio
- Provides MCP tools for sprint reporting
- Monitors performance and health
- Logs to console and files

### Option 2: Web API Server (for HTTP Requests)

The Web API server exposes REST endpoints for web applications.

**Development Mode (with hot reload):**
```bash
npm run dev:web
```

**Production Mode:**
```bash
npm run start:web
```

**Server Details:**
- Listens on: `http://localhost:3000`
- Integrated with MCP server internally
- RESTful API endpoints
- JSON responses

## Web API Endpoints

### Health Check

Check the server and service health status.

```bash
GET http://localhost:3000/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-01T10:00:00.000Z",
  "uptime": 12345,
  "version": "2.0.0",
  "checks": [
    {
      "name": "jira",
      "status": "healthy",
      "responseTime": 150
    },
    {
      "name": "github",
      "status": "healthy",
      "responseTime": 200
    },
    {
      "name": "cache",
      "status": "healthy",
      "responseTime": 5
    }
  ]
}
```

### Server Information

Get server capabilities and version info.

```bash
GET http://localhost:3000/api/info
```

**Response:**
```json
{
  "name": "enhanced-jira-github-sprint-reporter",
  "version": "2.0.0",
  "uptime": 12345,
  "capabilities": [
    "enhanced_performance_monitoring",
    "intelligent_cache_optimization",
    "automatic_error_recovery",
    "comprehensive_template_engine"
  ]
}
```

### Get Active Sprints

Retrieve active sprints from a Jira board.

```bash
GET http://localhost:3000/api/sprints?board_id=123&state=active
```

**Parameters:**
- `board_id` (required): Jira board ID
- `state` (optional): Sprint state (active, future, closed) - default: active

**Response:**
```json
{
  "sprints": [
    {
      "id": "456",
      "name": "Sprint 23",
      "state": "active",
      "startDate": "2025-09-15T00:00:00.000Z",
      "endDate": "2025-09-29T00:00:00.000Z",
      "goal": "Complete user authentication features"
    }
  ]
}
```

### Get Sprint Issues

Retrieve issues from a specific sprint with pagination support.

```bash
GET http://localhost:3000/api/sprints/456/issues?page=1&per_page=20
```

**Parameters:**
- `sprintId` (required): Sprint ID from URL path
- `page` (optional): Page number (default: 1)
- `per_page` (optional): Items per page (default: 20, max: 100)
- `fields` (optional): Comma-separated list of fields to include
- `max_results` (optional): Maximum total issues to fetch from Jira (default: 50)

**Response:**
```json
{
  "issues": [
    {
      "key": "PROJ-123",
      "summary": "Implement login form",
      "status": "In Progress",
      "assignee": "john.doe",
      "storyPoints": 5,
      "priority": "High"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total_issues": 113,
    "total_pages": 6,
    "has_next": true,
    "has_prev": false
  }
}
```

**Benefits:**
- 🚀 **Improved Performance**: Load only the issues you need
- 💾 **Reduced Load Time**: Faster initial page load
- 🎯 **Better UX**: Smoother scrolling and interaction
- 📦 **Smart Caching**: Full issue list cached, pagination in-memory

### Get Sprint Metrics

Get detailed metrics for a sprint including velocity and burndown.

```bash
GET http://localhost:3000/api/sprints/456/metrics?include_velocity=true&include_burndown=true
```

**Parameters:**
- `sprintId` (required): Sprint ID from URL path
- `include_velocity` (optional): Include velocity data (true/false)
- `include_burndown` (optional): Include burndown data (true/false)

**Response:**
```json
{
  "sprint_id": "456",
  "metrics": {
    "totalIssues": 25,
    "completedIssues": 18,
    "inProgressIssues": 5,
    "todoIssues": 2,
    "velocity": 45,
    "burndown": [
      {"date": "2025-09-15", "remaining": 50},
      {"date": "2025-09-22", "remaining": 25}
    ]
  }
}
```

### Generate Sprint Report

Generate a comprehensive sprint report in various formats.

```bash
POST http://localhost:3000/api/reports/sprint
Content-Type: application/json

{
  "sprint_id": "456",
  "github_owner": "your-org",
  "github_repo": "your-repo",
  "format": "json",
  "include_commits": true,
  "include_prs": true,
  "include_velocity": true,
  "include_burndown": true,
  "theme": "default"
}
```

**Request Body:**
- `sprint_id` (required): Jira sprint ID
- `github_owner` (optional): GitHub repository owner
- `github_repo` (optional): GitHub repository name
- `format` (required): Output format (json, html, markdown, csv)
- `include_commits` (required): Include Git commits
- `include_prs` (required): Include pull requests
- `include_velocity` (required): Include velocity chart
- `include_burndown` (required): Include burndown chart
- `theme` (required): Report theme (default, dark, corporate)

**Response:**
```json
{
  "report": {
    "sprint": {
      "id": "456",
      "name": "Sprint 23",
      "status": "active"
    },
    "summary": {
      "totalIssues": 25,
      "completed": 18,
      "inProgress": 5,
      "velocity": 45
    },
    "commits": [...],
    "pullRequests": [...],
    "charts": {
      "velocity": "data:image/png;base64,...",
      "burndown": "data:image/png;base64,..."
    }
  }
}
```

### GitHub Integration

#### Get Repository Commits

```bash
GET http://localhost:3000/api/github/repos/:owner/:repo/commits?since=2025-09-01&until=2025-09-30
```

#### Get Pull Requests

```bash
GET http://localhost:3000/api/github/repos/:owner/:repo/pulls?state=all&per_page=50
```

#### Get Repository Statistics

```bash
GET http://localhost:3000/api/github/repos/:owner/:repo/stats
```

## Example Usage with cURL

### 1. Check Server Health

```bash
curl http://localhost:3000/api/health
```

### 2. Get Active Sprints

```bash
curl "http://localhost:3000/api/sprints?board_id=123&state=active"
```

### 3. Generate Sprint Report

```bash
curl -X POST http://localhost:3000/api/reports/sprint \
  -H "Content-Type: application/json" \
  -d '{
    "sprint_id": "456",
    "github_owner": "your-org",
    "github_repo": "your-repo",
    "format": "json",
    "include_commits": true,
    "include_prs": true,
    "include_velocity": true,
    "include_burndown": true,
    "theme": "default"
  }'
```

## Example Usage with JavaScript/Fetch

```javascript
// Check health
const healthResponse = await fetch('http://localhost:3000/api/health');
const health = await healthResponse.json();
console.log('Server health:', health);

// Get sprints
const sprintsResponse = await fetch('http://localhost:3000/api/sprints?board_id=123');
const sprints = await sprintsResponse.json();
console.log('Active sprints:', sprints);

// Generate sprint report
const reportResponse = await fetch('http://localhost:3000/api/reports/sprint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sprint_id: '456',
    github_owner: 'your-org',
    github_repo: 'your-repo',
    format: 'json',
    include_commits: true,
    include_prs: true,
    include_velocity: true,
    include_burndown: true,
    theme: 'default'
  })
});

const report = await reportResponse.json();
console.log('Sprint report:', report);
```

## Example Web Application Integration

### React Example

```jsx
import React, { useState, useEffect } from 'react';

function SprintDashboard() {
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSprints() {
      try {
        const response = await fetch('http://localhost:3000/api/sprints?board_id=123');
        const data = await response.json();
        setSprints(data.sprints);
      } catch (error) {
        console.error('Error fetching sprints:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSprints();
  }, []);

  const generateReport = async (sprintId) => {
    try {
      const response = await fetch('http://localhost:3000/api/reports/sprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sprint_id: sprintId,
          format: 'json',
          include_commits: true,
          include_prs: true,
          include_velocity: true,
          include_burndown: true,
          theme: 'default'
        })
      });
      const report = await response.json();
      console.log('Report generated:', report);
      // Handle the report data...
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  if (loading) return <div>Loading sprints...</div>;

  return (
    <div>
      <h1>Sprint Dashboard</h1>
      {sprints.map(sprint => (
        <div key={sprint.id}>
          <h2>{sprint.name}</h2>
          <p>Status: {sprint.state}</p>
          <button onClick={() => generateReport(sprint.id)}>
            Generate Report
          </button>
        </div>
      ))}
    </div>
  );
}

export default SprintDashboard;
```

## Error Handling

All API endpoints return standard HTTP status codes and error messages:

### Success Responses
- `200 OK` - Request successful
- `201 Created` - Resource created successfully

### Error Responses
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid API credentials
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

**Error Response Format:**
```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "details": {
    "field": "Additional error details"
  }
}
```

## Performance Monitoring

The server includes built-in performance monitoring:

### Get Performance Metrics

```bash
GET http://localhost:3000/api/metrics
```

**Response includes:**
- Memory usage statistics
- Cache hit rates
- API response times
- Service health metrics
- Performance alerts

## Troubleshooting

### Server Won't Start

1. **Check environment variables:**
   ```bash
   # Verify .env file exists and has correct values
   cat .env
   ```

2. **Verify dependencies:**
   ```bash
   npm install
   ```

3. **Check port availability:**
   ```bash
   # Port 3000 should be available
   lsof -i :3000
   ```

### Jira Connection Issues

If you see "Jira service unhealthy" in health checks:

1. **Verify Jira credentials:**
   - Check JIRA_BASE_URL is correct (e.g., https://your-company.atlassian.net)
   - Verify JIRA_API_TOKEN is valid
   - Test credentials manually: `curl -u email:token https://your-jira/rest/api/3/myself`

2. **Check Jira API permissions:**
   - Token must have read access to projects and boards
   - User must have appropriate Jira permissions

### GitHub Connection Issues

1. **Verify GitHub token:**
   - Token must have `repo` scope for private repositories
   - Token must have `public_repo` scope for public repositories
   - Test token: `curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user`

2. **Check rate limits:**
   - GitHub has API rate limits
   - Authenticated requests: 5,000 per hour
   - Check remaining: `curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/rate_limit`

## Logs

Server logs are available in:
- Console output (when running in development mode)
- Log files (in production mode)

**View real-time logs:**
```bash
# Development mode automatically shows logs
npm run dev:web

# Production mode
npm run start:web
```

## Production Deployment

### Build for Production

```bash
npm run build
```

### Run in Production

```bash
# Set environment to production
export NODE_ENV=production

# Start the web server
npm run start:web
```

### Using Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Start server with PM2
pm2 start dist/web-server.js --name sprint-reporter-api

# View logs
pm2 logs sprint-reporter-api

# Monitor
pm2 monit

# Stop
pm2 stop sprint-reporter-api
```

### Docker Deployment

```bash
# Build Docker image
npm run docker:build

# Run with Docker Compose
npm run docker:run

# Stop
npm run docker:stop
```

## Support and Issues

For issues, questions, or feature requests:
- GitHub Issues: https://github.com/your-org/jira-github-sprint-reporter-mcp/issues
- Documentation: Check README.md and API documentation

## Additional Resources

- **MCP Protocol:** https://modelcontextprotocol.io
- **Jira REST API:** https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- **GitHub REST API:** https://docs.github.com/en/rest
