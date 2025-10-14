# GitHub GraphQL v4 API Integration

## Overview

This document describes the GitHub GraphQL v4 API integration implemented to resolve pull request data fetching issues in the comprehensive sprint report endpoint.

## Problem Statement

### Original Issue
The comprehensive sprint report endpoint was returning 0 pull requests for sprint 43577 (Aug 6-20, 2025) despite GitHub having 86 PRs in that date range.

### Root Cause
The REST API (`/repos/{owner}/{repo}/pulls`) had pagination limitations:
- Returns only 30 PRs per page
- Sorted by `updated` desc by default
- No native date filtering
- Recent October PRs filled the first page, pushing August PRs out
- Client-side date filtering resulted in empty arrays

## Solution

### GraphQL v4 Implementation

We implemented a dedicated GraphQL client that leverages GitHub's search API for efficient date-range queries.

#### New Components

**1. GraphQL Client** (`src/clients/github-graphql-client.ts`)
- Dedicated client using `@octokit/graphql` package
- Authentication via GitHub token
- Native search API support with date filtering
- Automatic pagination (up to 1000 results)

**2. Integration in Sprint Service** (`src/services/sprint-service.ts`)
- GraphQL client initialized when GitHub token is provided
- `getSprintPullRequests()` method updated to prefer GraphQL
- Fallback to REST API if GraphQL client not available
- Supports both camelCase and snake_case PR field formats

## Architecture

### Call Flow

```
Comprehensive Endpoint Request
↓
callMCPTool('generate_sprint_report')
↓
reportGenerator.generateReport()
↓
sprintService.generateSprintReport()
↓
sprintService.getSprintPullRequests()
↓
[GraphQL Client Check]
├─ IF GraphQL available → githubGraphQLClient.searchPullRequestsByDateRange()
└─ ELSE → githubClient.searchPullRequestsByDateRange() (REST API fallback)
```

### GraphQL Query

The implementation uses GitHub's search API with the following query structure:

```graphql
query($searchQuery: String!, $cursor: String) {
  search(query: $searchQuery, type: ISSUE, first: 100, after: $cursor) {
    issueCount
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
        closedAt
        mergedAt
        author { login }
        baseRefName
        headRefName
        url
        additions
        deletions
        commits { totalCount }
        changedFiles
        reviews { totalCount }
        comments { totalCount }
        labels(first: 10) { nodes { name } }
        assignees(first: 10) { nodes { login } }
      }
    }
  }
}
```

With search query: `repo:Sage/sage-connect is:pr created:2025-08-06..2025-08-20`

## Configuration

### Environment Variables

The GraphQL client requires the GitHub token to be available:

```bash
GITHUB_TOKEN=ghp_your_token_here
```

### Server Initialization

All server modes now pass the GitHub token to enable GraphQL:

```typescript
const sprintService = new SprintService(
  jiraClient,
  githubClient,
  cacheManager,
  config.github.token  // ← Enables GraphQL
);
```

Updated servers:
- `src/server/enhanced-mcp-server.ts`
- `src/http-server.ts`
- `src/sse-server.ts`
- `src/server/mcp-server.ts`

## Performance Comparison

### REST API (Before)
- **Endpoint**: `/repos/{owner}/{repo}/pulls`
- **Results per page**: 30
- **Total pages for 86 PRs**: 3+
- **Date filtering**: Client-side (post-fetch)
- **Pagination**: Manual iteration required
- **Result**: 0 PRs (due to sorting/pagination issues)

### GraphQL API (After)
- **Endpoint**: `/search/issues` (via GraphQL)
- **Results per page**: 100
- **Total pages for 86 PRs**: 1
- **Date filtering**: Native (`created:YYYY-MM-DD..YYYY-MM-DD`)
- **Pagination**: Automatic with cursor-based pagination
- **Query time**: ~1.2 seconds
- **Result**: 86 PRs ✅

## Verification

### Direct GraphQL Test

Run the included test script to verify GraphQL functionality:

```bash
node test-graphql.js
```

Expected output:
```
✅ GraphQL search completed in 1172 ms
- Total PRs found: 86
- PRs in first page: 86
- Has next page: false
✅ SUCCESS: GraphQL API returned 86 PRs for the date range!
```

### Server Logs

When the server starts with GraphQL enabled, you'll see:

```
[INFO] [SprintService] GitHub GraphQL client initialized
```

When fetching PRs, you'll see:

```
[INFO] Fetching PRs for sprint date range {
  owner: 'Sage',
  repo: 'sage-connect',
  startDate: '2025-08-06T10:14:00.000Z',
  endDate: '2025-08-20T10:14:00.000Z',
  hasGraphQLClient: true
}
[INFO] Using GitHub GraphQL v4 for PR search
```

### Endpoint Test

Test the comprehensive endpoint:

```bash
# Clear cache first
redis-cli FLUSHALL

# Test endpoint
curl -s "http://localhost:3000/api/sprints/43577/comprehensive?github_owner=Sage&github_repo=sage-connect&include_tier1=false&include_tier2=false&include_tier3=false&include_forward_looking=false&include_enhanced_github=true" | jq '.pullRequests | length'

# Expected: 86
```

## Troubleshooting

### Issue: Still getting 0 PRs

**Cause**: Cached data from before GraphQL implementation

**Solution**:
```bash
redis-cli FLUSHALL
npm run dev:web  # Restart server
```

### Issue: GraphQL client not initialized

**Check**:
1. Verify `GITHUB_TOKEN` in `.env` file
2. Check server logs for "GitHub GraphQL client initialized"
3. Ensure all servers are passing the token in constructor

### Issue: Rate limiting

GitHub GraphQL API has rate limits:
- **Authenticated**: 5000 points per hour
- **Search API cost**: ~1 point per query

Monitor in logs:
```json
{
  "rateLimit": {
    "limit": 5000,
    "remaining": 4988,
    "reset": 1760425627
  }
}
```

## Future Enhancements

### Potential Improvements

1. **Caching Strategy**
   - Cache GraphQL results separately from REST API results
   - Implement cache key namespacing: `graphql:prs:...`

2. **Pagination Optimization**
   - Implement parallel page fetching for large result sets
   - Add progress indicators for multi-page queries

3. **Query Optimization**
   - Reduce fields fetched if not needed
   - Implement fragment reuse for common PR fields

4. **Error Handling**
   - Add retry logic for transient GraphQL errors
   - Implement circuit breaker pattern

5. **Metrics**
   - Track GraphQL vs REST API usage
   - Monitor query performance
   - Alert on rate limit approaching

## Dependencies

```json
{
  "@octokit/graphql": "^9.0.2"
}
```

## Migration Notes

### Breaking Changes
None. The implementation is backward compatible:
- Falls back to REST API if GraphQL client not available
- Supports both camelCase (GraphQL) and snake_case (REST) field formats
- Existing tests continue to work

### Rollback Plan
If issues occur, simply don't pass the GitHub token to `SprintService` constructor:

```typescript
const sprintService = new SprintService(
  jiraClient,
  githubClient,
  cacheManager
  // No token = no GraphQL client = REST API fallback
);
```

## References

- [GitHub GraphQL API Documentation](https://docs.github.com/en/graphql)
- [GitHub Search Syntax](https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests)
- [@octokit/graphql Package](https://github.com/octokit/graphql.js)

## Authors

- Implementation: October 14, 2025
- Sprint Report System v2.2.0

---

**Status**: ✅ Implemented and Verified  
**Last Updated**: October 14, 2025
