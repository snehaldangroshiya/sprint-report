import { JiraClient } from '../clients/jira-client.js';
import { Logger } from '../utils/logger.js';
import { ValidationUtils, MCPToolSchemas } from '../utils/validation.js';

export class JiraTools {
  private logger: Logger;

  constructor(private jiraClient: JiraClient) {
    this.logger = new Logger('JiraTools');
  }

  /**
   * Get boards tool
   */
  async getBoards(): Promise<any> {
    this.logger.info('Getting Jira boards');

    try {
      const boards = await this.jiraClient.getBoards();
      this.logger.info('Successfully retrieved boards', {
        count: boards.length,
      });
      return boards;
    } catch (error) {
      this.logger.error(error as Error, 'get_boards');
      throw error;
    }
  }

  /**
   * Get sprints for a board
   */
  async getSprints(args: { board_id: string }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.jiraGetSprints,
      args
    );
    this.logger.info('Getting sprints for board', { boardId: params.board_id });

    try {
      const sprints = await this.jiraClient.getSprints(String(params.board_id));
      this.logger.info('Successfully retrieved sprints', {
        boardId: params.board_id,
        count: sprints.length,
      });
      return sprints;
    } catch (error) {
      this.logger.error(error as Error, 'get_sprints', {
        boardId: params.board_id,
      });
      throw error;
    }
  }

  /**
   * Get sprint details
   */
  async getSprintDetails(args: { sprint_id: string }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.jiraGetSprintDetails,
      args
    );
    this.logger.info('Getting sprint details', { sprintId: params.sprint_id });

    try {
      const sprint = await this.jiraClient.getSprintData(
        String(params.sprint_id)
      );
      this.logger.info('Successfully retrieved sprint details', {
        sprintId: params.sprint_id,
      });
      return sprint;
    } catch (error) {
      this.logger.error(error as Error, 'get_sprint_details', {
        sprintId: params.sprint_id,
      });
      throw error;
    }
  }

  /**
   * Search issues
   */
  async searchIssues(args: {
    jql: string;
    fields?: string[];
    max_results?: number;
    start_at?: number;
  }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.jiraSearchIssues,
      args
    );
    this.logger.info('Searching Jira issues', { jql: params.jql });

    try {
      const issues = await this.jiraClient.searchIssues(
        params.jql,
        params.fields,
        params.max_results
      );
      this.logger.info('Successfully searched issues', {
        jql: params.jql,
        total: issues.length,
        returned: issues.length,
      });
      return issues;
    } catch (error) {
      this.logger.error(error as Error, 'search_issues', { jql: params.jql });
      throw error;
    }
  }

  /**
   * Get issue by key
   */
  async getIssue(args: { issue_key: string; fields?: string[] }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.jiraGetIssue,
      args
    );
    this.logger.info('Getting Jira issue', { issueKey: params.issue_key });

    try {
      const issue = await this.jiraClient.getIssueDetails(params.issue_key);
      this.logger.info('Successfully retrieved issue', {
        issueKey: params.issue_key,
      });
      return issue;
    } catch (error) {
      this.logger.error(error as Error, 'get_issue', {
        issueKey: params.issue_key,
      });
      throw error;
    }
  }

  /**
   * Get velocity data
   */
  async getVelocityData(args: {
    board_id: string;
    sprint_count?: number;
  }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.jiraGetVelocityData,
      args
    );
    this.logger.info('Calculating velocity data', {
      boardId: params.board_id,
      sprintCount: params.sprint_count,
    });

    try {
      // Get recent sprints for the board
      const allSprints = await this.jiraClient.getSprints(
        String(params.board_id)
      );
      const closedSprints = allSprints
        .filter((sprint: any) => sprint.state === 'closed')
        .slice(-(params.sprint_count || 5));

      // Calculate velocity for each sprint
      const sprintVelocities = await Promise.all(
        closedSprints.map(async (sprint: any) => {
          const issues = await this.jiraClient.getSprintIssues(sprint.id);
          const completedIssues = issues.filter((issue: any) =>
            ['Done', 'Closed', 'Resolved'].includes(issue.status)
          );

          const velocity = completedIssues.reduce(
            (sum: number, issue: any) => sum + (issue.storyPoints || 0),
            0
          );

          const commitment = issues.reduce(
            (sum: number, issue: any) => sum + (issue.storyPoints || 0),
            0
          );

          return {
            id: sprint.id,
            name: sprint.name,
            velocity,
            commitment,
            completed: velocity,
          };
        })
      );

      // Calculate average and trend
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

        if (earlier.length > 0) {
          const recentAvg =
            recent.reduce((sum, s) => sum + s.velocity, 0) / recent.length;
          const earlierAvg =
            earlier.reduce((sum, s) => sum + s.velocity, 0) / earlier.length;

          const changePercent = ((recentAvg - earlierAvg) / earlierAvg) * 100;

          if (changePercent > 10) trend = 'increasing';
          else if (changePercent < -10) trend = 'decreasing';
        }
      }

      const result = {
        sprints: sprintVelocities,
        average: Math.round(average * 100) / 100,
        trend,
      };

      this.logger.info('Successfully calculated velocity data', {
        boardId: params.board_id,
        average: result.average,
        trend: result.trend,
      });

      return result;
    } catch (error) {
      this.logger.error(error as Error, 'get_velocity_data', {
        boardId: params.board_id,
      });
      throw error;
    }
  }

  /**
   * Get burndown data
   */
  async getBurndownData(args: { sprint_id: string }): Promise<any> {
    const params = ValidationUtils.validateAndParse(
      MCPToolSchemas.jiraGetBurndownData,
      args
    );
    this.logger.info('Calculating burndown data', {
      sprintId: params.sprint_id,
    });

    try {
      const sprint = await this.jiraClient.getSprintData(
        String(params.sprint_id)
      );

      if (!sprint.startDate || !sprint.endDate) {
        throw new Error('Sprint must have start and end dates');
      }

      const issues = await this.jiraClient.getSprintIssues(
        String(params.sprint_id)
      );
      const totalStoryPoints = issues.reduce(
        (sum: number, issue: any) => sum + (issue.storyPoints || 0),
        0
      );

      const startDate = new Date(sprint.startDate);
      const endDate = new Date(sprint.endDate);
      const totalDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const days = [];
      for (let i = 0; i <= totalDays; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);

        // Simplified calculation - in reality this would come from Jira issue history
        const progress = i / totalDays;
        const remaining = Math.max(0, totalStoryPoints * (1 - progress));
        const ideal = totalStoryPoints * (1 - progress);
        const completed = totalStoryPoints - remaining;

        days.push({
          date: currentDate.toISOString().split('T')[0],
          remaining: Math.round(remaining * 100) / 100,
          ideal: Math.round(ideal * 100) / 100,
          completed: Math.round(completed * 100) / 100,
        });
      }

      const result = {
        sprint_id: params.sprint_id,
        days,
      };

      this.logger.info('Successfully calculated burndown data', {
        sprintId: params.sprint_id,
        totalDays: days.length,
      });

      return result;
    } catch (error) {
      this.logger.error(error as Error, 'get_burndown_data', {
        sprintId: params.sprint_id,
      });
      throw error;
    }
  }

  /**
   * Health check for Jira
   */
  async healthCheck(): Promise<any> {
    this.logger.info('Performing Jira health check');

    try {
      const startTime = Date.now();
      await this.jiraClient.healthCheck();
      const latency = Date.now() - startTime;

      const result = {
        healthy: true,
        latency,
        service: 'jira',
      };

      this.logger.info('Jira health check passed', { latency });
      return result;
    } catch (error) {
      this.logger.error(error as Error, 'jira_health_check');

      return {
        healthy: false,
        error: (error as Error).message,
        service: 'jira',
      };
    }
  }
}
