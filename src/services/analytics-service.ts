import { CacheManager } from '../cache/cache-manager.js';
import { GitHubClient } from '../clients/github-client.js';
import {
  Issue,
  Sprint,
  CommitTrendData,
  AnalyticsReport,
  SprintGoalAnalysis,
  ScopeChange,
  SpilloverAnalysis,
  BlockerImpediment,
  BugMetrics,
  CycleTimeMetrics,
  TeamCapacity,
  EpicProgress,
  TechnicalDebt,
  RiskItem,
  NextSprintForecast,
  CarryoverItems,
  ISprintDataProvider,
} from '../types/index.js';
import { CacheKeyBuilder } from '../utils/cache-keys.js';
import { Logger } from '../utils/logger.js';

export class AnalyticsService {
  private logger: Logger;

  constructor(
    private githubClient: GitHubClient,
    private sprintDataProvider: ISprintDataProvider,
    private cache: CacheManager
  ) {
    if (!cache) {
      throw new Error(
        'CacheManager is required for AnalyticsService initialization'
      );
    }
    this.logger = new Logger('AnalyticsService');
  }

  /**
   * Get commit trends for a repository
   */
  async getCommitTrends(
    owner: string,
    repo: string,
    period: '1month' | '3months' | '6months' | '1year' = '6months'
  ): Promise<CommitTrendData[]> {
    const cacheKey = CacheKeyBuilder.analytics.commitTrends(
      owner,
      repo,
      period
    );
    let trends = await this.cache.get(cacheKey);

    if (!trends) {
      const now = new Date();
      const monthsBack = this.getPeriodMonths(period);
      const startDate = new Date(
        now.getFullYear(),
        now.getMonth() - monthsBack,
        1
      );

      // Get commits for the period
      const commits = await this.githubClient.getCommits(owner, repo, {
        since: startDate.toISOString(),
        until: now.toISOString(),
      });

      // Get pull requests for the period
      const pullRequests = await this.githubClient.getPullRequests(
        owner,
        repo,
        { state: 'all' }
      );
      const filteredPRs = pullRequests.filter((pr: any) => {
        const createdAt = new Date(pr.created_at);
        return createdAt >= startDate && createdAt <= now;
      });

      // Group by month
      const trendMap = new Map<string, { commits: number; prs: number }>();

      // Process commits
      commits.forEach((commit: any) => {
        const date = new Date(commit.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!trendMap.has(monthKey)) {
          trendMap.set(monthKey, { commits: 0, prs: 0 });
        }
        trendMap.get(monthKey)!.commits++;
      });

      // Process pull requests
      filteredPRs.forEach((pr: any) => {
        const date = new Date(pr.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!trendMap.has(monthKey)) {
          trendMap.set(monthKey, { commits: 0, prs: 0 });
        }
        trendMap.get(monthKey)!.prs++;
      });

      // Convert to array and sort
      trends = Array.from(trendMap.entries())
        .map(([date, data]) => ({
          date,
          commits: data.commits,
          prs: data.prs,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      await this.cache.set(cacheKey, trends, { ttl: 3600 }); // 1 hour cache
    }

    return trends as CommitTrendData[];
  }

  /**
   * Get comprehensive analytics report
   */
  async getAnalyticsReport(
    boardId: string,
    owner?: string,
    repo?: string,
    period: '1month' | '3months' | '6months' | '1year' = '6months'
  ): Promise<AnalyticsReport> {
    this.logger.info('Generating analytics report', {
      boardId,
      owner,
      repo,
      period,
    });

    try {
      // Get velocity data
      const velocityData = await this.sprintDataProvider.getVelocityData(
        boardId,
        10
      );

      // Get team performance data
      const teamPerformance =
        await this.sprintDataProvider.getTeamPerformanceData(boardId, 10);

      // Initialize report
      const report: Partial<AnalyticsReport> = {
        boardId,
        period,
        generatedAt: new Date().toISOString(),
        velocity: velocityData,
        teamPerformance,
      };

      // Get commit trends if GitHub info provided
      if (owner && repo) {
        report.commitTrends = await this.getCommitTrends(owner, repo, period);
        report.gitHubMetrics = await this.getGitHubMetrics(owner, repo, period);
      }

      // Calculate summary metrics
      report.summary = this.calculateSummaryMetrics(report as AnalyticsReport);

      this.logger.info('Analytics report generated successfully', {
        boardId,
        summary: report.summary,
      });

      return report as AnalyticsReport;
    } catch (error) {
      this.logger.error(error as Error, 'generate_analytics_report', {
        boardId,
        owner,
        repo,
      });
      throw error;
    }
  }

  /**
   * Get GitHub-specific metrics
   */
  private async getGitHubMetrics(
    owner: string,
    repo: string,
    period: '1month' | '3months' | '6months' | '1year'
  ) {
    const cacheKey = CacheKeyBuilder.analytics.githubMetrics(
      owner,
      repo,
      period
    );
    let metrics = await this.cache.get(cacheKey);

    if (!metrics) {
      const now = new Date();
      const monthsBack = this.getPeriodMonths(period);
      const startDate = new Date(
        now.getFullYear(),
        now.getMonth() - monthsBack,
        1
      );

      // Get all data for the period
      const [commits, pullRequests] = await Promise.all([
        this.githubClient.getCommits(owner, repo, {
          since: startDate.toISOString(),
          until: now.toISOString(),
        }),
        this.githubClient.getPullRequests(owner, repo, { state: 'all' }),
      ]);

      // Filter PRs by date
      const filteredPRs = pullRequests.filter((pr: any) => {
        const createdAt = new Date(pr.created_at);
        return createdAt >= startDate && createdAt <= now;
      });

      // Calculate metrics
      const totalCommits = commits.length;
      const totalPRs = filteredPRs.length;
      const mergedPRs = filteredPRs.filter((pr: any) => pr.merged_at).length;
      const openPRs = filteredPRs.filter(
        (pr: any) => pr.state === 'open'
      ).length;

      // Calculate contributor metrics
      const contributors = new Set(commits.map((commit: any) => commit.author));
      const topContributors = this.getTopContributors(commits, 5);

      // Calculate average time to merge (for merged PRs)
      const mergedPRsWithTimes = filteredPRs
        .filter((pr: any) => pr.merged_at)
        .map((pr: any) => {
          const created = new Date(pr.created_at);
          const merged = new Date(pr.merged_at);
          return merged.getTime() - created.getTime();
        });

      const avgTimeToMerge =
        mergedPRsWithTimes.length > 0
          ? mergedPRsWithTimes.reduce((sum, time) => sum + time, 0) /
            mergedPRsWithTimes.length
          : 0;

      metrics = {
        totalCommits,
        totalPRs,
        mergedPRs,
        openPRs,
        uniqueContributors: contributors.size,
        topContributors,
        avgTimeToMergeHours:
          Math.round((avgTimeToMerge / (1000 * 60 * 60)) * 100) / 100,
        mergeRate:
          totalPRs > 0
            ? Math.round((mergedPRs / totalPRs) * 100 * 100) / 100
            : 0,
      };

      await this.cache.set(cacheKey, metrics, { ttl: 3600 }); // 1 hour cache
    }

    return metrics as any;
  }

  /**
   * Get top contributors by commit count
   */
  private getTopContributors(commits: any[], limit: number = 5) {
    const contributorMap = new Map<string, number>();

    commits.forEach((commit: any) => {
      const author = commit.author || 'Unknown';
      contributorMap.set(author, (contributorMap.get(author) || 0) + 1);
    });

    return Array.from(contributorMap.entries())
      .map(([author, commits]) => ({ author, commits }))
      .sort((a, b) => b.commits - a.commits)
      .slice(0, limit);
  }

  /**
   * Calculate summary metrics from analytics data
   */
  private calculateSummaryMetrics(report: AnalyticsReport) {
    const velocity = report.velocity;
    const teamPerformance = report.teamPerformance;
    const gitHubMetrics = report.gitHubMetrics;

    // Calculate completion rate from team performance
    const totalPlanned = teamPerformance.reduce(
      (sum, sprint) => sum + sprint.planned,
      0
    );
    const totalCompleted = teamPerformance.reduce(
      (sum, sprint) => sum + sprint.completed,
      0
    );
    const completionRate =
      totalPlanned > 0 ? (totalCompleted / totalPlanned) * 100 : 0;

    // Calculate velocity trend
    const velocityTrend = velocity.trend;

    // Calculate code activity (if GitHub data available)
    let codeActivityTrend: 'increasing' | 'decreasing' | 'stable' | undefined;
    if (report.commitTrends && report.commitTrends.length >= 2) {
      const recentMonths = report.commitTrends.slice(-2);
      const earlierMonths = report.commitTrends.slice(-4, -2);

      if (earlierMonths.length > 0) {
        const recentAvg =
          recentMonths.reduce((sum, month) => sum + month.commits, 0) /
          recentMonths.length;
        const earlierAvg =
          earlierMonths.reduce((sum, month) => sum + month.commits, 0) /
          earlierMonths.length;

        const changePercent = ((recentAvg - earlierAvg) / earlierAvg) * 100;

        if (changePercent > 15) codeActivityTrend = 'increasing';
        else if (changePercent < -15) codeActivityTrend = 'decreasing';
        else codeActivityTrend = 'stable';
      }
    }

    const summary: {
      averageVelocity: number;
      completionRate: number;
      velocityTrend: 'increasing' | 'decreasing' | 'stable';
      codeActivityTrend?: 'increasing' | 'decreasing' | 'stable' | undefined;
      totalSprints: number;
      totalCommits: number;
      totalPRs: number;
      uniqueContributors: number;
    } = {
      averageVelocity: velocity.average,
      completionRate: Math.round(completionRate * 100) / 100,
      velocityTrend,
      totalSprints: teamPerformance.length,
      totalCommits: gitHubMetrics?.totalCommits || 0,
      totalPRs: gitHubMetrics?.totalPRs || 0,
      uniqueContributors: gitHubMetrics?.uniqueContributors || 0,
    };

    if (codeActivityTrend !== undefined) {
      summary.codeActivityTrend = codeActivityTrend;
    }

    return summary;
  }

  /**
   * Get number of months for period
   */
  private getPeriodMonths(
    period: '1month' | '3months' | '6months' | '1year'
  ): number {
    const periodMap = {
      '1month': 1,
      '3months': 3,
      '6months': 6,
      '1year': 12,
    };
    return periodMap[period];
  }

  /**
   * Get metrics for dashboard
   */
  async getDashboardMetrics(): Promise<{
    cacheHitRate: number;
    memoryTrend: 'stable' | 'increasing' | 'decreasing';
  }> {
    const cacheStats = await this.cache.getStats();

    // Simple memory trend calculation (simplified)
    const memoryTrend: 'stable' | 'increasing' | 'decreasing' = 'stable';

    return {
      cacheHitRate: cacheStats.hitRate || 0,
      memoryTrend,
    };
  }

  /**
   * Get cache optimization recommendations
   */
  async getCacheOptimizations(): Promise<{ recommendations: string[] }> {
    const stats = await this.cache.getStats();

    const recommendations: string[] = [];

    if (stats.hitRate < 50) {
      recommendations.push(
        'Consider increasing cache TTL for frequently accessed data'
      );
    }

    if (stats.hitRate < 30) {
      recommendations.push(
        'Enable Redis clustering for better cache performance'
      );
    }

    if (stats.keys && stats.keys > 1000) {
      recommendations.push(
        'Implement cache eviction policies for large datasets'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Cache performance is optimal');
    }

    return { recommendations };
  }

  // ============================================================================
  // COMPREHENSIVE SPRINT METRICS (TIER 1, 2, 3)
  // ============================================================================

  /**
   * Analyze sprint goal achievement (Tier 1)
   */
  analyzeSprintGoal(sprint: Sprint, issues: Issue[]): SprintGoalAnalysis {
    const goal = sprint.goal || 'No sprint goal defined';
    const totalIssues = issues.length;
    const completedIssues = issues.filter(
      i =>
        i.status.toLowerCase() === 'done' ||
        i.status.toLowerCase() === 'closed' ||
        i.status.toLowerCase() === 'resolved'
    ).length;

    const achievementPercentage =
      totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0;

    const achieved = achievementPercentage >= 80; // 80% threshold

    return {
      goal,
      achieved,
      achievementPercentage: Math.round(achievementPercentage * 10) / 10,
      notes: achieved
        ? `Sprint goal achieved with ${Math.round(achievementPercentage)}% completion`
        : `Sprint goal not achieved. ${completedIssues} of ${totalIssues} issues completed`,
    };
  }

  /**
   * Detect scope changes during sprint (Tier 1)
   */
  detectScopeChanges(issues: Issue[], sprint: Sprint): ScopeChange[] {
    const scopeChanges: ScopeChange[] = [];
    const sprintStartDate = new Date(sprint.startDate || Date.now());

    for (const issue of issues) {
      if (!issue.sprintHistory) continue;

      for (const change of issue.sprintHistory) {
        const changeDate = new Date(change.timestamp);
        if (changeDate >= sprintStartDate) {
          const scopeChange: ScopeChange = {
            issueKey: issue.key,
            issueSummary: issue.summary,
            action: change.action,
            timestamp: change.timestamp,
            reason:
              change.action === 'added'
                ? 'Added during sprint'
                : 'Removed during sprint',
            author: change.author,
          };

          if (issue.storyPoints !== undefined) {
            scopeChange.storyPoints = issue.storyPoints;
          }

          scopeChanges.push(scopeChange);
        }
      }
    }

    return scopeChanges.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Analyze spillover items (Tier 1)
   */
  analyzeSpillover(issues: Issue[]): SpilloverAnalysis {
    const spilloverIssues = issues.filter(
      i =>
        i.status.toLowerCase() !== 'done' &&
        i.status.toLowerCase() !== 'closed' &&
        i.status.toLowerCase() !== 'resolved'
    );

    const spilloverStoryPoints = spilloverIssues.reduce(
      (sum, i) => sum + (i.storyPoints || 0),
      0
    );

    const totalStoryPoints = issues.reduce(
      (sum, i) => sum + (i.storyPoints || 0),
      0
    );

    return {
      totalSpilloverIssues: spilloverIssues.length,
      spilloverStoryPoints,
      spilloverPercentage:
        totalStoryPoints > 0
          ? Math.round((spilloverStoryPoints / totalStoryPoints) * 1000) / 10
          : 0,
      issues: spilloverIssues.map(i => {
        const spilloverItem: {
          key: string;
          summary: string;
          storyPoints?: number;
          reason: string;
          assignee: string;
        } = {
          key: i.key,
          summary: i.summary,
          reason: i.flagged ? 'Blocked' : i.status,
          assignee: i.assignee,
        };

        if (i.storyPoints !== undefined) {
          spilloverItem.storyPoints = i.storyPoints;
        }

        return spilloverItem;
      }),
    };
  }

  /**
   * Extract blockers and impediments (Tier 2)
   */
  extractBlockers(issues: Issue[]): BlockerImpediment[] {
    return issues
      .filter(i => i.flagged)
      .map(i => {
        const blocker: BlockerImpediment = {
          issueKey: i.key,
          issueSummary: i.summary,
          blockerReason: i.blockerReason || 'Flagged as blocked',
          raisedDate: i.created,
          resolvedDate: i.resolved || '',
          daysBlocked: i.cycleTime || 1,
          impact:
            (i.cycleTime || 0) > 2 ? ('high' as const) : ('medium' as const),
          assignee: i.assignee,
        };
        return blocker;
      })
      .sort((a, b) => b.daysBlocked - a.daysBlocked);
  }

  /**
   * Calculate bug metrics (Tier 2)
   */
  calculateBugMetrics(issues: Issue[], sprint: Sprint): BugMetrics {
    const sprintStart = new Date(sprint.startDate || Date.now());
    const sprintEnd = new Date(sprint.endDate || Date.now());

    const bugs = issues.filter(
      i =>
        i.issueType.toLowerCase() === 'bug' ||
        i.issueType.toLowerCase() === 'defect'
    );

    const bugsCreated = bugs.filter(b => {
      const created = new Date(b.created);
      return created >= sprintStart && created <= sprintEnd;
    }).length;

    const bugsResolved = bugs.filter(b => {
      if (!b.resolved) return false;
      const resolved = new Date(b.resolved);
      return resolved >= sprintStart && resolved <= sprintEnd;
    }).length;

    const bugsByPriority: Record<string, number> = {};
    bugs.forEach(b => {
      bugsByPriority[b.priority] = (bugsByPriority[b.priority] || 0) + 1;
    });

    const resolvedBugs = bugs.filter(b => b.resolved);
    const avgResolutionTime =
      resolvedBugs.length > 0
        ? resolvedBugs.reduce((sum, b) => {
            const created = new Date(b.created).getTime();
            const resolved = new Date(b.resolved!).getTime();
            return sum + (resolved - created) / (1000 * 60 * 60);
          }, 0) / resolvedBugs.length
        : 0;

    return {
      bugsCreated,
      bugsResolved,
      bugsCarriedOver: bugs.filter(b => !b.resolved).length,
      netBugChange: bugsCreated - bugsResolved,
      bugsByPriority,
      averageBugResolutionTime: Math.round(avgResolutionTime * 10) / 10,
      criticalBugsOutstanding: bugs.filter(
        b => !b.resolved && b.priority.toLowerCase().includes('critical')
      ).length,
    };
  }

  /**
   * Calculate cycle time metrics (Tier 2)
   */
  calculateCycleTimeMetrics(issues: Issue[]): CycleTimeMetrics {
    const withCycleTime = issues.filter(i => i.cycleTime && i.cycleTime > 0);

    if (withCycleTime.length === 0) {
      return {
        averageCycleTime: 0,
        medianCycleTime: 0,
        p90CycleTime: 0,
        cycleTimeByType: {},
        cycleTimeByPriority: {},
        improvementVsPreviousSprint: 0,
      };
    }

    const times = withCycleTime.map(i => i.cycleTime!).sort((a, b) => a - b);
    const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
    const median = times[Math.floor(times.length / 2)] || 0;
    const p90 =
      times[Math.floor(times.length * 0.9)] || times[times.length - 1] || 0;

    const cycleTimeByType: Record<string, number> = {};
    const cycleTimeByPriority: Record<string, number> = {};

    return {
      averageCycleTime: Math.round(avg * 10) / 10,
      medianCycleTime: Math.round(median * 10) / 10,
      p90CycleTime: Math.round(p90 * 10) / 10,
      cycleTimeByType,
      cycleTimeByPriority,
      improvementVsPreviousSprint: 0,
    };
  }

  /**
   * Calculate team capacity (Tier 2) - Simplified version
   */
  calculateTeamCapacity(issues: Issue[]): TeamCapacity {
    const assignees = [...new Set(issues.map(i => i.assignee))];
    const totalCapacity = assignees.length * 40;

    return {
      totalCapacityHours: totalCapacity,
      plannedCapacityHours: totalCapacity * 0.8,
      actualCapacityHours: totalCapacity * 0.8,
      utilizationPercentage: 80,
      capacityByMember: assignees.map(name => ({
        name,
        planned: 40,
        actual: 32,
        utilization: 80,
        ptoHours: 0,
        sickHours: 0,
        otherHours: 8,
      })),
      capacityLoss: {
        pto: 0,
        sick: 0,
        meetings: assignees.length * 8,
        training: 0,
        other: 0,
      },
    };
  }

  /**
   * Calculate epic progress (Tier 3)
   */
  calculateEpicProgress(issues: Issue[]): EpicProgress[] {
    const epicMap = new Map<string, Issue[]>();

    issues.forEach(i => {
      if (i.epicLink) {
        if (!epicMap.has(i.epicLink)) {
          epicMap.set(i.epicLink, []);
        }
        epicMap.get(i.epicLink)!.push(i);
      }
    });

    const progress: EpicProgress[] = [];

    epicMap.forEach((epicIssues, epicKey) => {
      const total = epicIssues.length;
      const completed = epicIssues.filter(
        i => i.status.toLowerCase() === 'done'
      ).length;
      const inProgress = epicIssues.filter(i =>
        i.status.toLowerCase().includes('progress')
      ).length;
      const totalPoints = epicIssues.reduce(
        (sum, i) => sum + (i.storyPoints || 0),
        0
      );
      const completedPoints = epicIssues
        .filter(i => i.status.toLowerCase() === 'done')
        .reduce((sum, i) => sum + (i.storyPoints || 0), 0);

      progress.push({
        epicKey,
        epicName: epicIssues[0]?.epicName || epicKey,
        totalIssues: total,
        completedIssues: completed,
        inProgressIssues: inProgress,
        todoIssues: total - completed - inProgress,
        totalStoryPoints: totalPoints,
        completedStoryPoints: completedPoints,
        completionPercentage:
          total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
        remainingWork: totalPoints - completedPoints,
      });
    });

    return progress.sort((a, b) => b.totalStoryPoints - a.totalStoryPoints);
  }

  /**
   * Calculate technical debt (Tier 3)
   */
  calculateTechnicalDebt(issues: Issue[]): TechnicalDebt {
    const techDebtIssues = issues.filter(i =>
      i.labels.some(
        l =>
          l.toLowerCase().includes('tech-debt') ||
          l.toLowerCase().includes('refactor')
      )
    );

    const total = techDebtIssues.length;
    const points = techDebtIssues.reduce(
      (sum, i) => sum + (i.storyPoints || 0),
      0
    );
    const addressed = techDebtIssues.filter(
      i => i.status.toLowerCase() === 'done'
    ).length;
    const added = techDebtIssues.filter(
      i => i.status.toLowerCase() !== 'done'
    ).length;

    const techDebtByCategory: Record<string, number> = {};
    techDebtIssues.forEach(i => {
      const cat = i.components[0] || 'Uncategorized';
      techDebtByCategory[cat] = (techDebtByCategory[cat] || 0) + 1;
    });

    const totalPoints = issues.reduce(
      (sum, i) => sum + (i.storyPoints || 0),
      0
    );

    return {
      totalTechDebtIssues: total,
      techDebtStoryPoints: points,
      techDebtAddressed: addressed,
      techDebtAdded: added,
      netTechDebtChange: added - addressed,
      techDebtByCategory,
      percentageOfSprintCapacity:
        totalPoints > 0 ? (points / totalPoints) * 100 : 0,
    };
  }

  /**
   * Extract risk items (Tier 3)
   */
  extractRisks(issues: Issue[]): RiskItem[] {
    return issues
      .filter(i => i.flagged && i.priority.toLowerCase().includes('high'))
      .map((i, idx) => {
        const risk: RiskItem = {
          id: `RISK-${idx + 1}`,
          description: i.summary,
          probability: 'medium' as const,
          impact: i.priority.toLowerCase().includes('critical')
            ? ('high' as const)
            : ('medium' as const),
          mitigation: i.blockerReason || '',
          owner: i.assignee,
          status: i.resolved ? ('mitigated' as const) : ('active' as const),
          raisedDate: i.created,
          relatedIssues: [i.key],
        };
        return risk;
      });
  }

  /**
   * Generate next sprint forecast (Forward Looking)
   */
  generateNextSprintForecast(
    velocityHistory: number[],
    spillover: SpilloverAnalysis
  ): NextSprintForecast {
    const avgVelocity =
      velocityHistory.length > 0
        ? velocityHistory.reduce((sum, v) => sum + v, 0) /
          velocityHistory.length
        : 0;

    const recentVelocity = velocityHistory.slice(-3);
    const trend = this.calculateVelocityTrend(recentVelocity);

    let forecasted = avgVelocity;
    if (trend === 'increasing') forecasted *= 1.1;
    else if (trend === 'decreasing') forecasted *= 0.9;

    const carryover = spillover.spilloverStoryPoints;
    const available = Math.max(0, forecasted - carryover);

    const recommendations: string[] = [];
    if (carryover > forecasted * 0.3) {
      recommendations.push('High carryover - review capacity planning');
    }
    if (spillover.totalSpilloverIssues > 5) {
      recommendations.push(
        `${spillover.totalSpilloverIssues} items carried over - review planning`
      );
    }

    return {
      forecastedVelocity: Math.round(forecasted * 10) / 10,
      confidenceLevel:
        velocityHistory.length >= 5
          ? 'high'
          : velocityHistory.length >= 3
            ? 'medium'
            : 'low',
      recommendedCapacity: Math.round(available * 10) / 10,
      carryoverItems: spillover.totalSpilloverIssues,
      carryoverStoryPoints: carryover,
      availableCapacity: Math.round(available * 10) / 10,
      recommendations,
      risks: carryover > 0 ? [`${carryover} points already committed`] : [],
    };
  }

  /**
   * Analyze carryover items (Forward Looking)
   */
  analyzeCarryoverItems(
    spillover: SpilloverAnalysis,
    totalCommitment: number
  ): CarryoverItems {
    const mostCommonReasons: Record<string, number> = {};
    spillover.issues.forEach(i => {
      mostCommonReasons[i.reason] = (mostCommonReasons[i.reason] || 0) + 1;
    });

    const recommendedActions: string[] = [];
    if ((mostCommonReasons['Blocked'] || 0) > 0) {
      recommendedActions.push('Resolve blockers before next sprint');
    }
    if (spillover.totalSpilloverIssues > totalCommitment * 0.3) {
      recommendedActions.push('Review sprint planning process');
    }

    return {
      totalItems: spillover.totalSpilloverIssues,
      totalStoryPoints: spillover.spilloverStoryPoints,
      items: spillover.issues.map(i => {
        const carryoverItem: {
          key: string;
          summary: string;
          storyPoints?: number;
          reason: string;
          priority: string;
          assignee: string;
          daysInProgress: number;
        } = {
          key: i.key,
          summary: i.summary,
          reason: i.reason,
          priority: 'Medium',
          assignee: i.assignee,
          daysInProgress: 5,
        };

        if (i.storyPoints !== undefined) {
          carryoverItem.storyPoints = i.storyPoints;
        }

        return carryoverItem;
      }),
      analysis: {
        percentageOfOriginalCommitment:
          totalCommitment > 0
            ? (spillover.spilloverStoryPoints / totalCommitment) * 100
            : 0,
        mostCommonReasons,
        recommendedActions,
      },
    };
  }

  private calculateVelocityTrend(
    velocities: number[]
  ): 'increasing' | 'decreasing' | 'stable' {
    if (velocities.length < 2) return 'stable';

    const firstHalf = velocities.slice(0, Math.floor(velocities.length / 2));
    const secondHalf = velocities.slice(Math.floor(velocities.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }
}
