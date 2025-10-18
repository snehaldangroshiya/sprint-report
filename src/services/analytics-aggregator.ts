// Analytics Aggregator Service - Business logic for analytics calculations
// Handles commit trends, velocity, team performance, and issue distribution

import { MCPBridge } from './mcp-bridge';

import { CacheManager } from '@/cache/cache-manager';
import { Logger } from '@/utils/logger';

/**
 * Aggregates and calculates analytics metrics across sprints and repositories
 * Implements caching strategies and parallel data fetching
 */
export class AnalyticsAggregator {
  private logger: Logger;
  private cacheManager: CacheManager;
  private mcpBridge: MCPBridge;

  constructor(cacheManager: CacheManager, mcpBridge: MCPBridge) {
    this.cacheManager = cacheManager;
    this.mcpBridge = mcpBridge;
    this.logger = new Logger({ service: 'AnalyticsAggregator' });
  }

  /**
   * Aggregate commits and PRs by month with zero-filling for missing months
   * @param commits - Array of commits
   * @param pullRequests - Array of pull requests
   * @param startDate - Start date for aggregation
   * @param endDate - End date for aggregation
   * @returns Array of monthly data with commits and PR counts
   */
  aggregateCommitsByMonth(
    commits: any[],
    pullRequests: any[] = [],
    startDate?: Date,
    endDate?: Date
  ): any[] {
    const monthlyData: { [key: string]: { commits: number; prs: number } } = {};

    // Initialize all months in the range with zeros if dates provided
    if (startDate && endDate) {
      const current = new Date(startDate);
      current.setDate(1); // Start from first day of month
      const end = new Date(endDate);

      while (current <= end) {
        const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[monthKey] = { commits: 0, prs: 0 };
        current.setMonth(current.getMonth() + 1);
      }
    }

    // Aggregate commits
    commits.forEach(commit => {
      // Handle both raw GitHub API response and our transformed response
      const commitDate = commit.date || commit.commit?.committer?.date;

      if (!commitDate) {
        return; // Skip commits without dates
      }

      const date = new Date(commitDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { commits: 0, prs: 0 };
      }

      monthlyData[monthKey].commits++;
    });

    // Aggregate pull requests
    pullRequests.forEach(pr => {
      // Use created_at for PR date (or closed_at/merged_at if available)
      // Handle both snake_case (API response) and camelCase (transformed data)
      const prDate =
        pr.mergedAt ||
        pr.merged_at ||
        pr.closedAt ||
        pr.closed_at ||
        pr.createdAt ||
        pr.created_at;

      if (!prDate) {
        return; // Skip PRs without dates
      }

      const date = new Date(prDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { commits: 0, prs: 0 };
      }

      monthlyData[monthKey].prs++;
    });

    return Object.entries(monthlyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * OPTIMIZED: Multi-layer caching with batch operations for velocity calculation
   * @param boardId - Jira board ID
   * @param sprintCount - Number of recent sprints to analyze
   * @returns Velocity data with sprint metrics, average, and trend
   */
  async calculateVelocityOptimized(
    boardId: string,
    sprintCount: number
  ): Promise<any> {
    try {
      // Layer 1: Check for cached closed sprints list (30 min TTL - rarely changes)
      const sprintsListKey = `sprints:closed:${boardId}`;
      let sprints = await this.cacheManager.get(sprintsListKey);

      if (!sprints) {
        sprints = await this.mcpBridge.executeTool('jira_get_sprints', {
          board_id: boardId,
          state: 'closed',
        });
        await this.cacheManager.set(sprintsListKey, sprints, { ttl: 1800000 }); // 30 minutes
      }

      // Sort by start date descending (newest first) before slicing
      const sortedSprints = (sprints as any[]).sort((a: any, b: any) => {
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return (
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );
      });

      const recentSprints = sortedSprints.slice(0, sprintCount);

      // Layer 2: Check cache for individual sprint issues (batch operation)
      const sprintIssueKeys = recentSprints.map(
        (sprint: any) => `sprint:${sprint.id}:issues`
      );
      const cachedIssues = await this.cacheManager.getMany(sprintIssueKeys);

      // Layer 3: Fetch missing sprint issues in parallel
      const missingSprintIds: string[] = [];
      const sprintIssuesMap = new Map<string, any[]>();

      for (let i = 0; i < recentSprints.length; i++) {
        const sprint = recentSprints[i];
        if (!sprint) continue;

        const cacheKey = sprintIssueKeys[i];
        if (!cacheKey) continue;

        const cachedIssue = cachedIssues.get(cacheKey);

        if (cachedIssue && Array.isArray(cachedIssue)) {
          sprintIssuesMap.set(sprint.id, cachedIssue);
        } else {
          missingSprintIds.push(sprint.id);
        }
      }

      // Fetch missing issues in parallel
      if (missingSprintIds.length > 0) {
        const missingIssuesPromises = missingSprintIds.map(sprintId =>
          this.mcpBridge
            .executeTool('jira_get_sprint_issues', {
              sprint_id: sprintId,
            })
            .then(issuesResult => ({
              sprintId,
              issues: Array.isArray(issuesResult) ? issuesResult : [],
            }))
        );

        const missingIssuesData = await Promise.all(missingIssuesPromises);

        // Cache the newly fetched issues (batch operation)
        const cacheEntries = missingIssuesData.map(({ sprintId, issues }) => {
          sprintIssuesMap.set(sprintId, issues);
          return {
            key: `sprint:${sprintId}:issues`,
            value: issues,
            ttl: 1800, // 30 minutes (closed sprint data rarely changes)
          };
        });

        await this.cacheManager.setMany(cacheEntries);
      }

      // Calculate velocity metrics
      const sprintData = [];
      let totalVelocity = 0;

      for (const sprint of recentSprints) {
        const issues = sprintIssuesMap.get(sprint.id) || [];

        const completed = issues.filter(
          (issue: any) =>
            issue?.status?.toLowerCase() === 'done' ||
            issue?.status?.toLowerCase() === 'closed' ||
            issue?.status?.toLowerCase() === 'resolved'
        );

        const committedPoints = issues.reduce(
          (sum: number, issue: any) => sum + (issue?.storyPoints || 0),
          0
        );

        const completedPoints = completed.reduce(
          (sum: number, issue: any) => sum + (issue?.storyPoints || 0),
          0
        );

        const velocity = completedPoints;
        totalVelocity += velocity;

        sprintData.push({
          id: sprint.id,
          name: sprint.name,
          velocity,
          commitment: committedPoints,
          completed: completedPoints,
        });
      }

      // Calculate trend
      const average =
        sprintData.length > 0 ? totalVelocity / sprintData.length : 0;
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';

      if (sprintData.length >= 3) {
        const firstHalf = sprintData.slice(
          0,
          Math.floor(sprintData.length / 2)
        );
        const secondHalf = sprintData.slice(Math.floor(sprintData.length / 2));

        const firstAvg =
          firstHalf.reduce((sum, s) => sum + s.velocity, 0) / firstHalf.length;
        const secondAvg =
          secondHalf.reduce((sum, s) => sum + s.velocity, 0) /
          secondHalf.length;

        if (secondAvg > firstAvg * 1.1) trend = 'increasing';
        else if (secondAvg < firstAvg * 0.9) trend = 'decreasing';
      }

      return {
        sprints: sprintData, // Return reverse chronological order (newest first)
        average,
        trend,
      };
    } catch (error) {
      this.logger.logError(error as Error, 'calculate_velocity_data_optimized');
      throw error;
    }
  }

  /**
   * Calculate team performance metrics across multiple sprints
   * @param boardId - Jira board ID
   * @param sprintCount - Number of recent sprints to analyze
   * @returns Array of team performance data (planned vs completed)
   */
  async calculateTeamPerformance(
    boardId: string,
    sprintCount: number
  ): Promise<any[]> {
    try {
      // Reuse cached closed sprints list (same as velocity endpoint)
      const sprintsListKey = `sprints:closed:${boardId}`;
      let sprints = await this.cacheManager.get(sprintsListKey);

      if (!sprints) {
        sprints = await this.mcpBridge.executeTool('jira_get_sprints', {
          board_id: boardId,
          state: 'closed',
        });
        await this.cacheManager.set(sprintsListKey, sprints, { ttl: 1800000 }); // 30 minutes
      }

      // Sort by start date descending (newest first) before slicing
      const sortedSprints = (sprints as any[]).sort((a: any, b: any) => {
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return (
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );
      });

      const recentSprints = sortedSprints.slice(0, sprintCount);

      this.logger.info('Team Performance - Sprint data', {
        boardId,
        requestedCount: sprintCount,
        availableSprints: sortedSprints.length,
        recentSprintsCount: recentSprints.length,
        sprintNames: recentSprints.map((s: any) => s.name),
      });

      // If no sprints available, return empty array early
      if (recentSprints.length === 0) {
        this.logger.warn('Team Performance - No sprints available', {
          boardId,
          sprintCount,
        });
        return [];
      }

      // Reuse cached sprint issues (batch operation)
      const sprintIssueKeys = recentSprints.map(
        (sprint: any) => `sprint:${sprint.id}:issues`
      );
      const cachedIssues = await this.cacheManager.getMany(sprintIssueKeys);

      // Fetch missing sprint issues in parallel
      const missingSprintIds: string[] = [];
      const sprintIssuesMap = new Map<string, any[]>();

      for (let i = 0; i < recentSprints.length; i++) {
        const sprint = recentSprints[i];
        if (!sprint) continue;

        const cacheKey = sprintIssueKeys[i];
        if (!cacheKey) continue;

        const cachedIssue = cachedIssues.get(cacheKey);

        if (cachedIssue && Array.isArray(cachedIssue)) {
          sprintIssuesMap.set(sprint.id, cachedIssue);
        } else {
          missingSprintIds.push(sprint.id);
        }
      }

      // Fetch missing issues in parallel
      if (missingSprintIds.length > 0) {
        const missingIssuesPromises = missingSprintIds.map(sprintId =>
          this.mcpBridge
            .executeTool('jira_get_sprint_issues', {
              sprint_id: sprintId,
            })
            .then(issuesResult => ({
              sprintId,
              issues: Array.isArray(issuesResult) ? issuesResult : [],
            }))
        );

        const missingIssuesData = await Promise.all(missingIssuesPromises);

        // Cache the newly fetched issues (batch operation)
        const cacheEntries = missingIssuesData.map(({ sprintId, issues }) => {
          sprintIssuesMap.set(sprintId, issues);
          return {
            key: `sprint:${sprintId}:issues`,
            value: issues,
            ttl: 1800, // 30 minutes
          };
        });

        await this.cacheManager.setMany(cacheEntries);
      }

      // Calculate performance metrics
      const performance = recentSprints.map((sprint: any) => {
        const issues = sprintIssuesMap.get(sprint.id) || [];

        const completed = issues.filter(
          (issue: any) =>
            issue.status?.toLowerCase() === 'done' ||
            issue.status?.toLowerCase() === 'closed' ||
            issue.status?.toLowerCase() === 'resolved'
        );

        const plannedPoints = issues.reduce(
          (sum: number, issue: any) => sum + (issue?.storyPoints || 0),
          0
        );

        const completedPoints = completed.reduce(
          (sum: number, issue: any) => sum + (issue?.storyPoints || 0),
          0
        );

        return {
          name: sprint.name,
          planned: plannedPoints,
          completed: completedPoints,
          velocity: completedPoints,
        };
      });

      this.logger.info('Team Performance - Calculated', {
        boardId,
        sprintCount,
        performanceCount: performance.length,
        sprints: performance.map(p => `${p.name}: ${p.completed}/${p.planned}`),
      });

      return performance; // Return reverse chronological order (newest first)
    } catch (error) {
      this.logger.logError(error as Error, 'calculate_team_performance');
      return [];
    }
  }

  /**
   * Calculate issue type distribution across multiple sprints
   * @param boardId - Jira board ID
   * @param sprintCount - Number of recent sprints to analyze
   * @returns Array of issue type data with counts and colors
   */
  async calculateIssueDistribution(
    boardId: string,
    sprintCount: number
  ): Promise<any[]> {
    try {
      // Reuse cached closed sprints list
      const sprintsListKey = `sprints:closed:${boardId}`;
      let sprints = await this.cacheManager.get(sprintsListKey);

      if (!sprints) {
        sprints = await this.mcpBridge.executeTool('jira_get_sprints', {
          board_id: boardId,
          state: 'closed',
        });
        await this.cacheManager.set(sprintsListKey, sprints, { ttl: 1800000 }); // 30 minutes
      }

      // Sort by start date descending (newest first) before slicing
      const sortedSprints = (sprints as any[]).sort((a: any, b: any) => {
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return (
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );
      });

      const recentSprints = sortedSprints.slice(0, sprintCount);

      // Reuse cached sprint issues (batch operation)
      const sprintIssueKeys = recentSprints.map(
        (sprint: any) => `sprint:${sprint.id}:issues`
      );
      const cachedIssues = await this.cacheManager.getMany(sprintIssueKeys);

      // Fetch missing sprint issues in parallel
      const missingSprintIds: string[] = [];
      const allIssues: any[] = [];

      for (let i = 0; i < recentSprints.length; i++) {
        const sprint = recentSprints[i];
        if (!sprint) continue;

        const cacheKey = sprintIssueKeys[i];
        if (!cacheKey) continue;

        const cachedIssue = cachedIssues.get(cacheKey);

        if (cachedIssue && Array.isArray(cachedIssue)) {
          allIssues.push(...cachedIssue);
        } else {
          missingSprintIds.push(sprint.id);
        }
      }

      // Fetch missing issues in parallel
      if (missingSprintIds.length > 0) {
        const missingIssuesPromises = missingSprintIds.map(sprintId =>
          this.mcpBridge.executeTool('jira_get_sprint_issues', {
            sprint_id: sprintId,
          })
        );

        const missingIssuesData = await Promise.all(missingIssuesPromises);
        missingIssuesData.forEach(issues => {
          if (Array.isArray(issues)) {
            allIssues.push(...issues);
          }
        });
      }

      // Count issue types
      const issueTypeCounts: { [key: string]: number } = {};
      allIssues.forEach((issue: any) => {
        const issueType = issue?.issueType || issue?.type || 'Unknown';
        issueTypeCounts[issueType] = (issueTypeCounts[issueType] || 0) + 1;
      });

      // Define colors for common issue types
      const colorMap: { [key: string]: string } = {
        Story: '#3b82f6',
        Bug: '#ef4444',
        Task: '#f59e0b',
        Epic: '#8b5cf6',
        'Sub-task': '#06b6d4',
        Improvement: '#10b981',
        Unknown: '#6b7280',
      };

      // Convert to array format for pie chart
      return Object.entries(issueTypeCounts)
        .map(([name, value]) => ({
          name,
          value,
          color: colorMap[name] || '#6b7280',
        }))
        .sort((a, b) => b.value - a.value); // Sort by count descending
    } catch (error) {
      this.logger.logError(error as Error, 'calculate_issue_type_distribution');
      return [];
    }
  }
}
