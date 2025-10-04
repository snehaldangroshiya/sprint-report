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

// New types for enhanced issue tracking
export interface StatusChange {
  from: string;
  to: string;
  timestamp: string;
  author: string;
  duration?: number; // Time in previous status (hours)
}

export interface SprintChange {
  sprintId: string;
  sprintName: string;
  action: 'added' | 'removed';
  timestamp: string;
  author: string;
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
  // Enhanced fields for comprehensive reporting
  epicLink?: string;
  epicName?: string;
  flagged?: boolean;
  blockerReason?: string;
  statusHistory?: StatusChange[];
  sprintHistory?: SprintChange[];
  timeInStatus?: Record<string, number>; // Status -> hours
  cycleTime?: number; // Days from start to done
  leadTime?: number; // Days from created to done
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
  // Enhanced PR metrics
  reviews?: PRReview[];
  timeToFirstReview?: number; // Hours
  timeToMerge?: number; // Hours
  reviewComments?: number;
  conversationsResolved?: number;
  conversationsTotal?: number;
  linkedIssues?: string[]; // Jira issue keys
}

export interface PRReview {
  reviewer: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
  submittedAt: string;
  comments: number;
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
  goal?: string;
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

// Tier 1: Must Have
export interface SprintGoalAnalysis {
  goal: string;
  achieved: boolean;
  achievementPercentage: number;
  notes?: string;
}

export interface ScopeChange {
  issueKey: string;
  issueSummary: string;
  action: 'added' | 'removed';
  timestamp: string;
  storyPoints?: number;
  reason?: string;
  author: string;
}

export interface SpilloverAnalysis {
  totalSpilloverIssues: number;
  spilloverStoryPoints: number;
  spilloverPercentage: number;
  issues: Array<{
    key: string;
    summary: string;
    storyPoints?: number;
    reason: string;
    assignee: string;
  }>;
}

// Tier 2: Should Have
export interface BlockerImpediment {
  issueKey: string;
  issueSummary: string;
  blockerReason: string;
  raisedDate: string;
  resolvedDate?: string;
  daysBlocked: number;
  impact: 'high' | 'medium' | 'low';
  assignee: string;
}

export interface BugMetrics {
  bugsCreated: number;
  bugsResolved: number;
  bugsCarriedOver: number;
  netBugChange: number; // negative is good
  bugsByPriority: Record<string, number>;
  bugsBySeverity?: Record<string, number>;
  averageBugResolutionTime: number; // hours
  criticalBugsOutstanding: number;
}

export interface CycleTimeMetrics {
  averageCycleTime: number; // days
  medianCycleTime: number;
  p90CycleTime: number; // 90th percentile
  cycleTimeByType: Record<string, number>;
  cycleTimeByPriority: Record<string, number>;
  improvementVsPreviousSprint: number; // percentage
}

export interface TeamCapacity {
  totalCapacityHours: number;
  plannedCapacityHours: number;
  actualCapacityHours: number;
  utilizationPercentage: number;
  capacityByMember: Array<{
    name: string;
    planned: number;
    actual: number;
    utilization: number;
    ptoHours: number;
    sickHours: number;
    otherHours: number;
  }>;
  capacityLoss: {
    pto: number;
    sick: number;
    meetings: number;
    training: number;
    other: number;
  };
}

// Tier 3: Nice to Have
export interface EpicProgress {
  epicKey: string;
  epicName: string;
  totalIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  todoIssues: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  completionPercentage: number;
  remainingWork: number;
}

export interface TechnicalDebt {
  totalTechDebtIssues: number;
  techDebtStoryPoints: number;
  techDebtAddressed: number;
  techDebtAdded: number;
  netTechDebtChange: number;
  techDebtByCategory: Record<string, number>;
  percentageOfSprintCapacity: number;
}

export interface RetrospectiveAction {
  id: string;
  action: string;
  category: 'process' | 'technical' | 'team' | 'other';
  priority: 'high' | 'medium' | 'low';
  owner: string;
  status: 'completed' | 'in_progress' | 'not_started' | 'deferred';
  dueDate?: string;
  completionDate?: string;
  impact?: string;
}

export interface RiskItem {
  id: string;
  description: string;
  probability: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigation?: string;
  owner: string;
  status: 'active' | 'mitigated' | 'occurred';
  raisedDate: string;
  relatedIssues: string[];
}

// Forward Looking
export interface NextSprintForecast {
  forecastedVelocity: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  recommendedCapacity: number;
  carryoverItems: number;
  carryoverStoryPoints: number;
  availableCapacity: number;
  recommendations: string[];
  risks: string[];
}

export interface CarryoverItems {
  totalItems: number;
  totalStoryPoints: number;
  items: Array<{
    key: string;
    summary: string;
    storyPoints?: number;
    reason: string;
    priority: string;
    assignee: string;
    daysInProgress: number;
  }>;
  analysis: {
    percentageOfOriginalCommitment: number;
    mostCommonReasons: Record<string, number>;
    recommendedActions: string[];
  };
}

// Enhanced GitHub Metrics
export interface EnhancedGitHubMetrics {
  commitActivity: {
    totalCommits: number;
    commitsByAuthor: Record<string, number>;
    commitsByDay: Array<{ date: string; count: number }>;
    averageCommitsPerDay: number;
    peakCommitDay: string;
  };
  pullRequestStats: {
    totalPRs: number;
    mergedPRs: number;
    closedWithoutMerge: number;
    openPRs: number;
    mergeRate: number; // percentage
    averageTimeToFirstReview: number; // hours
    averageTimeToMerge: number; // hours
    averageReviewComments: number;
    prsByAuthor: Record<string, number>;
  };
  codeChanges: {
    totalLinesAdded: number;
    totalLinesDeleted: number;
    netLineChange: number;
    filesChanged: number;
    changesByAuthor: Record<string, { additions: number; deletions: number }>;
  };
  prToIssueTraceability: Array<{
    issueKey: string;
    prs: number[];
    commits: number;
    totalChanges: number;
    status: 'complete' | 'partial' | 'none';
  }>;
  codeReviewStats: {
    totalReviews: number;
    reviewsByReviewer: Record<string, number>;
    averageReviewsPerPR: number;
    approvalRate: number; // percentage
    changesRequestedRate: number; // percentage
  };
  testCoverage?: {
    currentCoverage: number;
    previousCoverage: number;
    coverageChange: number;
    uncoveredFiles: string[];
  };
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
  // Comprehensive report options
  include_tier1?: boolean; // Sprint Goal, Scope Changes, Spillover
  include_tier2?: boolean; // Blockers, Bug Metrics, Cycle Time, Capacity
  include_tier3?: boolean; // Epic Progress, Tech Debt, Retro Actions, Risks
  include_forward_looking?: boolean; // Next Sprint Forecast, Carryover Items
  include_enhanced_github?: boolean; // Enhanced GitHub metrics
  // Optional: Fetch previous sprint for comparisons
  compare_with_previous?: boolean;
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
  // Tier 1: Must Have
  sprintGoal?: SprintGoalAnalysis;
  scopeChanges?: ScopeChange[];
  spilloverAnalysis?: SpilloverAnalysis;
  // Tier 2: Should Have
  blockers?: BlockerImpediment[];
  bugMetrics?: BugMetrics;
  cycleTimeMetrics?: CycleTimeMetrics;
  teamCapacity?: TeamCapacity;
  // Tier 3: Nice to Have
  epicProgress?: EpicProgress[];
  technicalDebt?: TechnicalDebt;
  retrospectiveActions?: RetrospectiveAction[];
  risks?: RiskItem[];
  // Forward Looking
  nextSprintForecast?: NextSprintForecast;
  carryoverItems?: CarryoverItems;
  // Enhanced GitHub Metrics
  enhancedGitHubMetrics?: EnhancedGitHubMetrics;
  metadata: {
    generatedAt: string;
    generatedBy: string;
    version: string;
    includeCommits: boolean;
    includePrs: boolean;
    includeVelocity: boolean;
    includeBurndown: boolean;
    // New flags for comprehensive features
    includeTier1: boolean;
    includeTier2: boolean;
    includeTier3: boolean;
    includeForwardLooking: boolean;
    includeEnhancedGitHub: boolean;
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