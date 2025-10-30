# API Inventory - NextReleaseMCP

**Complete reference of all Jira and GitHub APIs used by NextReleaseMCP**

---

## Table of Contents

1. [Overview](#overview)
2. [Jira APIs](#jira-apis)
3. [GitHub REST API v3](#github-rest-api-v3)
4. [GitHub GraphQL API v4](#github-graphql-api-v4)
5. [API Usage Patterns](#api-usage-patterns)
6. [Rate Limits & Quotas](#rate-limits--quotas)
7. [Authentication](#authentication)
8. [Performance Optimizations](#performance-optimizations)
9. [Cross-API Integration](#cross-api-integration)
10. [Complete Method Inventory](#complete-method-inventory)
11. [Summary Statistics](#summary-statistics)

---

## Overview

NextReleaseMCP integrates with **Jira Server** and **GitHub** to provide comprehensive sprint reporting and analytics. This document catalogs all API endpoints, methods, and integration patterns used by the application.

### **API Clients**

- **Jira Client**: `src/clients/jira-client.ts` - Jira Server API v2 + Agile API v1.0
- **GitHub REST Client**: `src/clients/github-client.ts` - GitHub REST API v3
- **GitHub GraphQL Client**: `src/clients/github-graphql-client.ts` - GitHub GraphQL API v4
- **Base Client**: `src/clients/base-client.ts` - Shared HTTP client with caching and retry logic

---

## Jira APIs

### **Base Configuration**

| Property                 | Value                                     |
| ------------------------ | ----------------------------------------- |
| **API Version**          | Jira Server API v2 + Agile API v1.0       |
| **Base URL**             | `https://jira.sage.com`                   |
| **Authentication**       | Bearer Token OR Basic Auth (configurable) |
| **Environment Variable** | `JIRA_AUTH_TYPE` (basic/bearer)           |
| **Client File**          | `src/clients/jira-client.ts`              |

### **Endpoints Used**

#### **Agile API** (`/rest/agile/1.0/`)

| Endpoint                                  | Method | Purpose               | Cache TTL | Pagination |
| ----------------------------------------- | ------ | --------------------- | --------- | ---------- |
| `/rest/agile/1.0/board`                   | GET    | List all boards       | 30 min    | ✅ Yes     |
| `/rest/agile/1.0/board/{boardId}/sprint`  | GET    | Get sprints for board | 5 min     | ✅ Yes     |
| `/rest/agile/1.0/sprint/{sprintId}`       | GET    | Get sprint details    | 5 min     | ❌ No      |
| `/rest/agile/1.0/sprint/{sprintId}/issue` | GET    | Get issues in sprint  | 5 min     | ✅ Yes     |

**Query Parameters:**

- `state` - Filter sprints by state (active/closed/future)
- `maxResults` - Number of results per page (default: 50)
- `startAt` - Pagination offset
- `fields` - Comma-separated list of fields to include

#### **Core API v2** (`/rest/api/2/`)

| Endpoint                                        | Method | Purpose                           | Cache TTL | Pagination |
| ----------------------------------------------- | ------ | --------------------------------- | --------- | ---------- |
| `/rest/api/2/myself`                            | GET    | Validate connection, health check | No cache  | ❌ No      |
| `/rest/api/2/serverInfo`                        | GET    | Get Jira server version info      | 1 hour    | ❌ No      |
| `/rest/api/2/issue/{issueKey}`                  | GET    | Get issue details                 | 10 min    | ❌ No      |
| `/rest/api/2/issue/{issueKey}?expand=changelog` | GET    | Get issue with changelog history  | 5 min     | ❌ No      |
| `/rest/api/2/search`                            | POST   | JQL search                        | No cache  | ✅ Yes     |

**Query Parameters:**

- `expand` - Expand additional fields (e.g., `changelog`)
- `fields` - Fields to include in response
- `maxResults` - Results per page
- `startAt` - Pagination offset

**JQL Search Body:**

```json
{
  "jql": "project = SCNT AND sprint = 44298",
  "fields": ["summary", "status", "assignee"],
  "maxResults": 100,
  "startAt": 0
}
```

### **Detailed Method Specifications**

#### **getSprints()**

```typescript
async getSprints(
  boardId: string,
  state?: 'active' | 'closed' | 'future'
): Promise<SprintData[]>
```

**Implementation:**

- Validates input using `MCPToolSchemas.jiraGetSprints`
- Endpoint: `/rest/agile/1.0/board/{boardId}/sprint`
- Cache TTL: 5 minutes (300000ms)
- Returns: Array of transformed sprint data

**Query Parameters:**

```typescript
{
  state?: 'active' | 'closed' | 'future'  // Optional filter
}
```

**Transformation:**

```typescript
{
  id: sprint.id.toString(),
  name: sprint.name,
  startDate: sprint.startDate || '',
  endDate: sprint.endDate || '',
  goal: sprint.goal || undefined,
  state: 'ACTIVE' | 'CLOSED' | 'FUTURE',  // Mapped from lowercase
  completeDate: sprint.completeDate || undefined,
  boardId: sprint.originBoardId
}
```

#### **getSprintIssues()**

```typescript
async getSprintIssues(
  sprintId: string,
  fields?: string[],
  maxResults?: number
): Promise<Issue[]>
```

**Implementation:**

- Endpoint: `/rest/agile/1.0/sprint/{sprintId}/issue`
- Cache TTL: 5 minutes
- **Automatic pagination**: Continues until all issues fetched
- **Safety limit**: Max 1000 issues
- Default maxResults: 50 per page

**Pagination Logic:**

```typescript
let startAt = 0;
let hasMore = true;
while (hasMore) {
  const response = await makeRequest({ startAt, maxResults });
  allIssues.concat(response.issues);
  hasMore = response.issues.length === maxResults;
  startAt += maxResults;
  if (allIssues.length >= 1000) break; // Safety check
}
```

#### **getEnhancedSprintIssues()**

```typescript
async getEnhancedSprintIssues(
  sprintId: string,
  maxResults: number = 100
): Promise<Issue[]>
```

**Implementation:**

- Fetches basic sprint issues
- Enhances **first 20 issues** with changelog data
- Rate limiting: 200ms delay every 15 requests

**Enhancement Process:**

```typescript
const issuesToEnhance = issues.slice(0, 20); // Limit for performance
for (let i = 0; i < issuesToEnhance.length; i++) {
  const enhanced = await getEnhancedIssue(issue.key);
  if ((i + 1) % 15 === 0) {
    await delay(200); // Rate limiting
  }
}
```

**Enhanced Data Includes:**

- `statusHistory`: Array of status changes with duration
- `sprintHistory`: Sprint add/remove events
- `timeInStatus`: Hours spent in each status (Record<string, number>)
- `cycleTime`: Days from "In Progress" to "Done"
- `leadTime`: Days from creation to resolution

#### **searchIssues()**

```typescript
async searchIssues(
  jql: string,
  fields?: string[],
  maxResults?: number
): Promise<Issue[]>
```

**Implementation:**

- Endpoint: `/rest/api/2/search`
- Method: POST
- **JQL Validation**: Validates JQL syntax for security
- **No caching**: Search results not cached
- **Automatic pagination**: Max 1000 results

**Security:**

```typescript
// JQL validation prevents injection attacks
ValidationUtils.validateJQL(jql);
```

**Request Body:**

```typescript
{
  jql: "project = SCNT AND sprint = 44298",
  fields: ["summary", "status", "assignee", "customfield_10016"],
  maxResults: 100,
  startAt: 0
}
```

#### **buildJQL()**

```typescript
buildJQL(conditions: Record<string, any>): string
```

**Implementation:**

```typescript
// Handles arrays and single values
{
  project: 'SCNT',
  status: ['Done', 'Closed'],
  sprint: '44298'
}
// Returns: 'project = "SCNT" AND status IN ("Done", "Closed") AND sprint = "44298"'
```

**Logic:**

- Arrays → `IN (value1, value2)`
- Strings → `= "value"`
- Numbers → `= value`
- null/undefined → skip field

### **Custom Fields Extracted**

The Jira client automatically extracts common custom fields:

#### **Story Points**

```typescript
// Location: jira-client.ts:407-425
private extractStoryPoints(fields: any): number | undefined {
  const storyPointFields = [
    'customfield_10016',  // Most common Jira Cloud field
    'customfield_10004',  // Alternative field ID
    'customfield_10002',  // Story Points
    'storyPoints',        // Direct field name
    'story_points'        // Snake case variant
  ];

  for (const fieldName of storyPointFields) {
    const value = fields[fieldName];
    if (typeof value === 'number' && value >= 0) {
      return value;
    }
  }
  return undefined;
}
```

#### **Epic Link**

```typescript
// Location: jira-client.ts:427-447
private extractEpicLink(fields: any): string | undefined {
  const epicLinkFields = [
    'customfield_10014',  // Common epic link field
    'customfield_10008',  // Alternative epic link
    'epicLink',           // Direct field name
    'parent'              // Jira next-gen projects
  ];

  for (const fieldName of epicLinkFields) {
    const value = fields[fieldName];
    if (typeof value === 'string' && value) {
      return value;
    }
    // Handle parent field (object with key property)
    if (value && typeof value === 'object' && value.key) {
      return value.key;
    }
  }
  return undefined;
}
```

#### **Epic Name**

```typescript
// Location: jira-client.ts:449-468
private extractEpicName(fields: any): string | undefined {
  // Check parent field first (next-gen projects)
  if (fields.parent?.fields?.summary) {
    return fields.parent.fields.summary;
  }

  const epicNameFields = [
    'customfield_10011',
    'customfield_10009',
    'epicName'
  ];

  for (const fieldName of epicNameFields) {
    const value = fields[fieldName];
    if (typeof value === 'string' && value) {
      return value;
    }
  }
  return undefined;
}
```

#### **Flagged/Blocked**

```typescript
// Location: jira-client.ts:470-494
private extractFlagged(fields: any): boolean {
  const flaggedFields = [
    'customfield_10021',  // Impediment flag
    'customfield_10015',  // Blocked flag
    'flagged'             // Direct field name
  ];

  for (const fieldName of flaggedFields) {
    const value = fields[fieldName];
    if (value !== null && value !== undefined) {
      // Array of flags
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      // String flag values
      if (typeof value === 'string') {
        return value.toLowerCase() === 'impediment' ||
               value.toLowerCase() === 'blocked';
      }
      // Object flag
      if (typeof value === 'object' && value.value) {
        return true;
      }
    }
  }
  return false;
}
```

#### **Blocker Reason**

```typescript
// Location: jira-client.ts:496-512
private extractBlockerReason(fields: any): string | undefined {
  const blockerFields = ['customfield_10021', 'customfield_10015', 'flagged'];

  for (const fieldName of blockerFields) {
    const value = fields[fieldName];
    // Array of flag objects
    if (Array.isArray(value) && value.length > 0) {
      return value[0].value || value[0];
    }
    // Single flag object
    if (typeof value === 'object' && value.value) {
      return value.value;
    }
  }
  return undefined;
}
```

### **Changelog Processing Methods**

#### **extractStatusHistory()**

```typescript
// Location: jira-client.ts:599-640
private extractStatusHistory(histories: any[]): StatusChange[] {
  const statusChanges: StatusChange[] = [];

  // Extract status changes from changelog
  for (const history of histories) {
    const statusItem = history.items?.find(item => item.field === 'status');
    if (statusItem) {
      statusChanges.push({
        from: statusItem.fromString || '',
        to: statusItem.toString || '',
        timestamp: history.created,
        author: history.author?.displayName || 'Unknown'
      });
    }
  }

  // Calculate duration for each status
  for (let i = 0; i < statusChanges.length - 1; i++) {
    const current = statusChanges[i];
    const next = statusChanges[i + 1];
    const currentTime = new Date(current.timestamp).getTime();
    const nextTime = new Date(next.timestamp).getTime();
    current.duration = (nextTime - currentTime) / (1000 * 60 * 60);  // Hours
  }

  // Last status duration: from last change to now
  if (statusChanges.length > 0) {
    const lastChange = statusChanges[statusChanges.length - 1];
    const lastTime = new Date(lastChange.timestamp).getTime();
    const now = new Date().getTime();
    lastChange.duration = (now - lastTime) / (1000 * 60 * 60);  // Hours
  }

  return statusChanges;
}
```

#### **calculateCycleTime()**

```typescript
// Location: jira-client.ts:711-753
private calculateCycleTime(statusHistory: StatusChange[], createdDate: string): number {
  const inProgressStatuses = ['In Progress', 'In Development', 'In Review', 'Testing'];
  const doneStatuses = ['Done', 'Closed', 'Resolved', 'Complete'];

  let startTime: number | null = null;
  let endTime: number | null = null;

  for (const change of statusHistory) {
    // Find first transition to "in progress"
    if (!startTime && inProgressStatuses.some(s =>
      change.to.toLowerCase().includes(s.toLowerCase())
    )) {
      startTime = new Date(change.timestamp).getTime();
    }

    // Find transition to "done"
    if (doneStatuses.some(s =>
      change.to.toLowerCase().includes(s.toLowerCase())
    )) {
      endTime = new Date(change.timestamp).getTime();
    }
  }

  if (startTime && endTime) {
    return (endTime - startTime) / (1000 * 60 * 60 * 24);  // Days
  }

  return 0;
}
```

**Status Classifications:**

- **In Progress**: "In Progress", "In Development", "In Review", "Testing"
- **Done**: "Done", "Closed", "Resolved", "Complete"
- **Cycle Time**: Time from first "In Progress" to "Done" (in days)

#### **calculateLeadTime()**

```typescript
// Location: jira-client.ts:755-766
private calculateLeadTime(createdDate: string, resolvedDate?: string): number {
  if (!resolvedDate) return 0;

  const created = new Date(createdDate).getTime();
  const resolved = new Date(resolvedDate).getTime();

  return (resolved - created) / (1000 * 60 * 60 * 24);  // Days
}
```

**Formula:** `leadTime = (resolvedDate - createdDate) / (24 * 60 * 60 * 1000)`

### **Response Structures**

#### **Sprint Response**

```typescript
{
  id: number;
  name: string;
  state: 'closed' | 'active' | 'future';
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  goal?: string;
  originBoardId: number;
}
```

#### **Issue Response**

```typescript
{
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: {...} };
    assignee: { displayName: string; ... } | null;
    priority: { name: string };
    issuetype: { name: string };
    created: string;
    updated: string;
    resolutiondate?: string;
    labels: string[];
    components: Array<{name: string}>;
    fixVersions: Array<{name: string}>;
    customfield_10016?: number; // Story Points
  }
}
```

### **Enhanced Data Processing**

The Jira client provides enhanced issue data with changelog processing:

#### **Status History**

```typescript
{
  from: string;          // Previous status
  to: string;            // New status
  timestamp: string;     // ISO 8601 date
  author: string;        // User who changed status
  duration?: number;     // Time in status (hours)
}
```

#### **Sprint History**

```typescript
{
  sprintId: string;
  sprintName: string;
  action: 'added' | 'removed';
  timestamp: string;
  author: string;
}
```

#### **Time Metrics**

- **Cycle Time**: Time from "In Progress" to "Done" (days)
- **Lead Time**: Time from creation to "Done" (days)
- **Time in Status**: Hours spent in each status

---

## GitHub REST API v3

### **Base Configuration**

| Property           | Value                                |
| ------------------ | ------------------------------------ |
| **API Version**    | GitHub REST API v3                   |
| **Base URL**       | `https://api.github.com`             |
| **Authentication** | Bearer Token (Personal Access Token) |
| **Accept Header**  | `application/vnd.github.v3+json`     |
| **User-Agent**     | `JiraGitHubReporter/1.0.0`           |
| **Client File**    | `src/clients/github-client.ts`       |

### **Endpoints Used**

#### **Repository Endpoints**

| Endpoint                                        | Method | Purpose                       | Cache TTL | Pagination |
| ----------------------------------------------- | ------ | ----------------------------- | --------- | ---------- |
| `/repos/{owner}/{repo}`                         | GET    | Get repository info           | 30 min    | ❌ No      |
| `/repos/{owner}/{repo}/commits`                 | GET    | List commits                  | 5 min     | ✅ Yes     |
| `/repos/{owner}/{repo}/commits/{sha}`           | GET    | Get commit details with stats | 1 hour    | ❌ No      |
| `/repos/{owner}/{repo}/pulls`                   | GET    | List pull requests            | 5 min     | ✅ Yes     |
| `/repos/{owner}/{repo}/pulls/{number}`          | GET    | Get PR details                | 5 min     | ❌ No      |
| `/repos/{owner}/{repo}/pulls/{number}/reviews`  | GET    | Get PR reviews                | 5 min     | ✅ Yes     |
| `/repos/{owner}/{repo}/pulls/{number}/comments` | GET    | Get PR review comments        | 5 min     | ✅ Yes     |

**Query Parameters:**

- `per_page` - Results per page (max: 100)
- `page` - Page number (1-based)
- `since` - ISO 8601 timestamp (commits after this date)
- `until` - ISO 8601 timestamp (commits before this date)
- `author` - Filter commits by author
- `state` - PR state (open/closed/all)
- `sort` - Sort field (created/updated/popularity)
- `direction` - Sort direction (asc/desc)

#### **Search Endpoints**

| Endpoint          | Method | Purpose                     | Cache TTL | Rate Limit |
| ----------------- | ------ | --------------------------- | --------- | ---------- |
| `/search/commits` | GET    | Search commits by message   | 5 min     | 30 req/min |
| `/search/issues`  | GET    | Search PRs (via issues API) | 5 min     | 30 req/min |

**Search Query Syntax:**

```
repo:owner/repo SCNT-1234 created:2025-09-17..2025-10-01
```

**Search Parameters:**

- `q` - Search query string
- `sort` - Sort field
- `order` - Sort order (asc/desc)
- `per_page` - Results per page (max: 100)
- `page` - Page number

#### **User & Rate Limit Endpoints**

| Endpoint      | Method | Purpose                     | Cache TTL |
| ------------- | ------ | --------------------------- | --------- |
| `/user`       | GET    | Get authenticated user info | 30 min    |
| `/rate_limit` | GET    | Check rate limit status     | No cache  |

### **Detailed Method Specifications**

#### **getAllCommits()**

```typescript
// Location: github-client.ts:209-248
async getAllCommits(
  owner: string,
  repo: string,
  since?: string,
  until?: string,
  author?: string
): Promise<Commit[]>
```

**Implementation:**

- Automatic pagination with safety limit (10,000 commits)
- Fetches 100 commits per page (maximum allowed)
- Continues until no more commits returned

**Pagination Logic:**

```typescript
let page = 1;
const perPage = 100; // Maximum per page

while (true) {
  const commits = await getCommits(owner, repo, { since, until, author, per_page: perPage, page });

  if (commits.length === 0) break;
  allCommits = allCommits.concat(commits);

  if (commits.length < perPage) break; // Last page

  page++;

  if (allCommits.length >= 10000) {
    console.warn('Too many commits, limiting to first 10000');
    break;
  }
}
```

#### **findCommitsWithJiraReferences()**

```typescript
// Location: github-client.ts:930-999
async findCommitsWithJiraReferences(
  owner: string,
  repo: string,
  issueKeys: string[],
  since?: string,
  until?: string
): Promise<Array<{ issueKey: string; commits: Commit[] }>>
```

**Implementation:**

```typescript
// 1. Fetch all commits in date range
const allCommits = await getAllCommits(owner, repo, since, until);

// 2. Extract issue keys from each commit
for (const commit of allCommits) {
  const referencedIssues = extractIssueKeysFromCommitMessage(commit.message);

  // 3. Group commits by issue key
  for (const issueKey of referencedIssues) {
    if (issueKeys.includes(issueKey)) {
      commitsByIssue.get(issueKey).push(commit);
    }
  }
}

// 4. Sort and limit commits per issue
for (const issueKey of issueKeys) {
  const commits = commitsByIssue.get(issueKey) || [];
  const sortedCommits = commits
    .sort((a, b) => new Date(b.author.date).getTime() - new Date(a.author.date).getTime())
    .slice(0, 20); // Max 20 commits per issue

  result.push({ issueKey, commits: sortedCommits });
}
```

**Issue Key Extraction Pattern:**

```typescript
// Regex: /\b[A-Z][A-Z0-9_]*-\d+\b/g
Examples:
- "SCNT-1234: Fix bug" → ['SCNT-1234']
- "fixes PROJ-567" → ['PROJ-567']
- "#TEAM-999" → ['TEAM-999']
```

#### **getEnhancedPullRequest()**

```typescript
// Location: github-client.ts:490-543
async getEnhancedPullRequest(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PullRequest>
```

**Enhancement Process:**

```typescript
// 1. Get basic PR data
const pr = await getPullRequestDetails(owner, repo, prNumber);

// 2. Get reviews
const reviews = await getPullRequestReviews(owner, repo, prNumber);

// 3. Get comment count
const commentCount = await getPullRequestComments(owner, repo, prNumber);

// 4. Calculate time to first review (hours)
const timeToFirstReview =
  reviews.length > 0 ? (new Date(reviews[0].submittedAt) - new Date(pr.createdAt)) / (1000 * 60 * 60) : undefined;

// 5. Calculate time to merge (hours)
const timeToMerge = pr.mergedAt ? (new Date(pr.mergedAt) - new Date(pr.createdAt)) / (1000 * 60 * 60) : undefined;

// 6. Extract linked Jira issues
const linkedIssues = [...extractIssueKeysFromCommitMessage(pr.title), ...extractIssueKeysFromCommitMessage(pr.body)];

return { ...pr, reviews, reviewComments: commentCount, timeToFirstReview, timeToMerge, linkedIssues };
```

**Enhanced Fields:**

- `reviews`: Array<PRReview>
- `reviewComments`: number
- `timeToFirstReview`: number (hours)
- `timeToMerge`: number (hours)
- `linkedIssues`: string[]

#### **calculateCodeReviewStats()**

```typescript
// Location: github-client.ts:610-647
calculateCodeReviewStats(prs: PullRequest[]): {
  totalReviews: number;
  reviewsByReviewer: Record<string, number>;
  averageReviewsPerPR: number;
  approvalRate: number;
  changesRequestedRate: number;
}
```

**Calculation Logic:**

```typescript
let totalReviews = 0;
let approvedCount = 0;
let changesRequestedCount = 0;
const reviewsByReviewer: Record<string, number> = {};

for (const pr of prs) {
  for (const review of pr.reviews || []) {
    totalReviews++;
    reviewsByReviewer[review.reviewer] = (reviewsByReviewer[review.reviewer] || 0) + 1;

    if (review.state === 'APPROVED') approvedCount++;
    if (review.state === 'CHANGES_REQUESTED') changesRequestedCount++;
  }
}

return {
  totalReviews,
  reviewsByReviewer,
  averageReviewsPerPR: prs.length > 0 ? totalReviews / prs.length : 0,
  approvalRate: totalReviews > 0 ? (approvedCount / totalReviews) * 100 : 0,
  changesRequestedRate: totalReviews > 0 ? (changesRequestedCount / totalReviews) * 100 : 0,
};
```

#### **calculateCommitActivityStats()**

```typescript
// Location: github-client.ts:650-695
calculateCommitActivityStats(commits: Commit[]): {
  totalCommits: number;
  commitsByAuthor: Record<string, number>;
  commitsByDay: Array<{ date: string; count: number }>;
  averageCommitsPerDay: number;
  peakCommitDay: string;
}
```

**Grouping Logic:**

```typescript
const commitsByAuthor: Record<string, number> = {};
const commitsByDay: Map<string, number> = new Map();

for (const commit of commits) {
  // Count by author
  const author = commit.author.name;
  commitsByAuthor[author] = (commitsByAuthor[author] || 0) + 1;

  // Count by day (YYYY-MM-DD)
  const day = commit.date.split('T')[0];
  commitsByDay.set(day, (commitsByDay.get(day) || 0) + 1);
}

// Convert to array and sort by date
const commitsByDayArray = Array.from(commitsByDay.entries())
  .map(([date, count]) => ({ date, count }))
  .sort((a, b) => a.date.localeCompare(b.date));

// Find peak day
const peakCommitDay = commitsByDayArray.reduce((max, day) => (day.count > max.count ? day : max), {
  date: '',
  count: 0,
}).date;

return {
  totalCommits: commits.length,
  commitsByAuthor,
  commitsByDay: commitsByDayArray,
  averageCommitsPerDay: commitsByDayArray.length > 0 ? commits.length / commitsByDayArray.length : 0,
  peakCommitDay,
};
```

#### **calculateCodeChangeStats()**

```typescript
// Location: github-client.ts:698-734
calculateCodeChangeStats(commits: Commit[]): {
  totalLinesAdded: number;
  totalLinesDeleted: number;
  netLineChange: number;
  filesChanged: number;
  changesByAuthor: Record<string, { additions: number; deletions: number }>;
}
```

**Aggregation Logic:**

```typescript
let totalLinesAdded = 0;
let totalLinesDeleted = 0;
const filesChanged = new Set<string>();
const changesByAuthor: Record<string, { additions: number; deletions: number }> = {};

for (const commit of commits) {
  if (commit.stats) {
    totalLinesAdded += commit.stats.additions;
    totalLinesDeleted += commit.stats.deletions;

    const author = commit.author.name;
    if (!changesByAuthor[author]) {
      changesByAuthor[author] = { additions: 0, deletions: 0 };
    }
    changesByAuthor[author].additions += commit.stats.additions;
    changesByAuthor[author].deletions += commit.stats.deletions;
  }
}

return {
  totalLinesAdded,
  totalLinesDeleted,
  netLineChange: totalLinesAdded - totalLinesDeleted,
  filesChanged: filesChanged.size,
  changesByAuthor,
};
```

### **Response Structures**

#### **Commit Response**

```typescript
{
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
    committer: { name: string; email: string; date: string };
  };
  author: { login: string; id: number; avatar_url: string } | null;
  parents: Array<{ sha: string; url: string }>;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
  files?: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
  }>;
  html_url: string;
}
```

#### **Pull Request Response**

```typescript
{
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  user: {
    login: string;
    id: number;
  }
  assignees: Array<{ login: string }>;
  requested_reviewers: Array<{ login: string }>;
  labels: Array<{ name: string; color: string }>;
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
  html_url: string;
}
```

### **Enhanced PR Metrics**

The GitHub client calculates additional metrics for PRs:

#### **Review Metrics**

```typescript
{
  reviews: Array<{
    reviewer: string;
    state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
    submittedAt: string;
    comments: number;
  }>;
  reviewComments: number;
  timeToFirstReview?: number;  // Hours
  timeToMerge?: number;         // Hours
}
```

#### **Linked Issues**

```typescript
{
  linkedIssues: string[];  // Jira issue keys extracted from title/body
}
```

---

## GitHub GraphQL API v4

### **Base Configuration**

| Property           | Value                                  |
| ------------------ | -------------------------------------- |
| **API Version**    | GitHub GraphQL API v4                  |
| **Endpoint**       | `https://api.github.com/graphql`       |
| **Library**        | `@octokit/graphql`                     |
| **Authentication** | Token-based (same as REST)             |
| **Client File**    | `src/clients/github-graphql-client.ts` |

### **Queries Used**

#### **1. Pull Request Search**

**Purpose**: Efficiently search PRs by date range with nested data

**Query:**

```graphql
query ($searchQuery: String!, $cursor: String) {
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
        author {
          login
        }
        baseRefName
        headRefName
        url
        additions
        deletions
        commits {
          totalCount
        }
        changedFiles
        reviews {
          totalCount
        }
        comments {
          totalCount
        }
        labels(first: 10) {
          nodes {
            name
          }
        }
        assignees(first: 10) {
          nodes {
            login
          }
        }
      }
    }
  }
}
```

**Variables:**

```typescript
{
  searchQuery: "repo:owner/repo is:pr created:2025-09-17..2025-10-01",
  cursor: null  // For pagination
}
```

**Advantages over REST:**

- Single request fetches commits, reviews, comments counts
- Cursor-based pagination more reliable
- 100 items per page (same as REST)
- Reduced API calls (1 request vs 3+ REST calls)

#### **2. Repository Info**

**Query:**

```graphql
query ($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    name
    owner {
      login
    }
    url
    description
    defaultBranchRef {
      name
    }
    createdAt
    updatedAt
    pushedAt
  }
}
```

#### **3. Commit History**

**Query:**

```graphql
query ($owner: String!, $repo: String!, $branch: String!, $limit: Int!, $since: GitTimestamp, $until: GitTimestamp) {
  repository(owner: $owner, name: $repo) {
    ref(qualifiedName: $branch) {
      target {
        ... on Commit {
          history(first: $limit, since: $since, until: $until) {
            pageInfo {
              hasNextPage
              endCursor
            }
            totalCount
            nodes {
              oid
              message
              committedDate
              url
              author {
                name
                email
                date
              }
              additions
              deletions
              changedFiles
            }
          }
        }
      }
    }
  }
}
```

**Advantages:**

- Fetches commit stats (additions/deletions) in single request
- REST requires separate call per commit for stats
- Date filtering at API level (more efficient)

#### **4. Commit Details**

**Query:**

```graphql
query ($owner: String!, $repo: String!, $sha: GitObjectID!) {
  repository(owner: $owner, name: $repo) {
    object(oid: $sha) {
      ... on Commit {
        oid
        message
        committedDate
        url
        author {
          name
          email
          date
        }
        additions
        deletions
        changedFiles
      }
    }
  }
}
```

#### **5. Commit Search**

**Query:**

```graphql
query ($searchQuery: String!) {
  search(query: $searchQuery, type: COMMIT, first: 100) {
    commitCount
    nodes {
      ... on Commit {
        oid
        message
        committedDate
        url
        author {
          name
          email
          date
        }
        additions
        deletions
        changedFiles
      }
    }
  }
}
```

**Search Query Examples:**

```
repo:owner/repo SCNT-1234 committer-date:>=2025-09-17
```

---

## API Usage Patterns

### **Jira Client Features**

#### **1. Automatic Pagination**

```typescript
// Handles pagination automatically
const issues = await jiraClient.getSprintIssues(sprintId);
// Returns ALL issues (up to safety limit of 1000)
```

**Implementation:**

- Fetches 50-100 items per request
- Continues until `isLast = true` or max items reached
- Safety limit prevents infinite loops

#### **2. Custom Field Extraction**

```typescript
// Automatically tries multiple common field IDs
const storyPoints = extractStoryPoints(fields);
// Checks: customfield_10016, customfield_10004, customfield_10002
```

#### **3. Changelog Processing**

```typescript
const enhancedIssue = await jiraClient.getEnhancedIssue(issueKey);
// Returns issue with:
// - statusHistory: Array<StatusChange>
// - sprintHistory: Array<SprintChange>
// - timeInStatus: Record<string, number>
// - cycleTime: number (days)
// - leadTime: number (days)
```

#### **4. JQL Query Builder**

```typescript
const jql = jiraClient.buildJQL({
  project: 'SCNT',
  sprint: '44298',
  status: ['Done', 'Closed'],
});
// Returns: 'project = "SCNT" AND sprint = "44298" AND status IN ("Done", "Closed")'
```

#### **5. Enhanced Sprint Issues**

```typescript
// Fetches first 20 issues with full changelog data
const enhancedIssues = await jiraClient.getEnhancedSprintIssues(sprintId);
// Rate limiting: 200ms delay every 15 requests
```

### **GitHub REST Client Features**

#### **1. Automatic Pagination**

```typescript
// Fetches all commits in date range
const commits = await githubClient.getAllCommits(owner, repo, since, until);
// Handles pagination automatically (max 10,000 commits)
```

#### **2. Date Range Filtering**

```typescript
// Filter PRs by sprint dates
const prs = await githubClient.getPullRequests(owner, repo, {
  since: '2025-09-17T00:00:00Z',
  until: '2025-10-01T23:59:59Z',
  state: 'all',
});
```

#### **3. Jira Issue Linking**

```typescript
// Extract Jira issue keys from commit messages
const issueKeys = githubClient.extractIssueKeysFromCommitMessage('SCNT-1234: Fix authentication bug');
// Returns: ['SCNT-1234']

// Find all commits for specific Jira issues
const commitsByIssue = await githubClient.findCommitsWithJiraReferences(
  owner,
  repo,
  ['SCNT-1234', 'SCNT-5678'],
  since,
  until
);
// Returns: Array<{ issueKey: string; commits: Commit[] }>
```

**Supported Patterns:**

- `PROJ-123` - Standard Jira format
- `fixes PROJ-123` - Keywords: fixes, closes, resolves
- `#PROJ-123` - Hash prefix

#### **4. PR Enhancement**

```typescript
const enhancedPR = await githubClient.getEnhancedPullRequest(owner, repo, prNumber);
// Returns PR with:
// - reviews: Array<PRReview>
// - reviewComments: number
// - timeToFirstReview?: number (hours)
// - timeToMerge?: number (hours)
// - linkedIssues: string[]
```

#### **5. Analytics Methods**

**Code Review Stats:**

```typescript
const stats = githubClient.calculateCodeReviewStats(prs);
// Returns:
// {
//   totalReviews: number;
//   reviewsByReviewer: Record<string, number>;
//   averageReviewsPerPR: number;
//   approvalRate: number;
//   changesRequestedRate: number;
// }
```

**Commit Activity Stats:**

```typescript
const stats = githubClient.calculateCommitActivityStats(commits);
// Returns:
// {
//   totalCommits: number;
//   commitsByAuthor: Record<string, number>;
//   commitsByDay: Array<{ date: string; count: number }>;
//   averageCommitsPerDay: number;
//   peakCommitDay: string;
// }
```

**Code Change Stats:**

```typescript
const stats = githubClient.calculateCodeChangeStats(commits);
// Returns:
// {
//   totalLinesAdded: number;
//   totalLinesDeleted: number;
//   netLineChange: number;
//   filesChanged: number;
//   changesByAuthor: Record<string, { additions: number; deletions: number }>;
// }
```

#### **6. Rate Limiting**

```typescript
// Automatic delay every 5 enhanced PR requests
for (const pr of prs) {
  const enhanced = await getEnhancedPullRequest(owner, repo, pr.number);
  // 1000ms delay every 5 requests
}
```

### **GitHub GraphQL Client Features**

#### **1. Efficient Date Queries**

```typescript
// Single GraphQL query vs multiple REST calls
const prs = await graphqlClient.searchPullRequestsByDateRange(owner, repo, startDate, endDate, 'all');
// Fetches PRs with commits, reviews, comments in ONE request
```

#### **2. Cursor-Based Pagination**

```typescript
// More reliable than page-based pagination
let cursor = null;
while (hasNextPage) {
  const response = await graphqlClient.query({ cursor });
  cursor = response.pageInfo.endCursor;
}
```

#### **3. Nested Data Fetching**

```typescript
// Single request fetches:
// - PR metadata
// - Commit count
// - Review count
// - Comment count
// - Labels
// - Assignees
```

**REST Equivalent:** Would require 4+ requests per PR

---

## Rate Limits & Quotas

### **Jira Server**

| Limit Type               | Value                   | Notes                    |
| ------------------------ | ----------------------- | ------------------------ |
| **Official Rate Limit**  | None                    | Self-hosted Jira Server  |
| **Application Throttle** | 100ms min interval      | Prevents server overload |
| **Pagination Size**      | 50-100 items            | Per request              |
| **Safety Limit**         | 1000 issues             | Per sprint query         |
| **Enhanced Issues**      | 20 issues               | With full changelog      |
| **Enhancement Rate**     | 200ms delay/15 requests | Changelog fetching       |

### **GitHub REST API**

| Limit Type                     | Value         | Notes             |
| ------------------------------ | ------------- | ----------------- |
| **Rate Limit (Authenticated)** | 5000 req/hour | Primary API       |
| **Search API Limit**           | 30 req/minute | Stricter limit    |
| **Max Per Page**               | 100 items     | Pagination        |
| **Search Results Limit**       | 1000 items    | 10 pages max      |
| **Commits Safety Limit**       | 10,000        | Application limit |
| **PRs Safety Limit**           | 5,000         | Application limit |

**Rate Limit Headers:**

```
x-ratelimit-limit: 5000
x-ratelimit-remaining: 4999
x-ratelimit-reset: 1633024800
retry-after: 60
```

**Handling:**

- Automatic retry on 429 responses
- Exponential backoff with jitter
- Rate limit info cached in client

### **GitHub GraphQL API**

| Limit Type         | Value            | Notes               |
| ------------------ | ---------------- | ------------------- |
| **Rate Limit**     | 5000 points/hour | Point-based system  |
| **Query Cost**     | 1+ points        | Based on complexity |
| **Max Nodes**      | 100 per query    | Node limit          |
| **Search Results** | 1000 items       | 10 pages max        |

**Cost Calculation:**

- Simple query: 1 point
- Nested queries: Cost multiplied by nesting depth
- Generally more efficient than REST

---

## Authentication

### **Jira Authentication**

#### **Option 1: Bearer Token** (Jira Server)

```typescript
// Environment Variables
JIRA_AUTH_TYPE=bearer
JIRA_API_TOKEN=your_bearer_token

// HTTP Header
Authorization: Bearer your_bearer_token
```

#### **Option 2: Basic Auth** (Jira Cloud/Server)

```typescript
// Environment Variables
JIRA_AUTH_TYPE=basic
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your_api_token

// HTTP Header
Authorization: Basic base64(email:token)
```

**Configuration:**

```typescript
// src/clients/jira-client.ts:108
const authHeader =
  config.jira.authType === 'bearer'
    ? `Bearer ${config.jira.apiToken}`
    : `Basic ${Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64')}`;
```

### **GitHub Authentication**

#### **Personal Access Token**

```typescript
// Environment Variable
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

// HTTP Headers
Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx
Accept: application/vnd.github.v3+json
User-Agent: JiraGitHubReporter/1.0.0
```

**Required Scopes:**

- `repo` - For private repositories (full access)
- `public_repo` - For public repositories only
- `read:user` - For user information

**Token Generation:**

1. GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `repo`, `read:user`
4. Copy token (shown only once)

---

## Performance Optimizations

### **Implemented Optimizations**

#### **1. Multi-Tier Caching**

```typescript
// Memory Cache (Tier 1)
- TTL: 5 minutes (default)
- Size: 100 entries
- Strategy: LRU eviction

// Redis Cache (Tier 2)
- TTL: 30 minutes
- Compression: gzip (35-40% reduction)
- Fallback: Graceful degradation to memory-only
```

**Cache Keys:**

```typescript
// Pattern: service:hash(endpoint+params)
jira: 12345678; // Sprint issues
github: 87654321; // Commits
graphql: 11223344; // GraphQL queries
```

#### **2. Request Deduplication**

```typescript
// Hash-based cache key prevents duplicate requests
const key = generateCacheKey(endpoint, params);
const cached = await cache.get(key);
if (cached) return cached;
```

#### **3. Exponential Backoff**

```typescript
// Retry logic with jitter
const delay = baseDelay * Math.pow(2, attempt - 1) + jitter;
// Example: 1000ms → 2000ms → 4000ms → 8000ms (max 30s)
```

#### **4. Parallel Requests**

```typescript
// Where dependencies allow
const [sprints, boards, issues] = await Promise.all([
  jiraClient.getSprints(boardId),
  jiraClient.getBoards(),
  jiraClient.getSprintIssues(sprintId),
]);
```

#### **5. Selective Enhancement**

```typescript
// Only fetch changelog for sample of issues (20 out of 121)
const enhancedIssues = await jiraClient.getEnhancedSprintIssues(sprintId);
// Reduces API calls by 83% while maintaining representative data
```

#### **6. Compression**

```typescript
// Redis cache uses gzip compression
- Original size: 1.2 MB
- Compressed: 700 KB
- Savings: 35-40%
```

### **Identified Bottlenecks**

From backend architecture analysis (see `.claude/BACKEND_ARCHITECTURE_ANALYSIS.md`):

#### **1. N+1 Query Pattern**

```typescript
// Current (SLOW)
for (const pr of prs) {
  const reviews = await getReviews(pr.number); // Sequential
}

// Recommended (FAST)
const reviews = await Promise.all(prs.map(pr => getReviews(pr.number)));
```

**Impact:** 30% slower for 50 PRs

#### **2. Serial PR Fetching**

```typescript
// Current
const prs = await getAllPullRequests(); // Sequential pagination

// Recommended
// Use GraphQL for date-range queries (already implemented in graphql-client.ts)
const prs = await graphqlClient.searchPullRequestsByDateRange();
```

**Impact:** 40% fewer requests with GraphQL

#### **3. No Request Batching**

```typescript
// Current: Multiple separate calls for similar data
const commit1 = await getCommit(sha1);
const commit2 = await getCommit(sha2);
const commit3 = await getCommit(sha3);

// Recommended: Batch similar requests
const commits = await Promise.all([getCommit(sha1), getCommit(sha2), getCommit(sha3)]);
```

**Impact:** 25% reduction in total API calls

### **Optimization Roadmap**

**Phase 1: Quick Wins** (1 week)

- ✅ Implement Promise.all for independent requests
- ✅ Switch to GraphQL for PR date-range queries
- ✅ Add request batching utility

**Phase 2: Architecture** (2 weeks)

- ⬜ Implement request deduplication
- ⬜ Add Redis pipeline operations
- ⬜ GraphQL query optimization

**Phase 3: Advanced** (1 month)

- ⬜ Implement DataLoader pattern
- ⬜ Add query result streaming
- ⬜ Implement adaptive caching (TTL based on data volatility)

---

## Cross-API Integration

### **Jira ↔ GitHub Linking**

#### **Issue Key Extraction**

**Regex Pattern:**

```typescript
/\b[A-Z][A-Z0-9_]*-\d+\b/g;
```

**Examples:**

- `SCNT-1234: Fix authentication bug` → `['SCNT-1234']`
- `Fixes PROJ-567 and PROJ-568` → `['PROJ-567', 'PROJ-568']`
- `#TEAM-999 Update documentation` → `['TEAM-999']`

**Supported Formats:**

1. Standard: `PROJ-123`
2. Keywords: `fixes PROJ-123`, `closes PROJ-123`, `resolves PROJ-123`
3. Hash prefix: `#PROJ-123`

#### **Linking Methods**

**1. Find Commits with Jira References**

```typescript
const result = await githubClient.findCommitsWithJiraReferences(
  'owner',
  'repo',
  ['SCNT-1234', 'SCNT-5678'],  // Issue keys to search for
  '2025-09-17T00:00:00Z',      // Since date
  '2025-10-01T23:59:59Z'       // Until date
);

// Returns:
[
  {
    issueKey: 'SCNT-1234',
    commits: [
      { sha: 'abc123', message: 'SCNT-1234: Fix bug', ... },
      { sha: 'def456', message: 'Update SCNT-1234', ... }
    ]
  },
  {
    issueKey: 'SCNT-5678',
    commits: [
      { sha: 'ghi789', message: 'Fixes SCNT-5678', ... }
    ]
  }
]
```

**Implementation:**

1. Fetch all commits in date range
2. Extract issue keys from each commit message
3. Group commits by issue key
4. Sort by date (most recent first)
5. Limit to 20 commits per issue (configurable)

**2. Find Pull Requests with Jira References**

```typescript
const result = await githubClient.findPullRequestsWithJiraReferences(
  'owner',
  'repo',
  ['SCNT-1234', 'SCNT-5678'],
  '2025-09-17T00:00:00Z',
  '2025-10-01T23:59:59Z',
  5  // Max PRs per issue
);

// Returns:
[
  {
    issueKey: 'SCNT-1234',
    prs: [
      { number: 42, title: 'SCNT-1234: Authentication fix', ... }
    ]
  }
]
```

**Implementation:**

1. Fetch all PRs in date range
2. Check title and body for issue keys
3. Group PRs by issue key
4. Sort by creation date (most recent first)
5. Limit per issue (default: 5)

#### **Integration Use Cases**

**1. Sprint Report Generation**

```typescript
// Get sprint issues from Jira
const issues = await jiraClient.getSprintIssues(sprintId);

// Find related GitHub activity
for (const issue of issues) {
  const commits = await githubClient.findCommitsWithJiraReferences(
    owner,
    repo,
    [issue.key],
    sprint.startDate,
    sprint.endDate
  );

  const prs = await githubClient.findPullRequestsWithJiraReferences(
    owner,
    repo,
    [issue.key],
    sprint.startDate,
    sprint.endDate
  );

  // Combine Jira + GitHub data
  issue.commits = commits[0]?.commits || [];
  issue.pullRequests = prs[0]?.prs || [];
}
```

**2. Traceability Analysis**

```typescript
// Find issues without commits
const issuesWithoutCommits = issues.filter(issue => !commits.some(c => c.issueKey === issue.key));

// Find commits without linked issues
const orphanCommits = commits.filter(commit => !githubClient.extractIssueKeysFromCommitMessage(commit.message).length);
```

**3. Code Review Quality**

```typescript
// Analyze PR review coverage for sprint issues
for (const issue of issues) {
  const prs = await findPullRequestsWithJiraReferences([issue.key]);
  const enhancedPRs = await Promise.all(prs.map(pr => githubClient.getEnhancedPullRequest(owner, repo, pr.number)));

  issue.reviewMetrics = {
    totalPRs: enhancedPRs.length,
    totalReviews: enhancedPRs.reduce((sum, pr) => sum + (pr.reviews?.length || 0), 0),
    averageTimeToReview: calculateAverage(enhancedPRs.map(pr => pr.timeToFirstReview)),
  };
}
```

---

## Complete Method Inventory

### **Jira Client** (`src/clients/jira-client.ts`)

**Total Methods:** 17

#### **Sprint Operations** (3)

```typescript
getSprints(boardId: string, state?: 'active' | 'closed' | 'future'): Promise<SprintData[]>
getSprintData(sprintId: string): Promise<SprintData>
getSprintIssues(sprintId: string, fields?: string[], maxResults?: number): Promise<Issue[]>
getEnhancedSprintIssues(sprintId: string, maxResults?: number): Promise<Issue[]>
```

#### **Issue Operations** (5)

```typescript
getIssueDetails(issueKey: string, expand?: string[]): Promise<Issue>
getEnhancedIssue(issueKey: string): Promise<Issue>
getIssueChangelog(issueKey: string): Promise<any>
searchIssues(jql: string, fields?: string[], maxResults?: number): Promise<Issue[]>
```

#### **Board Operations** (1)

```typescript
getBoards(): Promise<Array<{ id: number; name: string; type: string }>>
```

#### **Utility Methods** (6)

```typescript
validateConnection(): Promise<{ valid: boolean; user?: string; error?: string }>
getServerInfo(): Promise<{ version: string; buildNumber: string; serverTitle: string }>
buildJQL(conditions: Record<string, any>): string
clearCache(): Promise<void>
getCacheStats(): { size: number; entries: number; hits: number; misses: number; hitRate: number }
healthCheck(): Promise<{ healthy: boolean; responseTime: number; error?: string }>
```

#### **Internal/Private Methods** (8)

```typescript
transformSprintData(sprint: any): SprintData
transformIssueData(issue: any): Issue
extractStoryPoints(fields: any): number | undefined
extractEpicLink(fields: any): string | undefined
extractEpicName(fields: any): string | undefined
extractFlagged(fields: any): boolean
extractBlockerReason(fields: any): string | undefined
extractStatusHistory(histories: any[]): StatusChange[]
extractSprintHistory(histories: any[]): SprintChange[]
calculateTimeInStatus(statusHistory: StatusChange[]): Record<string, number>
calculateCycleTime(statusHistory: StatusChange[], createdDate: string): number
calculateLeadTime(createdDate: string, resolvedDate?: string): number
```

### **GitHub REST Client** (`src/clients/github-client.ts`)

**Total Methods:** 28

#### **Repository Operations** (1)

```typescript
getRepositoryInfo(owner: string, repo: string): Promise<GitHubRepository>
```

#### **Commit Operations** (6)

```typescript
getCommits(owner: string, repo: string, options?: {...}): Promise<Commit[]>
getAllCommits(owner: string, repo: string, since?: string, until?: string, author?: string): Promise<Commit[]>
getCommitDetails(owner: string, repo: string, sha: string): Promise<Commit>
searchCommitsByMessage(owner: string, repo: string, query: string, since?: string, until?: string): Promise<Commit[]>
findCommitsWithJiraReferences(owner: string, repo: string, issueKeys: string[], since?: string, until?: string): Promise<Array<{ issueKey: string; commits: Commit[] }>>
```

#### **Pull Request Operations** (9)

```typescript
getPullRequests(owner: string, repo: string, options?: {...}): Promise<PullRequest[]>
getAllPullRequests(owner: string, repo: string, since?: string, until?: string): Promise<PullRequest[]>
getPullRequestDetails(owner: string, repo: string, number: number): Promise<PullRequest>
getEnhancedPullRequest(owner: string, repo: string, prNumber: number): Promise<PullRequest>
getEnhancedPullRequests(owner: string, repo: string, options?: {...}): Promise<PullRequest[]>
getPullRequestReviews(owner: string, repo: string, prNumber: number): Promise<PRReview[]>
getPullRequestComments(owner: string, repo: string, prNumber: number): Promise<number>
searchPullRequestsByDateRange(owner: string, repo: string, since?: string, until?: string, state?: string): Promise<PullRequest[]>
findPullRequestsWithJiraReferences(owner: string, repo: string, issueKeys: string[], since?: string, until?: string, maxPRsPerIssue?: number): Promise<Array<{ issueKey: string; prs: PullRequest[] }>>
```

#### **Analytics Methods** (3)

```typescript
calculateCodeReviewStats(prs: PullRequest[]): {...}
calculateCommitActivityStats(commits: Commit[]): {...}
calculateCodeChangeStats(commits: Commit[]): {...}
```

#### **Utility Methods** (9)

```typescript
validateConnection(): Promise<{ valid: boolean; user?: string; scopes?: string[]; rateLimit?: any; error?: string }>
getAuthenticatedUser(): Promise<{ login: string; id: number; name: string; email: string; company?: string }>
getRateLimitStatus(): Promise<{ core: {...}; search: {...} }>
buildRepositoryUrl(owner: string, repo: string): string
buildCommitUrl(owner: string, repo: string, sha: string): string
buildPullRequestUrl(owner: string, repo: string, number: number): string
extractIssueKeysFromCommitMessage(message: string): string[]
clearCache(): Promise<void>
getCacheStats(): {...}
healthCheck(): Promise<{ healthy: boolean; responseTime: number; error?: string }>
```

### **GitHub GraphQL Client** (`src/clients/github-graphql-client.ts`)

**Total Methods:** 6

#### **Pull Request Operations** (1)

```typescript
searchPullRequestsByDateRange(owner: string, repo: string, startDate: string, endDate: string, state?: 'open' | 'closed' | 'merged' | 'all'): Promise<PullRequest[]>
```

#### **Repository Operations** (1)

```typescript
getRepositoryInfo(owner: string, repo: string): Promise<GitHubRepository>
```

#### **Commit Operations** (4)

```typescript
getCommits(owner: string, repo: string, options?: { since?: string; until?: string; branch?: string; limit?: number }): Promise<Commit[]>
getCommitDetails(owner: string, repo: string, sha: string): Promise<Commit>
searchCommitsByMessage(owner: string, repo: string, query: string, since?: string, until?: string): Promise<Commit[]>
```

### **Base API Client** (`src/clients/base-client.ts`)

**Abstract Base Class** - Provides shared functionality for all API clients

#### **Core Methods** (7)

```typescript
makeRequest<T>(endpoint: string, options?: AxiosRequestConfig, cacheOptions?: {...}): Promise<T>
clearCache(): Promise<void>
getCacheStats(): { size: number; entries: number; hits: number; misses: number; hitRate: number }
getCacheManager(): CacheManager
getRateLimitInfo(): RateLimitInfo | null
healthCheck(): Promise<{ healthy: boolean; responseTime: number; error?: string }>
```

#### **Abstract Methods** (2)

```typescript
abstract get serviceName(): string
abstract performHealthCheck(): Promise<void>
```

#### **Internal Methods** (15+)

- Request retry logic
- Rate limit checking
- Cache key generation
- Error transformation
- Request/response logging
- Exponential backoff calculation

### **Detailed Base Client Specifications**

#### **Retry Configuration**

```typescript
// Location: base-client.ts:82-89
interface RetryConfig {
  maxRetries: 3;
  baseDelay: 1000; // 1 second
  maxDelay: 30000; // 30 seconds
  retryCondition: (error: AxiosError) => boolean;
}
```

**Retryable Errors:**

- HTTP 429 (Rate Limit) - Always retry
- HTTP 5xx (Server Errors) - Retry
- Network Errors (no response) - Retry
- HTTP 4xx (Client Errors) - **Do NOT retry** (except 429)

#### **Exponential Backoff Algorithm**

```typescript
// Location: base-client.ts:226-231
calculateRetryDelay(attempt: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.1 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxDelay);
}

// Example delays:
// Attempt 1: 1000ms + jitter (0-100ms) = ~1000-1100ms
// Attempt 2: 2000ms + jitter (0-200ms) = ~2000-2200ms
// Attempt 3: 4000ms + jitter (0-400ms) = ~4000-4400ms
```

**Jitter:** 10% random variation prevents thundering herd

#### **makeRequest() - Core Request Method**

```typescript
// Location: base-client.ts:121-157
protected async makeRequest<T>(
  endpoint: string,
  options: AxiosRequestConfig = {},
  cacheOptions: { ttl?: number; useCache?: boolean } = {}
): Promise<T>
```

**Flow:**

```typescript
// 1. Check cache (if enabled and GET request)
if (useCache && options.method !== 'POST') {
  const cached = await getFromCache(endpoint, options);
  if (cached) return cached;
}

// 2. Check rate limits
await checkRateLimit();

// 3. Make request with retry logic (up to 3 attempts)
const response = await makeRequestWithRetry(endpoint, options);

// 4. Cache successful response
if (useCache && options.method !== 'POST') {
  await setCache(endpoint, options, response.data, ttl);
}

return response.data;
```

**Cache Decision Matrix:**
| Method | useCache | Cached? |
|--------|----------|---------|
| GET | true | ✅ Yes |
| POST | true | ❌ No |
| GET | false | ❌ No |

#### **Cache Key Generation**

```typescript
// Location: base-client.ts:238-258
generateCacheKey(endpoint: string, options: AxiosRequestConfig): string {
  const params = JSON.stringify({
    endpoint,
    method: options.method || 'GET',
    params: options.params,
    data: options.data
  });

  // Simple hash function (32-bit integer)
  let hash = 0;
  for (let i = 0; i < params.length; i++) {
    const char = params.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;  // Convert to 32-bit integer
  }

  return `${serviceName}:${Math.abs(hash)}`;
}

// Examples:
// jira:12345678 - Sprint issues
// github:87654321 - Commits
// graphql:11223344 - GraphQL queries
```

#### **Error Transformation**

```typescript
// Location: base-client.ts:326-373
transformError(error: AxiosError): BaseError {
  const status = error.response?.status;
  const message = extractErrorMessage(error);

  // 401/403 → AuthenticationError
  if (status === 401 || status === 403) {
    return new AuthenticationError(serviceName, { status, message, endpoint });
  }

  // 429 → RateLimitError
  if (status === 429) {
    const retryAfter = extractRetryAfter(error);
    return new RateLimitError(serviceName, retryAfter, { status, message });
  }

  // Timeout → TimeoutError
  if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
    return new TimeoutError(endpoint, timeout, { status, message, code: error.code });
  }

  // Default → BaseError
  const retryable = isRetryableError(error);
  return new BaseError(message, 'API_ERROR', retryable, undefined, { status, endpoint, method });
}
```

**Error Hierarchy:**

```
BaseError (retryable flag)
├─ AuthenticationError (401/403)
├─ RateLimitError (429)
└─ TimeoutError (ECONNABORTED)
```

#### **Rate Limit Handling**

```typescript
// Location: base-client.ts:281-302
async checkRateLimit(): Promise<void> {
  if (!rateLimitInfo) return;

  const now = Date.now() / 1000;

  // Check if rate limit exceeded
  if (rateLimitInfo.remaining <= 0 && now < rateLimitInfo.reset) {
    const retryAfter = rateLimitInfo.reset - now;
    throw new RateLimitError(serviceName, Math.ceil(retryAfter));
  }

  // Basic throttling: min 100ms between requests
  const minInterval = 100;
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  if (timeSinceLastRequest < minInterval) {
    await delay(minInterval - timeSinceLastRequest);
  }

  lastRequestTime = Date.now();
}
```

**Rate Limit Headers (GitHub):**

```
x-ratelimit-limit: 5000
x-ratelimit-remaining: 4999
x-ratelimit-reset: 1633024800  (Unix timestamp)
retry-after: 60  (seconds, for 429 responses)
```

#### **Request/Response Interceptors**

```typescript
// Location: base-client.ts:91-118

// REQUEST INTERCEPTOR
httpClient.interceptors.request.use(config => {
  // Add request ID and timestamp for tracking
  config.metadata = {
    requestId: generateRequestId(), // Random 13-char ID
    startTime: Date.now(),
  };
  return config;
});

// RESPONSE INTERCEPTOR
httpClient.interceptors.response.use(
  response => {
    updateRateLimitInfo(response); // Extract rate limit headers
    logRequest(response); // Log success (if enabled)
    return response;
  },
  error => {
    logError(error); // Log failure (if enabled)
    return Promise.reject(transformError(error));
  }
);
```

**Logging Control:**

- Controlled by `ENABLE_API_LOGGING` env variable
- **stdio mode**: Logging completely disabled (prevents JSON-RPC interference)
- **TTY mode**: Logs to stderr with structured JSON

#### **Health Check Implementation**

```typescript
// Location: base-client.ts:491-511
async healthCheck(): Promise<{ healthy: boolean; responseTime: number; error?: string }> {
  const startTime = Date.now();

  try {
    await performHealthCheck();  // Abstract method implemented by each client
    return {
      healthy: true,
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

**Health Check Endpoints:**

- **Jira**: `/rest/api/2/myself`
- **GitHub**: `/user`
- **No caching**: Always fresh health status

---

## Summary Statistics

### **API Inventory**

| Category                   | Count                                       |
| -------------------------- | ------------------------------------------- |
| **Total API Clients**      | 4 (Jira, GitHub REST, GitHub GraphQL, Base) |
| **Total Unique Endpoints** | 25+                                         |
| **Total Public Methods**   | 51                                          |
| **Total Internal Methods** | 30+                                         |

### **By Client**

| Client                    | Endpoints | Public Methods | Key Features                         |
| ------------------------- | --------- | -------------- | ------------------------------------ |
| **Jira Client**           | 8         | 17             | Pagination, custom fields, changelog |
| **GitHub REST Client**    | 12        | 28             | Pagination, analytics, Jira linking  |
| **GitHub GraphQL Client** | 5 queries | 6              | Efficient queries, nested data       |
| **Base Client**           | N/A       | 7              | Caching, retry, rate limiting        |

### **Endpoints by Type**

| Type                  | Jira | GitHub REST | GitHub GraphQL |
| --------------------- | ---- | ----------- | -------------- |
| **Read Operations**   | 8    | 12          | 5              |
| **Search Operations** | 1    | 2           | 3              |
| **Health/Auth**       | 2    | 2           | 0              |
| **Total**             | 8    | 12          | 5              |

### **Performance Features**

| Feature            | Jira             | GitHub REST      | GitHub GraphQL   |
| ------------------ | ---------------- | ---------------- | ---------------- |
| **Caching**        | ✅ Yes           | ✅ Yes           | ✅ Yes           |
| **Pagination**     | ✅ Automatic     | ✅ Automatic     | ✅ Cursor-based  |
| **Rate Limiting**  | ✅ Throttle      | ✅ Auto-retry    | ✅ Point-based   |
| **Retry Logic**    | ✅ Exponential   | ✅ Exponential   | ✅ Exponential   |
| **Error Handling** | ✅ Custom errors | ✅ Custom errors | ✅ Custom errors |

### **Authentication Methods**

| Service            | Method         | Header                  | Configurable |
| ------------------ | -------------- | ----------------------- | ------------ |
| **Jira**           | Bearer / Basic | `Authorization`         | ✅ Yes (env) |
| **GitHub REST**    | PAT            | `Authorization: Bearer` | ❌ No        |
| **GitHub GraphQL** | PAT            | `Authorization: token`  | ❌ No        |

### **Cache Configuration**

| Tier       | Storage    | TTL    | Max Size    | Compression      |
| ---------- | ---------- | ------ | ----------- | ---------------- |
| **Memory** | In-process | 5 min  | 100 entries | ❌ No            |
| **Redis**  | External   | 30 min | Unlimited   | ✅ gzip (35-40%) |

---

## Related Documentation

- **[CLAUDE.md](../CLAUDE.md)** - Project overview and architecture
- **[CLAUDE_ARCHITECTURE.md](../.claude/CLAUDE_ARCHITECTURE.md)** - System architecture details
- **[BACKEND_ARCHITECTURE_ANALYSIS.md](../claudedocs/BACKEND_ARCHITECTURE_ANALYSIS.md)** - Backend analysis and optimization recommendations
- **[API_WORKING_EXAMPLES.md](./API_WORKING_EXAMPLES.md)** - Real API usage examples
- **[REDIS_CACHE_ARCHITECTURE.md](./REDIS_CACHE_ARCHITECTURE.md)** - Cache optimization guide

---

**Last Updated:** January 2025
**Version:** 2.2.0
**Maintainer:** Development Team
