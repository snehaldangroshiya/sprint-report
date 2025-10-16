import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle, XCircle, Clock, Activity, RefreshCw,
  Database, GitBranch, FileText, BarChart3, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  // Mutation to refresh MCP tools (clears cache and gets fresh data)
  const refreshMutation = useMutation({
    mutationFn: api.refreshMCPTools,
    onSuccess: () => {
      // Invalidate and refetch all queries
      queryClient.invalidateQueries({ queryKey: ['health'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['mcp-tools'] });
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MCP Tools & System Status</h1>
          <p className="mt-1 text-sm text-gray-500">
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
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          {refreshMutation.isPending ? 'Refreshing...' : 'Refresh Status'}
        </Button>
      </div>

      {/* System Health Overview */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">System Health</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Overall Status */}
          <div className="flex items-center space-x-3 p-4 border rounded-lg">
            {health?.status === 'healthy' ? (
              <CheckCircle className="h-8 w-8 text-green-500" />
            ) : (
              <XCircle className="h-8 w-8 text-red-500" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">Overall</p>
              <p className="text-lg font-semibold capitalize">{health?.status || 'Loading...'}</p>
            </div>
          </div>

          {/* Jira Service */}
          {health?.services?.jira && (
            <div className="flex items-center space-x-3 p-4 border rounded-lg">
              {health.services.jira.healthy ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">Jira</p>
                <p className="text-sm text-gray-500">
                  {health.services.jira.latency}ms
                </p>
              </div>
            </div>
          )}

          {/* GitHub Service */}
          {health?.services?.github && (
            <div className="flex items-center space-x-3 p-4 border rounded-lg">
              {health.services.github.healthy ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">GitHub</p>
                <p className="text-sm text-gray-500">
                  {health.services.github.latency}ms
                </p>
              </div>
            </div>
          )}

          {/* Cache Service */}
          {health?.services?.cache && (
            <div className="flex items-center space-x-3 p-4 border rounded-lg">
              {health.services.cache.healthy ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">Cache</p>
                <p className="text-sm text-gray-500">
                  {health.services.cache.latency}ms
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Performance Metrics */}
        {metrics && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-900">Cache Hit Rate</p>
              <p className="text-2xl font-bold text-blue-600">
                {metrics.summary?.cacheHitRate ? Math.round(metrics.summary.cacheHitRate) : 0}%
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm font-medium text-purple-900">Memory Trend</p>
              <p className="text-lg font-semibold text-purple-600 capitalize">
                {metrics.summary?.memoryTrend || 'stable'}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-900">Uptime</p>
              <p className="text-lg font-semibold text-green-600">
                {health?.uptime ? Math.floor(health.uptime / 1000 / 60) : 0} min
              </p>
            </div>
          </div>
        )}
      </div>

      {/* MCP Tools Status by Category */}
      {Object.entries(groupedTools).map(([category, tools]) => (
        <div key={category} className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {category} Tools ({tools.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.name}
                  className="flex items-start space-x-3 p-4 border rounded-lg hover:border-blue-300 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${
                    tool.available
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {tool.name}
                      </p>
                      {tool.available ? (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {tool.description}
                    </p>
                    {tool.lastUsed && (
                      <p className="text-xs text-gray-400 mt-1">
                        Last used: {new Date(tool.lastUsed).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* System Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">System Information</h2>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <dt className="text-sm font-medium text-gray-500">MCP Protocol</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">stdio (Standard)</dd>
          </div>
          <div className="border rounded-lg p-4">
            <dt className="text-sm font-medium text-gray-500">Total Tools</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">14 MCP Tools</dd>
          </div>
          <div className="border rounded-lg p-4">
            <dt className="text-sm font-medium text-gray-500">API Server</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">http://localhost:3000</dd>
          </div>
          <div className="border rounded-lg p-4">
            <dt className="text-sm font-medium text-gray-500">Cache Strategy</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">Memory + Redis (optional)</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
