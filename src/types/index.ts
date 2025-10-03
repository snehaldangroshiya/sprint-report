// Core type definitions for the MCP Sprint Reporter

export interface SprintData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  goal?: string;
  state: 'ACTIVE' | 'CLOSED' | 'FUTURE';
  completeDate?: string;
  boardId: number;
}

export interface Issue {
  id: string;
  key: string;
  summary: string;
  status: string;
  assignee: string;
  assigneeAccountId?: string;
  storyPoints?: number | undefined;
  priority: string;
  issueType: string;
  created: string;
  updated: string;
  resolved?: string;
  labels: string[];
  components: string[];
  fixVersions: string[];
}

export interface GitHubRepository {
  owner: string;
  repo: string;
  fullName: string;
  url: string;
  defaultBranch: string;
}

export interface Commit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  date: string;
  url: string;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  createdAt: string;
  updatedAt: string;
  closedAt?: string | undefined;
  mergedAt?: string | undefined;
  author: string;
  reviewers: string[];
  commits: number;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface LegacySprintMetrics {
  totalIssues: number;
  completedIssues: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  completionPercentage: number;
  velocity: number;
  averageCycleTime?: number;
  issuesByStatus: Record<string, number>;
  issuesByAssignee: Record<string, number>;
}

export interface GitHubActivity {
  totalCommits: number;
  totalPullRequests: number;
  mergedPullRequests: number;
  openPullRequests: number;
  commitsByDay: Array<{ date: string; count: number }>;
  commitsByAuthor: Record<string, number>;
  linesAdded: number;
  linesDeleted: number;
}

export interface MVPReportData {
  sprint: SprintData;
  metrics: SprintMetrics;
  issues: Issue[];
  githubActivity: GitHubActivity;
  correlatedData: IssueCommitCorrelation[];
  generatedAt: string;
  warnings: string[];
}

export interface IssueCommitCorrelation {
  issueKey: string;
  commits: Commit[];
  pullRequests: PullRequest[];
  totalCommits: number;
  totalLinesChanged: number;
}

// Configuration types
export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  maxResults: number;
  timeout: number;
}

export interface GitHubConfig {
  token: string;
  apiUrl: string;
  timeout: number;
  userAgent: string;
}

export interface CacheConfig {
  memory: {
    maxSize: number;
    ttl: number;
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: boolean;
  corsOrigin: string;
}

export interface AppConfig {
  jira: JiraConfig;
  github: GitHubConfig;
  cache: CacheConfig;
  server: ServerConfig;
  reports: {
    outputDir: string;
    templateDir: string;
    maxSize: number;
  };
  security: {
    rateLimitPerMinute: number;
    maxRequestSize: number;
    enableHelmet: boolean;
  };
  logging: {
    level: string;
    enableApiLogging: boolean;
  };
  nodeEnv: string;
}

// API Response types
export interface JiraApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface GitHubApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
}

// Error types
export interface APIError extends Error {
  code: string;
  status?: number;
  retryable: boolean;
  userMessage: string;
  context?: any;
}

export interface ValidationError extends Error {
  field: string;
  value: any;
  constraint: string;
}

// Cache types
export interface CacheEntry<T> {
  data: T;
  expires: number;
  created: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memory: number;
  hitRate: number;
}

// Rate limiting types
export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number;
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  details?: any;
  error?: string;
}

// MCP Tool types
export interface MCPToolSchema {
  type: 'object';
  properties: Record<string, any>;
  required: string[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPToolSchema;
  handler: (params: any) => Promise<any>;
}

// Report generation types
export interface ReportOptions {
  format: 'html' | 'json';
  template?: string;
  includeCharts: boolean;
  includeDetails: boolean;
}

export interface ReportResult {
  format: string;
  content: string;
  filename: string;
  size: number;
  generatedAt: string;
}

// Logging types
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  requestId?: string;
  userId?: string;
  service?: string;
}

// Request context types
export interface RequestContext {
  requestId: string;
  startTime: number;
  clientId?: string;
  userAgent?: string;
  method: string;
  path: string;
}

export interface ServiceContext {
  requestId: string;
  service: string;
  operation: string;
  metadata?: Record<string, any>;
}

// Sprint Service Types
export interface Sprint {
  id: string;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
  boardId: string;
  issues?: Issue[];
}

export interface SprintMetrics {
  totalIssues: number;
  completedIssues: number;
  storyPoints: number;
  completedStoryPoints: number;
  completionRate: number;
  velocity: number;
  issuesByType: Record<string, number>;
  issuesByStatus: Record<string, number>;
  averageCycleTime: number;
  averageLeadTime: number;
}

export interface SprintReportRequest {
  sprint_id: string;
  github_owner?: string;
  github_repo?: string;
  format: ReportFormat;
  include_commits: boolean;
  include_prs: boolean;
  include_velocity: boolean;
  include_burndown: boolean;
  theme: 'default' | 'dark' | 'corporate';
}

export type ReportFormat = 'html' | 'markdown' | 'json' | 'csv';

export interface SprintReport {
  sprint: Sprint;
  metrics: SprintMetrics;
  commits?: Commit[];
  pullRequests?: PullRequest[];
  velocity?: VelocityData;
  burndown?: BurndownData;
  teamPerformance?: TeamPerformanceData[];
  metadata: {
    generatedAt: string;
    generatedBy: string;
    version: string;
    includeCommits: boolean;
    includePrs: boolean;
    includeVelocity: boolean;
    includeBurndown: boolean;
  };
}

export interface VelocityData {
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

export interface BurndownData {
  sprint_id: string;
  days: Array<{
    date: string;
    remaining: number;
    ideal: number;
    completed: number;
  }>;
}

export interface TeamPerformanceData {
  name: string;
  planned: number;
  completed: number;
  velocity: number;
}

export interface CommitTrendData {
  date: string;
  commits: number;
  prs: number;
}

export interface AnalyticsReport {
  boardId: string;
  period: '1month' | '3months' | '6months' | '1year';
  generatedAt: string;
  velocity: VelocityData;
  teamPerformance: TeamPerformanceData[];
  commitTrends?: CommitTrendData[];
  gitHubMetrics?: {
    totalCommits: number;
    totalPRs: number;
    mergedPRs: number;
    openPRs: number;
    uniqueContributors: number;
    topContributors: Array<{ author: string; commits: number }>;
    avgTimeToMergeHours: number;
    mergeRate: number;
  };
  summary: {
    averageVelocity: number;
    completionRate: number;
    velocityTrend: 'increasing' | 'decreasing' | 'stable';
    codeActivityTrend?: 'increasing' | 'decreasing' | 'stable' | undefined;
    totalSprints: number;
    totalCommits: number;
    totalPRs: number;
    uniqueContributors: number;
  };
}

export interface ReportStorage {
  id: string;
  sprint_id: string;
  format: ReportFormat;
  content: string;
  contentType: string;
  created_at: string;
  size: number;
}

// Tool Schema Types
export interface ToolSchemas {
  jiraGetSprints: MCPToolSchema;
  jiraGetSprintDetails: MCPToolSchema;
  jiraSearchIssues: MCPToolSchema;
  jiraGetIssue: MCPToolSchema;
  jiraGetVelocityData: MCPToolSchema;
  jiraGetBurndownData: MCPToolSchema;
  githubGetCommits: MCPToolSchema;
  githubGetPullRequests: MCPToolSchema;
  githubGetRepository: MCPToolSchema;
  githubSearchCommitsByMessage: MCPToolSchema;
  githubFindCommitsWithJiraReferences: MCPToolSchema;
  githubGetCommitTrends: MCPToolSchema;
  githubGetRepositoryStats: MCPToolSchema;
  generateSprintReport: MCPToolSchema;
  getReport: MCPToolSchema;
  deleteReport: MCPToolSchema;
  exportSprintReportToPDF: MCPToolSchema;
  exportAnalyticsToPDF: MCPToolSchema;
  getAnalyticsReport: MCPToolSchema;
  getVelocityData: MCPToolSchema;
  getBurndownData: MCPToolSchema;
  getTeamPerformanceData: MCPToolSchema;
}

// Cache types extension
export interface CacheSetOptions {
  ttl?: number;
  nx?: boolean;
}

export interface CacheManagerStats {
  hitRate: number;
  totalRequests: number;
  hits: number;
  misses: number;
  size?: number;
}

// Server types
export interface ServerInfo {
  name: string;
  version: string;
  capabilities: string[];
  uptime: number;
}

// Alias for compatibility
export type HealthCheckStatus = HealthStatus;

// Cache Manager Options
export interface CacheManagerOptions {
  memory?: {
    maxSize: number;
    ttl: number;
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
}

// Performance types
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  timestamp: number;
  tags: Record<string, string>;
  context?: Record<string, any> | undefined;
}