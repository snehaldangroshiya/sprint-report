// Centralized cache key management with consistent namespacing

/**
 * Cache key namespaces for different data types
 * Prevents key collisions and improves cache organization
 */
export const CacheNamespace = {
  // Jira-related keys
  JIRA_BOARDS: 'jira:boards',
  JIRA_SPRINTS: 'jira:sprints',
  JIRA_SPRINT: 'jira:sprint',
  JIRA_ISSUES: 'jira:issues',
  JIRA_VELOCITY: 'jira:velocity',
  JIRA_BURNDOWN: 'jira:burndown',
  JIRA_TEAM_PERFORMANCE: 'jira:team-performance',
  JIRA_ENHANCED_ISSUES: 'jira:enhanced-issues',

  // GitHub-related keys
  GITHUB_COMMITS: 'github:commits',
  GITHUB_PRS: 'github:prs',
  GITHUB_ENHANCED_PRS: 'github:enhanced-prs',

  // Analytics keys
  ANALYTICS_COMMIT_TRENDS: 'analytics:commit-trends',
  ANALYTICS_GITHUB_METRICS: 'analytics:github-metrics',
  ANALYTICS_TEAM_PERFORMANCE: 'analytics:team-performance',
  ANALYTICS_ISSUE_TYPES: 'analytics:issue-types',

  // API-level keys
  API_VELOCITY: 'api:velocity',
  API_SPRINTS: 'api:sprints',
  API_SPRINT_ISSUES: 'api:sprint:issues',

  // Health check keys
  HEALTH_CHECK: 'health:check',

  // Circuit breaker keys
  CIRCUIT_BREAKER: 'circuit:breaker',
} as const;

/**
 * Utility class for building consistent cache keys
 */
export class CacheKeyBuilder {
  /**
   * Build a cache key with namespace and parameters
   * @param namespace - The cache namespace
   * @param params - Key parameters (will be joined with ':')
   * @returns Formatted cache key
   */
  static build(namespace: string, ...params: (string | number)[]): string {
    const parts = [namespace, ...params.map(p => String(p))];
    return parts.join(':');
  }

  /**
   * Jira cache keys
   */
  static jira = {
    boards: () => CacheNamespace.JIRA_BOARDS,
    sprints: (boardId: string) =>
      CacheKeyBuilder.build(CacheNamespace.JIRA_SPRINTS, boardId),
    sprint: (sprintId: string) =>
      CacheKeyBuilder.build(CacheNamespace.JIRA_SPRINT, sprintId),
    issues: (sprintId: string) =>
      CacheKeyBuilder.build(CacheNamespace.JIRA_ISSUES, sprintId),
    velocity: (boardId: string, sprintCount: number) =>
      CacheKeyBuilder.build(CacheNamespace.JIRA_VELOCITY, boardId, sprintCount),
    burndown: (sprintId: string) =>
      CacheKeyBuilder.build(CacheNamespace.JIRA_BURNDOWN, sprintId),
    teamPerformance: (boardId: string, sprintCount: number) =>
      CacheKeyBuilder.build(
        CacheNamespace.JIRA_TEAM_PERFORMANCE,
        boardId,
        sprintCount
      ),
    enhancedIssues: (sprintId: string) =>
      CacheKeyBuilder.build(CacheNamespace.JIRA_ENHANCED_ISSUES, sprintId),
  };

  /**
   * GitHub cache keys
   */
  static github = {
    commits: (
      owner: string,
      repo: string,
      startDate: string,
      endDate: string
    ) =>
      CacheKeyBuilder.build(
        CacheNamespace.GITHUB_COMMITS,
        owner,
        repo,
        startDate,
        endDate
      ),
    prs: (owner: string, repo: string, startDate: string, endDate: string) =>
      CacheKeyBuilder.build(
        CacheNamespace.GITHUB_PRS,
        owner,
        repo,
        startDate,
        endDate
      ),
    enhancedPrs: (
      owner: string,
      repo: string,
      startDate: string,
      endDate: string
    ) =>
      CacheKeyBuilder.build(
        CacheNamespace.GITHUB_ENHANCED_PRS,
        owner,
        repo,
        startDate,
        endDate
      ),
  };

  /**
   * Analytics cache keys
   */
  static analytics = {
    commitTrends: (owner: string, repo: string, period: string) =>
      CacheKeyBuilder.build(
        CacheNamespace.ANALYTICS_COMMIT_TRENDS,
        owner,
        repo,
        period
      ),
    githubMetrics: (owner: string, repo: string, period: string) =>
      CacheKeyBuilder.build(
        CacheNamespace.ANALYTICS_GITHUB_METRICS,
        owner,
        repo,
        period
      ),
    teamPerformance: (boardId: string, sprintCount: number) =>
      CacheKeyBuilder.build(
        CacheNamespace.ANALYTICS_TEAM_PERFORMANCE,
        boardId,
        sprintCount
      ),
    issueTypes: (boardId: string, sprintCount: number) =>
      CacheKeyBuilder.build(
        CacheNamespace.ANALYTICS_ISSUE_TYPES,
        boardId,
        sprintCount
      ),
  };

  /**
   * API cache keys
   */
  static api = {
    velocity: (boardId: string, sprintCount: number) =>
      CacheKeyBuilder.build(CacheNamespace.API_VELOCITY, boardId, sprintCount),
    sprints: (boardId: string, state: string = 'closed') =>
      CacheKeyBuilder.build(CacheNamespace.API_SPRINTS, state, boardId),
    sprintIssues: (sprintId: string) =>
      CacheKeyBuilder.build(CacheNamespace.API_SPRINT_ISSUES, sprintId),
  };

  /**
   * Health check cache keys
   */
  static health = {
    check: (timestamp?: number) =>
      CacheKeyBuilder.build(
        CacheNamespace.HEALTH_CHECK,
        timestamp || Date.now()
      ),
  };

  /**
   * Circuit breaker cache keys
   */
  static circuitBreaker = {
    state: (toolName: string, operationName: string) =>
      CacheKeyBuilder.build(
        CacheNamespace.CIRCUIT_BREAKER,
        toolName,
        operationName
      ),
  };

  /**
   * Get all keys matching a pattern
   * @param namespace - The namespace to match
   * @returns Pattern string for cache operations
   */
  static pattern(namespace: string): string {
    return `${namespace}:*`;
  }

  /**
   * Extract namespace from a cache key
   * @param key - The cache key
   * @returns The namespace portion
   */
  static getNamespace(key: string): string {
    const parts = key.split(':');
    return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : parts[0] || '';
  }
}
