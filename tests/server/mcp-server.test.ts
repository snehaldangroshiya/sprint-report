// Integration tests for MCP server

import { MCPServer } from '../../src/server/mcp-server';
import { createTestConfig } from '../setup';

// Mock external dependencies
jest.mock('../../src/clients/jira-client');
jest.mock('../../src/clients/github-client');
jest.mock('../../src/cache/cache-manager');
jest.mock('../../src/utils/rate-limiter');

const MockJiraClient = require('../../src/clients/jira-client').JiraClient;
const MockGitHubClient = require('../../src/clients/github-client').GitHubClient;
const MockCacheManager = require('../../src/cache/cache-manager').CacheManager;
const MockServiceRateLimiter = require('../../src/utils/rate-limiter').ServiceRateLimiter;

describe('MCPServer', () => {
  let server: MCPServer;
  let mockJiraClient: jest.Mocked<any>;
  let mockGitHubClient: jest.Mocked<any>;
  let mockCacheManager: jest.Mocked<any>;
  let mockRateLimiter: jest.Mocked<any>;

  beforeEach(() => {
    // Setup mocks
    mockJiraClient = {
      validateConnection: jest.fn().mockResolvedValue({ valid: true, user: 'Test User' }),
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, latency: 100 }),
    };

    mockGitHubClient = {
      validateConnection: jest.fn().mockResolvedValue({ valid: true, user: 'testuser' }),
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, latency: 150 }),
    };

    mockCacheManager = {
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, latency: 50 }),
      cleanup: jest.fn().mockResolvedValue(undefined),
    };

    mockRateLimiter = {
      destroy: jest.fn(),
    };

    MockJiraClient.mockImplementation(() => mockJiraClient);
    MockGitHubClient.mockImplementation(() => mockGitHubClient);
    MockCacheManager.mockImplementation(() => mockCacheManager);
    MockServiceRateLimiter.mockImplementation(() => mockRateLimiter);

    server = new MCPServer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    test('should initialize server successfully', async () => {
      await server.initialize();

      expect(MockJiraClient).toHaveBeenCalled();
      expect(MockGitHubClient).toHaveBeenCalled();
      expect(MockCacheManager).toHaveBeenCalled();
      expect(MockServiceRateLimiter).toHaveBeenCalled();
    });

    test('should perform health checks during startup', async () => {
      await server.initialize();

      expect(mockJiraClient.validateConnection).toHaveBeenCalled();
      expect(mockGitHubClient.validateConnection).toHaveBeenCalled();
      expect(mockCacheManager.healthCheck).toHaveBeenCalled();
    });

    test('should handle health check failures gracefully', async () => {
      mockJiraClient.validateConnection.mockRejectedValue(new Error('Jira connection failed'));

      // Should not throw - health check failures are warnings, not errors
      await expect(server.initialize()).resolves.not.toThrow();
    });

    test('should throw error if initialization fails', async () => {
      MockJiraClient.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      await expect(server.initialize()).rejects.toThrow('Configuration error');
    });
  });

  describe('getHealthStatus', () => {
    beforeEach(async () => {
      await server.initialize();
    });

    test('should return healthy status when all services are healthy', async () => {
      const healthStatus = await server.getHealthStatus();

      expect(healthStatus.status).toBe('healthy');
      expect(healthStatus.uptime).toBeGreaterThan(0);
      expect(healthStatus.services).toHaveProperty('jira');
      expect(healthStatus.services).toHaveProperty('github');
      expect(healthStatus.services).toHaveProperty('cache');
    });

    test('should return degraded status when some services are unhealthy', async () => {
      mockJiraClient.healthCheck.mockResolvedValue({ healthy: false, error: 'Connection timeout' });

      const healthStatus = await server.getHealthStatus();

      expect(healthStatus.status).toBe('degraded');
      expect(healthStatus.services.jira.healthy).toBe(false);
      expect(healthStatus.services.jira.error).toBe('Connection timeout');
    });

    test('should return unhealthy status when server not initialized', async () => {
      const uninitializedServer = new MCPServer();
      const healthStatus = await uninitializedServer.getHealthStatus();

      expect(healthStatus.status).toBe('unhealthy');
      expect(healthStatus.error).toBe('Server not initialized');
    });
  });

  describe('getServerInfo', () => {
    test('should return server information before initialization', () => {
      const serverInfo = server.getServerInfo();

      expect(serverInfo.name).toBe('jira-github-sprint-reporter');
      expect(serverInfo.version).toBe('1.0.0');
      expect(serverInfo.status).toBe('initializing');
      expect(serverInfo.uptime).toBe(0);
    });

    test('should return server information after initialization', async () => {
      await server.initialize();

      const serverInfo = server.getServerInfo();

      expect(serverInfo.status).toBe('running');
      expect(serverInfo.uptime).toBeGreaterThan(0);
      expect(serverInfo.tools).toBeGreaterThan(0);
      expect(serverInfo.capabilities).toContain('jira_integration');
      expect(serverInfo.capabilities).toContain('github_integration');
      expect(serverInfo.capabilities).toContain('sprint_reporting');
    });
  });

  describe('shutdown', () => {
    test('should shutdown gracefully', async () => {
      await server.initialize();

      // Mock process.exit to prevent actual exit during tests
      const originalExit = process.exit;
      process.exit = jest.fn() as any;

      await server.shutdown();

      expect(mockCacheManager.cleanup).toHaveBeenCalled();
      expect(mockRateLimiter.destroy).toHaveBeenCalled();

      // Restore process.exit
      process.exit = originalExit;
    });

    test('should handle shutdown errors', async () => {
      await server.initialize();

      mockCacheManager.cleanup.mockRejectedValue(new Error('Cleanup failed'));

      const originalExit = process.exit;
      process.exit = jest.fn() as any;

      // Should not throw even if cleanup fails
      await expect(server.shutdown()).resolves.not.toThrow();

      process.exit = originalExit;
    });

    test('should not fail if called multiple times', async () => {
      await server.initialize();

      const originalExit = process.exit;
      process.exit = jest.fn() as any;

      await server.shutdown();
      await server.shutdown(); // Second call should be safe

      process.exit = originalExit;
    });
  });
});