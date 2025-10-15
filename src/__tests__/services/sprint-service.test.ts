import { SprintService } from '../../services/sprint-service.js';
import { JiraClient } from '../../clients/jira-client.js';
import { GitHubClient } from '../../clients/github-client.js';
import { CacheManager } from '../../cache/cache-manager.js';

// Mock the dependencies
jest.mock('../../clients/jira-client.js');
jest.mock('../../clients/github-client.js');
jest.mock('../../cache/cache-manager.js');

describe('SprintService', () => {
  let sprintService: SprintService;
  let mockJiraClient: jest.Mocked<JiraClient>;
  let mockGitHubClient: jest.Mocked<GitHubClient>;
  let mockCacheManager: jest.Mocked<CacheManager>;

  beforeEach(() => {
    mockJiraClient = new JiraClient({} as any) as jest.Mocked<JiraClient>;
    mockGitHubClient = new GitHubClient({} as any) as jest.Mocked<GitHubClient>;
    mockCacheManager = new CacheManager() as jest.Mocked<CacheManager>;

    sprintService = new SprintService(
      mockJiraClient,
      mockGitHubClient,
      mockCacheManager,
      'test-github-token'  // Pass test token for GraphQL client
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBoards', () => {
    it('should return cached boards if available', async () => {
      const mockBoards = [{ id: '1', name: 'Test Board' }];
      mockCacheManager.get.mockResolvedValue(mockBoards);

      const result = await sprintService.getBoards();

      expect(result).toEqual(mockBoards);
      expect(mockCacheManager.get).toHaveBeenCalledWith('jira:boards');
      expect(mockJiraClient.getBoards).not.toHaveBeenCalled();
    });

    it('should fetch boards from Jira client if not cached', async () => {
      const mockBoards = [{ id: '1', name: 'Test Board' }];
      mockCacheManager.get.mockResolvedValue(null);
      mockJiraClient.getBoards.mockResolvedValue(mockBoards);

      const result = await sprintService.getBoards();

      expect(result).toEqual(mockBoards);
      expect(mockJiraClient.getBoards).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'jira:boards',
        mockBoards,
        { ttl: 300 }
      );
    });
  });

  describe('getSprints', () => {
    it('should return cached sprints if available', async () => {
      const boardId = '123';
      const mockSprints = [{ id: '1', name: 'Sprint 1' }];
      mockCacheManager.get.mockResolvedValue(mockSprints);

      const result = await sprintService.getSprints(boardId);

      expect(result).toEqual(mockSprints);
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        `jira:sprints:${boardId}`
      );
      expect(mockJiraClient.getSprints).not.toHaveBeenCalled();
    });

    it('should fetch sprints from Jira client if not cached', async () => {
      const boardId = '123';
      const mockSprints = [{ id: '1', name: 'Sprint 1' }];
      mockCacheManager.get.mockResolvedValue(null);
      mockJiraClient.getSprints.mockResolvedValue(mockSprints);

      const result = await sprintService.getSprints(boardId);

      expect(result).toEqual(mockSprints);
      expect(mockJiraClient.getSprints).toHaveBeenCalledWith(boardId);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `jira:sprints:${boardId}`,
        mockSprints,
        { ttl: 300 }
      );
    });
  });

  describe('getSprintDetails', () => {
    it('should return cached sprint details if available', async () => {
      const sprintId = '456';
      const mockSprint = {
        id: sprintId,
        name: 'Sprint 1',
        state: 'active',
        startDate: '2024-01-01',
        endDate: '2024-01-14',
        issues: [],
      };
      mockCacheManager.get.mockResolvedValue(mockSprint);

      const result = await sprintService.getSprintDetails(sprintId);

      expect(result).toEqual(mockSprint);
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        `jira:sprint:${sprintId}`
      );
      expect(mockJiraClient.getSprintData).not.toHaveBeenCalled();
    });

    it('should fetch sprint details from Jira client if not cached', async () => {
      const sprintId = '456';
      const mockSprint = {
        id: sprintId,
        name: 'Sprint 1',
        state: 'active',
        startDate: '2024-01-01',
        endDate: '2024-01-14',
        issues: [],
      };
      mockCacheManager.get.mockResolvedValue(null);
      mockJiraClient.getSprintData.mockResolvedValue(mockSprint);

      const result = await sprintService.getSprintDetails(sprintId);

      expect(result).toEqual(mockSprint);
      expect(mockJiraClient.getSprintData).toHaveBeenCalledWith(sprintId);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `jira:sprint:${sprintId}`,
        mockSprint,
        { ttl: 180 }
      );
    });
  });

  describe('generateSprintReport', () => {
    it('should generate a complete sprint report', async () => {
      const mockRequest = {
        sprint_id: '456',
        format: 'json' as const,
        include_commits: true,
        include_prs: true,
        include_velocity: true,
        include_burndown: true,
        theme: 'default' as const,
        github_owner: 'test-owner',
        github_repo: 'test-repo',
      };

      const mockSprint = {
        id: '456',
        name: 'Sprint 1',
        state: 'active',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-14T23:59:59Z',
        boardId: '123',
        issues: [
          {
            key: 'TEST-1',
            summary: 'Test issue',
            status: 'Done',
            storyPoints: 5,
            issueType: 'Story',
          },
        ],
      };

      const mockCommits = [
        {
          sha: 'abc123',
          message: 'Fix bug',
          author: 'developer',
          date: '2024-01-05T12:00:00Z',
        },
      ];

      const mockPullRequests = [
        {
          number: 42,
          title: 'Feature implementation',
          author: 'developer',
          state: 'merged',
          created_at: '2024-01-03T10:00:00Z',
        },
      ];

      // Mock all required method calls
      mockCacheManager.get.mockResolvedValue(null);
      mockJiraClient.getSprintData.mockResolvedValue(mockSprint);
      mockGitHubClient.getCommits.mockResolvedValue(mockCommits);
      mockGitHubClient.getPullRequests.mockResolvedValue(mockPullRequests);
      mockJiraClient.getSprints.mockResolvedValue([mockSprint]);

      const result = await sprintService.generateSprintReport(mockRequest);

      expect(result).toBeDefined();
      expect(result.sprint).toEqual(mockSprint);
      expect(result.commits).toEqual(mockCommits);
      expect(result.pullRequests).toEqual(mockPullRequests);
      expect(result.metrics).toBeDefined();
      expect(result.metrics.totalIssues).toBe(1);
      expect(result.metrics.completedIssues).toBe(1);
      expect(result.metrics.completionRate).toBe(100);
      expect(result.metadata).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const mockRequest = {
        sprint_id: '456',
        format: 'json' as const,
        include_commits: false,
        include_prs: false,
        include_velocity: false,
        include_burndown: false,
        theme: 'default' as const,
      };

      mockCacheManager.get.mockResolvedValue(null);
      mockJiraClient.getSprintData.mockRejectedValue(
        new Error('Jira API error')
      );

      await expect(
        sprintService.generateSprintReport(mockRequest)
      ).rejects.toThrow('Jira API error');
    });
  });

  describe('getVelocityData', () => {
    it('should calculate velocity data correctly', async () => {
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

      mockCacheManager.get
        .mockResolvedValueOnce(null) // velocity cache miss
        .mockResolvedValueOnce(mockSprints) // sprints cache hit
        .mockResolvedValueOnce(mockSprintDetails[0]) // sprint 1 details cache hit
        .mockResolvedValueOnce(mockSprintDetails[1]); // sprint 2 details cache hit

      const result = await sprintService.getVelocityData(boardId, 2);

      expect(result).toBeDefined();
      expect(result.sprints).toHaveLength(2);
      expect(result.sprints[0].velocity).toBe(8); // 5 + 3
      expect(result.sprints[1].velocity).toBe(8); // only completed story points
      expect(result.average).toBe(8); // (8 + 8) / 2
      expect(result.trend).toBe('stable');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when all services are healthy', async () => {
      mockJiraClient.healthCheck.mockResolvedValue(undefined);
      mockGitHubClient.healthCheck.mockResolvedValue(undefined);

      const result = await sprintService.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.services.jira.healthy).toBe(true);
      expect(result.services.github.healthy).toBe(true);
      expect(result.services.jira.latency).toBeGreaterThan(0);
      expect(result.services.github.latency).toBeGreaterThan(0);
    });

    it('should return unhealthy status when services fail', async () => {
      mockJiraClient.healthCheck.mockRejectedValue(new Error('Jira down'));
      mockGitHubClient.healthCheck.mockResolvedValue(undefined);

      const result = await sprintService.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.services.jira.healthy).toBe(false);
      expect(result.services.jira.error).toBe('Jira down');
      expect(result.services.github.healthy).toBe(true);
    });
  });
});
