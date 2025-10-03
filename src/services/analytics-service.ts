import { GitHubClient } from '../clients/github-client.js';
import { CacheManager } from '../cache/cache-manager.js';
import { Logger } from '../utils/logger.js';
import { SprintService } from './sprint-service.js';
import {
  CommitTrendData,
  AnalyticsReport
} from '../types/index.js';

export class AnalyticsService {
  private logger: Logger;
  private cache: CacheManager;

  constructor(
    private githubClient: GitHubClient,
    private sprintService: SprintService,
    cacheManager?: CacheManager
  ) {
    this.logger = new Logger('AnalyticsService');
    this.cache = cacheManager || new CacheManager({
      memory: { maxSize: 100, ttl: 300 }
    });
  }

  /**
   * Get commit trends for a repository
   */
  async getCommitTrends(
    owner: string,
    repo: string,
    period: '1month' | '3months' | '6months' | '1year' = '6months'
  ): Promise<CommitTrendData[]> {
    const cacheKey = `analytics:commit-trends:${owner}:${repo}:${period}`;
    let trends = await this.cache.get(cacheKey);

    if (!trends) {
      const now = new Date();
      const monthsBack = this.getPeriodMonths(period);
      const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);

      // Get commits for the period
      const commits = await this.githubClient.getCommits(
        owner,
        repo,
        {
          since: startDate.toISOString(),
          until: now.toISOString()
        }
      );

      // Get pull requests for the period
      const pullRequests = await this.githubClient.getPullRequests(owner, repo, { state: 'all' });
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
          prs: data.prs
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
    this.logger.info('Generating analytics report', { boardId, owner, repo, period });

    try {
      // Get velocity data
      const velocityData = await this.sprintService.getVelocityData(boardId, 10);

      // Get team performance data
      const teamPerformance = await this.sprintService.getTeamPerformanceData(boardId, 10);

      // Initialize report
      const report: Partial<AnalyticsReport> = {
        boardId,
        period,
        generatedAt: new Date().toISOString(),
        velocity: velocityData,
        teamPerformance
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
        summary: report.summary
      });

      return report as AnalyticsReport;
    } catch (error) {
      this.logger.error(error as Error, 'generate_analytics_report', { boardId, owner, repo });
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
    const cacheKey = `analytics:github-metrics:${owner}:${repo}:${period}`;
    let metrics = await this.cache.get(cacheKey);

    if (!metrics) {
      const now = new Date();
      const monthsBack = this.getPeriodMonths(period);
      const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);

      // Get all data for the period
      const [commits, pullRequests] = await Promise.all([
        this.githubClient.getCommits(owner, repo, {
          since: startDate.toISOString(),
          until: now.toISOString()
        }),
        this.githubClient.getPullRequests(owner, repo, { state: 'all' })
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
      const openPRs = filteredPRs.filter((pr: any) => pr.state === 'open').length;

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

      const avgTimeToMerge = mergedPRsWithTimes.length > 0
        ? mergedPRsWithTimes.reduce((sum, time) => sum + time, 0) / mergedPRsWithTimes.length
        : 0;

      metrics = {
        totalCommits,
        totalPRs,
        mergedPRs,
        openPRs,
        uniqueContributors: contributors.size,
        topContributors,
        avgTimeToMergeHours: Math.round(avgTimeToMerge / (1000 * 60 * 60) * 100) / 100,
        mergeRate: totalPRs > 0 ? Math.round((mergedPRs / totalPRs) * 100 * 100) / 100 : 0
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
    const totalPlanned = teamPerformance.reduce((sum, sprint) => sum + sprint.planned, 0);
    const totalCompleted = teamPerformance.reduce((sum, sprint) => sum + sprint.completed, 0);
    const completionRate = totalPlanned > 0 ? (totalCompleted / totalPlanned) * 100 : 0;

    // Calculate velocity trend
    const velocityTrend = velocity.trend;

    // Calculate code activity (if GitHub data available)
    let codeActivityTrend: 'increasing' | 'decreasing' | 'stable' | undefined;
    if (report.commitTrends && report.commitTrends.length >= 2) {
      const recentMonths = report.commitTrends.slice(-2);
      const earlierMonths = report.commitTrends.slice(-4, -2);

      if (earlierMonths.length > 0) {
        const recentAvg = recentMonths.reduce((sum, month) => sum + month.commits, 0) / recentMonths.length;
        const earlierAvg = earlierMonths.reduce((sum, month) => sum + month.commits, 0) / earlierMonths.length;

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
      uniqueContributors: gitHubMetrics?.uniqueContributors || 0
    };

    if (codeActivityTrend !== undefined) {
      summary.codeActivityTrend = codeActivityTrend;
    }

    return summary;
  }

  /**
   * Get number of months for period
   */
  private getPeriodMonths(period: '1month' | '3months' | '6months' | '1year'): number {
    const periodMap = {
      '1month': 1,
      '3months': 3,
      '6months': 6,
      '1year': 12
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
      memoryTrend
    };
  }

  /**
   * Get cache optimization recommendations
   */
  async getCacheOptimizations(): Promise<{ recommendations: string[] }> {
    const stats = await this.cache.getStats();

    const recommendations: string[] = [];

    if (stats.hitRate < 50) {
      recommendations.push('Consider increasing cache TTL for frequently accessed data');
    }

    if (stats.hitRate < 30) {
      recommendations.push('Enable Redis clustering for better cache performance');
    }

    if (stats.keys && stats.keys > 1000) {
      recommendations.push('Implement cache eviction policies for large datasets');
    }

    if (recommendations.length === 0) {
      recommendations.push('Cache performance is optimal');
    }

    return { recommendations };
  }
}