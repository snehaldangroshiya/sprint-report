// Tests for cache manager

import { CacheManager } from '../../src/cache/cache-manager';
import { CacheError } from '../../src/utils/errors';

// Mock node-cache
jest.mock('node-cache');
const MockNodeCache = require('node-cache');

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockMemoryCache: jest.Mocked<any>;

  beforeEach(() => {
    mockMemoryCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      has: jest.fn(),
      keys: jest.fn(),
      getTtl: jest.fn(),
      flushAll: jest.fn(),
      getStats: jest.fn(),
      on: jest.fn(),
    };

    MockNodeCache.mockImplementation(() => mockMemoryCache);

    cacheManager = new CacheManager({
      memory: {
        maxSize: 100,
        ttl: 300,
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with memory cache only', () => {
      expect(MockNodeCache).toHaveBeenCalledWith({
        stdTTL: 300,
        checkperiod: 120,
        useClones: false,
        maxKeys: 100,
      });

      expect(mockMemoryCache.on).toHaveBeenCalledWith('expired', expect.any(Function));
      expect(mockMemoryCache.on).toHaveBeenCalledWith('del', expect.any(Function));
      expect(mockMemoryCache.on).toHaveBeenCalledWith('set', expect.any(Function));
    });

    test('should initialize with Redis configuration', () => {
      const cacheWithRedis = new CacheManager({
        memory: { maxSize: 100, ttl: 300 },
        redis: {
          host: 'localhost',
          port: 6379,
          password: 'secret',
          db: 1,
        },
      });

      expect(cacheWithRedis).toBeDefined();
    });
  });

  describe('get', () => {
    test('should return value from memory cache', async () => {
      const testValue = { data: 'test' };
      mockMemoryCache.get.mockReturnValue(testValue);

      const result = await cacheManager.get('test-key');

      expect(result).toEqual(testValue);
      expect(mockMemoryCache.get).toHaveBeenCalledWith('test-key');
    });

    test('should return null when key not found', async () => {
      mockMemoryCache.get.mockReturnValue(undefined);

      const result = await cacheManager.get('nonexistent-key');

      expect(result).toBeNull();
    });

    test('should use fallback when key not found', async () => {
      mockMemoryCache.get.mockReturnValue(undefined);
      const fallbackValue = { data: 'fallback' };

      const result = await cacheManager.get('test-key', {
        fallback: async () => fallbackValue,
      });

      expect(result).toEqual(fallbackValue);
      expect(mockMemoryCache.set).toHaveBeenCalled();
    });

    test('should handle errors gracefully', async () => {
      mockMemoryCache.get.mockImplementation(() => {
        throw new Error('Cache error');
      });

      const result = await cacheManager.get('test-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    test('should set value in memory cache', async () => {
      const testValue = { data: 'test' };

      await cacheManager.set('test-key', testValue, { ttl: 600 });

      expect(mockMemoryCache.set).toHaveBeenCalledWith('test-key', testValue, 600);
    });

    test('should use default TTL when not specified', async () => {
      const testValue = { data: 'test' };

      await cacheManager.set('test-key', testValue);

      expect(mockMemoryCache.set).toHaveBeenCalledWith('test-key', testValue, 300);
    });

    test('should handle errors gracefully without throwing', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockMemoryCache.set.mockImplementation(() => {
        throw new Error('Set failed');
      });

      // Should not throw - method handles errors gracefully
      await expect(cacheManager.set('test-key', 'value')).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('delete', () => {
    test('should delete from memory cache', async () => {
      mockMemoryCache.del.mockReturnValue(1);

      const result = await cacheManager.delete('test-key');

      expect(result).toBe(true);
      expect(mockMemoryCache.del).toHaveBeenCalledWith('test-key');
    });

    test('should return false when key not found', async () => {
      mockMemoryCache.del.mockReturnValue(0);

      const result = await cacheManager.delete('nonexistent-key');

      expect(result).toBe(false);
    });

    test('should handle errors gracefully', async () => {
      mockMemoryCache.del.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      await expect(cacheManager.delete('test-key')).rejects.toThrow(CacheError);
    });
  });

  describe('deletePattern', () => {
    test('should delete keys matching pattern', async () => {
      mockMemoryCache.keys.mockReturnValue(['user:123', 'user:456', 'session:abc']);
      mockMemoryCache.del.mockReturnValue(1);

      const result = await cacheManager.deletePattern('user:*');

      expect(result).toBe(2);
      expect(mockMemoryCache.del).toHaveBeenCalledWith('user:123');
      expect(mockMemoryCache.del).toHaveBeenCalledWith('user:456');
      expect(mockMemoryCache.del).not.toHaveBeenCalledWith('session:abc');
    });

    test('should handle no matching keys', async () => {
      mockMemoryCache.keys.mockReturnValue(['session:abc']);

      const result = await cacheManager.deletePattern('user:*');

      expect(result).toBe(0);
    });
  });

  describe('exists', () => {
    test('should check key existence in memory cache', async () => {
      mockMemoryCache.has.mockReturnValue(true);

      const result = await cacheManager.exists('test-key');

      expect(result).toBe(true);
      expect(mockMemoryCache.has).toHaveBeenCalledWith('test-key');
    });

    test('should return false when key does not exist', async () => {
      mockMemoryCache.has.mockReturnValue(false);

      const result = await cacheManager.exists('nonexistent-key');

      expect(result).toBe(false);
    });
  });

  describe('ttl', () => {
    test('should return TTL from memory cache', async () => {
      const expireTime = Date.now() + 60000; // 1 minute from now
      mockMemoryCache.getTtl.mockReturnValue(expireTime);

      const result = await cacheManager.ttl('test-key');

      expect(result).toBeCloseTo(60, 0);
      expect(mockMemoryCache.getTtl).toHaveBeenCalledWith('test-key');
    });

    test('should return -1 when key does not exist', async () => {
      mockMemoryCache.getTtl.mockReturnValue(null);

      const result = await cacheManager.ttl('nonexistent-key');

      expect(result).toBe(-1);
    });
  });

  describe('clear', () => {
    test('should clear all caches', async () => {
      mockMemoryCache.getStats.mockReturnValue({ keys: 0, hits: 0, misses: 0 });

      await cacheManager.clear();

      expect(mockMemoryCache.flushAll).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    test('should return cache statistics', () => {
      mockMemoryCache.getStats.mockReturnValue({
        keys: 10,
        hits: 100,
        misses: 20,
      });

      mockMemoryCache.keys.mockReturnValue(new Array(10).fill('key'));

      const stats = cacheManager.getStats();

      expect(stats).toEqual({
        hits: 0,
        misses: 0,
        keys: 10,
        memory: expect.any(Number),
        hitRate: 0,
      });
    });
  });

  describe('healthCheck', () => {
    test('should perform successful health check', async () => {
      let storedValue: any;
      mockMemoryCache.set.mockImplementation((_key: string, value: any) => {
        storedValue = value;
        return true;
      });
      mockMemoryCache.get.mockImplementation(() => storedValue);
      mockMemoryCache.del.mockReturnValue(1);

      const result = await cacheManager.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    test('should detect unhealthy cache', async () => {
      mockMemoryCache.set.mockImplementation(() => {
        throw new Error('Cache failure');
      });

      const result = await cacheManager.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('buildKey', () => {
    test('should build cache key from parts', () => {
      const key = CacheManager.buildKey('user', 123, 'profile');

      expect(key).toBe('user:123:profile');
    });

    test('should escape colons in parts', () => {
      const key = CacheManager.buildKey('user:admin', 'profile:data');

      expect(key).toBe('user_admin:profile_data');
    });
  });

  describe('buildSprintKey', () => {
    test('should build sprint key', () => {
      const key = CacheManager.buildSprintKey('123');

      expect(key).toBe('sprint:123');
    });

    test('should build sprint key with suffix', () => {
      const key = CacheManager.buildSprintKey('123', 'issues');

      expect(key).toBe('sprint:123:issues');
    });
  });

  describe('buildRepositoryKey', () => {
    test('should build repository key', () => {
      const key = CacheManager.buildRepositoryKey('owner', 'repo');

      expect(key).toBe('repo:owner:repo');
    });

    test('should build repository key with suffix', () => {
      const key = CacheManager.buildRepositoryKey('owner', 'repo', 'commits');

      expect(key).toBe('repo:owner:repo:commits');
    });
  });

  describe('cleanup', () => {
    test('should cleanup resources', async () => {
      await cacheManager.cleanup();

      expect(mockMemoryCache.flushAll).toHaveBeenCalled();
    });
  });
});

describe('CacheWarmer', () => {
  let mockJiraClient: any;
  let mockGitHubClient: any;

  beforeEach(() => {
    mockJiraClient = {
      getSprintData: jest.fn().mockResolvedValue({ id: '123', name: 'Test Sprint' }),
      getSprintIssues: jest.fn().mockResolvedValue([]),
    };

    mockGitHubClient = {
      getRepositoryInfo: jest.fn().mockResolvedValue({ owner: 'test', repo: 'repo' }),
      getCommits: jest.fn().mockResolvedValue([]),
      getPullRequests: jest.fn().mockResolvedValue([]),
    };
  });

  test('should warm sprint cache', async () => {
    const { CacheWarmer } = await import('../../src/cache/cache-manager');
    const warmer = new CacheWarmer();

    await warmer.warmSprintCache('123', mockJiraClient);

    expect(mockJiraClient.getSprintData).toHaveBeenCalledWith('123');
    expect(mockJiraClient.getSprintIssues).toHaveBeenCalledWith('123');
  });

  test('should warm repository cache', async () => {
    const { CacheWarmer } = await import('../../src/cache/cache-manager');
    const warmer = new CacheWarmer();

    await warmer.warmRepositoryCache('owner', 'repo', mockGitHubClient, '2023-01-01', '2023-01-31');

    expect(mockGitHubClient.getRepositoryInfo).toHaveBeenCalledWith('owner', 'repo');
    expect(mockGitHubClient.getCommits).toHaveBeenCalledWith('owner', 'repo', {
      since: '2023-01-01',
      until: '2023-01-31',
      per_page: 30,
    });
    expect(mockGitHubClient.getPullRequests).toHaveBeenCalledWith('owner', 'repo', {
      state: 'all',
      per_page: 30,
    });
  });

  test('should handle cache warming failures gracefully', async () => {
    const { CacheWarmer } = await import('../../src/cache/cache-manager');
    const warmer = new CacheWarmer();

    mockJiraClient.getSprintData.mockRejectedValue(new Error('API error'));

    // Should not throw
    await warmer.warmSprintCache('123', mockJiraClient);

    expect(mockJiraClient.getSprintData).toHaveBeenCalled();
  });
});
