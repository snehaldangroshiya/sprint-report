// Intelligent cache optimization and management system

import {
  PerformanceMonitor,
  measurePerformance,
} from '../performance/performance-monitor';

import { CacheManager } from './cache-manager';

export interface CachePattern {
  keyPattern: string;
  frequency: number;
  avgSize: number;
  hitRate: number;
  lastAccessed: number;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
}

export interface CacheOptimizationRule {
  name: string;
  condition: (pattern: CachePattern) => boolean;
  action: 'preload' | 'extend_ttl' | 'reduce_ttl' | 'evict' | 'compress';
  value?: number;
  enabled: boolean;
  description: string;
}

export interface CacheOptimizationResult {
  keysProcessed: number;
  actionsPerformed: {
    preload: number;
    extend_ttl: number;
    reduce_ttl: number;
    evict: number;
    compress: number;
  };
  spaceSaved: number;
  estimatedPerformanceGain: number;
  recommendations: string[];
}

export interface PrefetchStrategy {
  name: string;
  keyGenerator: (context: any) => string[];
  dataLoader: (keys: string[]) => Promise<Record<string, any>>;
  priority: number;
  schedule?: string; // cron-like schedule
  dependencies?: string[]; // other strategies this depends on
}

export class CacheOptimizer {
  private cachePatterns: Map<string, CachePattern> = new Map();
  private optimizationRules: CacheOptimizationRule[] = [];
  private prefetchStrategies: Map<string, PrefetchStrategy> = new Map();
  private optimizationHistory: Array<{
    timestamp: number;
    result: CacheOptimizationResult;
  }> = [];

  constructor(
    private cacheManager: CacheManager,
    _performanceMonitor?: PerformanceMonitor
  ) {
    this.setupDefaultOptimizationRules();
    this.setupDefaultPrefetchStrategies();
  }

  private setupDefaultOptimizationRules(): void {
    // High-frequency, high-hit-rate keys should have extended TTL
    this.addOptimizationRule({
      name: 'extend-popular-keys',
      condition: pattern => pattern.frequency > 100 && pattern.hitRate > 0.8,
      action: 'extend_ttl',
      value: 1.5, // Multiply current TTL by 1.5
      enabled: true,
      description:
        'Extend TTL for frequently accessed keys with high hit rates',
    });

    // Low-hit-rate keys should be evicted
    this.addOptimizationRule({
      name: 'evict-low-performance',
      condition: pattern =>
        pattern.hitRate < 0.2 && Date.now() - pattern.lastAccessed > 300000, // 5 minutes
      action: 'evict',
      enabled: true,
      description:
        "Evict keys with low hit rates that haven't been accessed recently",
    });

    // Large, infrequently accessed keys should have reduced TTL
    this.addOptimizationRule({
      name: 'reduce-large-stale',
      condition: pattern =>
        pattern.avgSize > 10000 &&
        pattern.frequency < 10 &&
        Date.now() - pattern.lastAccessed > 180000, // 3 minutes
      action: 'reduce_ttl',
      value: 0.5, // Reduce TTL by half
      enabled: true,
      description: 'Reduce TTL for large, infrequently accessed keys',
    });

    // Preload patterns for predictable access
    this.addOptimizationRule({
      name: 'preload-sprint-data',
      condition: pattern =>
        pattern.keyPattern.includes('sprint:') && pattern.hitRate > 0.6,
      action: 'preload',
      enabled: true,
      description:
        'Preload related sprint data for frequently accessed sprints',
    });

    // Compress large values that are accessed frequently
    this.addOptimizationRule({
      name: 'compress-large-frequent',
      condition: pattern => pattern.avgSize > 50000 && pattern.frequency > 50,
      action: 'compress',
      enabled: true,
      description: 'Compress large values that are accessed frequently',
    });
  }

  private setupDefaultPrefetchStrategies(): void {
    // Sprint-related data prefetching
    this.addPrefetchStrategy({
      name: 'sprint-ecosystem',
      keyGenerator: (context: { sprintId: string }) => [
        `sprint:${context.sprintId}:issues`,
        `sprint:${context.sprintId}:metrics`,
        `sprint:${context.sprintId}:velocity`,
        `sprint:${context.sprintId}:burndown`,
      ],
      dataLoader: async (_keys: string[]) => {
        // This would be implemented with actual data loading logic
        return {};
      },
      priority: 1,
    });

    // Repository-related data prefetching
    this.addPrefetchStrategy({
      name: 'repository-ecosystem',
      keyGenerator: (context: { owner: string; repo: string }) => [
        `repo:${context.owner}:${context.repo}:commits:recent`,
        `repo:${context.owner}:${context.repo}:prs:open`,
        `repo:${context.owner}:${context.repo}:contributors`,
        `repo:${context.owner}:${context.repo}:stats`,
      ],
      dataLoader: async (_keys: string[]) => {
        return {};
      },
      priority: 2,
    });

    // Cross-service correlation prefetching
    this.addPrefetchStrategy({
      name: 'issue-correlation',
      keyGenerator: (context: { issueKeys: string[] }) => {
        const keys: string[] = [];
        for (const issueKey of context.issueKeys) {
          keys.push(
            `issue:${issueKey}:commits`,
            `issue:${issueKey}:prs`,
            `issue:${issueKey}:details`
          );
        }
        return keys;
      },
      dataLoader: async (_keys: string[]) => {
        return {};
      },
      priority: 3,
      dependencies: ['sprint-ecosystem'],
    });
  }

  @measurePerformance('cache-analysis')
  public async analyzeCache(): Promise<CachePattern[]> {
    const cacheInfo = await this.cacheManager.getInfo();
    const memoryKeys = Object.keys(cacheInfo.memory);

    // Analyze access patterns for each key
    for (const key of memoryKeys) {
      await this.analyzeKeyPattern(key);
    }

    return Array.from(this.cachePatterns.values()).sort((a, b) =>
      b.priority.localeCompare(a.priority)
    );
  }

  private async analyzeKeyPattern(key: string): Promise<void> {
    const existing = this.cachePatterns.get(key);
    const now = Date.now();

    // Determine key pattern (e.g., "sprint:*", "repo:*:commits")
    const pattern = this.extractPattern(key);

    // Get or create pattern analysis
    const cachePattern = existing || {
      keyPattern: pattern,
      frequency: 0,
      avgSize: 0,
      hitRate: 0,
      lastAccessed: now,
      priority: 'medium' as const,
      tags: this.extractTags(key),
    };

    // Update frequency and access time
    cachePattern.frequency += 1;
    cachePattern.lastAccessed = now;

    // Estimate size (would be better with actual size tracking)
    try {
      const value = await this.cacheManager.get(key);
      if (value) {
        const size = JSON.stringify(value).length * 2; // UTF-16 estimate
        cachePattern.avgSize = (cachePattern.avgSize + size) / 2;
      }
    } catch (error) {
      // Ignore errors in size calculation
    }

    // Update priority based on access patterns
    cachePattern.priority = this.calculatePriority(cachePattern);

    this.cachePatterns.set(key, cachePattern);
  }

  private extractPattern(key: string): string {
    // Convert specific keys to patterns
    return key
      .replace(/:\d+/g, ':*') // Replace numbers with wildcards
      .replace(/:[a-f0-9]{7,40}/g, ':*') // Replace commit SHAs
      .replace(/:[A-Z]+-\d+/g, ':*'); // Replace issue keys
  }

  private extractTags(key: string): string[] {
    const tags: string[] = [];

    if (key.includes('sprint:')) tags.push('sprint');
    if (key.includes('repo:')) tags.push('repository');
    if (key.includes('issue:')) tags.push('issue');
    if (key.includes('commits')) tags.push('commits');
    if (key.includes('prs')) tags.push('pull-requests');
    if (key.includes('metrics')) tags.push('metrics');
    if (key.includes('velocity')) tags.push('velocity');
    if (key.includes('burndown')) tags.push('burndown');

    return tags;
  }

  private calculatePriority(pattern: CachePattern): 'high' | 'medium' | 'low' {
    const score = pattern.frequency * 0.4 + pattern.hitRate * 0.6;

    if (score > 80) return 'high';
    if (score > 40) return 'medium';
    return 'low';
  }

  @measurePerformance('cache-optimization')
  public async optimizeCache(): Promise<CacheOptimizationResult> {
    const patterns = await this.analyzeCache();

    const result: CacheOptimizationResult = {
      keysProcessed: patterns.length,
      actionsPerformed: {
        preload: 0,
        extend_ttl: 0,
        reduce_ttl: 0,
        evict: 0,
        compress: 0,
      },
      spaceSaved: 0,
      estimatedPerformanceGain: 0,
      recommendations: [],
    };

    for (const pattern of patterns) {
      await this.applyOptimizationRules(pattern, result);
    }

    // Generate recommendations
    result.recommendations = this.generateRecommendations(patterns);

    // Record optimization history
    this.optimizationHistory.push({
      timestamp: Date.now(),
      result: { ...result },
    });

    // Limit history size
    if (this.optimizationHistory.length > 50) {
      this.optimizationHistory.splice(0, this.optimizationHistory.length - 50);
    }

    return result;
  }

  private async applyOptimizationRules(
    pattern: CachePattern,
    result: CacheOptimizationResult
  ): Promise<void> {
    for (const rule of this.optimizationRules) {
      if (!rule.enabled || !rule.condition(pattern)) continue;

      try {
        await this.executeOptimizationAction(rule, pattern, result);
      } catch (error) {
        console.warn(
          `Failed to execute optimization rule ${rule.name}:`,
          error
        );
      }
    }
  }

  private async executeOptimizationAction(
    rule: CacheOptimizationRule,
    pattern: CachePattern,
    result: CacheOptimizationResult
  ): Promise<void> {
    switch (rule.action) {
      case 'preload':
        await this.preloadRelatedData(pattern);
        result.actionsPerformed.preload++;
        break;

      case 'extend_ttl':
        await this.adjustTTL(pattern, rule.value || 1.5);
        result.actionsPerformed.extend_ttl++;
        break;

      case 'reduce_ttl':
        await this.adjustTTL(pattern, rule.value || 0.5);
        result.actionsPerformed.reduce_ttl++;
        break;

      case 'evict':
        await this.evictPattern(pattern);
        result.actionsPerformed.evict++;
        result.spaceSaved += pattern.avgSize;
        break;

      case 'compress':
        await this.compressPattern(pattern);
        result.actionsPerformed.compress++;
        result.spaceSaved += pattern.avgSize * 0.3; // Estimate 30% compression
        break;
    }
  }

  private async preloadRelatedData(pattern: CachePattern): Promise<void> {
    // Execute relevant prefetch strategies
    const applicableStrategies = Array.from(this.prefetchStrategies.values())
      .filter(strategy => this.isStrategyApplicable(strategy, pattern))
      .sort((a, b) => a.priority - b.priority);

    for (const strategy of applicableStrategies) {
      try {
        const context = this.extractContextFromPattern(pattern);
        const keys = strategy.keyGenerator(context);
        const data = await strategy.dataLoader(keys);

        // Cache the preloaded data using pipeline for better performance
        const entries = Object.entries(data)
          .filter(([, value]) => value !== null && value !== undefined)
          .map(([key, value]) => ({
            key,
            value,
            ttl: 1800, // 30 minutes TTL
          }));

        if (entries.length > 0) {
          await this.cacheManager.setMany(entries);
        }
      } catch (error) {
        console.warn(
          `Failed to execute prefetch strategy ${strategy.name}:`,
          error
        );
      }
    }
  }

  private isStrategyApplicable(
    strategy: PrefetchStrategy,
    pattern: CachePattern
  ): boolean {
    // Check if strategy tags match pattern tags
    if (strategy.name === 'sprint-ecosystem' && pattern.tags.includes('sprint'))
      return true;
    if (
      strategy.name === 'repository-ecosystem' &&
      pattern.tags.includes('repository')
    )
      return true;
    if (strategy.name === 'issue-correlation' && pattern.tags.includes('issue'))
      return true;

    return false;
  }

  private extractContextFromPattern(pattern: CachePattern): any {
    const context: any = {};

    // Extract sprint ID from pattern
    const sprintMatch = pattern.keyPattern.match(/sprint:([^:]+)/);
    if (sprintMatch) {
      context.sprintId = sprintMatch[1];
    }

    // Extract repository info from pattern
    const repoMatch = pattern.keyPattern.match(/repo:([^:]+):([^:]+)/);
    if (repoMatch) {
      context.owner = repoMatch[1];
      context.repo = repoMatch[2];
    }

    // Extract issue keys from pattern
    const issueMatch = pattern.keyPattern.match(/issue:([^:]+)/);
    if (issueMatch) {
      context.issueKeys = [issueMatch[1]];
    }

    return context;
  }

  private async adjustTTL(
    pattern: CachePattern,
    multiplier: number
  ): Promise<void> {
    // This would require cache manager enhancement to support TTL adjustment
    // For now, we'll simulate by re-caching with new TTL
    console.debug(
      `Would adjust TTL for pattern ${pattern.keyPattern} by factor ${multiplier}`
    );
  }

  private async evictPattern(pattern: CachePattern): Promise<void> {
    await this.cacheManager.deletePattern(pattern.keyPattern);
  }

  private async compressPattern(pattern: CachePattern): Promise<void> {
    // This would require cache manager enhancement to support compression
    console.debug(`Would compress pattern ${pattern.keyPattern}`);
  }

  private generateRecommendations(patterns: CachePattern[]): string[] {
    const recommendations: string[] = [];

    const highFrequencyPatterns = patterns.filter(p => p.frequency > 100);
    if (highFrequencyPatterns.length > 0) {
      recommendations.push(
        `Consider increasing cache memory allocation. Found ${highFrequencyPatterns.length} high-frequency access patterns.`
      );
    }

    const lowHitRatePatterns = patterns.filter(p => p.hitRate < 0.3);
    if (lowHitRatePatterns.length > 5) {
      recommendations.push(
        `Review cache strategy. ${lowHitRatePatterns.length} patterns have low hit rates (<30%).`
      );
    }

    const largePatterns = patterns.filter(p => p.avgSize > 100000);
    if (largePatterns.length > 0) {
      recommendations.push(
        `Consider implementing compression for large cache entries. Found ${largePatterns.length} patterns with average size >100KB.`
      );
    }

    const stalePatterns = patterns.filter(
      p => Date.now() - p.lastAccessed > 3600000
    ); // 1 hour
    if (stalePatterns.length > 10) {
      recommendations.push(
        `Clean up stale cache entries. ${stalePatterns.length} patterns haven't been accessed in over 1 hour.`
      );
    }

    return recommendations;
  }

  public addOptimizationRule(rule: CacheOptimizationRule): void {
    this.optimizationRules.push(rule);
  }

  public removeOptimizationRule(name: string): boolean {
    const index = this.optimizationRules.findIndex(rule => rule.name === name);
    if (index >= 0) {
      this.optimizationRules.splice(index, 1);
      return true;
    }
    return false;
  }

  public addPrefetchStrategy(strategy: PrefetchStrategy): void {
    this.prefetchStrategies.set(strategy.name, strategy);
  }

  public removePrefetchStrategy(name: string): boolean {
    return this.prefetchStrategies.delete(name);
  }

  @measurePerformance('cache-warming')
  public async warmCache(context: {
    sprintIds?: string[];
    repositories?: Array<{ owner: string; repo: string }>;
    issueKeys?: string[];
  }): Promise<void> {
    const strategies = Array.from(this.prefetchStrategies.values()).sort(
      (a, b) => a.priority - b.priority
    );

    for (const strategy of strategies) {
      try {
        const keys: string[] = [];

        if (strategy.name === 'sprint-ecosystem' && context.sprintIds) {
          for (const sprintId of context.sprintIds) {
            keys.push(...strategy.keyGenerator({ sprintId }));
          }
        } else if (
          strategy.name === 'repository-ecosystem' &&
          context.repositories
        ) {
          for (const repo of context.repositories) {
            keys.push(...strategy.keyGenerator(repo));
          }
        } else if (strategy.name === 'issue-correlation' && context.issueKeys) {
          keys.push(...strategy.keyGenerator({ issueKeys: context.issueKeys }));
        }

        if (keys.length > 0) {
          const data = await strategy.dataLoader(keys);

          // Use pipeline for batch caching
          const entries = Object.entries(data)
            .filter(([, value]) => value !== null && value !== undefined)
            .map(([key, value]) => ({
              key,
              value,
              ttl: 1800,
            }));

          if (entries.length > 0) {
            await this.cacheManager.setMany(entries);
          }
        }
      } catch (error) {
        console.warn(
          `Failed to warm cache with strategy ${strategy.name}:`,
          error
        );
      }
    }
  }

  public getOptimizationHistory(): Array<{
    timestamp: number;
    result: CacheOptimizationResult;
  }> {
    return this.optimizationHistory.slice();
  }

  public getCachePatterns(): CachePattern[] {
    return Array.from(this.cachePatterns.values());
  }

  public getOptimizationRules(): CacheOptimizationRule[] {
    return this.optimizationRules.slice();
  }

  public getPrefetchStrategies(): PrefetchStrategy[] {
    return Array.from(this.prefetchStrategies.values());
  }

  public getOptimizationSummary(): {
    totalPatterns: number;
    highPriorityPatterns: number;
    averageHitRate: number;
    totalSpaceSaved: number;
    lastOptimization?: number;
    recommendations: string[];
  } {
    const patterns = Array.from(this.cachePatterns.values());
    const lastOptimization =
      this.optimizationHistory[this.optimizationHistory.length - 1];

    const result: {
      totalPatterns: number;
      highPriorityPatterns: number;
      averageHitRate: number;
      totalSpaceSaved: number;
      lastOptimization?: number;
      recommendations: string[];
    } = {
      totalPatterns: patterns.length,
      highPriorityPatterns: patterns.filter(p => p.priority === 'high').length,
      averageHitRate:
        patterns.length > 0
          ? patterns.reduce((sum, p) => sum + p.hitRate, 0) / patterns.length
          : 0,
      totalSpaceSaved: this.optimizationHistory.reduce(
        (sum, opt) => sum + opt.result.spaceSaved,
        0
      ),
      recommendations: this.generateRecommendations(patterns),
    };

    if (lastOptimization) {
      result.lastOptimization = lastOptimization.timestamp;
    }

    return result;
  }
}
