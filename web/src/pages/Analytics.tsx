import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '../lib/api';
import { Select, SelectTrigger, SelectContent,SelectItem, SelectValue } from '@/components/ui/select';

export function Analytics() {
  const [selectedBoard, setSelectedBoard] = useState('6306');
  const [dateRange, setDateRange] = useState('3months');
  // GitHub integration from environment or default config
  const [githubOwner] = useState(import.meta.env.VITE_GITHUB_OWNER || '');
  const [githubRepo] = useState(import.meta.env.VITE_GITHUB_REPO || '')

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
  const { data: velocityData, isLoading: velocityLoading, refetch: refetchVelocity } = useQuery({
    queryKey: ['velocity', selectedBoard, sprintCount],
    queryFn: () => api.getVelocityData(selectedBoard, sprintCount),
    enabled: !!selectedBoard,
  });

  // Fetch team performance data - now based on sprint count from time period
  const { data: teamPerformanceData, isLoading: teamPerformanceLoading, refetch: refetchTeamPerformance } = useQuery({
    queryKey: ['team-performance', selectedBoard, sprintCount],
    queryFn: () => api.getTeamPerformance(selectedBoard, sprintCount),
    enabled: !!selectedBoard,
  });

  // Fetch issue type distribution - now from real API
  const { data: issueTypeData, isLoading: issueTypeLoading, refetch: refetchIssueTypes } = useQuery({
    queryKey: ['issue-types', selectedBoard, sprintCount],
    queryFn: () => api.getIssueTypeDistribution(selectedBoard, sprintCount),
    enabled: !!selectedBoard,
  });

  // Fetch commit trends (optional - only if GitHub repo is configured)
  const { data: commitTrendData, isLoading: commitTrendLoading, error: commitTrendError, refetch: refetchCommitTrends } = useQuery({
    queryKey: ['commit-trends', githubOwner, githubRepo, dateRange],
    queryFn: () => api.getCommitTrends(githubOwner, githubRepo, dateRange),
    enabled: !!githubOwner && !!githubRepo,
    // Optional query - don't fail if GitHub not configured
    retry: false,
  });

  // Handle Update Charts button click
  const handleUpdateCharts = () => {
    refetchVelocity();
    refetchTeamPerformance();
    refetchIssueTypes();
    if (githubOwner && githubRepo) {
      refetchCommitTrends();
    }
  };

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
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="board" className="block text-sm font-medium text-gray-700">
              Board
            </label>
            <Select 
              value={selectedBoard}
              onValueChange={(e) => setSelectedBoard(e)}
            >
              <SelectTrigger className="w-[180px]">
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
          <div>
            <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700">
              Time Period
            </label>
            <Select 
              value={dateRange}
              onValueChange={(e) => setDateRange(e)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select a board" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1month">Last Month</SelectItem>
                <SelectItem value="3months">Last 3 Months</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="1year">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleUpdateCharts}
              disabled={!selectedBoard}
              className="w-full"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Update Charts
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Average Velocity
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {velocityData?.average?.toFixed(1) || '--'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart3 className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Velocity Trend
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {velocityData?.trend || '--'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Sprints Analyzed
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {velocityData?.sprints?.length || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <PieChartIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Completion Rate
                  </dt>
                  <dd className={`text-lg font-medium ${
                    completionRate >= 80 ? 'text-green-600' :
                    completionRate >= 60 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {completionRate > 0 ? `${completionRate}%` : '--'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Widgets Grid - Responsive 2x2 layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sprint Velocity Trend */}
        <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Sprint Velocity Trend</h3>
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
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
            <div className="h-72 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Select a board and click "Update Charts"</p>
              </div>
            </div>
          )}
        </div>

        {/* Team Performance */}
        <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Team Performance</h3>
            <BarChart3 className="h-5 w-5 text-green-500" />
          </div>
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
            <div className="h-72 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">
                  {selectedBoard ? 'No team performance data available' : 'Select a board to view team performance'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Code Activity Trends */}
        <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Code Activity Trends</h3>
            <TrendingUp className="h-5 w-5 text-purple-500" />
          </div>
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
            <div className="h-72 flex items-center justify-center text-gray-400">
              <div className="text-center max-w-xs space-y-3">
                <TrendingUp className="h-12 w-12 mx-auto text-gray-300" />
                <div>
                  <p className="font-medium text-gray-600">GitHub Integration Not Configured</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Set VITE_GITHUB_OWNER and VITE_GITHUB_REPO environment variables or update the configuration
                  </p>
                </div>
                {commitTrendError && (
                  <p className="text-xs text-red-500">
                    Error: Repository not found or access denied
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Issue Type Distribution */}
        <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Issue Type Distribution</h3>
            <PieChartIcon className="h-5 w-5 text-orange-500" />
          </div>
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
            <div className="h-72 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <PieChartIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">
                  {selectedBoard ? 'No issue type data available' : 'Select a board to view issue types'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sprint Comparison Table */}
      {velocityData?.sprints && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Sprint Comparison</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sprint
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Commitment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Velocity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Success Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Display sprints in same order as Dashboard (newest → oldest) */}
                  {velocityData.sprints.map((sprint, index) => (
                    <tr key={sprint.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {sprint.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {sprint.commitment}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {sprint.completed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {sprint.velocity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {sprint.commitment > 0
                          ? ((sprint.completed / sprint.commitment) * 100).toFixed(1)
                          : '0.0'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}