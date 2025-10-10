import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { BarChart3, Activity, CheckCircle, TrendingUp, Target, Calendar, Database, Github, Zap, AlertTriangle, ArrowUp, ArrowDown, Minus, Lightbulb } from 'lucide-react';
import { api } from '../lib/api';
import { combineAndSortSprints } from '../lib/sprint-utils';
import { useConfiguration } from '../contexts/ConfigurationContext';
import { ConfigurationCard } from '../components/ConfigurationCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Separator } from '../components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

export function Dashboard() {
  // State for number of sprints to show
  const [sprintCount, setSprintCount] = useState(5);

  // Get configuration from context
  const { config } = useConfiguration();

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: api.getMetrics,
    refetchInterval: 60000, // Check every minute
  });

  // Fetch system status for Jira, GitHub, Cache
  const { data: systemStatus, isLoading: systemStatusLoading } = useQuery({
    queryKey: ['system-status'],
    queryFn: api.getSystemStatus,
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Use configured board ID instead of fetching all boards
  const boardId = config.jira.boardId;

  // Fetch active sprint using configured board
  const { data: activeSprints } = useQuery({
    queryKey: ['active-sprints', boardId],
    queryFn: () => api.getSprints(boardId, 'active'),
    enabled: !!boardId,
  });

  // Fetch recent closed sprints using configured board
  const { data: closedSprints } = useQuery({
    queryKey: ['closed-sprints', boardId],
    queryFn: () => api.getSprints(boardId, 'closed'),
    enabled: !!boardId,
  });

  // Combine active and closed sprints, sorted by start date descending (newest first)
  const recentSprints = combineAndSortSprints(activeSprints, closedSprints, sprintCount);

  const sprintsLoading = !boardId;

  // Fetch velocity data for quick stats
  const { data: velocityData, isLoading: velocityLoading } = useQuery({
    queryKey: ['velocity-stats', boardId],
    queryFn: () => api.getVelocityData(boardId, 5),
    enabled: !!boardId,
  });


  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor sprint reporting system status and generate reports
        </p>
      </div>

      {/* Configuration Card */}
      <ConfigurationCard />

      <Separator className="my-6" />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Sprint */}
        {sprintsLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <Card className="bg-white border border-blue-100 hover:border-blue-300 transition-all duration-200 hover:shadow-lg overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <Calendar className="h-7 w-7 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Sprint</p>
                    <p className="text-2xl font-bold text-gray-900 truncate max-w-[180px]">
                      {activeSprints && activeSprints.length > 0
                        ? activeSprints[0].name
                        : 'None'}
                    </p>
                    {activeSprints && activeSprints.length > 0 && (
                      <p className="text-xs text-blue-600 font-medium mt-1">
                        {activeSprints[0].state.toLowerCase() === 'active' ? 'In Progress' : 'Upcoming'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Average Velocity */}
        {velocityLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <Card className="bg-white border border-emerald-100 hover:border-emerald-300 transition-all duration-200 hover:shadow-lg overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-emerald-50 rounded-xl">
                    <TrendingUp className="h-7 w-7 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Average Velocity</p>
                    <p className="text-3xl font-bold text-gray-900">{velocityData?.average?.toFixed(1) || '0'}</p>
                    <p className="text-xs text-emerald-600 font-medium mt-1">Story points/sprint</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completion Rate */}
        {velocityLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <Card className="bg-white border border-violet-100 hover:border-violet-300 transition-all duration-200 hover:shadow-lg overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-violet-50 rounded-xl">
                    <Target className="h-7 w-7 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {velocityData?.sprints && velocityData.sprints.length > 0
                        ? (() => {
                            const total = velocityData.sprints.reduce((sum, s) => sum + s.commitment, 0);
                            const completed = velocityData.sprints.reduce((sum, s) => sum + s.completed, 0);
                            return total > 0 ? Math.round((completed / total) * 100) : 0;
                          })()
                        : 0}%
                    </p>
                    <p className="text-xs text-violet-600 font-medium mt-1">Last 5 sprints</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Total Sprints Tracked */}
        {sprintsLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <Card className="bg-white border border-amber-100 hover:border-amber-300 transition-all duration-200 hover:shadow-lg overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-amber-50 rounded-xl">
                    <Database className="h-7 w-7 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Sprints Tracked</p>
                    <p className="text-3xl font-bold text-gray-900">{recentSprints?.length || 0}</p>
                    <p className="text-xs text-amber-600 font-medium mt-1">Recent sprints</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeSprints && activeSprints.length > 0 ? (
          <Link
            to={`/sprint/${activeSprints[0].id}`}
            className="relative rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white px-6 py-5 shadow-sm hover:border-blue-400 hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-blue-100 rounded-lg">
                <Target className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  View Active Sprint
                </h3>
                <p className="text-sm text-gray-600">
                  {activeSprints[0].name}
                </p>
              </div>
            </div>
          </Link>
        ) : (
          <div className="relative rounded-lg border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-white px-6 py-5 shadow-sm opacity-60">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-gray-100 rounded-lg">
                <Target className="h-8 w-8 text-gray-400" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  No Active Sprint
                </h3>
                <p className="text-sm text-gray-600">
                  Start a sprint to view details
                </p>
              </div>
            </div>
          </div>
        )}

        <Link
          to="/velocity"
          className="relative rounded-lg border-2 border-green-200 bg-gradient-to-br from-green-50 to-white px-6 py-5 shadow-sm hover:border-green-400 hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0 p-3 bg-green-100 rounded-lg">
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Sprint Velocity
              </h3>
              <p className="text-sm text-gray-600">
                Track velocity trends & metrics
              </p>
            </div>
          </div>
        </Link>

        <Link
          to="/tools"
          className="relative rounded-lg border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white px-6 py-5 shadow-sm hover:border-purple-400 hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0 p-3 bg-purple-100 rounded-lg">
              <Activity className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">
                MCP Tools Status
              </h3>
              <p className="text-sm text-gray-600">
                Monitor 12 MCP tools & health
              </p>
            </div>
          </div>
        </Link>
      </div>

      <Separator className="my-6" />

      {/* System Status - Jira, GitHub, Cache */}
      {systemStatusLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : systemStatus ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2 text-blue-600" />
              System Status
            </CardTitle>
            <CardDescription>
              Health monitoring for Jira, GitHub, and Cache services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Jira Status */}
              <div className="border-2 rounded-lg p-4 transition-all hover:shadow-md" style={{
                borderColor: systemStatus.jira.status === 'healthy' ? '#10b981' : systemStatus.jira.status === 'degraded' ? '#f59e0b' : '#ef4444'
              }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg ${
                      systemStatus.jira.status === 'healthy' ? 'bg-green-100' :
                      systemStatus.jira.status === 'degraded' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      <Activity className={`h-5 w-5 ${
                        systemStatus.jira.status === 'healthy' ? 'text-green-600' :
                        systemStatus.jira.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                      }`} />
                    </div>
                    <h4 className="ml-3 text-lg font-semibold text-gray-900">Jira</h4>
                  </div>
                  <Badge
                    variant={
                      systemStatus.jira.status === 'healthy' ? 'default' :
                      systemStatus.jira.status === 'degraded' ? 'secondary' :
                      'destructive'
                    }
                    className="capitalize"
                  >
                    {systemStatus.jira.status}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">
                    Status: <span className="capitalize font-semibold">{systemStatus.jira.status}</span>
                  </p>
                  {systemStatus.jira.latency !== undefined && (
                    <p className="text-sm text-gray-600">
                      Latency: <span className="font-semibold">{systemStatus.jira.latency}ms</span>
                    </p>
                  )}
                  {systemStatus.jira.error && (
                    <p className="text-xs text-red-600 mt-2">{systemStatus.jira.error}</p>
                  )}
                </div>
              </div>

              {/* GitHub Status */}
              <div className="border-2 rounded-lg p-4 transition-all hover:shadow-md" style={{
                borderColor: systemStatus.github.status === 'healthy' ? '#10b981' : systemStatus.github.status === 'degraded' ? '#f59e0b' : '#ef4444'
              }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg ${
                      systemStatus.github.status === 'healthy' ? 'bg-green-100' :
                      systemStatus.github.status === 'degraded' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      <Github className={`h-5 w-5 ${
                        systemStatus.github.status === 'healthy' ? 'text-green-600' :
                        systemStatus.github.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                      }`} />
                    </div>
                    <h4 className="ml-3 text-lg font-semibold text-gray-900">GitHub</h4>
                  </div>
                  <Badge
                    variant={
                      systemStatus.github.status === 'healthy' ? 'default' :
                      systemStatus.github.status === 'degraded' ? 'secondary' :
                      'destructive'
                    }
                    className="capitalize"
                  >
                    {systemStatus.github.status}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">
                    Status: <span className="capitalize font-semibold">{systemStatus.github.status}</span>
                  </p>
                  {systemStatus.github.latency !== undefined && (
                    <p className="text-sm text-gray-600">
                      Latency: <span className="font-semibold">{systemStatus.github.latency}ms</span>
                    </p>
                  )}
                  {systemStatus.github.error && (
                    <p className="text-xs text-red-600 mt-2">{systemStatus.github.error}</p>
                  )}
                </div>
              </div>

              {/* Cache Status */}
              <div className="border-2 rounded-lg p-4 transition-all hover:shadow-md" style={{
                borderColor: systemStatus.cache.status === 'healthy' ? '#10b981' : systemStatus.cache.status === 'degraded' ? '#f59e0b' : '#ef4444'
              }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg ${
                      systemStatus.cache.status === 'healthy' ? 'bg-green-100' :
                      systemStatus.cache.status === 'degraded' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      <Database className={`h-5 w-5 ${
                        systemStatus.cache.status === 'healthy' ? 'text-green-600' :
                        systemStatus.cache.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                      }`} />
                    </div>
                    <h4 className="ml-3 text-lg font-semibold text-gray-900">Cache</h4>
                  </div>
                  <Badge
                    variant={
                      systemStatus.cache.status === 'healthy' ? 'default' :
                      systemStatus.cache.status === 'degraded' ? 'secondary' :
                      'destructive'
                    }
                    className="capitalize"
                  >
                    {systemStatus.cache.status}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">
                    Status: <span className="capitalize font-semibold">{systemStatus.cache.status}</span>
                  </p>
                  {systemStatus.cache.hitRate !== undefined && (
                    <p className="text-sm text-gray-600">
                      Hit Rate: <span className="font-semibold">{(systemStatus.cache.hitRate * 100).toFixed(1)}%</span>
                    </p>
                  )}
                  {systemStatus.cache.size !== undefined && (
                    <p className="text-sm text-gray-600">
                      Size: <span className="font-semibold">{systemStatus.cache.size} entries</span>
                    </p>
                  )}
                  {systemStatus.cache.error && (
                    <p className="text-xs text-red-600 mt-2">{systemStatus.cache.error}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Separator className="my-6" />

      {/* Performance Metrics - Enhanced */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="h-5 w-5 mr-2 text-blue-600" />
              Performance Metrics
            </CardTitle>
            <CardDescription>
              System performance insights and cache efficiency metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Cache Hit Rate */}
              {metrics.summary && metrics.summary.cacheHitRate !== undefined && (
                <div className="border-2 rounded-lg p-4 transition-all hover:shadow-md" style={{
                  borderColor: metrics.summary.cacheHitRate >= 80 ? '#10b981' :
                               metrics.summary.cacheHitRate >= 50 ? '#f59e0b' : '#ef4444'
                }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg ${
                        metrics.summary.cacheHitRate >= 80 ? 'bg-green-100' :
                        metrics.summary.cacheHitRate >= 50 ? 'bg-yellow-100' : 'bg-red-100'
                      }`}>
                        <Database className={`h-5 w-5 ${
                          metrics.summary.cacheHitRate >= 80 ? 'text-green-600' :
                          metrics.summary.cacheHitRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                        }`} />
                      </div>
                      <h4 className="ml-3 text-lg font-semibold text-gray-900">Cache Efficiency</h4>
                    </div>
                    <Badge
                      variant={
                        metrics.summary.cacheHitRate >= 80 ? 'default' :
                        metrics.summary.cacheHitRate >= 50 ? 'secondary' :
                        'destructive'
                      }
                    >
                      {metrics.summary.cacheHitRate >= 80 ? 'Excellent' :
                       metrics.summary.cacheHitRate >= 50 ? 'Good' : 'Needs Attention'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-600">Hit Rate</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {Math.round(metrics.summary.cacheHitRate)}%
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          metrics.summary.cacheHitRate >= 80 ? 'bg-green-600' :
                          metrics.summary.cacheHitRate >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                        }`}
                        style={{ width: `${Math.round(metrics.summary.cacheHitRate)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {metrics.summary.cacheHitRate >= 80 ? 'Cache is performing optimally' :
                       metrics.summary.cacheHitRate >= 50 ? 'Cache performance is acceptable' :
                       'Consider reviewing cache configuration'}
                    </p>
                  </div>
                </div>
              )}

              {/* Memory Trend */}
              {metrics.summary && metrics.summary.memoryTrend && (
                <div className={`border-2 rounded-lg p-4 transition-all hover:shadow-md ${
                  metrics.summary.memoryTrend === 'increasing' ? 'border-red-100' :
                  metrics.summary.memoryTrend === 'decreasing' ? 'border-green-100' :
                  'border-gray-100'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg ${
                        metrics.summary.memoryTrend === 'increasing' ? 'bg-red-100' :
                        metrics.summary.memoryTrend === 'decreasing' ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {metrics.summary.memoryTrend === 'increasing' ? (
                          <ArrowUp className="h-5 w-5 text-red-600" />
                        ) : metrics.summary.memoryTrend === 'decreasing' ? (
                          <ArrowDown className="h-5 w-5 text-green-600" />
                        ) : (
                          <Minus className="h-5 w-5 text-gray-600" />
                        )}
                      </div>
                      <h4 className="ml-3 text-lg font-semibold text-gray-900">Memory Usage</h4>
                    </div>
                    <Badge
                      variant={
                        metrics.summary.memoryTrend === 'decreasing' ? 'default' :
                        metrics.summary.memoryTrend === 'stable' ? 'secondary' :
                        'destructive'
                      }
                      className={
                        metrics.summary.memoryTrend === 'decreasing' ? 'bg-green-500' :
                        metrics.summary.memoryTrend === 'stable' ? '' : ''
                      }
                    >
                      {metrics.summary.memoryTrend === 'increasing' ? 'Increasing' :
                       metrics.summary.memoryTrend === 'decreasing' ? 'Optimizing' : 'Stable'}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-600">
                      Trend: <span className={`capitalize font-semibold ${
                        metrics.summary.memoryTrend === 'increasing' ? 'text-red-600' :
                        metrics.summary.memoryTrend === 'decreasing' ? 'text-green-600' :
                        'text-gray-600'
                      }`}>
                        {metrics.summary.memoryTrend}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {metrics.summary.memoryTrend === 'increasing' ?
                        '⚠️ Memory usage is growing. Monitor for potential leaks.' :
                       metrics.summary.memoryTrend === 'decreasing' ?
                        '✓ Memory is being freed efficiently.' :
                        'ℹ️ Memory usage remains consistent.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Cache Optimization Recommendations */}
              {metrics.cacheOptimization && (
                <div className="border-2 border-purple-100 rounded-lg p-4 transition-all hover:shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="p-2 rounded-lg bg-purple-100">
                        <Lightbulb className="h-5 w-5 text-purple-600" />
                      </div>
                      <h4 className="ml-3 text-lg font-semibold text-gray-900">Optimization</h4>
                    </div>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                      {metrics.cacheOptimization.recommendations?.length || 0} Tips
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-600">
                      Available Recommendations
                    </p>
                    <p className="text-3xl font-bold text-purple-600">
                      {metrics.cacheOptimization.recommendations?.length || 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {(metrics.cacheOptimization.recommendations?.length || 0) > 0 ?
                        '💡 View suggestions to improve performance' :
                        '✓ System is optimally configured'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Recommendations List */}
            {metrics.cacheOptimization && metrics.cacheOptimization.recommendations &&
             metrics.cacheOptimization.recommendations.length > 0 && (
              <div className="mt-6 p-4 bg-purple-50 border-l-4 border-purple-500 rounded-lg">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-purple-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">
                      Performance Optimization Suggestions
                    </h4>
                    <ul className="space-y-2">
                      {metrics.cacheOptimization.recommendations.slice(0, 3).map((rec, idx) => (
                        <li key={idx} className="flex items-start text-sm text-gray-700">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 mr-2 flex-shrink-0"></span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                    {metrics.cacheOptimization.recommendations.length > 3 && (
                      <p className="text-xs text-purple-600 mt-2 font-medium">
                        +{metrics.cacheOptimization.recommendations.length - 3} more recommendations
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Separator className="my-6" />

      {/* Recent Sprint Activity */}
      {sprintsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      ) : recentSprints && recentSprints.length > 0 ? (
        <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-green-500">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-green-600" />
                Recent Sprint Activity
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Show:</span>
                <Select value={sprintCount.toString()} onValueChange={(value) => setSprintCount(Number(value))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="5 sprints" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 sprints</SelectItem>
                    <SelectItem value="5">5 sprints</SelectItem>
                    <SelectItem value="10">10 sprints</SelectItem>
                    <SelectItem value="15">15 sprints</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flow-root">
              <ul className="-mb-8">
                {recentSprints.slice(0, sprintCount).map((sprint, idx) => {
                  const isActive = sprint.state.toLowerCase() === 'active';
                  const sprintEndDate = sprint.endDate ? new Date(sprint.endDate) : null;
                  const sprintStartDate = sprint.startDate ? new Date(sprint.startDate) : null;

                  // Calculate relative time
                  let relativeTime = null;
                  if (isActive && sprintEndDate) {
                    const daysUntilEnd = Math.ceil((sprintEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    if (daysUntilEnd > 0) {
                      relativeTime = `${daysUntilEnd} day${daysUntilEnd !== 1 ? 's' : ''} remaining`;
                    } else if (daysUntilEnd === 0) {
                      relativeTime = 'Ends today';
                    } else {
                      relativeTime = 'Overdue';
                    }
                  } else if (!isActive && sprintEndDate) {
                    const daysAgo = Math.floor((Date.now() - sprintEndDate.getTime()) / (1000 * 60 * 60 * 24));
                    relativeTime = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;
                  }

                  return (
                    <li key={sprint.id}>
                      <div className="relative pb-8">
                        {idx !== Math.min(sprintCount - 1, recentSprints.length - 1) && (
                          <span
                            className={`absolute top-4 left-4 -ml-px h-full w-0.5 ${
                              isActive ? 'bg-blue-200' : 'bg-gray-200'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full ${
                              isActive
                                ? 'bg-blue-500 ring-4 ring-blue-100'
                                : 'bg-green-100'
                            } flex items-center justify-center ring-8 ring-white`}>
                              {isActive ? (
                                <Activity className="h-5 w-5 text-white" />
                              ) : (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              )}
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-medium ${
                                  isActive ? 'text-blue-700' : 'text-gray-900'
                                }`}>
                                  {sprint.name}
                                </p>
                                {isActive && (
                                  <Badge variant="default" className="bg-blue-500 text-white text-xs">
                                    Active
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 mt-1">
                                <span className="capitalize">{sprint.state}</span>
                                {sprintStartDate && sprintEndDate && (
                                  <> • {sprintStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {sprintEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                                )}
                                {relativeTime && (
                                  <> • <span className={isActive ? 'text-blue-600 font-medium' : 'text-gray-400'}>
                                    {relativeTime}
                                  </span></>
                                )}
                              </p>
                            </div>
                            <div className="whitespace-nowrap text-right text-sm">
                              <Link to={`/sprint/${sprint.id}`} className="text-blue-600 hover:text-blue-800 font-medium hover:underline">
                                View Details →
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
