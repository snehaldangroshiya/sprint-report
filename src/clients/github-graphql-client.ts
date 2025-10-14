// GitHub GraphQL API v4 client implementation

import { graphql } from '@octokit/graphql';
import { PullRequest } from '@/types';
import { createLogger } from '@/utils/logger';

const logger = createLogger('GitHubGraphQLClient');

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

export class GitHubGraphQLClient {
  private graphqlWithAuth: typeof graphql;

  constructor(token: string) {
    this.graphqlWithAuth = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    });
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
}
