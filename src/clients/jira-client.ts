// Jira API client implementation

import { BaseAPIClient, APIClientOptions } from './base-client';
import { AppConfig, SprintData, Issue } from '@/types';
import { ValidationUtils, MCPToolSchemas } from '@/utils/validation';

export interface JiraSprintResponse {
  maxResults: number;
  startAt: number;
  total: number;
  isLast: boolean;
  values: Array<{
    id: number;
    self: string;
    state: 'closed' | 'active' | 'future';
    name: string;
    startDate?: string;
    endDate?: string;
    completeDate?: string;
    goal?: string;
    originBoardId: number;
  }>;
}

export interface JiraIssueResponse {
  maxResults: number;
  startAt: number;
  total: number;
  issues: Array<{
    id: string;
    key: string;
    self: string;
    fields: {
      summary: string;
      status: {
        id: string;
        name: string;
        statusCategory: {
          id: number;
          key: string;
          colorName: string;
          name: string;
        };
      };
      assignee: {
        accountId: string;
        displayName: string;
        emailAddress?: string;
      } | null;
      reporter: {
        accountId: string;
        displayName: string;
      };
      priority: {
        id: string;
        name: string;
      };
      issuetype: {
        id: string;
        name: string;
        iconUrl: string;
      };
      created: string;
      updated: string;
      resolutiondate?: string;
      labels: string[];
      components: Array<{
        id: string;
        name: string;
      }>;
      fixVersions: Array<{
        id: string;
        name: string;
      }>;
      customfield_10016?: number; // Story Points (common field ID)
      [key: string]: any; // For additional custom fields
    };
  }>;
}

export interface JiraBoardResponse {
  maxResults: number;
  startAt: number;
  total: number;
  isLast: boolean;
  values: Array<{
    id: number;
    self: string;
    name: string;
    type: string;
    location: {
      type: string;
      key: string;
      id: string;
      name: string;
    };
  }>;
}

export class JiraClient extends BaseAPIClient {
  protected get serviceName(): string {
    return 'jira';
  }

  constructor(config: AppConfig, cacheManager?: any) {
    const options: APIClientOptions = {
      baseURL: config.jira.baseUrl,
      timeout: config.jira.timeout,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        // Use Bearer token for Jira Server authentication
        'Authorization': `Bearer ${config.jira.apiToken}`,
      },
      maxRetries: 3,
      retryDelay: 1000,
    };

    super(options, config, cacheManager);

    // Note: Jira Server uses Bearer token authentication, not basic auth
    // For Jira Cloud, use basic auth: this.httpClient.defaults.auth = { username: email, password: token }
  }

  // Get sprints for a board
  async getSprints(boardId: string, state?: 'active' | 'closed' | 'future'): Promise<SprintData[]> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.jiraGetSprints,
      { board_id: boardId, state }
    );

    const queryParams: Record<string, string> = {};
    if (params.state) {
      queryParams.state = params.state;
    }

    const response = await this.makeRequest<JiraSprintResponse>(
      `/rest/agile/1.0/board/${params.board_id}/sprint`,
      {
        method: 'GET',
        params: queryParams,
      },
      { ttl: 300000 } // 5 minutes cache
    );

    return response.values.map(sprint => this.transformSprintData(sprint));
  }

  // Get issues for a sprint
  async getSprintIssues(
    sprintId: string,
    fields?: string[],
    maxResults?: number
  ): Promise<Issue[]> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.jiraGetSprintIssues,
      { sprint_id: sprintId, fields, max_results: maxResults }
    );

    const queryParams: Record<string, any> = {
      maxResults: params.max_results,
      startAt: 0,
    };

    if (params.fields && params.fields.length > 0) {
      queryParams.fields = params.fields.join(',');
    }

    let allIssues: Issue[] = [];
    let startAt = 0;
    let hasMore = true;

    // Handle pagination
    while (hasMore) {
      queryParams.startAt = startAt;

      const response = await this.makeRequest<JiraIssueResponse>(
        `/rest/agile/1.0/sprint/${params.sprint_id}/issue`,
        {
          method: 'GET',
          params: queryParams,
        },
        { ttl: 300000 } // 5 minutes cache
      );

      const issues = response.issues.map(issue => this.transformIssueData(issue));
      allIssues = allIssues.concat(issues);

      hasMore = !response.issues || response.issues.length === queryParams.maxResults;
      startAt += queryParams.maxResults;

      // Safety check to prevent infinite loops
      if (allIssues.length >= 1000) {
        console.warn(`Sprint ${sprintId} has too many issues, limiting to first 1000`);
        break;
      }
    }

    return allIssues;
  }

  // Get detailed issue information
  async getIssueDetails(issueKey: string, expand?: string[]): Promise<Issue> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.jiraGetIssueDetails,
      { issue_key: issueKey, expand }
    );

    const queryParams: Record<string, string> = {};
    if (params.expand && params.expand.length > 0) {
      queryParams.expand = params.expand.join(',');
    }

    const response = await this.makeRequest<any>(
      `/rest/api/3/issue/${params.issue_key}`,
      {
        method: 'GET',
        params: queryParams,
      },
      { ttl: 600000 } // 10 minutes cache for detailed data
    );

    return this.transformIssueData(response);
  }

  // Search issues using JQL
  async searchIssues(
    jql: string,
    fields?: string[],
    maxResults?: number
  ): Promise<Issue[]> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.jiraSearchIssues,
      { jql, fields, max_results: maxResults }
    );

    // Validate JQL for security
    ValidationUtils.validateJQL(params.jql);

    const requestBody: Record<string, any> = {
      jql: params.jql,
      maxResults: params.max_results,
      startAt: 0,
    };

    if (params.fields && params.fields.length > 0) {
      requestBody.fields = params.fields;
    }

    let allIssues: Issue[] = [];
    let startAt = 0;
    let hasMore = true;

    // Handle pagination
    while (hasMore) {
      requestBody.startAt = startAt;

      const response = await this.makeRequest<JiraIssueResponse>(
        '/rest/api/3/search',
        {
          method: 'POST',
          data: requestBody,
        },
        { useCache: false } // Don't cache search results
      );

      const issues = response.issues.map(issue => this.transformIssueData(issue));
      allIssues = allIssues.concat(issues);

      hasMore = response.issues.length === requestBody.maxResults;
      startAt += requestBody.maxResults;

      // Safety check
      if (allIssues.length >= 1000) {
        console.warn(`JQL search returned too many results, limiting to first 1000`);
        break;
      }
    }

    return allIssues;
  }

  // Get boards (for board discovery)
  async getBoards(): Promise<Array<{ id: number; name: string; type: string }>> {
    const response = await this.makeRequest<JiraBoardResponse>(
      '/rest/agile/1.0/board',
      {
        method: 'GET',
        params: { maxResults: 50 },
      },
      { ttl: 1800000 } // 30 minutes cache
    );

    return response.values.map(board => ({
      id: board.id,
      name: board.name,
      type: board.type,
    }));
  }

  // Get sprint data by ID
  async getSprintData(sprintId: string): Promise<SprintData> {
    const response = await this.makeRequest<any>(
      `/rest/agile/1.0/sprint/${sprintId}`,
      { method: 'GET' },
      { ttl: 300000 }
    );

    return this.transformSprintData(response);
  }

  // Health check implementation
  protected async performHealthCheck(): Promise<void> {
    await this.makeRequest<any>(
      '/rest/api/2/myself',
      { method: 'GET' },
      { useCache: false }
    );
  }

  // Data transformation methods
  private transformSprintData(sprint: any): SprintData {
    return {
      id: sprint.id.toString(),
      name: sprint.name,
      startDate: sprint.startDate || '',
      endDate: sprint.endDate || '',
      goal: sprint.goal || undefined,
      state: this.mapSprintState(sprint.state),
      completeDate: sprint.completeDate || undefined,
      boardId: sprint.originBoardId,
    };
  }

  private transformIssueData(issue: any): Issue {
    const fields = issue.fields;

    return {
      id: issue.id,
      key: issue.key,
      summary: fields.summary || '',
      status: fields.status?.name || 'Unknown',
      assignee: fields.assignee?.displayName || 'Unassigned',
      assigneeAccountId: fields.assignee?.accountId,
      storyPoints: this.extractStoryPoints(fields),
      priority: fields.priority?.name || 'Unknown',
      issueType: fields.issuetype?.name || 'Unknown',
      created: fields.created,
      updated: fields.updated,
      resolved: fields.resolutiondate,
      labels: fields.labels || [],
      components: fields.components?.map((c: any) => c.name) || [],
      fixVersions: fields.fixVersions?.map((v: any) => v.name) || [],
    };
  }

  private mapSprintState(state: string): 'ACTIVE' | 'CLOSED' | 'FUTURE' {
    switch (state.toLowerCase()) {
      case 'active':
        return 'ACTIVE';
      case 'closed':
        return 'CLOSED';
      case 'future':
        return 'FUTURE';
      default:
        return 'FUTURE';
    }
  }

  private extractStoryPoints(fields: any): number | undefined {
    // Common story points field names/IDs
    const storyPointFields = [
      'customfield_10016', // Common Jira Cloud field ID
      'customfield_10004', // Another common field ID
      'customfield_10002', // Story Points
      'storyPoints',
      'story_points',
    ];

    for (const fieldName of storyPointFields) {
      const value = fields[fieldName];
      if (typeof value === 'number' && value >= 0) {
        return value;
      }
    }

    return undefined;
  }

  // Utility methods
  public async validateConnection(): Promise<{ valid: boolean; user?: string; error?: string }> {
    try {
      const response = await this.makeRequest<any>(
        '/rest/api/2/myself',
        { method: 'GET' },
        { useCache: false }
      );

      return {
        valid: true,
        user: response.displayName || response.emailAddress,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async getServerInfo(): Promise<{ version: string; buildNumber: string; serverTitle: string }> {
    const response = await this.makeRequest<any>(
      '/rest/api/3/serverInfo',
      { method: 'GET' },
      { ttl: 3600000 } // 1 hour cache
    );

    return {
      version: response.version,
      buildNumber: response.buildNumber,
      serverTitle: response.serverTitle,
    };
  }

  // Build JQL queries programmatically
  public buildJQL(conditions: Record<string, any>): string {
    const parts: string[] = [];

    for (const [field, value] of Object.entries(conditions)) {
      if (value === null || value === undefined) continue;

      if (Array.isArray(value)) {
        if (value.length > 0) {
          const values = value.map(v => `"${v}"`).join(', ');
          parts.push(`${field} IN (${values})`);
        }
      } else if (typeof value === 'string') {
        parts.push(`${field} = "${value}"`);
      } else {
        parts.push(`${field} = ${value}`);
      }
    }

    return parts.join(' AND ');
  }
}