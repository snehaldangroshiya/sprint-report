import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '../lib/api';
import { Select, SelectTrigger, SelectContent,SelectItem, SelectValue } from '@/components/ui/select';

export function Analytics() {
  const [selectedBoard, setSelectedBoard] = useState('6306');
  const [dateRange, setDateRange] = useState('3months');
  // GitHub integration - editable inputs with better defaults
  const [githubOwner, setGithubOwner] = useState(import.meta.env.VITE_GITHUB_OWNER || 'Sage');
  const [githubRepo, setGithubRepo] = useState(import.meta.env.VITE_GITHUB_REPO || 'sage-connect');

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

  // Fetch boards for selection
  const { data: boards } = useQuery({
    queryKey: ['boards'],
    queryFn: api.getBoards,
  });

  // Fetch velocity data - now based on sprint count from time period
  const { data: velocityData, isLoading: velocityLoading } = useQuery({
    queryKey: ['velocity', selectedBoard, sprintCount],
    queryFn: () => api.getVelocityData(selectedBoard, sprintCount),
    enabled: !!selectedBoard,
  });

  // Fetch team performance data - now based on sprint count from time period
  const { data: teamPerformanceData, isLoading: teamPerformanceLoading } = useQuery({
    queryKey: ['team-performance', selectedBoard, sprintCount],
    queryFn: () => api.getTeamPerformance(selectedBoard, sprintCount),
    enabled: !!selectedBoard,
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
          <h1 className="text-2xl font-bold text-gray-900">Sprint Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Advanced insights and performance metrics for your sprints
          </p>
        </div>
        <Button onClick={exportToPDF}>
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="board">Board</Label>
              <Select
                value={selectedBoard}
                onValueChange={(e) => setSelectedBoard(e)}
              >
                <SelectTrigger id="board" className="w-full">
                  <SelectValue placeholder="Select a board" />
                </SelectTrigger>
                <SelectContent>
                  {boards?.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateRange">Time Period</Label>
              <Select
                value={dateRange}
                onValueChange={(e) => setDateRange(e)}
              >
                <SelectTrigger id="dateRange" className="w-full">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1month">Last Month</SelectItem>
                  <SelectItem value="3months">Last 3 Months</SelectItem>
                  <SelectItem value="6months">Last 6 Months</SelectItem>
                  <SelectItem value="1year">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="githubOwner">GitHub Owner</Label>
              <Input
                id="githubOwner"
                type="text"
                value={githubOwner}
                onChange={(e) => setGithubOwner(e.target.value)}
                placeholder="e.g., Sage"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="githubRepo">GitHub Repo</Label>
              <Input
                id="githubRepo"
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="e.g., sage-connect"
              />
            </div>
          </div>
        </CardContent>
      </Card>      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <p className="text-sm font-medium text-muted-foreground truncate">
                  Average Velocity
                </p>
                <p className="text-lg font-medium">
                  {velocityData?.average?.toFixed(1) || '--'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart3 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <p className="text-sm font-medium text-muted-foreground truncate">
                  Velocity Trend
                </p>
                <p className="text-lg font-medium">
                  {velocityData?.trend || '--'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <p className="text-sm font-medium text-muted-foreground truncate">
                  Sprints Analyzed
                </p>
                <p className="text-lg font-medium">
                  {velocityData?.sprints?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <PieChartIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <p className="text-sm font-medium text-muted-foreground truncate">
                  Completion Rate
                </p>
                <p className={`text-lg font-medium ${
                  completionRate >= 80 ? 'text-green-600' :
                  completionRate >= 60 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {completionRate > 0 ? `${completionRate}%` : '--'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Widgets Grid - Responsive 2x2 layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sprint Velocity Trend */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Sprint Velocity Trend</CardTitle>
              <TrendingUp className="h-5 w-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            {velocityLoading ? (
              <div className="h-72">
                <Skeleton className="h-full w-full" />
              </div>
            ) : velocityData?.sprints && velocityData.sprints.length > 0 ? (
              <ResponsiveContainer width="100%" height={288}>
                <LineChart data={velocityData.sprints}>
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
                  <Line
                    type="monotone"
                    dataKey="velocity"
                    name="Completed Points"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="commitment"
                    name="Committed Points"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 text-muted" />
                  <p className="text-sm">Select a board and click "Update Charts"</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Performance */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Team Performance</CardTitle>
              <BarChart3 className="h-5 w-5 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            {teamPerformanceLoading ? (
              <div className="h-72">
                <Skeleton className="h-full w-full" />
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
              <div className="h-72 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 text-muted" />
                  <p className="text-sm">
                    {selectedBoard ? 'No team performance data available' : 'Select a board to view team performance'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Code Activity Trends */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Code Activity Trends</CardTitle>
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            {commitTrendLoading ? (
              <div className="h-72">
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
            <div className="h-72 flex items-center justify-center text-muted-foreground">
              <div className="text-center max-w-xs space-y-3">
                <TrendingUp className="h-12 w-12 mx-auto text-muted" />
                <div>
                  <p className="font-medium">
                    {commitTrendError ? 'Failed to Load GitHub Data' : 'No GitHub Data Available'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {commitTrendError
                      ? `Error: ${commitTrendError instanceof Error ? commitTrendError.message : 'Repository not found or access denied'}`
                      : 'Configure GitHub Owner and Repo above, then select a time period'
                    }
                  </p>
                  {githubOwner && githubRepo && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Current: {githubOwner}/{githubRepo}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          </CardContent>
        </Card>

        {/* Issue Type Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Issue Type Distribution</CardTitle>
              <PieChartIcon className="h-5 w-5 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            {issueTypeLoading ? (
              <div className="h-72">
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
            <div className="h-72 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <PieChartIcon className="h-12 w-12 mx-auto mb-2 text-muted" />
                <p className="text-sm">
                  {selectedBoard ? 'No issue type data available' : 'Select a board to view issue types'}
                </p>
              </div>
            </div>
          )}
          </CardContent>
        </Card>
      </div>

      {/* Sprint Comparison Table */}
      {velocityData?.sprints && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sprint Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sprint</TableHead>
                  <TableHead>Commitment</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Velocity</TableHead>
                  <TableHead>Success Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Display sprints in same order as Dashboard (newest → oldest) */}
                {velocityData.sprints.map((sprint) => (
                  <TableRow key={sprint.id}>
                    <TableCell className="font-medium">{sprint.name}</TableCell>
                    <TableCell>{sprint.commitment}</TableCell>
                    <TableCell>{sprint.completed}</TableCell>
                    <TableCell>{sprint.velocity}</TableCell>
                    <TableCell>
                      {sprint.commitment > 0
                        ? ((sprint.completed / sprint.commitment) * 100).toFixed(1)
                        : '0.0'}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
