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
    // Use authentication type from config (from .env JIRA_AUTH_TYPE)
    const authHeader =
      config.jira.authType === 'bearer'
        ? `Bearer ${config.jira.apiToken}`
        : `Basic ${Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64')}`;

    const options: APIClientOptions = {
      baseURL: config.jira.baseUrl,
      timeout: config.jira.timeout,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      maxRetries: 3,
      retryDelay: 1000,
    };

    super(options, config, cacheManager);

    // Authentication type is read from .env JIRA_AUTH_TYPE (basic or bearer)
    // basic: uses email:token (default for most Jira instances)
    // bearer: uses Bearer token (for some self-hosted Jira servers)
  }

  // Get sprints for a board
  async getSprints(
    boardId: string,
    state?: 'active' | 'closed' | 'future'
  ): Promise<SprintData[]> {
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

      const issues = response.issues.map(issue =>
        this.transformIssueData(issue)
      );
      allIssues = allIssues.concat(issues);

      hasMore =
        !response.issues || response.issues.length === queryParams.maxResults;
      startAt += queryParams.maxResults;

      // Safety check to prevent infinite loops
      if (allIssues.length >= 1000) {
        console.warn(
          `Sprint ${sprintId} has too many issues, limiting to first 1000`
        );
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
      `/rest/api/2/issue/${params.issue_key}`,
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
        '/rest/api/2/search',
        {
          method: 'POST',
          data: requestBody,
        },
        { useCache: false } // Don't cache search results
      );

      const issues = response.issues.map(issue =>
        this.transformIssueData(issue)
      );
      allIssues = allIssues.concat(issues);

      hasMore = response.issues.length === requestBody.maxResults;
      startAt += requestBody.maxResults;

      // Safety check
      if (allIssues.length >= 1000) {
        console.warn(
          `JQL search returned too many results, limiting to first 1000`
        );
        break;
      }
    }

    return allIssues;
  }

  // Get boards (for board discovery)
  async getBoards(): Promise<
    Array<{ id: number; name: string; type: string }>
  > {
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

    const enhancedIssue: Issue = {
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
      // Enhanced fields for comprehensive reporting (optional)
      flagged: this.extractFlagged(fields),
      // Note: statusHistory, sprintHistory, timeInStatus, cycleTime, leadTime
      // are populated by separate methods that fetch changelog data
    };

    // Add optional fields only if they exist
    const epicLink = this.extractEpicLink(fields);
    if (epicLink) enhancedIssue.epicLink = epicLink;

    const epicName = this.extractEpicName(fields);
    if (epicName) enhancedIssue.epicName = epicName;

    const blockerReason = this.extractBlockerReason(fields);
    if (blockerReason) enhancedIssue.blockerReason = blockerReason;

    return enhancedIssue;
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

  private extractEpicLink(fields: any): string | undefined {
    // Common epic link field names
    const epicLinkFields = [
      'customfield_10014', // Common epic link field
      'customfield_10008', // Alternative epic link
      'epicLink',
      'parent', // For Jira next-gen projects
    ];

    for (const fieldName of epicLinkFields) {
      const value = fields[fieldName];
      if (typeof value === 'string' && value) {
        return value;
      }
      if (value && typeof value === 'object' && value.key) {
        return value.key; // For parent field
      }
    }

    return undefined;
  }

  private extractEpicName(fields: any): string | undefined {
    // Epic name from various sources
    if (fields.parent?.fields?.summary) {
      return fields.parent.fields.summary;
    }

    const epicNameFields = [
      'customfield_10011',
      'customfield_10009',
      'epicName',
    ];
    for (const fieldName of epicNameFields) {
      const value = fields[fieldName];
      if (typeof value === 'string' && value) {
        return value;
      }
    }

    return undefined;
  }

  private extractFlagged(fields: any): boolean {
    // Common flagged field names
    const flaggedFields = ['customfield_10021', 'customfield_10015', 'flagged'];

    for (const fieldName of flaggedFields) {
      const value = fields[fieldName];
      if (value !== null && value !== undefined) {
        // Field can be array of flags or a single flag
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        if (typeof value === 'string') {
          return (
            value.toLowerCase() === 'impediment' ||
            value.toLowerCase() === 'blocked'
          );
        }
        if (typeof value === 'object' && value.value) {
          return true;
        }
      }
    }

    return false;
  }

  private extractBlockerReason(fields: any): string | undefined {
    // Extract blocker/impediment reason from various fields
    const blockerFields = ['customfield_10021', 'customfield_10015', 'flagged'];

    for (const fieldName of blockerFields) {
      const value = fields[fieldName];
      if (Array.isArray(value) && value.length > 0) {
        // Return the first flag's value
        return value[0].value || value[0];
      }
      if (typeof value === 'object' && value.value) {
        return value.value;
      }
    }

    return undefined;
  }

  // Get issue changelog for comprehensive analysis
  async getIssueChangelog(issueKey: string): Promise<any> {
    const response = await this.makeRequest<any>(
      `/rest/api/2/issue/${issueKey}`,
      {
        method: 'GET',
        params: { expand: 'changelog' },
      },
      { ttl: 300000 } // 5 minutes cache
    );

    return response.changelog;
  }

  // Get enhanced issue data with changelog
  async getEnhancedIssue(issueKey: string): Promise<Issue> {
    const response = await this.makeRequest<any>(
      `/rest/api/2/issue/${issueKey}`,
      {
        method: 'GET',
        params: { expand: 'changelog' },
      },
      { ttl: 300000 }
    );

    const issue = this.transformIssueData(response);

    // Process changelog to add enhanced metrics
    if (response.changelog?.histories) {
      const statusHistory = this.extractStatusHistory(
        response.changelog.histories
      );
      const sprintHistory = this.extractSprintHistory(
        response.changelog.histories
      );
      const timeInStatus = this.calculateTimeInStatus(statusHistory);

      issue.statusHistory = statusHistory;
      issue.sprintHistory = sprintHistory;
      issue.timeInStatus = timeInStatus;
      issue.cycleTime = this.calculateCycleTime(statusHistory, issue.created);
      issue.leadTime = this.calculateLeadTime(issue.created, issue.resolved);
    }

    return issue;
  }

  // Get enhanced issues for sprint with changelog data
  async getEnhancedSprintIssues(
    sprintId: string,
    maxResults = 100
  ): Promise<Issue[]> {
    const issues = await this.getSprintIssues(sprintId, undefined, maxResults);

    // Fetch enhanced data for each issue (with batching to avoid rate limits)
    // Limit to first 20 issues for performance (tier analytics only need representative sample)
    const issuesToEnhance = issues.slice(0, 20);
    const enhancedIssues: Issue[] = [];

    for (let i = 0; i < issuesToEnhance.length; i++) {
      const issue = issuesToEnhance[i];
      if (!issue) continue;

      try {
        const enhanced = await this.getEnhancedIssue(issue.key);
        enhancedIssues.push(enhanced);

        // Reduced delay for better performance: every 15 requests with 200ms delay
        if ((i + 1) % 15 === 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        // If enhancement fails, use basic issue data
        console.warn(
          `Failed to enhance issue ${issue.key}, using basic data`,
          error
        );
        enhancedIssues.push(issue);
      }
    }

    return enhancedIssues;
  }

  // Extract status change history from changelog
  private extractStatusHistory(
    histories: any[]
  ): import('@/types').StatusChange[] {
    const statusChanges: import('@/types').StatusChange[] = [];

    for (const history of histories) {
      const statusItem = history.items?.find(
        (item: any) => item.field === 'status'
      );
      if (statusItem) {
        statusChanges.push({
          from: statusItem.fromString || '',
          to: statusItem.toString || '',
          timestamp: history.created,
          author: history.author?.displayName || 'Unknown',
        });
      }
    }

    // Calculate duration for each status
    for (let i = 0; i < statusChanges.length - 1; i++) {
      const current = statusChanges[i];
      const next = statusChanges[i + 1];
      if (current && next) {
        const currentTime = new Date(current.timestamp).getTime();
        const nextTime = new Date(next.timestamp).getTime();
        current.duration = (nextTime - currentTime) / (1000 * 60 * 60); // hours
      }
    }

    // Last status duration is from last change to now
    if (statusChanges.length > 0) {
      const lastChange = statusChanges[statusChanges.length - 1];
      if (lastChange) {
        const lastTime = new Date(lastChange.timestamp).getTime();
        const now = new Date().getTime();
        lastChange.duration = (now - lastTime) / (1000 * 60 * 60); // hours
      }
    }

    return statusChanges;
  }

  // Extract sprint change history from changelog
  private extractSprintHistory(
    histories: any[]
  ): import('@/types').SprintChange[] {
    const sprintChanges: import('@/types').SprintChange[] = [];

    for (const history of histories) {
      const sprintItem = history.items?.find(
        (item: any) => item.field === 'Sprint'
      );
      if (sprintItem) {
        // Added to sprint
        if (sprintItem.toString) {
          const sprintMatches = sprintItem.toString.match(/\[name=(.*?),/);
          sprintChanges.push({
            sprintId: sprintItem.to || '',
            sprintName: sprintMatches ? sprintMatches[1] : sprintItem.toString,
            action: 'added',
            timestamp: history.created,
            author: history.author?.displayName || 'Unknown',
          });
        }

        // Removed from sprint
        if (sprintItem.fromString && !sprintItem.toString) {
          const sprintMatches = sprintItem.fromString.match(/\[name=(.*?),/);
          sprintChanges.push({
            sprintId: sprintItem.from || '',
            sprintName: sprintMatches
              ? sprintMatches[1]
              : sprintItem.fromString,
            action: 'removed',
            timestamp: history.created,
            author: history.author?.displayName || 'Unknown',
          });
        }
      }
    }

    return sprintChanges;
  }

  // Calculate time spent in each status
  private calculateTimeInStatus(
    statusHistory: import('@/types').StatusChange[]
  ): Record<string, number> {
    const timeInStatus: Record<string, number> = {};

    for (const change of statusHistory) {
      if (change.duration) {
        const status = change.from;
        timeInStatus[status] = (timeInStatus[status] || 0) + change.duration;
      }
    }

    // Add current status time
    if (statusHistory.length > 0) {
      const lastChange = statusHistory[statusHistory.length - 1];
      if (lastChange) {
        const currentStatus = lastChange.to;
        const currentDuration = lastChange.duration || 0;
        timeInStatus[currentStatus] =
          (timeInStatus[currentStatus] || 0) + currentDuration;
      }
    }

    return timeInStatus;
  }

  // Calculate cycle time (time from "In Progress" to "Done")
  private calculateCycleTime(
    statusHistory: import('@/types').StatusChange[],
    _createdDate: string
  ): number {
    const inProgressStatuses = [
      'In Progress',
      'In Development',
      'In Review',
      'Testing',
    ];
    const doneStatuses = ['Done', 'Closed', 'Resolved', 'Complete'];

    let startTime: number | null = null;
    let endTime: number | null = null;

    for (const change of statusHistory) {
      // Find first transition to "in progress"
      if (
        !startTime &&
        inProgressStatuses.some(s =>
          change.to.toLowerCase().includes(s.toLowerCase())
        )
      ) {
        startTime = new Date(change.timestamp).getTime();
      }

      // Find transition to "done"
      if (
        doneStatuses.some(s =>
          change.to.toLowerCase().includes(s.toLowerCase())
        )
      ) {
        endTime = new Date(change.timestamp).getTime();
      }
    }

    if (startTime && endTime) {
      return (endTime - startTime) / (1000 * 60 * 60 * 24); // days
    }

    return 0;
  }

  // Calculate lead time (time from creation to done)
  private calculateLeadTime(
    createdDate: string,
    resolvedDate?: string
  ): number {
    if (!resolvedDate) return 0;

    const created = new Date(createdDate).getTime();
    const resolved = new Date(resolvedDate).getTime();

    return (resolved - created) / (1000 * 60 * 60 * 24); // days
  }

  // Utility methods
  public async validateConnection(): Promise<{
    valid: boolean;
    user?: string;
    error?: string;
  }> {
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

  public async getServerInfo(): Promise<{
    version: string;
    buildNumber: string;
    serverTitle: string;
  }> {
    const response = await this.makeRequest<any>(
      '/rest/api/2/serverInfo',
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
