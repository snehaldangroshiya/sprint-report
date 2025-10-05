// Advanced caching system with in-memory and Redis support

import NodeCache from 'node-cache';
import { CacheStats } from '@/types';
import { CacheError } from '@/utils/errors';

export interface CacheManagerOptions {
  memory: {
    maxSize: number;
    ttl: number;
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
}

export interface CacheGetOptions {
  fallback?: () => Promise<any>;
  ttl?: number;
}

export interface CacheSetOptions {
  ttl?: number;
  tags?: string[];
}

export class CacheManager {
  private memoryCache: NodeCache;
  private redisClient: any = null;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  constructor(private options: CacheManagerOptions) {
    this.memoryCache = new NodeCache({
      stdTTL: options.memory.ttl,
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false, // Better performance, but be careful with object mutations
      maxKeys: options.memory.maxSize,
    });

    this.setupMemoryCacheEvents();
    this.initializeRedis();
  }

  private setupMemoryCacheEvents(): void {
    this.memoryCache.on('expired', (key: string, _value: any) => {
      console.debug(`Memory cache key expired: ${key}`);
    });

    this.memoryCache.on('del', (_key: string, _value: any) => {
      this.stats.deletes++;
    });

    this.memoryCache.on('set', (_key: string, _value: any) => {
      this.stats.sets++;
    });
  }

  private async initializeRedis(): Promise<void> {
    if (!this.options.redis) {
      return;
    }

    try {
      // Dynamically import Redis (optional dependency)
      const { Redis } = await import('ioredis');

      const redisConfig: any = {
        host: this.options.redis.host,
        port: this.options.redis.port,
        db: this.options.redis.db,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      };

      if (this.options.redis.password) {
        redisConfig.password = this.options.redis.password;
      }

      this.redisClient = new Redis(redisConfig);

      this.redisClient.on('connect', () => {
        console.log('Redis cache connected');
      });

      this.redisClient.on('error', (error: Error) => {
        console.warn('Redis cache error:', error.message);
        this.stats.errors++;
        // Don't throw - degrade gracefully to memory-only
      });

      this.redisClient.on('close', () => {
        console.log('Redis cache connection closed');
      });

      // Test connection
      await this.redisClient.connect();
    } catch (error) {
      console.warn('Failed to initialize Redis cache:', error instanceof Error ? error.message : 'Unknown error');
      this.redisClient = null;
    }
  }

  // Get value from cache with fallback
  async get<T>(key: string, options: CacheGetOptions = {}): Promise<T | null> {
    try {
      // L1: Memory cache (fastest)
      const memoryResult = this.memoryCache.get<T>(key);
      if (memoryResult !== undefined) {
        this.stats.hits++;
        return memoryResult;
      }

      // L2: Redis cache (distributed)
      if (this.redisClient) {
        try {
          const redisResult = await this.redisClient.get(key);
          if (redisResult !== null) {
            const parsed = JSON.parse(redisResult);

            // Populate L1 cache with shorter TTL
            const l1Ttl = Math.min(options.ttl || this.options.memory.ttl, 300);
            this.memoryCache.set(key, parsed, l1Ttl);

            this.stats.hits++;
            return parsed;
          }
        } catch (error) {
          console.warn(`Redis get error for key ${key}:`, error);
          this.stats.errors++;
        }
      }

      this.stats.misses++;

      // L3: Fallback function
      if (options.fallback) {
        const fallbackResult = await options.fallback();
        if (fallbackResult !== null && fallbackResult !== undefined) {
          // Cache the fallback result
          await this.set(key, fallbackResult, options);
          return fallbackResult;
        }
      }

      return null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      this.stats.errors++;
      return null;
    }
  }

  // Set value in cache
  async set<T>(key: string, value: T, options: CacheSetOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || this.options.memory.ttl;

      // L1: Memory cache - handle max keys gracefully
      try {
        const success = this.memoryCache.set(key, value, ttl);
        
        // If set failed due to max keys, try to clear some space
        if (!success) {
          const keys = this.memoryCache.keys();
          const currentSize = keys.length;
          
          // If we're at max capacity, clear 10% of oldest entries
          if (currentSize >= this.options.memory.maxSize * 0.95) {
            console.warn(`Memory cache near capacity (${currentSize}/${this.options.memory.maxSize}), clearing old entries`);
            
            // Clear 10% of entries by deleting keys
            const numToDelete = Math.floor(this.options.memory.maxSize * 0.1);
            const keysToDelete = keys.slice(0, numToDelete);
            
            for (const k of keysToDelete) {
              this.memoryCache.del(k);
            }
            
            // Try setting again
            this.memoryCache.set(key, value, ttl);
          }
        }
      } catch (memError: any) {
        // If memory cache fails, log but continue - Redis might still work
        console.warn(`Memory cache set error for key ${key}:`, memError.message || memError);
        this.stats.errors++;
      }

      // L2: Redis cache
      if (this.redisClient) {
        try {
          const serialized = JSON.stringify(value);
          await this.redisClient.setex(key, ttl, serialized);
        } catch (error) {
          console.warn(`Redis set error for key ${key}:`, error);
          this.stats.errors++;
        }
      }

      this.stats.sets++;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      this.stats.errors++;
      // Don't throw error - degraded caching is better than no caching
      console.warn(`Continuing without caching for key ${key}`);
    }
  }

  // Set multiple values in cache using pipeline (batch operation)
  async setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    try {
      if (entries.length === 0) return;

      // L1: Memory cache (batch set) - handle max keys gracefully
      let successCount = 0;
      let failureCount = 0;
      
      for (const entry of entries) {
        const ttl = entry.ttl || this.options.memory.ttl;
        try {
          const success = this.memoryCache.set(entry.key, entry.value, ttl);
          if (success) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (err) {
          failureCount++;
          console.warn(`Memory cache set failed for key ${entry.key}`);
        }
      }
      
      // If many failures, clear some space
      if (failureCount > entries.length * 0.3) {
        const keys = this.memoryCache.keys();
        const currentSize = keys.length;
        console.warn(`Memory cache batch set had ${failureCount} failures (${currentSize}/${this.options.memory.maxSize}), clearing old entries`);
        
        const numToDelete = Math.floor(this.options.memory.maxSize * 0.2);
        const keysToDelete = keys.slice(0, numToDelete);
        
        for (const k of keysToDelete) {
          this.memoryCache.del(k);
        }
      }

      // L2: Redis cache (pipeline for batch operation)
      if (this.redisClient) {
        try {
          const pipeline = this.redisClient.pipeline();

          for (const entry of entries) {
            const ttl = entry.ttl || this.options.memory.ttl;
            const serialized = JSON.stringify(entry.value);
            pipeline.setex(entry.key, ttl, serialized);
          }

          // Execute all commands in a single round trip
          const results = await pipeline.exec();

          // Check for errors in pipeline execution
          if (results) {
            const errors = results.filter(([err]: [Error | null, unknown]) => err !== null);
            if (errors.length > 0) {
              console.warn(`Redis pipeline setMany had ${errors.length} errors`);
              this.stats.errors += errors.length;
            }
          }
        } catch (error) {
          console.warn('Redis pipeline setMany error:', error);
          this.stats.errors++;
        }
      }

      this.stats.sets += entries.length;
    } catch (error) {
      console.error('Cache setMany error:', error);
      this.stats.errors++;
      // Don't throw error - degraded caching is better than no caching
      console.warn('Continuing without full batch caching');
    }
  }

  // Get multiple values from cache using pipeline (batch operation)
  async getMany<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    try {
      if (keys.length === 0) return results;

      // L1: Memory cache (check all keys)
      const missingKeys: string[] = [];
      for (const key of keys) {
        const memoryResult = this.memoryCache.get<T>(key);
        if (memoryResult !== undefined) {
          results.set(key, memoryResult);
          this.stats.hits++;
        } else {
          missingKeys.push(key);
        }
      }

      // L2: Redis cache (pipeline for missing keys)
      if (this.redisClient && missingKeys.length > 0) {
        try {
          const pipeline = this.redisClient.pipeline();

          // Queue all get commands
          for (const key of missingKeys) {
            pipeline.get(key);
          }

          // Execute all commands in a single round trip
          const pipelineResults = await pipeline.exec();

          if (pipelineResults) {
            for (let i = 0; i < missingKeys.length; i++) {
              const key = missingKeys[i];
              if (!key) continue; // Safety check

              const pipelineResult = pipelineResults[i];
              if (!pipelineResult) continue; // Safety check

              const [err, value]: [Error | null, unknown] = pipelineResult;

              if (err) {
                console.warn(`Redis get error for key ${key}:`, err);
                this.stats.errors++;
                results.set(key, null);
              } else if (value !== null) {
                try {
                  const parsed = JSON.parse(value as string);
                  results.set(key, parsed);

                  // Populate L1 cache
                  const l1Ttl = Math.min(this.options.memory.ttl, 300);
                  this.memoryCache.set(key, parsed, l1Ttl);

                  this.stats.hits++;
                } catch (parseError) {
                  console.warn(`JSON parse error for key ${key}:`, parseError);
                  results.set(key, null);
                }
              } else {
                results.set(key, null);
                this.stats.misses++;
              }
            }
          }
        } catch (error) {
          console.warn('Redis pipeline getMany error:', error);
          this.stats.errors++;
          // Mark all missing keys as null
          for (const key of missingKeys) {
            results.set(key, null);
          }
        }
      } else {
        // No Redis or no missing keys
        for (const key of missingKeys) {
          results.set(key, null);
          this.stats.misses++;
        }
      }

      return results;
    } catch (error) {
      console.error('Cache getMany error:', error);
      this.stats.errors++;
      return results;
    }
  }

  // Delete from cache
  async delete(key: string): Promise<boolean> {
    try {
      let deleted = false;

      // Delete from memory cache
      if (this.memoryCache.del(key) > 0) {
        deleted = true;
      }

      // Delete from Redis cache
      if (this.redisClient) {
        try {
          const redisDeleted = await this.redisClient.del(key);
          if (redisDeleted > 0) {
            deleted = true;
          }
        } catch (error) {
          console.warn(`Redis delete error for key ${key}:`, error);
          this.stats.errors++;
        }
      }

      if (deleted) {
        this.stats.deletes++;
      }

      return deleted;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      this.stats.errors++;
      throw new CacheError(`delete:${key}`, error instanceof Error ? error : undefined);
    }
  }

  // Delete multiple keys by pattern
  async deletePattern(pattern: string): Promise<number> {
    try {
      let deletedCount = 0;

      // Delete from memory cache
      const memoryKeys = this.memoryCache.keys();
      for (const key of memoryKeys) {
        if (this.matchPattern(key, pattern)) {
          if (this.memoryCache.del(key) > 0) {
            deletedCount++;
          }
        }
      }

      // Delete from Redis cache using SCAN (non-blocking) + Pipeline
      if (this.redisClient) {
        try {
          const redisKeys = await this.scanRedisKeys(pattern);
          if (redisKeys.length > 0) {
            // Delete using pipeline for better performance
            const batchSize = 1000;
            for (let i = 0; i < redisKeys.length; i += batchSize) {
              const batch = redisKeys.slice(i, i + batchSize);

              // Use pipeline for batch deletion
              const pipeline = this.redisClient.pipeline();
              batch.forEach(key => pipeline.del(key));

              const results = await pipeline.exec();

              // Count successful deletions
              if (results) {
                const successfulDeletes = results.filter(([err, result]: [Error | null, unknown]) =>
                  err === null && result === 1
                ).length;
                deletedCount += successfulDeletes;

                // Track errors
                const errors = results.filter(([err]: [Error | null, unknown]) => err !== null);
                if (errors.length > 0) {
                  this.stats.errors += errors.length;
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Redis delete pattern error for ${pattern}:`, error);
          this.stats.errors++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error);
      this.stats.errors++;
      throw new CacheError(`deletePattern:${pattern}`, error instanceof Error ? error : undefined);
    }
  }

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    try {
      // Check memory cache first
      if (this.memoryCache.has(key)) {
        return true;
      }

      // Check Redis cache
      if (this.redisClient) {
        try {
          const exists = await this.redisClient.exists(key);
          return exists === 1;
        } catch (error) {
          console.warn(`Redis exists error for key ${key}:`, error);
          this.stats.errors++;
        }
      }

      return false;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  // Get remaining TTL for a key
  async ttl(key: string): Promise<number> {
    try {
      // Check memory cache first
      const memoryTtl = this.memoryCache.getTtl(key);
      if (memoryTtl) {
        return Math.floor((memoryTtl - Date.now()) / 1000);
      }

      // Check Redis cache
      if (this.redisClient) {
        try {
          const redisTtl = await this.redisClient.ttl(key);
          return redisTtl;
        } catch (error) {
          console.warn(`Redis ttl error for key ${key}:`, error);
          this.stats.errors++;
        }
      }

      return -1; // Key doesn't exist
    } catch (error) {
      console.error(`Cache ttl error for key ${key}:`, error);
      this.stats.errors++;
      return -1;
    }
  }

  // Clear all cache
  async clear(): Promise<void> {
    try {
      // Clear memory cache
      this.memoryCache.flushAll();

      // Clear Redis cache
      if (this.redisClient) {
        try {
          await this.redisClient.flushdb();
        } catch (error) {
          console.warn('Redis clear error:', error);
          this.stats.errors++;
        }
      }

      // Reset stats
      this.stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0,
      };
    } catch (error) {
      console.error('Cache clear error:', error);
      this.stats.errors++;
      throw new CacheError('clear', error instanceof Error ? error : undefined);
    }
  }

  // Get cache statistics
  getStats(): CacheStats {
    const memoryStats = this.memoryCache.getStats();
    const totalRequests = this.stats.hits + this.stats.misses;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      keys: memoryStats.keys,
      memory: this.getMemoryUsage(),
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
    };
  }

  // Get detailed cache information
  async getInfo(): Promise<{
    memory: {
      keys: number;
      size: number;
      maxSize: number;
    };
    redis?: {
      connected: boolean;
      keys?: number;
      memory?: number;
    };
    stats: {
      hits: number;
      misses: number;
      sets: number;
      deletes: number;
      errors: number;
    };
  }> {
    const memoryStats = this.memoryCache.getStats();
    const info: any = {
      memory: {
        keys: memoryStats.keys,
        size: this.getMemoryUsage(),
        maxSize: this.options.memory.maxSize,
      },
      stats: { ...this.stats },
    };

    if (this.redisClient) {
      try {
        const redisInfo = await this.redisClient.info('keyspace');
        const dbKeys = this.parseRedisDbKeys(redisInfo);

        info.redis = {
          connected: this.redisClient.status === 'ready',
          keys: dbKeys,
        };
      } catch (error) {
        info.redis = {
          connected: false,
        };
      }
    }

    return info;
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const startTime = Date.now();

    try {
      // Test memory cache
      const testKey = `health_check_${Date.now()}`;
      const testValue = { timestamp: Date.now() };

      await this.set(testKey, testValue, { ttl: 5 });
      const retrieved = await this.get<{ timestamp: number }>(testKey);

      if (!retrieved || retrieved.timestamp !== testValue.timestamp) {
        throw new Error('Memory cache test failed');
      }

      await this.delete(testKey);

      // Test Redis cache if available
      if (this.redisClient) {
        try {
          await this.redisClient.ping();
        } catch (error) {
          console.warn('Redis health check failed:', error);
          // Don't fail the overall health check for Redis issues
        }
      }

      return {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Cache key utilities
  public static buildKey(...parts: (string | number)[]): string {
    return parts
      .map(part => String(part).replace(/:/g, '_'))
      .join(':');
  }

  public static buildSprintKey(sprintId: string, suffix?: string): string {
    return suffix ? `sprint:${sprintId}:${suffix}` : `sprint:${sprintId}`;
  }

  public static buildRepositoryKey(owner: string, repo: string, suffix?: string): string {
    const base = `repo:${owner}:${repo}`;
    return suffix ? `${base}:${suffix}` : base;
  }

  // Private utility methods
  private getMemoryUsage(): number {
    const keys = this.memoryCache.keys();
    let size = 0;

    for (const key of keys) {
      const value = this.memoryCache.get(key);
      if (value !== undefined) {
        size += JSON.stringify(value).length * 2; // Rough size estimate
      }
    }

    return size;
  }

  private matchPattern(key: string, pattern: string): boolean {
    // Simple pattern matching with * wildcard
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(key);
  }

  private parseRedisDbKeys(info: string): number {
    const dbMatch = info.match(/db0:keys=(\d+)/);
    return dbMatch && dbMatch[1] ? parseInt(dbMatch[1], 10) : 0;
  }

  // SCAN Redis keys using non-blocking iterator (replaces blocking KEYS command)
  private async scanRedisKeys(pattern: string): Promise<string[]> {
    if (!this.redisClient) {
      return [];
    }

    const keys: string[] = [];

    try {
      // Use scanStream for efficient, non-blocking key scanning
      const stream = this.redisClient.scanStream({
        match: pattern,
        count: 100, // Scan 100 keys per iteration
      });

      // Collect all matching keys
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (resultKeys: string[]) => {
          keys.push(...resultKeys);
        });

        stream.on('end', () => {
          resolve();
        });

        stream.on('error', (error: Error) => {
          reject(error);
        });
      });

      return keys;
    } catch (error) {
      console.warn(`Redis SCAN error for pattern ${pattern}:`, error);
      return [];
    }
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    try {
      if (this.redisClient) {
        await this.redisClient.disconnect();
      }
      this.memoryCache.flushAll();
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }
}

// Cache warming utilities
export class CacheWarmer {
  constructor() {}

  async warmSprintCache(sprintId: string, jiraClient: any): Promise<void> {
    try {
      const operations = [
        () => jiraClient.getSprintData(sprintId),
        () => jiraClient.getSprintIssues(sprintId),
      ];

      await Promise.allSettled(operations.map(op => op()));

      console.log(`Cache warmed for sprint ${sprintId}`);
    } catch (error) {
      console.warn(`Failed to warm cache for sprint ${sprintId}:`, error);
    }
  }

  async warmRepositoryCache(
    owner: string,
    repo: string,
    githubClient: any,
    since?: string,
    until?: string
  ): Promise<void> {
    try {
      const operations = [
        () => githubClient.getRepositoryInfo(owner, repo),
        () => githubClient.getCommits(owner, repo, { since, until, per_page: 30 }),
        () => githubClient.getPullRequests(owner, repo, { state: 'all', per_page: 30 }),
      ];

      await Promise.allSettled(operations.map(op => op()));

      console.log(`Cache warmed for repository ${owner}/${repo}`);
    } catch (error) {
      console.warn(`Failed to warm cache for repository ${owner}/${repo}:`, error);
    }
  }
}