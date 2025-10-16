import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle, XCircle, Clock, Activity, RefreshCw,
  Database, GitBranch, FileText, BarChart3, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '../lib/api';

interface ToolStatus {
  name: string;
  category: string;
  available: boolean;
  lastUsed?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function ToolsStatus() {
  const queryClient = useQueryClient();

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 30000,
  });

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: api.getMetrics,
    refetchInterval: 60000,
  });

  // Fetch MCP tools from API
  const { data: mcpToolsData, isLoading: toolsLoading } = useQuery({
    queryKey: ['mcp-tools'],
    queryFn: api.getMCPTools,
    refetchInterval: 60000,
  });

  // Fetch cache stats for system info
  const { data: cacheStats } = useQuery({
    queryKey: ['cache-stats'],
    queryFn: api.getCacheStats,
    refetchInterval: 30000,
  });

  // Mutation to refresh MCP tools (clears cache and gets fresh data)
  const refreshMutation = useMutation({
    mutationFn: api.refreshMCPTools,
    onSuccess: () => {
      // Invalidate and refetch all queries
      queryClient.invalidateQueries({ queryKey: ['health'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['mcp-tools'] });
      queryClient.invalidateQueries({ queryKey: ['cache-stats'] });
    },
  });

  // Icon mapping helper
  const getIconForTool = (name: string): React.ComponentType<{ className?: string }> => {
    if (name.includes('jira')) {
      if (name.includes('sprint') && !name.includes('issue')) return BarChart3;
      if (name.includes('issue') || name.includes('search')) return FileText;
      return Database;
    }
    if (name.includes('github')) return GitBranch;
    if (name.includes('report')) return FileText;
    if (name.includes('metrics')) return Zap;
    if (name.includes('health')) return Activity;
    if (name.includes('cache')) return Database;
    return FileText;
  };

  // Category mapping helper
  const getCategoryForTool = (name: string): string => {
    if (name.startsWith('jira_')) return 'Jira';
    if (name.startsWith('github_')) return 'GitHub';
    if (name.includes('report') || name.includes('metrics')) return 'Reports';
    return 'Utility';
  };

  // Map API tools to ToolStatus format
  const mcpTools: ToolStatus[] = mcpToolsData?.tools.map(tool => ({
    name: tool.name,
    category: getCategoryForTool(tool.name),
    available: true,
    description: tool.description,
    icon: getIconForTool(tool.name),
  })) || [];

  const groupedTools = mcpTools.reduce((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, ToolStatus[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Tools & System Status</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {toolsLoading 
              ? 'Loading MCP tools...' 
              : `Monitor all ${mcpToolsData?.count || 0} MCP tools and system health in real-time`
            }
          </p>
        </div>
        <Button
          onClick={() => refreshMutation.mutate()}
          variant="outline"
          disabled={refreshMutation.isPending || toolsLoading}
          className="w-full md:w-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          {refreshMutation.isPending ? 'Refreshing...' : 'Refresh Status'}
        </Button>
      </div>

      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Real-time status of all services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Overall Status */}
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
              {health?.status === 'healthy' ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-destructive" />
              )}
              <div>
                <p className="text-sm font-medium">Overall</p>
                <p className="text-lg font-semibold capitalize">{health?.status || 'Loading...'}</p>
              </div>
            </div>

            {/* Jira Service */}
            {health?.services?.jira && (
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                {health.services.jira.healthy ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <XCircle className="h-8 w-8 text-destructive" />
                )}
                <div>
                  <p className="text-sm font-medium">Jira</p>
                  <p className="text-sm text-muted-foreground">
                    {health.services.jira.latency}ms
                  </p>
              </div>
            </div>
          )}

          {/* GitHub Service */}
          {health?.services?.github && (
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-card">
              {health.services.github.healthy ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-destructive" />
              )}
              <div>
                <p className="text-sm font-medium">GitHub</p>
                <p className="text-sm text-muted-foreground">
                  {health.services.github.latency}ms
                </p>
              </div>
            </div>
          )}

          {/* Cache Service */}
          {health?.services?.cache && (
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-card">
              {health.services.cache.healthy ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-destructive" />
              )}
              <div>
                <p className="text-sm font-medium">Cache</p>
                <p className="text-sm text-muted-foreground">
                  {health.services.cache.latency}ms
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Performance Metrics */}
        {metrics && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-accent rounded-lg border">
              <p className="text-sm font-medium">Cache Hit Rate</p>
              <p className="text-2xl font-bold">
                {metrics.summary?.cacheHitRate ? Math.round(metrics.summary.cacheHitRate) : 0}%
              </p>
            </div>
            <div className="p-4 bg-accent rounded-lg border">
              <p className="text-sm font-medium">Memory Trend</p>
              <p className="text-lg font-semibold capitalize">
                {metrics.summary?.memoryTrend || 'stable'}
              </p>
            </div>
            <div className="p-4 bg-accent rounded-lg border">
              <p className="text-sm font-medium">Uptime</p>
              <p className="text-lg font-semibold">
                {health?.uptime ? Math.floor(health.uptime / 1000 / 60) : 0} min
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

      {/* MCP Tools Status by Category */}
      {Object.entries(groupedTools).map(([category, tools]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>
              {category} Tools ({tools.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.name}
                    className="flex items-start gap-3 p-4 border rounded-lg bg-card hover:bg-accent transition-colors"
                  >
                    <div className={`p-2 rounded-lg border ${
                      tool.available
                        ? 'bg-green-50 text-green-600 border-green-200'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">
                          {tool.name}
                        </p>
                        {tool.available ? (
                          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tool.description}
                      </p>
                      {tool.lastUsed && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last used: {new Date(tool.lastUsed).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 bg-card">
              <dt className="text-sm font-medium text-muted-foreground">MCP Protocol</dt>
              <dd className="mt-1 text-lg font-semibold">
                stdio (Standard)
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                Model Context Protocol via stdin/stdout
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-card">
              <dt className="text-sm font-medium text-muted-foreground">Total Tools</dt>
              <dd className="mt-1 text-lg font-semibold">
                {toolsLoading ? 'Loading...' : `${mcpToolsData?.count || 0} MCP Tools`}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                Registered and available
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-card">
              <dt className="text-sm font-medium text-muted-foreground">API Server</dt>
              <dd className="mt-1 text-lg font-semibold">
                {typeof window !== 'undefined' 
                  ? window.location.origin.replace(':3001', ':3000')
                  : 'http://localhost:3000'}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                Backend API endpoint
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-card">
              <dt className="text-sm font-medium text-muted-foreground">Cache Strategy</dt>
              <dd className="mt-1 text-lg font-semibold">
                {cacheStats?.redis?.connected 
                  ? 'Memory + Redis' 
                  : 'Memory Only'}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                {cacheStats?.redis?.connected 
                  ? `Redis connected (${cacheStats.redis.keys} keys)` 
                  : 'Redis unavailable, using in-memory cache'}
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-card">
              <dt className="text-sm font-medium text-muted-foreground">Cache Hit Rate</dt>
              <dd className="mt-1 text-lg font-semibold">
                {cacheStats?.stats.hitRate !== undefined
                  ? `${cacheStats.stats.hitRate.toFixed(1)}%`
                  : 'N/A'}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                {cacheStats?.stats.totalRequests 
                  ? `${cacheStats.stats.hits}/${cacheStats.stats.totalRequests} requests`
                  : 'No cache activity yet'}
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-card">
              <dt className="text-sm font-medium text-muted-foreground">System Uptime</dt>
              <dd className="mt-1 text-lg font-semibold">
                {health?.uptime 
                  ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`
                  : 'N/A'}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                Server running time
              </p>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
