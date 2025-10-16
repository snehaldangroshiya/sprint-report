// MCP Tools management routes
import { Router } from 'express';

import { EnhancedServerContext } from '@/server/enhanced-mcp-server';

/**
 * Create MCP tools management routes
 */
export function createMCPToolsRouter(
  getContext: () => EnhancedServerContext,
  getMCPServer: () => any
): Router {
  const router = Router();

  // List all registered MCP tools
  router.get('/mcp/tools', async (_req, res): Promise<void> => {
    try {
      const mcpServer = getMCPServer();
      const context = getContext();
      const logger = context.logger;

      // Get registered tools from the MCP server
      const toolRegistry = (mcpServer as any).toolRegistry;
      
      if (!toolRegistry) {
        res.status(500).json({ error: 'Tool registry not available' });
        return;
      }

      // Access the private tools map via reflection
      const tools = (toolRegistry as any).tools;
      
      if (!tools || !(tools instanceof Map)) {
        res.status(500).json({ error: 'Tools map not accessible' });
        return;
      }

      // Convert tools map to array
      const toolsList = Array.from(tools.entries()).map(([name, toolDef]: [string, any]) => ({
        name,
        description: toolDef.definition.description,
        inputSchema: toolDef.definition.inputSchema,
      }));

      logger.info(`Listed ${toolsList.length} MCP tools`);

      res.json({
        tools: toolsList,
        count: toolsList.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error listing MCP tools:', error);
      res.status(500).json({
        error: 'Failed to list MCP tools',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Clear all cache (Redis + Memory)
  router.post('/mcp/cache/clear', async (_req, res): Promise<void> => {
    try {
      const context = getContext();
      const logger = context.logger;
      const cacheManager = context.cacheManager;

      if (!cacheManager) {
        res.status(500).json({ error: 'Cache manager not available' });
        return;
      }

      logger.info('Clearing all cache (Redis + Memory)');

      // Clear all cache
      await cacheManager.clear();

      logger.info('Cache cleared successfully');

      res.json({
        success: true,
        message: 'All cache cleared successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({
        error: 'Failed to clear cache',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Refresh MCP tools list (clears cache and returns fresh tools)
  router.post('/mcp/tools/refresh', async (_req, res): Promise<void> => {
    try {
      const mcpServer = getMCPServer();
      const context = getContext();
      const logger = context.logger;
      const cacheManager = context.cacheManager;

      logger.info('Refreshing MCP tools list (clearing cache)');

      // Clear cache to force fresh data
      if (cacheManager) {
        await cacheManager.clear();
        logger.info('Cache cleared before tools refresh');
      }

      // Get fresh tools list
      const toolRegistry = (mcpServer as any).toolRegistry;
      
      if (!toolRegistry) {
        res.status(500).json({ error: 'Tool registry not available' });
        return;
      }

      const tools = (toolRegistry as any).tools;
      
      if (!tools || !(tools instanceof Map)) {
        res.status(500).json({ error: 'Tools map not accessible' });
        return;
      }

      const toolsList = Array.from(tools.entries()).map(([name, toolDef]: [string, any]) => ({
        name,
        description: toolDef.definition.description,
        inputSchema: toolDef.definition.inputSchema,
      }));

      logger.info(`Refreshed ${toolsList.length} MCP tools`);

      res.json({
        success: true,
        tools: toolsList,
        count: toolsList.length,
        cacheCleared: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error refreshing MCP tools:', error);
      res.status(500).json({
        error: 'Failed to refresh MCP tools',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
