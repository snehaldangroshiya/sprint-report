import { CacheManager } from '../cache/cache-manager.js';
import { GitHubClient } from '../clients/github-client.js';
import { JiraClient } from '../clients/jira-client.js';
import {
  Sprint,
  SprintReport,
  SprintReportRequest,
  VelocityData,
  BurndownData,
  TeamPerformanceData,
  SprintMetrics,
  Commit,
  PullRequest,
  Issue,
} from '../types/index.js';
import { CacheKeyBuilder } from '../utils/cache-keys.js';
import { Logger } from '../utils/logger.js';

import { AnalyticsService } from './analytics-service.js';

export class SprintService {
  private logger: Logger;
  private analyticsService: AnalyticsService;

  constructor(
    private jiraClient: JiraClient,
    private githubClient: GitHubClient,
    private cache: CacheManager
  ) {
    if (!cache) {
      throw new Error(
        'CacheManager is required for SprintService initialization'
      );
    }
    this.logger = new Logger('SprintService');
    this.analyticsService = new AnalyticsService(
      this.githubClient,
      this,
      this.cache
    );
  }

  /**
   * Get all available boards
   */
  async getBoards(): Promise<any[]> {
    const cacheKey = CacheKeyBuilder.jira.boards();
    let boards = await this.cache.get(cacheKey);

    if (!boards) {
      boards = await this.jiraClient.getBoards();
      await this.cache.set(cacheKey, boards, { ttl: 300 }); // 5 minutes
    }

    return boards as any[];
  }

  /**
   * Get sprints for a specific board
   */
  async getSprints(boardId: string): Promise<Sprint[]> {
    const cacheKey = CacheKeyBuilder.jira.sprints(boardId);
    let sprints = await this.cache.get(cacheKey);

    if (!sprints) {
      sprints = await this.jiraClient.getSprints(boardId);
      await this.cache.set(cacheKey, sprints, { ttl: 300 }); // 5 minutes
    }

    return sprints as Sprint[];
  }

  /**
   * Get detailed sprint information
   */
  async getSprintDetails(sprintId: string): Promise<Sprint> {
    const cacheKey = CacheKeyBuilder.jira.sprint(sprintId);
    let sprint = await this.cache.get(cacheKey);

    if (!sprint) {
      sprint = await this.jiraClient.getSprintData(sprintId);
      await this.cache.set(cacheKey, sprint, { ttl: 180 }); // 3 minutes
    }

    return sprint as Sprint;
  }

  /**
   * Generate comprehensive sprint report (OPTIMIZED: Parallel execution)
   */
  async generateSprintReport(
    request: SprintReportRequest
  ): Promise<SprintReport> {
    this.logger.info('Generating sprint report', {
      sprintId: request.sprint_id,
    });

    try {
      // Get sprint details first (needed for subsequent calls)
      const sprint = await this.getSprintDetails(request.sprint_id);

      // Determine if we need enhanced issue data (with changelog)
      const needsEnhancedIssues =
        request.include_tier1 || request.include_tier2 || request.include_tier3;

      // Initialize report data
      const reportData: Partial<SprintReport> = {
        sprint,
        metadata: {
          generatedAt: new Date().toISOString(),
          generatedBy: 'NextReleaseMCP',
          version: '1.0.0',
          includeCommits: request.include_commits,
          includePrs: request.include_prs,
          includeVelocity: request.include_velocity,
          includeBurndown: request.include_burndown,
          includeTier1: request.include_tier1 ?? false,
          includeTier2: request.include_tier2 ?? false,
          includeTier3: request.include_tier3 ?? false,
          includeForwardLooking: request.include_forward_looking ?? false,
          includeEnhancedGitHub: request.include_enhanced_github ?? false,
        },
      };

      // OPTIMIZATION: Parallelize all independent API calls (5-6x faster!)
      const [
        metrics,
        enhancedIssues,
        commits,
        pullRequests,
        velocity,
        burndown,
        teamPerformance,
      ] = await Promise.all([
        // Calculate sprint metrics (dependent on sprint data)
        this.calculateSprintMetrics(sprint),

        // Get enhanced issues if comprehensive metrics requested
        needsEnhancedIssues
          ? this.getEnhancedSprintIssues(request.sprint_id)
          : Promise.resolve(undefined),

        // Get commits if requested (independent)
        request.include_commits && request.github_owner && request.github_repo
          ? this.getSprintCommits(
              request.github_owner,
              request.github_repo,
              sprint.startDate,
              sprint.endDate
            )
          : Promise.resolve(undefined),

        // Get pull requests if requested (independent)
        request.include_prs && request.github_owner && request.github_repo
          ? request.include_enhanced_github
            ? this.getEnhancedSprintPullRequests(
                request.github_owner,
                request.github_repo,
                sprint.startDate,
                sprint.endDate
              )
            : this.getSprintPullRequests(
                request.github_owner,
                request.github_repo,
                sprint.startDate,
                sprint.endDate
              )
          : Promise.resolve(undefined),

        // Get velocity data if requested (independent)
        request.include_velocity
          ? this.getVelocityData(String(sprint.boardId), 5)
          : Promise.resolve(undefined),

        // Get burndown data if requested (independent)
        request.include_burndown
          ? this.getBurndownData(request.sprint_id)
          : Promise.resolve(undefined),

        // Get team performance data (independent)
        this.getTeamPerformanceData(String(sprint.boardId), 1),
      ]);

      // Assign basic results
      reportData.metrics = metrics;
      if (commits) reportData.commits = commits as Commit[];
      if (pullRequests) reportData.pullRequests = pullRequests as PullRequest[];
      if (velocity) reportData.velocity = velocity;
      if (burndown) reportData.burndown = burndown;
      reportData.teamPerformance = teamPerformance;

      // Use enhanced issues for comprehensive metrics, or fall back to sprint.issues
      const issues = enhancedIssues || sprint.issues || [];

      // Calculate Tier 1 metrics
      this.logger.info('[TIER DEBUG] Checking tier1 calculation', {
        include_tier1: request.include_tier1,
        issues_count: issues.length,
      });
      if (request.include_tier1 && issues.length > 0) {
        reportData.sprintGoal = this.analyticsService.analyzeSprintGoal(
          sprint,
          issues
        );
        reportData.scopeChanges = this.analyticsService.detectScopeChanges(
          issues,
          sprint
        );
        reportData.spilloverAnalysis =
          this.analyticsService.analyzeSpillover(issues);
        this.logger.info('[TIER DEBUG] Tier1 calculated:', {
          hasGoal: !!reportData.sprintGoal,
          hasChanges: !!reportData.scopeChanges,
          hasSpillover: !!reportData.spilloverAnalysis,
        });
      }

      // Calculate Tier 2 metrics
      if (request.include_tier2 && issues.length > 0) {
        reportData.blockers = this.analyticsService.extractBlockers(issues);
        reportData.bugMetrics = this.analyticsService.calculateBugMetrics(
          issues,
          sprint
        );
        reportData.cycleTimeMetrics =
          this.analyticsService.calculateCycleTimeMetrics(issues);
        reportData.teamCapacity =
          this.analyticsService.calculateTeamCapacity(issues);
      }

      // Calculate Tier 3 metrics
      if (request.include_tier3 && issues.length > 0) {
        reportData.epicProgress =
          this.analyticsService.calculateEpicProgress(issues);
        reportData.technicalDebt =
          this.analyticsService.calculateTechnicalDebt(issues);
        reportData.risks = this.analyticsService.extractRisks(issues);
      }

      // Calculate Forward Looking metrics
      if (request.include_forward_looking && reportData.spilloverAnalysis) {
        const velocityHistory = velocity?.sprints.map(s => s.velocity) || [];
        reportData.nextSprintForecast =
          this.analyticsService.generateNextSprintForecast(
            velocityHistory,
            reportData.spilloverAnalysis
          );

        const totalCommitment = metrics.storyPoints;
        reportData.carryoverItems = this.analyticsService.analyzeCarryoverItems(
          reportData.spilloverAnalysis,
          totalCommitment
        );
      }

      // Calculate Enhanced GitHub metrics
      if (request.include_enhanced_github) {
        const prs = (
          pullRequests && Array.isArray(pullRequests) ? pullRequests : []
        ) as PullRequest[];
        const commitsList = (commits as Commit[]) || [];

        // Calculate PR stats
        // Note: GitHub API returns state as 'open' or 'closed', not 'merged'
        // A merged PR is closed with mergedAt !== null
        const mergedPRs = prs.filter(
          pr => pr.mergedAt !== null && pr.mergedAt !== undefined
        );
        const closedWithoutMergePRs = prs.filter(
          pr => pr.state === 'closed' && (!pr.mergedAt || pr.mergedAt === null)
        );
        const openPRs = prs.filter(pr => pr.state === 'open');

        // Calculate average review comments
        const totalComments = prs.reduce(
          (sum, pr) => sum + (pr.reviewComments || 0),
          0
        );
        const avgComments = prs.length > 0 ? totalComments / prs.length : 0;

        // Count PRs by author
        const prsByAuthor: Record<string, number> = {};
        prs.forEach(pr => {
          prsByAuthor[pr.author] = (prsByAuthor[pr.author] || 0) + 1;
        });

        // Build traceability array from linked issues
        const traceabilityMap = new Map<
          string,
          { prs: number[]; commits: number; changes: number }
        >();

        prs.forEach(pr => {
          if (pr.linkedIssues && pr.linkedIssues.length > 0) {
            pr.linkedIssues.forEach(issueKey => {
              if (!traceabilityMap.has(issueKey)) {
                traceabilityMap.set(issueKey, {
                  prs: [],
                  commits: 0,
                  changes: 0,
                });
              }
              const entry = traceabilityMap.get(issueKey)!;
              entry.prs.push(pr.number);
              entry.commits += pr.commits || 0;
              entry.changes += (pr.additions || 0) + (pr.deletions || 0);
            });
          }
        });

        const prToIssueTraceability = Array.from(traceabilityMap.entries()).map(
          ([issueKey, data]) => ({
            issueKey,
            prs: data.prs,
            commits: data.commits,
            totalChanges: data.changes,
            status: (data.prs.length > 0 ? 'complete' : 'none') as
              | 'complete'
              | 'partial'
              | 'none',
          })
        );

        reportData.enhancedGitHubMetrics = {
          commitActivity:
            this.githubClient.calculateCommitActivityStats(commitsList),
          pullRequestStats: {
            totalPRs: prs.length,
            mergedPRs: mergedPRs.length,
            closedWithoutMerge: closedWithoutMergePRs.length,
            openPRs: openPRs.length,
            mergeRate:
              prs.length > 0 ? (mergedPRs.length / prs.length) * 100 : 0,
            averageTimeToFirstReview:
              this.calculateAverageTimeToFirstReview(prs),
            averageTimeToMerge: this.calculateAverageTimeToMerge(prs),
            averageReviewComments: Math.round(avgComments * 10) / 10,
            prsByAuthor,
          },
          codeChanges: this.githubClient.calculateCodeChangeStats(commitsList),
          prToIssueTraceability,
          codeReviewStats: this.githubClient.calculateCodeReviewStats(prs),
        };
      }

      this.logger.info(
        'Sprint report generated successfully (parallel execution)',
        {
          sprintId: request.sprint_id,
          metrics: reportData.metrics,
          tier1: request.include_tier1,
          tier2: request.include_tier2,
          tier3: request.include_tier3,
        }
      );

      // DEBUG: Log what we're about to return
      console.log(
        '[SPRINT-SERVICE] About to return report with keys:',
        Object.keys(reportData)
      );
      console.log('[SPRINT-SERVICE] Has metadata?', !!reportData.metadata);
      console.log('[SPRINT-SERVICE] Has sprintGoal?', !!reportData.sprintGoal);
      console.log('[SPRINT-SERVICE] Request flags:', {
        tier1: request.include_tier1,
        tier2: request.include_tier2,
        tier3: request.include_tier3,
      });

      return reportData as SprintReport;
    } catch (error) {
      this.logger.error(error as Error, 'generate_sprint_report', { request });
      throw error;
    }
  }

  /**
   * Calculate sprint metrics
   */
  private async calculateSprintMetrics(sprint: Sprint): Promise<SprintMetrics> {
    const issues = sprint.issues || [];

    const totalIssues = issues.length;
    const completedIssues = issues.filter(issue =>
      ['Done', 'Closed', 'Resolved'].includes(issue.status)
    ).length;

    const storyPoints = issues.reduce((sum, issue) => {
      return sum + (issue.storyPoints || 0);
    }, 0);

    const completedStoryPoints = issues
      .filter(issue => ['Done', 'Closed', 'Resolved'].includes(issue.status))
      .reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);

    const completionRate =
      totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0;
    const velocity = completedStoryPoints;

    // Calculate issue distribution by type
    const issuesByType = issues.reduce(
      (acc, issue) => {
        const type = issue.issueType || 'Unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Calculate issue distribution by status
    const issuesByStatus = issues.reduce(
      (acc, issue) => {
        acc[issue.status] = (acc[issue.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalIssues,
      completedIssues,
      storyPoints,
      completedStoryPoints,
      completionRate: Math.round(completionRate * 100) / 100,
      velocity,
      issuesByType,
      issuesByStatus,
      averageCycleTime: 0, // Requires issue changelog data for accurate calculation
      averageLeadTime: 0, // Requires issue changelog data for accurate calculation
    };
  }

  /**
   * Get commits for sprint timeframe
   */
  private async getSprintCommits(
    owner: string,
    repo: string,
    startDate?: string,
    endDate?: string
  ) {
    if (!startDate || !endDate) return [];

    const cacheKey = CacheKeyBuilder.github.commits(
      owner,
      repo,
      startDate,
      endDate
    );
    let commits = await this.cache.get(cacheKey);

    if (!commits) {
      try {
        commits = await this.githubClient.getCommits(owner, repo, {
          since: startDate,
          until: endDate,
        });
        await this.cache.set(cacheKey, commits, { ttl: 600 }); // 10 minutes
      } catch (error) {
        this.logger.warn('Failed to fetch commits, returning empty array', {
          owner,
          repo,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    }

    return commits;
  }

  /**
   * Get pull requests for sprint timeframe
   */
  private async getSprintPullRequests(
    owner: string,
    repo: string,
    startDate?: string,
    endDate?: string
  ) {
    if (!startDate || !endDate) return [];

    const cacheKey = CacheKeyBuilder.github.prs(
      owner,
      repo,
      startDate,
      endDate
    );
    let pullRequests = await this.cache.get(cacheKey);

    if (!pullRequests) {
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const now = new Date();
        const threeMonthsAgo = new Date(
          now.getTime() - 90 * 24 * 60 * 60 * 1000
        );

        // For historical sprints (older than 3 months), use GitHub Search API
        // which allows direct date-range queries instead of paginating through all PRs
        const isHistoricalSprint = end < threeMonthsAgo;

        let allPRs: any[];

        if (isHistoricalSprint) {
          this.logger.info('Using GitHub Search API for historical sprint', {
            owner,
            repo,
            startDate,
            endDate,
            sprintEndDate: end.toISOString(),
            threeMonthsAgo: threeMonthsAgo.toISOString(),
          });

          // Use Search API with date range filters
          allPRs = await this.githubClient.searchPullRequestsByDateRange(
            owner,
            repo,
            startDate,
            endDate,
            'all'
          );
        } else {
          // For recent sprints, use standard REST API
          allPRs = await this.githubClient.getPullRequests(owner, repo, {
            state: 'all',
          });
        }

        // Filter by date range (Search API filters by created date, but we also check updated/merged dates)
        pullRequests = allPRs.filter((pr: any) => {
          const createdAt = new Date(pr.created_at);
          const updatedAt = new Date(pr.updated_at);
          const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;
          const closedAt = pr.closed_at ? new Date(pr.closed_at) : null;

          // Include PR if any of its activity dates fall within the sprint
          return (
            (createdAt >= start && createdAt <= end) ||
            (updatedAt >= start && updatedAt <= end) ||
            (mergedAt && mergedAt >= start && mergedAt <= end) ||
            (closedAt && closedAt >= start && closedAt <= end)
          );
        });

        await this.cache.set(cacheKey, pullRequests, { ttl: 600 }); // 10 minutes
      } catch (error) {
        this.logger.warn(
          'Failed to fetch pull requests, returning empty array',
          {
            owner,
            repo,
            error: error instanceof Error ? error.message : String(error),
          }
        );
        return [];
      }
    }

    return pullRequests;
  }

  /**
   * Get velocity data for board
   */
  async getVelocityData(
    boardId: string,
    sprintCount: number = 5
  ): Promise<VelocityData> {
    const cacheKey = CacheKeyBuilder.jira.velocity(boardId, sprintCount);
    let velocityData = await this.cache.get(cacheKey);

    if (!velocityData) {
      const sprints = await this.getSprints(boardId);
      const recentSprints = sprints
        .filter(sprint => sprint.state === 'closed')
        .slice(-sprintCount);

      const sprintVelocities = await Promise.all(
        recentSprints.map(async sprint => {
          const details = await this.getSprintDetails(sprint.id);
          const metrics = await this.calculateSprintMetrics(details);

          return {
            id: sprint.id,
            name: sprint.name,
            velocity: metrics.velocity,
            commitment: metrics.storyPoints,
            completed: metrics.completedStoryPoints,
          };
        })
      );

      const totalVelocity = sprintVelocities.reduce(
        (sum, sprint) => sum + sprint.velocity,
        0
      );
      const average =
        sprintVelocities.length > 0
          ? totalVelocity / sprintVelocities.length
          : 0;

      // Determine trend
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (sprintVelocities.length >= 3) {
        const recent = sprintVelocities.slice(-2);
        const earlier = sprintVelocities.slice(-4, -2);

        const recentAvg =
          recent.reduce((sum, s) => sum + s.velocity, 0) / recent.length;
        const earlierAvg =
          earlier.reduce((sum, s) => sum + s.velocity, 0) / earlier.length;

        const changePercent = ((recentAvg - earlierAvg) / earlierAvg) * 100;

        if (changePercent > 10) trend = 'increasing';
        else if (changePercent < -10) trend = 'decreasing';
      }

      velocityData = {
        sprints: sprintVelocities,
        average: Math.round(average * 100) / 100,
        trend,
      };

      await this.cache.set(cacheKey, velocityData, { ttl: 1800 }); // 30 minutes
    }

    return velocityData as VelocityData;
  }

  /**
   * Get burndown data for sprint
   */
  async getBurndownData(sprintId: string): Promise<BurndownData> {
    const cacheKey = CacheKeyBuilder.jira.burndown(sprintId);
    let burndownData = await this.cache.get(cacheKey);

    if (!burndownData) {
      const sprint = await this.getSprintDetails(sprintId);

      // This is a simplified burndown calculation
      // In a real implementation, you'd get daily snapshots from Jira
      const totalStoryPoints =
        sprint.issues?.reduce(
          (sum, issue) => sum + (issue.storyPoints || 0),
          0
        ) || 0;

      const startDate = new Date(sprint.startDate || '');
      const endDate = new Date(sprint.endDate || '');
      const totalDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const days = [];
      for (let i = 0; i <= totalDays; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);

        // Simplified calculation - in reality this would come from Jira history
        const remaining = Math.max(
          0,
          totalStoryPoints - (totalStoryPoints * i) / totalDays
        );
        const ideal = totalStoryPoints - (totalStoryPoints * i) / totalDays;
        const completed = totalStoryPoints - remaining;

        days.push({
          date: currentDate.toISOString().split('T')[0],
          remaining: Math.round(remaining * 100) / 100,
          ideal: Math.round(ideal * 100) / 100,
          completed: Math.round(completed * 100) / 100,
        });
      }

      burndownData = {
        sprint_id: sprintId,
        days,
      };

      await this.cache.set(cacheKey, burndownData, { ttl: 1800 }); // 30 minutes
    }

    return burndownData as BurndownData;
  }

  /**
   * Get team performance data
   */
  async getTeamPerformanceData(
    boardId: string,
    sprintCount: number = 10
  ): Promise<TeamPerformanceData[]> {
    const cacheKey = CacheKeyBuilder.jira.teamPerformance(boardId, sprintCount);
    let performanceData = await this.cache.get(cacheKey);

    if (!performanceData) {
      const sprints = await this.getSprints(boardId);
      const recentSprints = sprints
        .filter(sprint => sprint.state === 'closed')
        .slice(-sprintCount);

      performanceData = await Promise.all(
        recentSprints.map(async sprint => {
          const details = await this.getSprintDetails(sprint.id);
          const metrics = await this.calculateSprintMetrics(details);

          return {
            name: sprint.name,
            planned: metrics.storyPoints,
            completed: metrics.completedStoryPoints,
            velocity: metrics.velocity,
          };
        })
      );

      await this.cache.set(cacheKey, performanceData, { ttl: 1800 }); // 30 minutes
    }

    return performanceData as TeamPerformanceData[];
  }

  /**
   * Get enhanced sprint issues with changelog data
   */
  private async getEnhancedSprintIssues(sprintId: string): Promise<Issue[]> {
    const cacheKey = CacheKeyBuilder.jira.enhancedIssues(sprintId);
    let enhancedIssues = await this.cache.get(cacheKey);

    if (!enhancedIssues) {
      enhancedIssues = await this.jiraClient.getEnhancedSprintIssues(sprintId);
      await this.cache.set(cacheKey, enhancedIssues, { ttl: 300 }); // 5 minutes
    }

    return enhancedIssues as Issue[];
  }

  /**
   * Get enhanced pull requests with review data
   */
  private async getEnhancedSprintPullRequests(
    owner: string,
    repo: string,
    startDate?: string,
    endDate?: string
  ): Promise<PullRequest[]> {
    if (!startDate || !endDate) return [];

    const cacheKey = CacheKeyBuilder.github.enhancedPrs(
      owner,
      repo,
      startDate,
      endDate
    );
    let enhancedPRs = await this.cache.get(cacheKey);

    if (!enhancedPRs) {
      try {
        enhancedPRs = await this.githubClient.getEnhancedPullRequests(
          owner,
          repo,
          {
            since: startDate,
            until: endDate,
            state: 'all',
          }
        );
        await this.cache.set(cacheKey, enhancedPRs, { ttl: 600 }); // 10 minutes
      } catch (error) {
        this.logger.warn(
          'Failed to fetch enhanced pull requests, returning empty array',
          {
            owner,
            repo,
            error: error instanceof Error ? error.message : String(error),
          }
        );
        return [];
      }
    }

    return enhancedPRs as PullRequest[];
  }

  /**
   * Calculate average time to first review for PRs
   */
  private calculateAverageTimeToFirstReview(prs: PullRequest[]): number {
    const prsWithReview = prs.filter(pr => pr.timeToFirstReview !== undefined);

    if (prsWithReview.length === 0) return 0;

    const totalTime = prsWithReview.reduce(
      (sum, pr) => sum + (pr.timeToFirstReview || 0),
      0
    );

    return Math.round((totalTime / prsWithReview.length) * 10) / 10;
  }

  /**
   * Calculate average time to merge for PRs
   */
  private calculateAverageTimeToMerge(prs: PullRequest[]): number {
    const mergedPRs = prs.filter(pr => pr.timeToMerge !== undefined);

    if (mergedPRs.length === 0) return 0;

    const totalTime = mergedPRs.reduce(
      (sum, pr) => sum + (pr.timeToMerge || 0),
      0
    );

    return Math.round((totalTime / mergedPRs.length) * 10) / 10;
  }

  /**
   * Health check for service dependencies
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    services: Record<string, any>;
  }> {
    const services: Record<string, any> = {};

    try {
      const startTime = Date.now();
      await this.jiraClient.healthCheck();
      services.jira = {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      services.jira = {
        healthy: false,
        error: (error as Error).message,
      };
    }

    try {
      const startTime = Date.now();
      await this.githubClient.healthCheck();
      services.github = {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      services.github = {
        healthy: false,
        error: (error as Error).message,
      };
    }

    const healthy = Object.values(services).every(service => service.healthy);

    return { healthy, services };
  }
}
