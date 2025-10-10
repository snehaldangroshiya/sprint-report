// GitHub API client implementation

import { BaseAPIClient, APIClientOptions } from './base-client';

import { AppConfig, Commit, PullRequest, GitHubRepository } from '@/types';
import { ValidationUtils, MCPToolSchemas } from '@/utils/validation';

export interface GitHubCommitResponse {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: {
    login: string;
    id: number;
    avatar_url: string;
  } | null;
  committer: {
    login: string;
    id: number;
    avatar_url: string;
  } | null;
  parents: Array<{
    sha: string;
    url: string;
  }>;
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

export interface GitHubPullRequestResponse {
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
  };
  assignees: Array<{
    login: string;
    id: number;
  }>;
  requested_reviewers: Array<{
    login: string;
    id: number;
  }>;
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  milestone: {
    id: number;
    title: string;
  } | null;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
  html_url: string;
}

export interface GitHubRepositoryResponse {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    id: number;
  };
  private: boolean;
  html_url: string;
  description: string | null;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  archived: boolean;
  disabled: boolean;
}

export interface GitHubSearchResponse<T> {
  total_count: number;
  incomplete_results: boolean;
  items: T[];
}

export class GitHubClient extends BaseAPIClient {
  protected get serviceName(): string {
    return 'github';
  }

  constructor(config: AppConfig, cacheManager?: any) {
    const options: APIClientOptions = {
      baseURL: config.github.apiUrl,
      timeout: config.github.timeout,
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${config.github.token}`,
        'User-Agent': config.github.userAgent,
      },
      maxRetries: 3,
      retryDelay: 1000,
    };

    super(options, config, cacheManager);
  }

  // Get repository information
  async getRepositoryInfo(
    owner: string,
    repo: string
  ): Promise<GitHubRepository> {
    const response = await this.makeRequest<GitHubRepositoryResponse>(
      `/repos/${owner}/${repo}`,
      { method: 'GET' },
      { ttl: 1800000 } // 30 minutes cache
    );

    return this.transformRepositoryData(response);
  }

  // Get commits for a repository
  async getCommits(
    owner: string,
    repo: string,
    options: {
      since?: string;
      until?: string;
      author?: string;
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<Commit[]> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.githubGetCommits,
      { owner, repo, ...options }
    );

    // Validate date range if provided
    if (params.since && params.until) {
      ValidationUtils.validateDateRange(params.since, params.until);
    }

    const queryParams: Record<string, any> = {
      per_page: params.per_page,
      page: params.page,
    };

    if (params.since) queryParams.since = params.since;
    if (params.until) queryParams.until = params.until;
    if (params.author) queryParams.author = params.author;

    const response = await this.makeRequest<GitHubCommitResponse[]>(
      `/repos/${params.owner}/${params.repo}/commits`,
      {
        method: 'GET',
        params: queryParams,
      },
      { ttl: 300000 } // 5 minutes cache
    );

    return response.map(commit => this.transformCommitData(commit));
  }

  // Get all commits for a date range (with pagination)
  async getAllCommits(
    owner: string,
    repo: string,
    since?: string,
    until?: string,
    author?: string
  ): Promise<Commit[]> {
    let allCommits: Commit[] = [];
    let page = 1;
    const perPage = 100; // Maximum per page

    while (true) {
      const commits = await this.getCommits(owner, repo, {
        ...(since && { since }),
        ...(until && { until }),
        ...(author && { author }),
        per_page: perPage,
        page,
      });

      if (commits.length === 0) break;

      allCommits = allCommits.concat(commits);

      // If we got fewer than the requested amount, we've reached the end
      if (commits.length < perPage) break;

      page++;

      // Safety check to prevent infinite loops
      if (allCommits.length >= 10000) {
        console.warn(
          `Repository ${owner}/${repo} has too many commits, limiting to first 10000`
        );
        break;
      }
    }

    return allCommits;
  }

  // Get pull requests for a repository
  async getPullRequests(
    owner: string,
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      since?: string;
      until?: string;
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<PullRequest[]> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.githubGetPullRequests,
      { owner, repo, ...options }
    );

    const queryParams: Record<string, any> = {
      state: params.state,
      per_page: params.per_page,
      page: params.page,
      sort: 'updated',
      direction: 'desc',
    };

    const response = await this.makeRequest<GitHubPullRequestResponse[]>(
      `/repos/${params.owner}/${params.repo}/pulls`,
      {
        method: 'GET',
        params: queryParams,
      },
      { ttl: 300000 } // 5 minutes cache
    );

    let pullRequests = response.map(pr => this.transformPullRequestData(pr));

    // Filter by date range if provided
    if (params.since || params.until) {
      pullRequests = this.filterPullRequestsByDate(
        pullRequests,
        params.since,
        params.until
      );
    }

    return pullRequests;
  }

  // Search commits by message content
  async searchCommitsByMessage(
    owner: string,
    repo: string,
    query: string,
    since?: string,
    until?: string
  ): Promise<Commit[]> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.githubSearchCommitsByMessage,
      { owner, repo, query, since, until }
    );

    // Build search query
    let searchQuery = `repo:${params.owner}/${params.repo} ${params.query}`;

    if (params.since) {
      searchQuery += ` committer-date:>=${params.since}`;
    }

    if (params.until) {
      searchQuery += ` committer-date:<=${params.until}`;
    }

    const response = await this.makeRequest<
      GitHubSearchResponse<GitHubCommitResponse>
    >(
      '/search/commits',
      {
        method: 'GET',
        params: {
          q: searchQuery,
          sort: 'committer-date',
          order: 'desc',
          per_page: 100,
        },
        headers: {
          Accept: 'application/vnd.github.cloak-preview+json', // Required for commit search
        },
      },
      { ttl: 300000 } // 5 minutes cache
    );

    return response.items.map(commit => this.transformCommitData(commit));
  }

  // Search pull requests by date range using GitHub Search API
  // This is more efficient for historical data than paginating through the REST API
  async searchPullRequestsByDateRange(
    owner: string,
    repo: string,
    since?: string,
    until?: string,
    state?: 'open' | 'closed' | 'merged' | 'all'
  ): Promise<PullRequest[]> {
    // Build search query
    let searchQuery = `repo:${owner}/${repo} is:pr`;

    // Add date filters using GitHub's date range syntax
    if (since && until) {
      // Format: created:YYYY-MM-DD..YYYY-MM-DD
      const sinceDate = since.split('T')[0]; // Extract just the date part
      const untilDate = until.split('T')[0];
      searchQuery += ` created:${sinceDate}..${untilDate}`;
    } else if (since) {
      const sinceDate = since.split('T')[0];
      searchQuery += ` created:>=${sinceDate}`;
    } else if (until) {
      const untilDate = until.split('T')[0];
      searchQuery += ` created:<=${untilDate}`;
    }

    // Add state filter
    if (state === 'open') {
      searchQuery += ` is:open`;
    } else if (state === 'closed') {
      searchQuery += ` is:closed is:unmerged`;
    } else if (state === 'merged') {
      searchQuery += ` is:merged`;
    }
    // 'all' means no state filter

    let allPRs: PullRequest[] = [];
    let page = 1;
    const perPage = 100; // Maximum per page for search API

    while (true) {
      const response = await this.makeRequest<
        GitHubSearchResponse<GitHubPullRequestResponse>
      >(
        '/search/issues', // GitHub uses issues endpoint for PR search
        {
          method: 'GET',
          params: {
            q: searchQuery,
            sort: 'created',
            order: 'desc',
            per_page: perPage,
            page,
          },
        },
        { ttl: 300000 } // 5 minutes cache
      );

      if (!response.items || response.items.length === 0) break;

      const prs = response.items.map(pr => this.transformPullRequestData(pr));
      allPRs = allPRs.concat(prs);

      // If we got fewer than the requested amount, we've reached the end
      if (response.items.length < perPage) break;

      page++;

      // GitHub Search API has a limit of 1000 results (10 pages of 100)
      if (page > 10) {
        console.warn(
          `GitHub Search API limit reached (1000 results) for ${owner}/${repo}`
        );
        break;
      }
    }

    return allPRs;
  }

  // Get commit details with stats
  async getCommitDetails(
    owner: string,
    repo: string,
    sha: string
  ): Promise<Commit> {
    const response = await this.makeRequest<GitHubCommitResponse>(
      `/repos/${owner}/${repo}/commits/${sha}`,
      { method: 'GET' },
      { ttl: 3600000 } // 1 hour cache for commit details
    );

    return this.transformCommitData(response);
  }

  // Get pull request details
  async getPullRequestDetails(
    owner: string,
    repo: string,
    number: number
  ): Promise<PullRequest> {
    const response = await this.makeRequest<GitHubPullRequestResponse>(
      `/repos/${owner}/${repo}/pulls/${number}`,
      { method: 'GET' },
      { ttl: 300000 } // 5 minutes cache
    );

    return this.transformPullRequestData(response);
  }

  // Get PR reviews for enhanced metrics
  async getPullRequestReviews(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<import('@/types').PRReview[]> {
    const response = await this.makeRequest<any[]>(
      `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      { method: 'GET' },
      { ttl: 300000 } // 5 minutes cache
    );

    return response.map(review => ({
      reviewer: review.user.login,
      state: review.state,
      submittedAt: review.submitted_at,
      comments: 0, // Will be populated separately
    }));
  }

  // Get PR review comments count
  async getPullRequestComments(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<number> {
    const response = await this.makeRequest<any[]>(
      `/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
      { method: 'GET' },
      { ttl: 300000 }
    );

    return response.length;
  }

  // Get enhanced PR with review metrics
  async getEnhancedPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<PullRequest> {
    // Get basic PR data
    const pr = await this.getPullRequestDetails(owner, repo, prNumber);

    try {
      // Get reviews
      const reviews = await this.getPullRequestReviews(owner, repo, prNumber);

      // Get comment count
      const commentCount = await this.getPullRequestComments(
        owner,
        repo,
        prNumber
      );

      // Calculate time to first review
      const timeToFirstReview =
        reviews.length > 0 && reviews[0]
          ? this.calculateTimeToFirstReview(
              pr.createdAt,
              reviews[0].submittedAt
            )
          : undefined;

      // Calculate time to merge
      const timeToMerge = pr.mergedAt
        ? this.calculateTimeToMerge(pr.createdAt, pr.mergedAt)
        : undefined;

      // Extract linked Jira issues
      const linkedIssues = [
        ...this.extractIssueKeysFromCommitMessage(pr.title),
        ...this.extractIssueKeysFromCommitMessage(pr.body),
      ];

      // Enhance PR with metrics
      if (timeToFirstReview !== undefined)
        pr.timeToFirstReview = timeToFirstReview;
      if (timeToMerge !== undefined) pr.timeToMerge = timeToMerge;
      pr.reviews = reviews;
      pr.reviewComments = commentCount;
      pr.linkedIssues = [...new Set(linkedIssues)];

      return pr;
    } catch (error) {
      // If enhancement fails, return basic PR
      console.warn(`Failed to enhance PR ${prNumber}, using basic data`, error);
      return pr;
    }
  }

  // Get enhanced PRs with review metrics
  async getEnhancedPullRequests(
    owner: string,
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      since?: string;
      until?: string;
      limit?: number;
    } = {}
  ): Promise<PullRequest[]> {
    const basicPRs = await this.getAllPullRequests(
      owner,
      repo,
      options.since,
      options.until
    );

    const limit = options.limit || 50;
    const prsToEnhance = basicPRs.slice(0, limit);
    const enhancedPRs: PullRequest[] = [];

    for (let i = 0; i < prsToEnhance.length; i++) {
      const pr = prsToEnhance[i];
      if (!pr) continue;

      try {
        const enhanced = await this.getEnhancedPullRequest(
          owner,
          repo,
          pr.number
        );
        enhancedPRs.push(enhanced);

        // Rate limiting: delay every 5 requests
        if ((i + 1) % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.warn(`Failed to enhance PR ${pr.number}`, error);
        enhancedPRs.push(pr);
      }
    }

    return enhancedPRs;
  }

  // Calculate time to first review in hours
  private calculateTimeToFirstReview(
    createdAt: string,
    firstReviewAt: string
  ): number {
    const created = new Date(createdAt).getTime();
    const reviewed = new Date(firstReviewAt).getTime();
    return (reviewed - created) / (1000 * 60 * 60); // hours
  }

  // Calculate time to merge in hours
  private calculateTimeToMerge(createdAt: string, mergedAt: string): number {
    const created = new Date(createdAt).getTime();
    const merged = new Date(mergedAt).getTime();
    return (merged - created) / (1000 * 60 * 60); // hours
  }

  // Calculate code review stats for a set of PRs
  calculateCodeReviewStats(prs: PullRequest[]): {
    totalReviews: number;
    reviewsByReviewer: Record<string, number>;
    averageReviewsPerPR: number;
    approvalRate: number;
    changesRequestedRate: number;
  } {
    let totalReviews = 0;
    const reviewsByReviewer: Record<string, number> = {};
    let approvedCount = 0;
    let changesRequestedCount = 0;

    for (const pr of prs) {
      if (pr.reviews) {
        totalReviews += pr.reviews.length;

        for (const review of pr.reviews) {
          reviewsByReviewer[review.reviewer] =
            (reviewsByReviewer[review.reviewer] || 0) + 1;

          if (review.state === 'APPROVED') {
            approvedCount++;
          } else if (review.state === 'CHANGES_REQUESTED') {
            changesRequestedCount++;
          }
        }
      }
    }

    return {
      totalReviews,
      reviewsByReviewer,
      averageReviewsPerPR: prs.length > 0 ? totalReviews / prs.length : 0,
      approvalRate: totalReviews > 0 ? (approvedCount / totalReviews) * 100 : 0,
      changesRequestedRate:
        totalReviews > 0 ? (changesRequestedCount / totalReviews) * 100 : 0,
    };
  }

  // Calculate commit activity stats
  calculateCommitActivityStats(commits: Commit[]): {
    totalCommits: number;
    commitsByAuthor: Record<string, number>;
    commitsByDay: Array<{ date: string; count: number }>;
    averageCommitsPerDay: number;
    peakCommitDay: string;
  } {
    const commitsByAuthor: Record<string, number> = {};
    const commitsByDay: Map<string, number> = new Map();

    for (const commit of commits) {
      // Count by author
      const author = commit.author.name;
      commitsByAuthor[author] = (commitsByAuthor[author] || 0) + 1;

      // Count by day
      const dateStr =
        commit.date || commit.author.date || new Date().toISOString();
      const dateParts = dateStr.split('T');
      const day = dateParts[0] || dateStr;
      commitsByDay.set(day, (commitsByDay.get(day) || 0) + 1);
    }

    const commitsByDayArray = Array.from(commitsByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const peakCommitDay =
      commitsByDayArray.length > 0
        ? commitsByDayArray.reduce(
            (max, day) => (day.count > max.count ? day : max),
            { date: '', count: 0 }
          ).date
        : '';

    return {
      totalCommits: commits.length,
      commitsByAuthor,
      commitsByDay: commitsByDayArray,
      averageCommitsPerDay:
        commitsByDayArray.length > 0
          ? commits.length / commitsByDayArray.length
          : 0,
      peakCommitDay,
    };
  }

  // Calculate code change stats
  calculateCodeChangeStats(commits: Commit[]): {
    totalLinesAdded: number;
    totalLinesDeleted: number;
    netLineChange: number;
    filesChanged: number;
    changesByAuthor: Record<string, { additions: number; deletions: number }>;
  } {
    let totalLinesAdded = 0;
    let totalLinesDeleted = 0;
    const filesChanged = new Set<string>();
    const changesByAuthor: Record<
      string,
      { additions: number; deletions: number }
    > = {};

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
  }

  // Health check implementation
  protected async performHealthCheck(): Promise<void> {
    await this.makeRequest<any>(
      '/user',
      { method: 'GET' },
      { useCache: false }
    );
  }

  // Data transformation methods
  private transformRepositoryData(
    repo: GitHubRepositoryResponse
  ): GitHubRepository {
    return {
      owner: repo.owner.login,
      repo: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      defaultBranch: repo.default_branch,
    };
  }

  private transformCommitData(commit: GitHubCommitResponse): Commit {
    const result: Commit = {
      sha: commit.sha,
      message: commit.commit.message,
      author: {
        name: commit.commit.author.name,
        email: commit.commit.author.email,
        date: commit.commit.author.date,
      },
      date: commit.commit.author.date,
      url: commit.html_url,
    };

    if (commit.stats) {
      result.stats = {
        additions: commit.stats.additions,
        deletions: commit.stats.deletions,
        total: commit.stats.total,
      };
    }

    return result;
  }

  private transformPullRequestData(pr: GitHubPullRequestResponse): PullRequest {
    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.merged_at ? 'merged' : pr.state,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      closedAt: pr.closed_at || undefined,
      mergedAt: pr.merged_at || undefined,
      author: pr.user.login,
      reviewers: pr.requested_reviewers.map(reviewer => reviewer.login),
      commits: pr.commits,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
    };
  }

  private filterPullRequestsByDate(
    pullRequests: PullRequest[],
    since?: string,
    until?: string
  ): PullRequest[] {
    return pullRequests.filter(pr => {
      const createdAt = new Date(pr.createdAt);
      const updatedAt = pr.updatedAt ? new Date(pr.updatedAt) : null;
      const mergedAt = pr.mergedAt ? new Date(pr.mergedAt) : null;
      const closedAt = pr.closedAt ? new Date(pr.closedAt) : null;

      const sinceDate = since ? new Date(since) : null;
      const untilDate = until ? new Date(until) : null;

      // Include PR if any of these conditions are met:
      // 1. It was created during the sprint
      // 2. It was updated during the sprint
      // 3. It was merged during the sprint
      // 4. It was closed during the sprint

      // Check if PR has any activity in the date range
      const dates = [createdAt, updatedAt, mergedAt, closedAt].filter(
        d => d !== null
      );

      for (const date of dates) {
        if (sinceDate && date < sinceDate) {
          continue; // This date is before the range
        }
        if (untilDate && date > untilDate) {
          continue; // This date is after the range
        }
        // If we get here, this date is within the range
        return true;
      }

      return false;
    });
  }

  // Utility methods
  public async validateConnection(): Promise<{
    valid: boolean;
    user?: string;
    scopes?: string[];
    rateLimit?: any;
    error?: string;
  }> {
    try {
      const response = await this.makeRequest<any>(
        '/user',
        { method: 'GET' },
        { useCache: false }
      );

      // Get rate limit info from the response
      const rateLimitInfo = this.getRateLimitInfo();

      return {
        valid: true,
        user: response.login,
        scopes: [], // GitHub doesn't return scopes in user endpoint
        rateLimit: rateLimitInfo,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async getAuthenticatedUser(): Promise<{
    login: string;
    id: number;
    name: string;
    email: string;
    company?: string;
  }> {
    const response = await this.makeRequest<any>(
      '/user',
      { method: 'GET' },
      { ttl: 1800000 } // 30 minutes cache
    );

    return {
      login: response.login,
      id: response.id,
      name: response.name || response.login,
      email: response.email,
      company: response.company,
    };
  }

  public async getRateLimitStatus(): Promise<{
    core: { limit: number; remaining: number; reset: number; used: number };
    search: { limit: number; remaining: number; reset: number; used: number };
  }> {
    const response = await this.makeRequest<any>(
      '/rate_limit',
      { method: 'GET' },
      { useCache: false }
    );

    return {
      core: response.resources.core,
      search: response.resources.search,
    };
  }

  // Build GitHub URLs
  public buildRepositoryUrl(owner: string, repo: string): string {
    return `https://github.com/${owner}/${repo}`;
  }

  public buildCommitUrl(owner: string, repo: string, sha: string): string {
    return `${this.buildRepositoryUrl(owner, repo)}/commit/${sha}`;
  }

  public buildPullRequestUrl(
    owner: string,
    repo: string,
    number: number
  ): string {
    return `${this.buildRepositoryUrl(owner, repo)}/pull/${number}`;
  }

  // Find commits that reference specific Jira issue keys
  async findCommitsWithJiraReferences(
    owner: string,
    repo: string,
    issueKeys: string[],
    since?: string,
    until?: string
  ): Promise<Array<{ issueKey: string; commits: Commit[] }>> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.githubFindCommitsWithJiraReferences,
      { owner, repo, issue_keys: issueKeys, since, until }
    );

    try {
      // Get all commits in the specified time range
      const allCommits = await this.getAllCommits(
        params.owner,
        params.repo,
        params.since,
        params.until
      );

      // Group commits by the issue keys they reference
      const commitsByIssue = new Map<string, Commit[]>();

      for (const commit of allCommits) {
        const referencedIssues = this.extractIssueKeysFromCommitMessage(
          commit.message
        );

        for (const issueKey of referencedIssues) {
          // Only include commits that reference the requested issue keys
          if (params.issue_keys.includes(issueKey)) {
            if (!commitsByIssue.has(issueKey)) {
              commitsByIssue.set(issueKey, []);
            }
            commitsByIssue.get(issueKey)!.push(commit);
          }
        }
      }

      // Convert to the expected format and limit commits per issue
      const result: Array<{ issueKey: string; commits: Commit[] }> = [];

      for (const issueKey of params.issue_keys) {
        const commits = commitsByIssue.get(issueKey) || [];

        // Sort commits by date (most recent first) and limit
        const sortedCommits = commits
          .sort(
            (a, b) =>
              new Date(b.author.date).getTime() -
              new Date(a.author.date).getTime()
          )
          .slice(0, params.max_commits_per_issue || 20);

        result.push({
          issueKey,
          commits: sortedCommits,
        });
      }

      return result;
    } catch (error) {
      console.error(
        `Failed to find commits with Jira references for ${owner}/${repo}:`,
        error
      );
      throw error;
    }
  }

  // Find pull requests that reference specific Jira issue keys
  async findPullRequestsWithJiraReferences(
    owner: string,
    repo: string,
    issueKeys: string[],
    since?: string,
    until?: string,
    maxPRsPerIssue = 5
  ): Promise<Array<{ issueKey: string; prs: PullRequest[] }>> {
    try {
      // Get all pull requests in the specified time range
      const allPRs = await this.getAllPullRequests(owner, repo, since, until);

      // Group PRs by the issue keys they reference
      const prsByIssue = new Map<string, PullRequest[]>();

      for (const pr of allPRs) {
        // Check both title and body for issue references
        const titleIssues = this.extractIssueKeysFromCommitMessage(pr.title);
        const bodyIssues = this.extractIssueKeysFromCommitMessage(pr.body);
        const referencedIssues = [...new Set([...titleIssues, ...bodyIssues])];

        for (const issueKey of referencedIssues) {
          // Only include PRs that reference the requested issue keys
          if (issueKeys.includes(issueKey)) {
            if (!prsByIssue.has(issueKey)) {
              prsByIssue.set(issueKey, []);
            }
            prsByIssue.get(issueKey)!.push(pr);
          }
        }
      }

      // Convert to the expected format and limit PRs per issue
      const result: Array<{ issueKey: string; prs: PullRequest[] }> = [];

      for (const issueKey of issueKeys) {
        const prs = prsByIssue.get(issueKey) || [];

        // Sort PRs by date (most recent first) and limit
        const sortedPRs = prs
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, maxPRsPerIssue);

        result.push({
          issueKey,
          prs: sortedPRs,
        });
      }

      return result;
    } catch (error) {
      console.error(
        `Failed to find pull requests with Jira references for ${owner}/${repo}:`,
        error
      );
      throw error;
    }
  }

  // Get all pull requests for a date range (with pagination)
  async getAllPullRequests(
    owner: string,
    repo: string,
    since?: string,
    until?: string
  ): Promise<PullRequest[]> {
    let allPRs: PullRequest[] = [];
    let page = 1;
    const perPage = 100; // Maximum per page

    while (true) {
      const prs = await this.getPullRequests(owner, repo, {
        state: 'all',
        ...(since && { since }),
        ...(until && { until }),
        per_page: perPage,
        page,
      });

      if (prs.length === 0) break;

      allPRs = allPRs.concat(prs);

      // If we got fewer than the requested amount, we've reached the end
      if (prs.length < perPage) break;

      page++;

      // Safety check to prevent infinite loops
      if (allPRs.length >= 5000) {
        console.warn(
          `Repository ${owner}/${repo} has too many PRs, limiting to first 5000`
        );
        break;
      }
    }

    return allPRs;
  }

  // Parse issue keys from commit messages
  public extractIssueKeysFromCommitMessage(message: string): string[] {
    // Common patterns for Jira issue references
    const patterns = [
      /\b[A-Z][A-Z0-9_]*-\d+\b/g, // Standard Jira format: PROJ-123
      /(?:fixes?|closes?|resolves?)\s+([A-Z][A-Z0-9_]*-\d+)/gi, // "fixes PROJ-123"
      /#([A-Z][A-Z0-9_]*-\d+)/g, // "#PROJ-123"
    ];

    const issueKeys = new Set<string>();

    for (const pattern of patterns) {
      const matches = message.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Extract just the issue key part
          const issueKey = match
            .replace(/^(?:fixes?|closes?|resolves?)\s+/i, '')
            .replace(/^#/, '')
            .toUpperCase();
          issueKeys.add(issueKey);
        });
      }
    }

    return Array.from(issueKeys);
  }
}
