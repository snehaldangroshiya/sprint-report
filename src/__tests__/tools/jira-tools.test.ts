import { JiraTools } from '../../tools/jira-tools.js';
import { JiraClient } from '../../clients/jira-client.js';

// Mock the dependencies
jest.mock('../../clients/jira-client.js');

describe('JiraTools', () => {
  let jiraTools: JiraTools;
  let mockJiraClient: jest.Mocked<JiraClient>;

  beforeEach(() => {
    mockJiraClient = new JiraClient({} as any) as jest.Mocked<JiraClient>;
    jiraTools = new JiraTools(mockJiraClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBoards', () => {
    it('should return boards from Jira client', async () => {
      const mockBoards = [
        { id: '1', name: 'Development Board', type: 'scrum' },
        { id: '2', name: 'Support Board', type: 'kanban' },
      ];

      mockJiraClient.getBoards.mockResolvedValue(mockBoards);

      const result = await jiraTools.getBoards();

      expect(result).toEqual(mockBoards);
      expect(mockJiraClient.getBoards).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from Jira client', async () => {
      const error = new Error('Jira API error');
      mockJiraClient.getBoards.mockRejectedValue(error);

      await expect(jiraTools.getBoards()).rejects.toThrow('Jira API error');
    });
  });

  describe('getSprints', () => {
    it('should return sprints for a board', async () => {
      const boardId = '123';
      const mockSprints = [
        { id: '1', name: 'Sprint 1', state: 'active' },
        { id: '2', name: 'Sprint 2', state: 'closed' },
      ];

      mockJiraClient.getSprints.mockResolvedValue(mockSprints);

      const result = await jiraTools.getSprints({ board_id: boardId });

      expect(result).toEqual(mockSprints);
      expect(mockJiraClient.getSprints).toHaveBeenCalledWith(boardId);
    });

    it('should validate input parameters', async () => {
      await expect(jiraTools.getSprints({ board_id: '' })).rejects.toThrow();
    });
  });

  describe('getSprintDetails', () => {
    it('should return sprint details', async () => {
      const sprintId = '456';
      const mockSprint = {
        id: sprintId,
        name: 'Sprint 1',
        state: 'active',
        startDate: '2024-01-01',
        endDate: '2024-01-14',
        issues: [{ key: 'TEST-1', summary: 'Test issue', status: 'Done' }],
      };

      mockJiraClient.getSprintDetails.mockResolvedValue(mockSprint);

      const result = await jiraTools.getSprintDetails({ sprint_id: sprintId });

      expect(result).toEqual(mockSprint);
      expect(mockJiraClient.getSprintDetails).toHaveBeenCalledWith(sprintId);
    });
  });

  describe('searchIssues', () => {
    it('should search issues with JQL', async () => {
      const jql = 'project = TEST AND status = Done';
      const mockResult = {
        issues: [{ key: 'TEST-1', fields: { summary: 'Test issue' } }],
        total: 1,
        startAt: 0,
        maxResults: 50,
      };

      mockJiraClient.searchIssues.mockResolvedValue(mockResult);

      const result = await jiraTools.searchIssues({ jql });

      expect(result).toEqual(mockResult);
      expect(mockJiraClient.searchIssues).toHaveBeenCalledWith(
        jql,
        undefined,
        undefined,
        undefined
      );
    });

    it('should pass optional parameters', async () => {
      const jql = 'project = TEST';
      const fields = ['summary', 'status'];
      const maxResults = 10;
      const startAt = 0;

      mockJiraClient.searchIssues.mockResolvedValue({
        issues: [],
        total: 0,
        startAt: 0,
        maxResults: 10,
      });

      await jiraTools.searchIssues({
        jql,
        fields,
        max_results: maxResults,
        start_at: startAt,
      });

      expect(mockJiraClient.searchIssues).toHaveBeenCalledWith(
        jql,
        fields,
        maxResults,
        startAt
      );
    });
  });

  describe('getIssue', () => {
    it('should get issue by key', async () => {
      const issueKey = 'TEST-1';
      const mockIssue = {
        key: issueKey,
        fields: {
          summary: 'Test issue',
          status: { name: 'Done' },
        },
      };

      mockJiraClient.getIssue.mockResolvedValue(mockIssue);

      const result = await jiraTools.getIssue({ issue_key: issueKey });

      expect(result).toEqual(mockIssue);
      expect(mockJiraClient.getIssue).toHaveBeenCalledWith(issueKey, undefined);
    });
  });

  describe('getVelocityData', () => {
    it('should calculate velocity data for a board', async () => {
      const boardId = '123';
      const mockSprints = [
        { id: '1', name: 'Sprint 1', state: 'closed' },
        { id: '2', name: 'Sprint 2', state: 'closed' },
      ];

      const mockSprintDetails = [
        {
          id: '1',
          name: 'Sprint 1',
          issues: [
            { status: 'Done', storyPoints: 5 },
            { status: 'Done', storyPoints: 3 },
          ],
        },
        {
          id: '2',
          name: 'Sprint 2',
          issues: [
            { status: 'Done', storyPoints: 8 },
            { status: 'In Progress', storyPoints: 2 },
          ],
        },
      ];

      mockJiraClient.getSprints.mockResolvedValue(mockSprints);
      mockJiraClient.getSprintDetails
        .mockResolvedValueOnce(mockSprintDetails[0])
        .mockResolvedValueOnce(mockSprintDetails[1]);

      const result = await jiraTools.getVelocityData({ board_id: boardId });

      expect(result).toBeDefined();
      expect(result.sprints).toHaveLength(2);
      expect(result.sprints[0].velocity).toBe(8); // 5 + 3
      expect(result.sprints[1].velocity).toBe(8); // only Done issues
      expect(result.average).toBe(8);
      expect(['increasing', 'decreasing', 'stable']).toContain(result.trend);
    });

    it('should handle sprints with no issues', async () => {
      const boardId = '123';
      const mockSprints = [{ id: '1', name: 'Sprint 1', state: 'closed' }];

      const mockSprintDetails = {
        id: '1',
        name: 'Sprint 1',
        issues: [],
      };

      mockJiraClient.getSprints.mockResolvedValue(mockSprints);
      mockJiraClient.getSprintDetails.mockResolvedValue(mockSprintDetails);

      const result = await jiraTools.getVelocityData({ board_id: boardId });

      expect(result.sprints).toHaveLength(1);
      expect(result.sprints[0].velocity).toBe(0);
      expect(result.average).toBe(0);
    });
  });

  describe('getBurndownData', () => {
    it('should calculate burndown data for a sprint', async () => {
      const sprintId = '456';
      const mockSprint = {
        id: sprintId,
        name: 'Sprint 1',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-14T23:59:59Z',
        issues: [{ storyPoints: 5 }, { storyPoints: 3 }, { storyPoints: 2 }],
      };

      mockJiraClient.getSprintDetails.mockResolvedValue(mockSprint);

      const result = await jiraTools.getBurndownData({ sprint_id: sprintId });

      expect(result.sprint_id).toBe(sprintId);
      expect(result.days).toBeDefined();
      expect(result.days.length).toBeGreaterThan(0);
      expect(result.days[0].remaining).toBe(10); // Total story points
      expect(result.days[0].completed).toBe(0);
    });

    it('should throw error for sprint without dates', async () => {
      const sprintId = '456';
      const mockSprint = {
        id: sprintId,
        name: 'Sprint 1',
        startDate: null,
        endDate: null,
        issues: [],
      };

      mockJiraClient.getSprintDetails.mockResolvedValue(mockSprint);

      await expect(
        jiraTools.getBurndownData({ sprint_id: sprintId })
      ).rejects.toThrow('Sprint must have start and end dates');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when Jira is accessible', async () => {
      mockJiraClient.healthCheck.mockResolvedValue(undefined);

      const result = await jiraTools.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.service).toBe('jira');
      expect(result.latency).toBeGreaterThan(0);
    });

    it('should return unhealthy status when Jira is not accessible', async () => {
      const error = new Error('Connection failed');
      mockJiraClient.healthCheck.mockRejectedValue(error);

      const result = await jiraTools.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.service).toBe('jira');
      expect(result.error).toBe('Connection failed');
    });
  });
});
