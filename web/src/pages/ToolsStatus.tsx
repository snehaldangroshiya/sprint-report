import { useQuery } from '@tanstack/react-query';
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
  const { data: health, refetch: refetchHealth } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 30000,
  });

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: api.getMetrics,
    refetchInterval: 60000,
  });

  // MCP Tools Status (12 total)
  const mcpTools: ToolStatus[] = [
    // Jira Tools (4)
    { name: 'jira_get_sprints', category: 'Jira', available: true, description: 'List sprints for board', icon: BarChart3 },
    { name: 'jira_get_sprint_issues', category: 'Jira', available: true, description: 'Get sprint issues', icon: FileText },
    { name: 'jira_get_issue_details', category: 'Jira', available: true, description: 'Detailed issue info', icon: FileText },
    { name: 'jira_get_board_config', category: 'Jira', available: true, description: 'Board configuration', icon: Database },

    // GitHub Tools (4)
    { name: 'github_get_commits', category: 'GitHub', available: true, description: 'List commits', icon: GitBranch },
    { name: 'github_get_prs', category: 'GitHub', available: true, description: 'List pull requests', icon: GitBranch },
    { name: 'github_get_commit_details', category: 'GitHub', available: true, description: 'Commit details', icon: GitBranch },
    { name: 'github_get_pr_details', category: 'GitHub', available: true, description: 'PR details', icon: GitBranch },

    // Report Tools (4)
    { name: 'create_sprint_report', category: 'Reports', available: true, description: 'Generate sprint report', icon: FileText },
    { name: 'generate_release_notes', category: 'Reports', available: true, description: 'Create release notes', icon: FileText },
    { name: 'analyze_sprint_velocity', category: 'Analytics', available: true, description: 'Velocity metrics', icon: Zap },
    { name: 'get_sprint_health', category: 'Analytics', available: true, description: 'Sprint health check', icon: Activity },
  ];

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
            Monitor all 12 MCP tools and system health in real-time
          </p>
        </div>
        <Button
          onClick={() => refetchHealth()}
          variant="outline"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Status
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
            <dd className="mt-1 text-lg font-semibold text-gray-900">12 MCP Tools</dd>
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
