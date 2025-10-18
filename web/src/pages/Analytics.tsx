import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Calendar, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { api } from '../lib/api';
import { useConfiguration } from '../contexts/ConfigurationContext';

export function Analytics() {
  // Get configuration from context
  const { config } = useConfiguration();
  const [dateRange, setDateRange] = useState('3months');

  // Use configuration for board and GitHub, but allow local overrides for view-specific changes
  const selectedBoard = config.jira.boardId;
  const githubOwner = config.github.owner;
  const githubRepo = config.github.repo;

  // Calculate sprint count based on time period
  const getSprintCount = (period: string): number => {
    switch (period) {
      case '1month': return 2;
      case '3months': return 6;
      case '6months': return 12;
      case '1year': return 24;
      default: return 10;
    }
  };

  const sprintCount = getSprintCount(dateRange);

  // Fetch velocity data - now based on sprint count from time period
  const { data: velocityData, isLoading: velocityLoading } = useQuery({
    queryKey: ['velocity', selectedBoard, sprintCount],
    queryFn: () => {
      console.log('[Analytics] Fetching velocity data:', { selectedBoard, sprintCount });
      return api.getVelocityData(selectedBoard, sprintCount);
    },
    enabled: !!selectedBoard,
  });

  // Fetch team performance data - now based on sprint count from time period
  const { data: teamPerformanceData, isLoading: teamPerformanceLoading, error: teamPerformanceError } = useQuery({
    queryKey: ['team-performance', selectedBoard, sprintCount],
    queryFn: () => api.getTeamPerformance(selectedBoard, sprintCount),
    enabled: !!selectedBoard,
  });

  // Log team performance data for debugging
  console.log('[Analytics] Team Performance:', {
    dateRange,
    sprintCount,
    loading: teamPerformanceLoading,
    error: teamPerformanceError,
    data: teamPerformanceData,
    dataLength: teamPerformanceData?.length
  });

  // Fetch issue type distribution - now from real API
  const { data: issueTypeData, isLoading: issueTypeLoading } = useQuery({
    queryKey: ['issue-types', selectedBoard, sprintCount],
    queryFn: () => api.getIssueTypeDistribution(selectedBoard, sprintCount),
    enabled: !!selectedBoard,
  });

  // Fetch commit trends (optional - only if GitHub repo is configured)
  const { data: commitTrendData, isLoading: commitTrendLoading, error: commitTrendError } = useQuery({
    queryKey: ['commit-trends', githubOwner, githubRepo, dateRange],
    queryFn: () => api.getCommitTrends(githubOwner, githubRepo, dateRange),
    enabled: !!githubOwner && !!githubRepo,
    // Optional query - don't fail if GitHub not configured
    retry: false,
    staleTime: 0, // Always refetch when dateRange changes
  });

  // Calculate real completion rate from velocity data
  const completionRate = velocityData?.sprints
    ? (() => {
        const totalCommitment = velocityData.sprints.reduce((sum, s) => sum + s.commitment, 0);
        const totalCompleted = velocityData.sprints.reduce((sum, s) => sum + s.completed, 0);
        return totalCommitment > 0 ? Math.round((totalCompleted / totalCommitment) * 100) : 0;
      })()
    : 0;

  const exportToPDF = async () => {
    try {
      const analyticsData = {
        averageVelocity: velocityData?.average,
        sprintsAnalyzed: velocityData?.sprints?.length || 0,
        completionRate,
        velocityTrend: velocityData?.trend,
        sprintComparison: velocityData?.sprints
      };

      const response = await fetch('/api/export/analytics/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          analyticsData,
          options: {
            format: 'A4',
            orientation: 'portrait'
          }
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'analytics-report.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        console.error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sprint Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Advanced insights and performance metrics for your sprints
          </p>
        </div>
        <Button onClick={exportToPDF} variant="default">
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
          <CardDescription>Current board settings and analysis time period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Current Configuration</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Board:</span>
                  <Badge variant="secondary">{config.jira.boardName}</Badge>
                  <Badge variant="outline">ID: {config.jira.boardId}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">GitHub:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {config.github.owner}/{config.github.repo}
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure these settings from the Dashboard
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="dateRange" className="text-sm font-medium">
                Time Period
              </label>
              <Select
                value={dateRange}
                onValueChange={setDateRange}
              >
                <SelectTrigger id="dateRange">
                  <SelectValue placeholder="Select time period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1month">Last Month</SelectItem>
                  <SelectItem value="3months">Last 3 Months</SelectItem>
                  <SelectItem value="6months">Last 6 Months</SelectItem>
                  <SelectItem value="1year">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Velocity
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {velocityData?.average?.toFixed(1) || '--'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Story points per sprint
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Velocity Trend
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {velocityData?.trend || '--'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Overall performance direction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Sprints Analyzed
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {velocityData?.sprints?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Completed sprints in period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completion Rate
            </CardTitle>
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completionRate > 0 ? `${completionRate}%` : '--'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {completionRate >= 80 ? 'Excellent performance' :
               completionRate >= 60 ? 'Good performance' :
               completionRate > 0 ? 'Needs improvement' : 'No data available'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Widgets Grid - Responsive 2x2 layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sprint Velocity Trend */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sprint Velocity Trend</CardTitle>
                <CardDescription>Commitment vs. completion over time (oldest → newest)</CardDescription>
              </div>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {velocityLoading ? (
              <div className="h-72 space-y-2">
                <Skeleton className="h-full w-full" />
              </div>
            ) : velocityData?.sprints && velocityData.sprints.length > 0 ? (
              <ResponsiveContainer width="100%" height={288}>
                <LineChart data={[...velocityData.sprints].reverse()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} label={{ value: 'Story Points', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.375rem'
                    }}
                    formatter={(value: number, name: string) => [
                      `${value} pts`,
                      name === 'velocity' ? 'Completed' : name === 'commitment' ? 'Committed' : name
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '14px' }} />
                  <Line
                    type="monotone"
                    dataKey="velocity"
                    name="Completed Points"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="commitment"
                    name="Committed Points"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 4 }}
                    strokeDasharray="5 5"
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center">
                <Alert variant="default" className="max-w-md">
                  <BarChart3 className="h-4 w-4" />
                  <AlertTitle>No Data Available</AlertTitle>
                  <AlertDescription>
                    Select a board from the dashboard to view velocity trends.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Performance */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Team Performance</CardTitle>
                <CardDescription>Planned vs. completed points per sprint</CardDescription>
              </div>
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {teamPerformanceLoading ? (
              <div className="h-72 space-y-2">
                <Skeleton className="h-full w-full" />
              </div>
            ) : teamPerformanceError ? (
              <div className="h-72 flex items-center justify-center">
                <Alert variant="destructive" className="max-w-md">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error Loading Data</AlertTitle>
                  <AlertDescription>
                    {teamPerformanceError instanceof Error 
                      ? teamPerformanceError.message 
                      : 'Failed to load team performance data. Please try again.'}
                  </AlertDescription>
                </Alert>
              </div>
            ) : teamPerformanceData && Array.isArray(teamPerformanceData) && teamPerformanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={288}>
                <BarChart data={teamPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.375rem'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '14px' }} />
                  <Bar dataKey="planned" name="Planned Points" fill="#6366f1" />
                  <Bar dataKey="completed" name="Completed Points" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center">
                <Alert variant="default" className="max-w-md">
                  <BarChart3 className="h-4 w-4" />
                  <AlertTitle>No Performance Data</AlertTitle>
                  <AlertDescription>
                    {selectedBoard 
                      ? `No team performance data found for the last ${sprintCount} sprints. Try selecting a different time period.`
                      : 'Select a board from the dashboard to view team performance.'}
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Code Activity Trends */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Code Activity Trends</CardTitle>
                <CardDescription>Commits and pull requests over time</CardDescription>
              </div>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {commitTrendLoading ? (
              <div className="h-72 space-y-2">
                <Skeleton className="h-full w-full" />
              </div>
            ) : commitTrendData && Array.isArray(commitTrendData) && commitTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={288}>
                <LineChart data={commitTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.375rem'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '14px' }} />
                <Line
                  type="monotone"
                  dataKey="commits"
                  name="Commits"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="prs"
                  name="Pull Requests"
                  stroke="#ec4899"
                  strokeWidth={2}
                  dot={{ fill: '#ec4899', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-72 flex items-center justify-center">
              <Alert variant={commitTrendError ? "destructive" : "default"} className="max-w-md">
                {commitTrendError ? <AlertCircle className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                <AlertTitle>
                  {commitTrendError ? 'Failed to Load GitHub Data' : 'No GitHub Data Available'}
                </AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    {commitTrendError
                      ? `${commitTrendError instanceof Error ? commitTrendError.message : 'Repository not found or access denied'}`
                      : 'Configure GitHub Owner and Repo from the dashboard to view code activity trends.'}
                  </p>
                  {githubOwner && githubRepo && (
                    <code className="text-xs bg-muted px-2 py-1 rounded block">
                      {githubOwner}/{githubRepo}
                    </code>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}
          </CardContent>
        </Card>

        {/* Issue Type Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Issue Type Distribution</CardTitle>
                <CardDescription>Breakdown of work items by type</CardDescription>
              </div>
              <PieChartIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {issueTypeLoading ? (
              <div className="h-72 space-y-2">
                <Skeleton className="h-full w-full" />
              </div>
            ) : issueTypeData && Array.isArray(issueTypeData) && issueTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={288}>
                <PieChart>
                  <Pie
                    data={issueTypeData}
                    cx="50%"
                    cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={85}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {issueTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.375rem'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-72 flex items-center justify-center">
              <Alert variant="default" className="max-w-md">
                <PieChartIcon className="h-4 w-4" />
                <AlertTitle>No Issue Type Data</AlertTitle>
                <AlertDescription>
                  {selectedBoard 
                    ? 'No issue type data available for the selected time period.' 
                    : 'Select a board from the dashboard to view issue type distribution.'}
                </AlertDescription>
              </Alert>
            </div>
          )}
          </CardContent>
        </Card>
      </div>

      {/* Sprint Comparison Table */}
      {velocityData?.sprints && velocityData.sprints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sprint Comparison</CardTitle>
            <CardDescription>
              Detailed comparison of sprint commitments and completions (newest → oldest)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sprint</TableHead>
                    <TableHead className="text-right">Commitment</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Velocity</TableHead>
                    <TableHead className="text-right">Success Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...velocityData.sprints].map((sprint) => {
                    const successRate = sprint.commitment > 0
                      ? (sprint.completed / sprint.commitment) * 100
                      : 0;
                    
                    return (
                      <TableRow key={sprint.id}>
                        <TableCell className="font-medium">{sprint.name}</TableCell>
                        <TableCell className="text-right">{sprint.commitment}</TableCell>
                        <TableCell className="text-right">{sprint.completed}</TableCell>
                        <TableCell className="text-right font-semibold">{sprint.velocity}</TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant={successRate >= 80 ? "default" : successRate >= 60 ? "secondary" : "destructive"}
                          >
                            {successRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
