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
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${config.github.token}`,
        'User-Agent': config.github.userAgent,
      },
      maxRetries: 3,
      retryDelay: 1000,
    };

    super(options, config, cacheManager);
  }

  // Get repository information
  async getRepositoryInfo(owner: string, repo: string): Promise<GitHubRepository> {
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
        console.warn(`Repository ${owner}/${repo} has too many commits, limiting to first 10000`);
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
      pullRequests = this.filterPullRequestsByDate(pullRequests, params.since, params.until);
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

    const response = await this.makeRequest<GitHubSearchResponse<GitHubCommitResponse>>(
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
          'Accept': 'application/vnd.github.cloak-preview+json', // Required for commit search
        },
      },
      { ttl: 300000 } // 5 minutes cache
    );

    return response.items.map(commit => this.transformCommitData(commit));
  }

  // Get commit details with stats
  async getCommitDetails(owner: string, repo: string, sha: string): Promise<Commit> {
    const response = await this.makeRequest<GitHubCommitResponse>(
      `/repos/${owner}/${repo}/commits/${sha}`,
      { method: 'GET' },
      { ttl: 3600000 } // 1 hour cache for commit details
    );

    return this.transformCommitData(response);
  }

  // Get pull request details
  async getPullRequestDetails(owner: string, repo: string, number: number): Promise<PullRequest> {
    const response = await this.makeRequest<GitHubPullRequestResponse>(
      `/repos/${owner}/${repo}/pulls/${number}`,
      { method: 'GET' },
      { ttl: 300000 } // 5 minutes cache
    );

    return this.transformPullRequestData(response);
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
  private transformRepositoryData(repo: GitHubRepositoryResponse): GitHubRepository {
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

      if (since && createdAt < new Date(since)) {
        return false;
      }

      if (until && createdAt > new Date(until)) {
        return false;
      }

      return true;
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

  public buildPullRequestUrl(owner: string, repo: string, number: number): string {
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
        const referencedIssues = this.extractIssueKeysFromCommitMessage(commit.message);

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
          .sort((a, b) => new Date(b.author.date).getTime() - new Date(a.author.date).getTime())
          .slice(0, params.max_commits_per_issue || 20);

        result.push({
          issueKey,
          commits: sortedCommits,
        });
      }

      return result;

    } catch (error) {
      console.error(`Failed to find commits with Jira references for ${owner}/${repo}:`, error);
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
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, maxPRsPerIssue);

        result.push({
          issueKey,
          prs: sortedPRs,
        });
      }

      return result;

    } catch (error) {
      console.error(`Failed to find pull requests with Jira references for ${owner}/${repo}:`, error);
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
        console.warn(`Repository ${owner}/${repo} has too many PRs, limiting to first 5000`);
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
          const issueKey = match.replace(/^(?:fixes?|closes?|resolves?)\s+/i, '')
                                .replace(/^#/, '')
                                .toUpperCase();
          issueKeys.add(issueKey);
        });
      }
    }

    return Array.from(issueKeys);
  }
}