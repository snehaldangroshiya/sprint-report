/**
 * Cache Orchestrator Service
 * Manages cache warming, invalidation, and TTL strategies
 */

import { EnhancedMCPServer } from '../../server/enhanced-mcp-server';
import { getLogger } from '../../utils/logger';

import { MCPBridge } from './mcp-bridge.service';

export class CacheOrchestrator {
  private mcpServer: EnhancedMCPServer;
  private mcpBridge: MCPBridge;
  private logger: any;

  constructor(mcpServer: EnhancedMCPServer, mcpBridge: MCPBridge) {
    this.mcpServer = mcpServer;
    this.mcpBridge = mcpBridge;
    this.logger = getLogger();
  }

  /**
   * Get dynamic cache TTL based on sprint state
   * Active sprints: 5 minutes (frequently changing)
   * Closed sprints: 30 days (rarely changes)
   * Future sprints: 15 minutes (may change during planning)
   */
  async getSprintCacheTTL(sprintId: string): Promise<number> {
    try {
      const cacheManager = this.mcpServer.getContext().cacheManager;

      // Check if we have sprint state in cache
      const sprintStateKey = `sprint:${sprintId}:state`;
      let sprintState = await cacheManager.get(sprintStateKey);

      if (!sprintState) {
        // Fetch sprint details to determine state
        try {
          const sprint = await this.mcpBridge.callTool('jira_get_sprint', {
            sprint_id: sprintId,
          });
          if (sprint) {
            sprintState = sprint.state;
            // Cache sprint state for 1 hour
            await cacheManager.set(sprintStateKey, sprintState, {
              ttl: 3600000,
            });
          }
        } catch (error) {
          this.logger.warn('Failed to fetch sprint state', {
            sprintId,
            error: (error as Error).message,
          });
        }
      }

      // Return TTL based on state
      switch (sprintState) {
        case 'active':
          return 300000; // 5 minutes - active sprints change frequently
        case 'closed':
          return 2592000000; // 30 days - closed sprints are immutable
        case 'future':
          return 900000; // 15 minutes - future sprints may change during planning
        default:
          return 600000; // 10 minutes - default fallback
      }
    } catch (error) {
      this.logger.warn('Failed to get sprint state for TTL, using default', {
        sprintId,
      });
      return 600000; // 10 minutes default
    }
  }

  /**
   * Schedule background refresh for popular cached items
   * Refreshes cache when it's 50% through its TTL
   */
  async scheduleBackgroundRefresh(
    cacheKey: string,
    refreshFunction: () => Promise<any>,
    ttl: number
  ): Promise<void> {
    const cacheManager = this.mcpServer.getContext().cacheManager;
    const cacheMetadata = (await cacheManager.get(
      `${cacheKey}:metadata`
    )) as any;

    if (
      cacheMetadata &&
      typeof cacheMetadata === 'object' &&
      'createdAt' in cacheMetadata
    ) {
      const age = Date.now() - cacheMetadata.createdAt;
      const halfLife = ttl / 2;

      if (age > halfLife) {
        // Schedule refresh in background (don't await)
        setImmediate(async () => {
          try {
            this.logger.info('Background refresh started', { cacheKey });
            const freshData = await refreshFunction();
            await cacheManager.set(cacheKey, freshData, { ttl });
            this.logger.info('Background refresh completed', { cacheKey });
          } catch (error) {
            this.logger.warn('Background refresh failed', {
              cacheKey,
              error: (error as Error).message,
            });
          }
        });
      }
    }
  }

  /**
   * Warm cache for all sprint-related data after sprint completion
   */
  async warmSprintCache(
    sprintId: string,
    githubOwner: string,
    githubRepo: string
  ): Promise<void> {
    const cacheManager = this.mcpServer.getContext().cacheManager;

    this.logger.info('Warming sprint cache', {
      sprintId,
      githubOwner,
      githubRepo,
    });

    try {
      // Warm issues cache
      const issues = await this.mcpBridge.callTool('jira_get_sprint_issues', {
        sprint_id: sprintId,
      });
      await cacheManager.set(`sprint:${sprintId}:issues:all:100`, issues, {
        ttl: 7200000,
      }); // 2 hours for closed

      // Warm comprehensive report cache
      const comprehensiveParams = {
        sprint_id: sprintId,
        github_owner: githubOwner,
        github_repo: githubRepo,
        format: 'json',
        include_commits: true,
        include_prs: true,
        include_velocity: true,
        include_burndown: true,
        theme: 'default',
        include_tier1: true,
        include_tier2: true,
        include_tier3: true,
        include_forward_looking: true,
        include_enhanced_github: true,
      };

      const comprehensiveReport =
        await this.mcpBridge.generateComprehensiveReport(
          sprintId,
          comprehensiveParams
        );
      const cacheKey = `comprehensive:${sprintId}:${githubOwner}:${githubRepo}:true:true:true:true:true`;
      await cacheManager.set(cacheKey, comprehensiveReport, { ttl: 7200000 }); // 2 hours

      this.logger.info('Sprint cache warmed successfully', { sprintId });
    } catch (error) {
      this.logger.logError(error as Error, 'warm_sprint_cache', { sprintId });
      throw error;
    }
  }

  /**
   * Invalidate cache for specific issue and related sprints
   */
  async invalidateIssueCache(issue: any, changelog: any): Promise<void> {
    try {
      // Find all sprints this issue belongs to
      const sprintIds: string[] = [];

      if (issue.fields?.sprint) {
        sprintIds.push(issue.fields.sprint.id);
      }

      // Check changelog for sprint changes
      if (changelog?.items) {
        for (const item of changelog.items) {
          if (item.field === 'Sprint' && item.to) {
            sprintIds.push(item.to);
          }
          if (item.field === 'Sprint' && item.from) {
            sprintIds.push(item.from);
          }
        }
      }

      // Invalidate cache for all affected sprints
      for (const sprintId of [...new Set(sprintIds)]) {
        await this.invalidateSprintCache(sprintId);
      }

      this.logger.info('Issue cache invalidated', {
        issueKey: issue.key,
        sprintIds,
      });
    } catch (error) {
      this.logger.logError(error as Error, 'invalidate_issue_cache', {
        issueKey: issue.key,
      });
    }
  }

  /**
   * Invalidate all cache entries for a specific sprint
   */
  async invalidateSprintCache(sprintId: string): Promise<void> {
    const cacheManager = this.mcpServer.getContext().cacheManager;

    try {
      // Invalidate all sprint-related cache keys
      const patterns = [
        `sprint:${sprintId}:issues:*`,
        `sprint:${sprintId}:metrics:*`,
        `comprehensive:${sprintId}:*`,
        `sprint:${sprintId}:state`,
      ];

      // Delete each pattern (cache manager should support pattern deletion)
      for (const pattern of patterns) {
        // Try to delete - some cache managers support pattern matching
        try {
          await cacheManager.delete(pattern);
        } catch (err) {
          // If pattern deletion not supported, log and continue
          this.logger.debug('Pattern deletion not supported or failed', {
            pattern,
          });
        }
      }

      this.logger.info('Sprint cache invalidated', { sprintId, patterns });
    } catch (error) {
      this.logger.logError(error as Error, 'invalidate_sprint_cache', {
        sprintId,
      });
    }
  }
}
