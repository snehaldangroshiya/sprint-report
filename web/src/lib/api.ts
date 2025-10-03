// API client for NextReleaseMCP web interface
// Interfaces with the Express API server that wraps MCP functionality

const API_BASE = import.meta.env.PROD
  ? '/api'
  : 'http://localhost:3000/api';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorData;

      try {
        errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // Response body is not JSON, use status text
      }

      throw new ApiError(errorMessage, response.status, errorData);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text() as unknown as T;
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`, 0);
  }
}

// Health and monitoring
export const getHealth = () =>
  apiRequest<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    services?: Record<string, { healthy: boolean; latency?: number }>;
  }>('/health');

export const getSystemStatus = () =>
  apiRequest<{
    jira: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    github: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    cache: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      hitRate?: number;
      size?: number;
      error?: string;
    };
  }>('/system-status');

export const getMetrics = () =>
  apiRequest<{
    summary?: {
      cacheHitRate?: number;
      memoryTrend?: 'increasing' | 'decreasing' | 'stable';
    };
    cacheOptimization?: {
      recommendations?: string[];
    };
  }>('/metrics');

// Sprint management
export const getBoards = () =>
  apiRequest<Array<{ id: string; name: string; type: string }>>('/boards');

export const getSprints = (boardId: string, state?: string) =>
  apiRequest<Array<{
    id: string;
    name: string;
    state: string;
    startDate?: string;
    endDate?: string;
    boardId?: number;
  }>>(`/sprints?board_id=${boardId}${state ? `&state=${state}` : ''}`);

export const getSprintIssues = (sprintId: string, maxResults?: number) =>
  apiRequest<Array<{
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
  }>>(`/sprints/${sprintId}/issues${maxResults ? `?max_results=${maxResults}` : ''}`);

export const getSprintMetrics = (sprintId: string) =>
  apiRequest<{
    sprint_id: string;
    total_issues: number;
    completed_issues: number;
    in_progress_issues: number;
    total_story_points: number;
    completed_story_points: number;
    completion_rate: number;
    velocity: number;
  }>(`/sprints/${sprintId}/metrics`);

// Report generation
export const generateSprintReport = (options: {
  sprint_id: string;
  github_owner?: string;
  github_repo?: string;
  format: 'html' | 'markdown' | 'json';
  include_github: boolean;
  template_type?: 'executive' | 'detailed' | 'technical';
}) =>
  apiRequest<{ report: string; metadata: any }>('/reports/sprint', {
    method: 'POST',
    body: JSON.stringify(options),
  });

// Report management
export const getReports = () =>
  apiRequest<Array<{
    id: string;
    sprint_id: string;
    format: string;
    created_at: string;
    size: number;
  }>>('/reports');

export const getReport = (reportId: string) =>
  apiRequest<{
    id: string;
    sprint_id: string;
    format: string;
    created_at: string;
    content: string;
  }>(`/report/${reportId}`);

export const deleteReport = (reportId: string) =>
  apiRequest<{ success: boolean }>(`/report/${reportId}`, {
    method: 'DELETE',
  });

// GitHub integration
export const getCommits = (owner: string, repo: string, since?: string, until?: string, maxResults?: number) =>
  apiRequest<Array<{
    sha: string;
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    authorEmail: string | null;
    date: string;
    url: string;
  }>>(`/github/repos/${owner}/${repo}/commits?${new URLSearchParams({
    ...(since && { since }),
    ...(until && { until }),
    ...(maxResults && { max_results: maxResults.toString() }),
  })}`);

export const getCommitsPaginated = (owner: string, repo: string, page: number, perPage: number, since?: string, until?: string) =>
  apiRequest<Array<{
    sha: string;
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    authorEmail: string | null;
    date: string;
    url: string;
  }>>(`/github/repos/${owner}/${repo}/commits?${new URLSearchParams({
    page: page.toString(),
    per_page: perPage.toString(),
    ...(since && { since }),
    ...(until && { until }),
  })}`);

export const getPullRequests = (owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'all', maxResults?: number) =>
  apiRequest<Array<{
    number: number;
    title: string;
    state: string;
    author: string;
    createdAt: string;
    mergedAt?: string;
    closedAt?: string;
    url: string;
  }>>(`/github/repos/${owner}/${repo}/pulls?${new URLSearchParams({
    state,
    ...(maxResults && { max_results: maxResults.toString() }),
  })}`);

export const getPullRequestsPaginated = (owner: string, repo: string, page: number, perPage: number, state: 'open' | 'closed' | 'all' = 'all') =>
  apiRequest<Array<{
    number: number;
    title: string;
    state: string;
    author: string;
    createdAt: string;
    mergedAt?: string;
    closedAt?: string;
    url: string;
  }>>(`/github/repos/${owner}/${repo}/pulls?${new URLSearchParams({
    page: page.toString(),
    per_page: perPage.toString(),
    state,
  })}`);

// Velocity and metrics
export const getVelocityData = (boardId: string, sprintCount: number = 5) =>
  apiRequest<{
    sprints: Array<{
      id: string;
      name: string;
      velocity: number;
      commitment: number;
      completed: number;
    }>;
    average: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>(`/velocity/${boardId}?sprints=${sprintCount}`);

export const getBurndownData = (sprintId: string) =>
  apiRequest<{
    sprint_id: string;
    days: Array<{
      date: string;
      remaining: number;
      ideal: number;
      completed: number;
    }>;
  }>(`/burndown/${sprintId}`);

// Analytics endpoints
export const getCommitTrends = (owner: string, repo: string, period: string = '6months') =>
  apiRequest<Array<{
    date: string;
    commits: number;
    prs: number;
  }>>(`/analytics/commit-trends/${owner}/${repo}?period=${period}`);

export const getTeamPerformance = (boardId: string, sprintCount: number = 10) =>
  apiRequest<Array<{
    name: string;
    planned: number;
    completed: number;
    velocity: number;
  }>>(`/analytics/team-performance/${boardId}?sprints=${sprintCount}`);

export const getIssueTypeDistribution = (boardId: string, sprintCount: number = 6) =>
  apiRequest<Array<{
    name: string;
    value: number;
    color: string;
  }>>(`/analytics/issue-types/${boardId}?sprints=${sprintCount}`);

// Utility functions
export const api = {
  getHealth,
  getSystemStatus,
  getMetrics,
  getBoards,
  getSprints,
  getSprintIssues,
  getSprintMetrics,
  generateSprintReport,
  getReports,
  getReport,
  deleteReport,
  getCommits,
  getCommitsPaginated,
  getPullRequests,
  getPullRequestsPaginated,
  getVelocityData,
  getBurndownData,
  getCommitTrends,
  getTeamPerformance,
  getIssueTypeDistribution,
};

export default api;