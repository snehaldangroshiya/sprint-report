// GitHub GraphQL API v4 client implementation

import { graphql } from '@octokit/graphql';
import { PullRequest, Commit, GitHubRepository } from '@/types';
import { createLogger } from '@/utils/logger';

const logger = createLogger('GitHubGraphQLClient');

// GraphQL Response Types
export interface GraphQLPullRequest {
  number: number;
  title: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  author: {
    login: string;
  } | null;
  baseRefName: string;
  headRefName: string;
  url: string;
  additions: number;
  deletions: number;
  commits: {
    totalCount: number;
  };
  changedFiles: number;
  reviews: {
    totalCount: number;
  };
  comments: {
    totalCount: number;
  };
  labels: {
    nodes: Array<{
      name: string;
    }>;
  };
  assignees: {
    nodes: Array<{
      login: string;
    }>;
  };
}

export interface GraphQLCommit {
  oid: string;
  message: string;
  committedDate: string;
  url: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface GraphQLRepository {
  name: string;
  owner: {
    login: string;
  };
  url: string;
  description: string | null;
  defaultBranchRef: {
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
}

export interface GraphQLSearchResponse {
  search: {
    issueCount: number;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    nodes: GraphQLPullRequest[];
  };
}

export interface GraphQLCommitHistoryResponse {
  repository: {
    ref: {
      target: {
        history: {
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
          totalCount: number;
          nodes: GraphQLCommit[];
        };
      };
    };
  };
}

export interface GitHubGraphQLClientOptions {
  cacheManager?: any;
  enableCache?: boolean;
  defaultCacheTTL?: number;
}

export class GitHubGraphQLClient {
  private graphqlWithAuth: typeof graphql;
  private cacheManager?: any;
  private enableCache: boolean;
  private defaultCacheTTL: number;

  constructor(token: string, options: GitHubGraphQLClientOptions = {}) {
    this.graphqlWithAuth = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    });
    this.cacheManager = options.cacheManager;
    this.enableCache = options.enableCache ?? true;
    this.defaultCacheTTL = options.defaultCacheTTL ?? 300000; // 5 minutes
  }

  /**
   * Search pull requests by date range using GitHub GraphQL API v4
   * This is more efficient than REST API for date-range queries
   */
  async searchPullRequestsByDateRange(
    owner: string,
    repo: string,
    startDate: string,
    endDate: string,
    state: 'open' | 'closed' | 'merged' | 'all' = 'all'
  ): Promise<PullRequest[]> {
    try {
      // Format dates for GitHub's search query (YYYY-MM-DD)
      const sinceDate = startDate.split('T')[0];
      const untilDate = endDate.split('T')[0];

      // Build search query
      let searchQuery = `repo:${owner}/${repo} is:pr created:${sinceDate}..${untilDate}`;

      // Add state filter
      if (state === 'open') {
        searchQuery += ' is:open';
      } else if (state === 'closed') {
        searchQuery += ' is:closed is:unmerged';
      } else if (state === 'merged') {
        searchQuery += ' is:merged';
      }
      // 'all' means no state filter

      logger.info('Searching PRs with GraphQL', {
        owner,
        repo,
        startDate: sinceDate,
        endDate: untilDate,
        state,
        query: searchQuery,
      });

      const allPRs: PullRequest[] = [];
      let hasNextPage = true;
      let cursor: string | null = null;
      let pageCount = 0;
      const maxPages = 10; // Limit to 1000 results (100 per page)

      while (hasNextPage && pageCount < maxPages) {
        const query = `
          query($searchQuery: String!, $cursor: String) {
            search(query: $searchQuery, type: ISSUE, first: 100, after: $cursor) {
              issueCount
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                ... on PullRequest {
                  number
                  title
                  state
                  createdAt
                  updatedAt
                  closedAt
                  mergedAt
                  author {
                    login
                  }
                  baseRefName
                  headRefName
                  url
                  additions
                  deletions
                  commits {
                    totalCount
                  }
                  changedFiles
                  reviews {
                    totalCount
                  }
                  comments {
                    totalCount
                  }
                  labels(first: 10) {
                    nodes {
                      name
                    }
                  }
                  assignees(first: 10) {
                    nodes {
                      login
                    }
                  }
                }
              }
            }
          }
        `;

        const response: GraphQLSearchResponse = await this.graphqlWithAuth({
          query,
          searchQuery,
          cursor,
        });

        const prs = response.search.nodes.map(pr => this.transformGraphQLPR(pr, owner, repo));
        allPRs.push(...prs);

        hasNextPage = response.search.pageInfo.hasNextPage;
        cursor = response.search.pageInfo.endCursor;
        pageCount++;

        logger.info(`GraphQL search page ${pageCount} completed`, {
          prsInPage: prs.length,
          totalPRs: allPRs.length,
          hasNextPage,
          totalCount: response.search.issueCount,
        });
      }

      logger.info('GraphQL PR search completed', {
        owner,
        repo,
        totalPRs: allPRs.length,
        pages: pageCount,
      });

      return allPRs;
    } catch (error) {
      logger.error('GraphQL PR search failed', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Get repository information with enhanced metadata
   */
  async getRepositoryInfo(owner: string, repo: string): Promise<GitHubRepository> {
    const cacheKey = `graphql:repo:${owner}/${repo}`;

    if (this.enableCache && this.cacheManager) {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        logger.info('Repository info from cache', { owner, repo });
        return cached;
      }
    }

    try {
      const query = `
        query($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            name
            owner {
              login
            }
            url
            description
            defaultBranchRef {
              name
            }
            createdAt
            updatedAt
            pushedAt
          }
        }
      `;

      const response: { repository: GraphQLRepository } = await this.graphqlWithAuth({
        query,
        owner,
        repo,
      });

      const result = this.transformGraphQLRepository(response.repository);

      if (this.enableCache && this.cacheManager) {
        await this.cacheManager.set(cacheKey, result, { ttl: this.defaultCacheTTL });
      }

      logger.info('Repository info fetched via GraphQL', { owner, repo });
      return result;
    } catch (error) {
      logger.error('Failed to fetch repository via GraphQL', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Get commit history with stats using GraphQL
   * More efficient than REST for getting commits with stats
   */
  async getCommits(
    owner: string,
    repo: string,
    options: {
      since?: string;
      until?: string;
      branch?: string;
      limit?: number;
    } = {}
  ): Promise<Commit[]> {
    const branch = options.branch || 'HEAD';
    const limit = options.limit || 100;

    const cacheKey = `graphql:commits:${owner}/${repo}:${branch}:${options.since || ''}:${options.until || ''}:${limit}`;

    if (this.enableCache && this.cacheManager) {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        logger.info('Commits from cache', { owner, repo, count: cached.length });
        return cached;
      }
    }

    try {
      const query = `
        query($owner: String!, $repo: String!, $branch: String!, $limit: Int!, $since: GitTimestamp, $until: GitTimestamp) {
          repository(owner: $owner, name: $repo) {
            ref(qualifiedName: $branch) {
              target {
                ... on Commit {
                  history(first: $limit, since: $since, until: $until) {
                    pageInfo {
                      hasNextPage
                      endCursor
                    }
                    totalCount
                    nodes {
                      oid
                      message
                      committedDate
                      url
                      author {
                        name
                        email
                        date
                      }
                      additions
                      deletions
                      changedFiles
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const variables: any = {
        owner,
        repo,
        branch,
        limit,
      };

      if (options.since) variables.since = options.since;
      if (options.until) variables.until = options.until;

      const response: GraphQLCommitHistoryResponse = await this.graphqlWithAuth({
        query,
        ...variables,
      });

      const commits = response.repository.ref.target.history.nodes.map(commit =>
        this.transformGraphQLCommit(commit)
      );

      if (this.enableCache && this.cacheManager) {
        await this.cacheManager.set(cacheKey, commits, { ttl: this.defaultCacheTTL });
      }

      logger.info('Commits fetched via GraphQL', {
        owner,
        repo,
        count: commits.length,
        totalCount: response.repository.ref.target.history.totalCount,
      });

      return commits;
    } catch (error) {
      logger.error('Failed to fetch commits via GraphQL', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Get commit details with full stats
   */
  async getCommitDetails(owner: string, repo: string, sha: string): Promise<Commit> {
    const cacheKey = `graphql:commit:${owner}/${repo}:${sha}`;

    if (this.enableCache && this.cacheManager) {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        logger.info('Commit details from cache', { owner, repo, sha });
        return cached;
      }
    }

    try {
      const query = `
        query($owner: String!, $repo: String!, $sha: GitObjectID!) {
          repository(owner: $owner, name: $repo) {
            object(oid: $sha) {
              ... on Commit {
                oid
                message
                committedDate
                url
                author {
                  name
                  email
                  date
                }
                additions
                deletions
                changedFiles
              }
            }
          }
        }
      `;

      const response: { repository: { object: GraphQLCommit } } = await this.graphqlWithAuth({
        query,
        owner,
        repo,
        sha,
      });

      const commit = this.transformGraphQLCommit(response.repository.object);

      if (this.enableCache && this.cacheManager) {
        await this.cacheManager.set(cacheKey, commit, { ttl: 3600000 }); // 1 hour for commit details
      }

      logger.info('Commit details fetched via GraphQL', { owner, repo, sha });
      return commit;
    } catch (error) {
      logger.error('Failed to fetch commit details via GraphQL', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Search commits by message using GraphQL
   */
  async searchCommitsByMessage(
    owner: string,
    repo: string,
    query: string,
    since?: string,
    until?: string
  ): Promise<Commit[]> {
    try {
      // Build search query
      let searchQuery = `repo:${owner}/${repo} ${query}`;

      if (since) {
        const sinceDate = since.split('T')[0];
        searchQuery += ` committer-date:>=${sinceDate}`;
      }

      if (until) {
        const untilDate = until.split('T')[0];
        searchQuery += ` committer-date:<=${untilDate}`;
      }

      logger.info('Searching commits via GraphQL', {
        owner,
        repo,
        query: searchQuery,
      });

      const graphqlQuery = `
        query($searchQuery: String!) {
          search(query: $searchQuery, type: COMMIT, first: 100) {
            commitCount
            nodes {
              ... on Commit {
                oid
                message
                committedDate
                url
                author {
                  name
                  email
                  date
                }
                additions
                deletions
                changedFiles
              }
            }
          }
        }
      `;

      const response: { search: { commitCount: number; nodes: GraphQLCommit[] } } =
        await this.graphqlWithAuth({
          query: graphqlQuery,
          searchQuery,
        });

      const commits = response.search.nodes.map(commit => this.transformGraphQLCommit(commit));

      logger.info('Commit search completed via GraphQL', {
        owner,
        repo,
        count: commits.length,
        totalCount: response.search.commitCount,
      });

      return commits;
    } catch (error) {
      logger.error('Failed to search commits via GraphQL', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Transform GraphQL PR response to our PullRequest type
   */
  private transformGraphQLPR(pr: GraphQLPullRequest, _owner: string, _repo: string): PullRequest {
    // Determine merged state
    const state: 'open' | 'closed' | 'merged' = pr.mergedAt
      ? 'merged'
      : (pr.state.toLowerCase() as 'open' | 'closed');

    return {
      id: pr.number,
      number: pr.number,
      title: pr.title,
      body: '', // Would need to fetch separately if needed
      state,
      createdAt: pr.createdAt,
      updatedAt: pr.updatedAt,
      closedAt: pr.closedAt ?? undefined,
      mergedAt: pr.mergedAt ?? undefined,
      author: pr.author?.login ?? 'unknown',
      reviewers: pr.assignees.nodes.map(a => a.login),
      commits: pr.commits.totalCount,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
      reviewComments: pr.comments.totalCount,
    };
  }

  /**
   * Transform GraphQL commit to our Commit type
   */
  private transformGraphQLCommit(commit: GraphQLCommit): Commit {
    return {
      sha: commit.oid,
      message: commit.message,
      author: {
        name: commit.author.name,
        email: commit.author.email,
        date: commit.author.date,
      },
      date: commit.committedDate,
      url: commit.url,
      stats: {
        additions: commit.additions,
        deletions: commit.deletions,
        total: commit.additions + commit.deletions,
      },
    };
  }

  /**
   * Transform GraphQL repository to our GitHubRepository type
   */
  private transformGraphQLRepository(repo: GraphQLRepository): GitHubRepository {
    return {
      owner: repo.owner.login,
      repo: repo.name,
      fullName: `${repo.owner.login}/${repo.name}`,
      url: repo.url,
      defaultBranch: repo.defaultBranchRef?.name || 'main',
    };
  }
}
