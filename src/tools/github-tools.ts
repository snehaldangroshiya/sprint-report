import { GitHubClient } from '../clients/github-client.js';
import { GitHubGraphQLClient } from '../clients/github-graphql-client.js';
import { Logger } from '../utils/logger.js';
import { ValidationUtils, MCPToolSchemas } from '../utils/validation.js';

export interface GitHubToolsOptions {
  useGraphQL?: boolean; // Feature flag to enable GraphQL operations
  preferGraphQL?: boolean; // Prefer GraphQL when both are available
}

export class GitHubTools {
  private logger: Logger;
  private useGraphQL: boolean;
  private preferGraphQL: boolean;

  constructor(
    private githubClient: GitHubClient,
    private githubGraphQLClient?: GitHubGraphQLClient,
    options: GitHubToolsOptions = {}
  ) {
    this.logger = new Logger('GitHubTools');
    this.useGraphQL = options.useGraphQL ?? true; // GraphQL enabled by default
    this.preferGraphQL = options.preferGraphQL ?? true; // Prefer GraphQL when available
  }

  /**
   * Get commits from repository
   * Uses GraphQL for better performance when stats are needed
   */
  async getCommits(args: {
    owner: string;
    repo: string;
    since?: string;
    until?: string;
    author?: string;
    per_page?: number;
    page?: number;
  }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.githubGetCommits,
      args
    );
    this.logger.info('Getting GitHub commits', {
      owner: params.owner,
      repo: params.repo,
      since: params.since,
      until: params.until,
      method: this.shouldUseGraphQL() ? 'graphql' : 'rest',
    });

    try {
      // Use GraphQL if available and no author filter (GraphQL doesn't support author filter yet)
      if (this.shouldUseGraphQL() && !params.author) {
        const options: {
          since?: string;
          until?: string;
          limit?: number;
        } = {
          limit: params.per_page || 100,
        };

        if (params.since) options.since = params.since;
        if (params.until) options.until = params.until;

        const commits = await this.githubGraphQLClient!.getCommits(
          params.owner,
          params.repo,
          options
        );

        this.logger.info('Successfully retrieved commits via GraphQL', {
          owner: params.owner,
          repo: params.repo,
          count: commits.length,
        });

        return commits;
      }

      // Fallback to REST
      const options: {
        since?: string;
        until?: string;
        author?: string;
        per_page?: number;
        page?: number;
      } = {};

      if (params.since !== undefined) options.since = params.since;
      if (params.until !== undefined) options.until = params.until;
      if (params.author !== undefined) options.author = params.author;
      if (params.per_page !== undefined) options.per_page = params.per_page;
      if (params.page !== undefined) options.page = params.page;

      const commits = await this.githubClient.getCommits(
        params.owner,
        params.repo,
        options
      );

      this.logger.info('Successfully retrieved commits via REST', {
        owner: params.owner,
        repo: params.repo,
        count: commits.length,
      });

      return commits;
    } catch (error) {
      this.logger.error(error as Error, 'get_commits', {
        owner: params.owner,
        repo: params.repo,
      });
      throw error;
    }
  }

  /**
   * Check if GraphQL should be used
   */
  private shouldUseGraphQL(): boolean {
    return this.useGraphQL && this.preferGraphQL && !!this.githubGraphQLClient;
  }

  /**
   * Get pull requests from repository
   */
  async getPullRequests(args: {
    owner: string;
    repo: string;
    state?: 'open' | 'closed' | 'all';
    per_page?: number;
    page?: number;
  }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.githubGetPullRequests,
      args
    );
    this.logger.info('Getting GitHub pull requests', {
      owner: params.owner,
      repo: params.repo,
      state: params.state,
    });

    try {
      const options: {
        state?: 'open' | 'closed' | 'all';
        per_page?: number;
        page?: number;
      } = {};

      if (params.state !== undefined) options.state = params.state;
      if (params.per_page !== undefined) options.per_page = params.per_page;
      if (params.page !== undefined) options.page = params.page;

      const pullRequests = await this.githubClient.getPullRequests(
        params.owner,
        params.repo,
        options
      );

      this.logger.info('Successfully retrieved pull requests', {
        owner: params.owner,
        repo: params.repo,
        count: pullRequests.length,
      });

      return pullRequests;
    } catch (error) {
      this.logger.error(error as Error, 'get_pull_requests', {
        owner: params.owner,
        repo: params.repo,
      });
      throw error;
    }
  }

  /**
   * Get repository information
   * Prefers GraphQL for better performance
   */
  async getRepository(args: { owner: string; repo: string }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.githubGetRepository,
      args
    );
    this.logger.info('Getting GitHub repository', {
      owner: params.owner,
      repo: params.repo,
      method: this.shouldUseGraphQL() ? 'graphql' : 'rest',
    });

    try {
      // Use GraphQL for repository info
      if (this.shouldUseGraphQL()) {
        const repository = await this.githubGraphQLClient!.getRepositoryInfo(
          params.owner,
          params.repo
        );

        this.logger.info('Successfully retrieved repository via GraphQL', {
          owner: params.owner,
          repo: params.repo,
          defaultBranch: repository.defaultBranch,
        });

        return repository;
      }

      // Fallback to REST
      const repository = await this.githubClient.getRepositoryInfo(
        params.owner,
        params.repo
      );

      this.logger.info('Successfully retrieved repository via REST', {
        owner: params.owner,
        repo: params.repo,
        defaultBranch: repository.defaultBranch,
      });

      return repository;
    } catch (error) {
      this.logger.error(error as Error, 'get_repository', {
        owner: params.owner,
        repo: params.repo,
      });
      throw error;
    }
  }

  /**
   * Search commits by message
   * Uses GraphQL for better performance
   */
  async searchCommitsByMessage(args: {
    owner: string;
    repo: string;
    query: string;
    since?: string;
    until?: string;
    per_page?: number;
    page?: number;
  }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.githubSearchCommitsByMessage,
      args
    );
    this.logger.info('Searching GitHub commits by message', {
      owner: params.owner,
      repo: params.repo,
      query: params.query,
      method: this.shouldUseGraphQL() ? 'graphql' : 'rest',
    });

    try {
      // Use GraphQL for commit search
      if (this.shouldUseGraphQL()) {
        const commits = await this.githubGraphQLClient!.searchCommitsByMessage(
          params.owner,
          params.repo,
          params.query,
          params.since,
          params.until
        );

        this.logger.info('Successfully searched commits via GraphQL', {
          owner: params.owner,
          repo: params.repo,
          query: params.query,
          count: commits.length,
        });

        return commits;
      }

      // Fallback to REST
      const commits = await this.githubClient.searchCommitsByMessage(
        params.owner,
        params.repo,
        params.query,
        params.since,
        params.until
      );

      this.logger.info('Successfully searched commits via REST', {
        owner: params.owner,
        repo: params.repo,
        query: params.query,
        count: commits.length,
      });

      return commits;
    } catch (error) {
      this.logger.error(error as Error, 'search_commits_by_message', {
        owner: params.owner,
        repo: params.repo,
        query: params.query,
      });
      throw error;
    }
  }

  /**
   * Find commits with Jira references
   */
  async findCommitsWithJiraReferences(args: {
    owner: string;
    repo: string;
    issue_keys: string[];
    since?: string;
    until?: string;
  }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.githubFindCommitsWithJiraReferences,
      args
    );
    this.logger.info('Finding commits with Jira references', {
      owner: params.owner,
      repo: params.repo,
      issueKeys: params.issue_keys,
    });

    try {
      const result = await this.githubClient.findCommitsWithJiraReferences(
        params.owner,
        params.repo,
        params.issue_keys,
        params.since,
        params.until
      );

      this.logger.info('Successfully found commits with Jira references', {
        owner: params.owner,
        repo: params.repo,
        issueKeys: params.issue_keys,
        results: result.length,
      });

      return result;
    } catch (error) {
      this.logger.error(error as Error, 'find_commits_with_jira_references', {
        owner: params.owner,
        repo: params.repo,
        issueKeys: params.issue_keys,
      });
      throw error;
    }
  }

  /**
   * Get commit trends for analytics
   */
  async getCommitTrends(args: {
    owner: string;
    repo: string;
    period: '1month' | '3months' | '6months' | '1year';
  }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.githubGetCommitTrends,
      args
    );
    this.logger.info('Calculating commit trends', {
      owner: params.owner,
      repo: params.repo,
      period: params.period,
    });

    try {
      const now = new Date();
      const monthsBack = this.getPeriodMonths(params.period || '6months');
      const startDate = new Date(
        now.getFullYear(),
        now.getMonth() - monthsBack,
        1
      );

      // Get commits for the period
      const commits = await this.githubClient.getCommits(
        params.owner,
        params.repo,
        {
          since: startDate.toISOString(),
          until: now.toISOString(),
        }
      );

      // Get pull requests for the period
      const pullRequests = await this.githubClient.getPullRequests(
        params.owner,
        params.repo
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
      const trends = Array.from(trendMap.entries())
        .map(([date, data]) => ({
          date,
          commits: data.commits,
          prs: data.prs,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      this.logger.info('Successfully calculated commit trends', {
        owner: params.owner,
        repo: params.repo,
        period: params.period,
        months: trends.length,
      });

      return trends;
    } catch (error) {
      this.logger.error(error as Error, 'get_commit_trends', {
        owner: params.owner,
        repo: params.repo,
        period: params.period,
      });
      throw error;
    }
  }

  /**
   * Get repository statistics
   */
  async getRepositoryStats(args: {
    owner: string;
    repo: string;
    period?: '1month' | '3months' | '6months' | '1year';
  }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.githubGetRepositoryStats,
      args
    );
    this.logger.info('Getting repository statistics', {
      owner: params.owner,
      repo: params.repo,
      period: params.period,
    });

    try {
      const period = params.period || '6months';
      const now = new Date();
      const monthsBack = this.getPeriodMonths(period);
      const startDate = new Date(
        now.getFullYear(),
        now.getMonth() - monthsBack,
        1
      );

      // Get all data for the period
      const [commits, pullRequests] = await Promise.all([
        this.githubClient.getCommits(params.owner, params.repo, {
          since: startDate.toISOString(),
          until: now.toISOString(),
        }),
        this.githubClient.getPullRequests(params.owner, params.repo, {}),
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

      const result = {
        period,
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

      this.logger.info('Successfully calculated repository statistics', {
        owner: params.owner,
        repo: params.repo,
        period,
        totalCommits,
        totalPRs,
      });

      return result;
    } catch (error) {
      this.logger.error(error as Error, 'get_repository_stats', {
        owner: params.owner,
        repo: params.repo,
        period: params.period,
      });
      throw error;
    }
  }

  /**
   * Health check for GitHub
   */
  async healthCheck(): Promise<any> {
    this.logger.info('Performing GitHub health check');

    try {
      const startTime = Date.now();
      await this.githubClient.healthCheck();
      const latency = Date.now() - startTime;

      const result = {
        healthy: true,
        latency,
        service: 'github',
      };

      this.logger.info('GitHub health check passed', { latency });
      return result;
    } catch (error) {
      this.logger.error(error as Error, 'github_health_check');

      return {
        healthy: false,
        error: (error as Error).message,
        service: 'github',
      };
    }
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
}
