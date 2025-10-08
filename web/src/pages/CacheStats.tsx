import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Database, TrendingUp, Activity, HardDrive, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getCacheStats } from '@/lib/api';

export function CacheStats() {
  const { data: cacheStats, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['cache-stats'],
    queryFn: getCacheStats,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!cacheStats) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load cache statistics. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { stats, memory, redis, performance } = cacheStats;
  const hitRateColor = stats.hitRate >= 80 ? 'text-green-600' : stats.hitRate >= 50 ? 'text-yellow-600' : 'text-red-600';
  const hitRateBgColor = stats.hitRate >= 80 ? 'bg-green-500' : stats.hitRate >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cache Statistics</h1>
          <p className="text-gray-500 mt-1">
            Monitor cache performance and hit rates
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          disabled={isRefetching}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Hit Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hit Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${hitRateColor}`}>
              {stats.hitRate.toFixed(1)}%
            </div>
            <Progress value={stats.hitRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.hits} hits / {stats.totalRequests} requests
            </p>
          </CardContent>
        </Card>

        {/* Total Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {stats.misses} misses
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {stats.errors} errors
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Memory Usage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memory.sizeMB} MB</div>
            <Progress value={parseFloat(memory.utilizationPercent)} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {memory.keys} / {memory.maxKeys} keys ({memory.utilizationPercent}%)
            </p>
          </CardContent>
        </Card>

        {/* Redis Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redis Cache</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {redis ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant={redis.connected ? "default" : "destructive"} className={redis.connected ? "bg-green-500" : ""}>
                    {redis.connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <p className="text-2xl font-bold mt-2">{redis.keys.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">keys stored</p>
              </>
            ) : (
              <>
                <Badge variant="secondary">Not Configured</Badge>
                <p className="text-xs text-muted-foreground mt-2">Memory-only caching</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cache Operations */}
        <Card>
          <CardHeader>
            <CardTitle>Cache Operations</CardTitle>
            <CardDescription>Breakdown of cache activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Cache Hits</span>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold">{stats.hits.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">
                  ~{performance.averageHitLatency}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pb-2 border-b">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Cache Misses</span>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold">{stats.misses.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">
                  ~{performance.averageMissLatency}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pb-2 border-b">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Cache Sets</span>
              </div>
              <div className="text-xl font-bold">{stats.sets.toLocaleString()}</div>
            </div>

            <div className="flex justify-between items-center pb-2 border-b">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Cache Deletes</span>
              </div>
              <div className="text-xl font-bold">{stats.deletes.toLocaleString()}</div>
            </div>

            {stats.errors > 0 && (
              <div className="flex justify-between items-center pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-600">Errors</span>
                </div>
                <div className="text-xl font-bold text-red-600">{stats.errors.toLocaleString()}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Insights</CardTitle>
            <CardDescription>Cache efficiency analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cache Efficiency</span>
                <span className={`font-semibold ${hitRateColor}`}>
                  {stats.hitRate >= 80 ? 'Excellent' : stats.hitRate >= 50 ? 'Good' : 'Poor'}
                </span>
              </div>
              <Progress value={stats.hitRate} className={hitRateBgColor} />
            </div>

            <div className="pt-4 space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm">Memory Utilization</span>
                <Badge variant="secondary">{memory.utilizationPercent}%</Badge>
              </div>

              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm">Total Keys Cached</span>
                <Badge variant="secondary">{memory.keys.toLocaleString()}</Badge>
              </div>

              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm">Cache Size</span>
                <Badge variant="secondary">{memory.sizeMB} MB</Badge>
              </div>

              {redis && (
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="text-sm">Redis Keys</span>
                  <Badge variant="secondary">{redis.keys.toLocaleString()}</Badge>
                </div>
              )}
            </div>

            <Alert className="mt-4">
              <AlertDescription className="text-xs">
                <strong>Tip:</strong> A hit rate above 80% indicates excellent cache performance.
                Closed sprints are cached for 30 days, active sprints for 5 minutes.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Last Updated */}
      <div className="text-center text-xs text-muted-foreground">
        Last updated: {new Date(cacheStats.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
