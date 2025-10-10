import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, BarChart3, Target, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api } from '../lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfiguration } from '../contexts/ConfigurationContext';

export function Velocity() {
  // Get configuration from context
  const { config } = useConfiguration();
  const [sprintCount, setSprintCount] = useState(5);

  const { data: velocityData, isLoading } = useQuery({
    queryKey: ['velocity', config.jira.boardId, sprintCount],
    queryFn: () => api.getVelocityData(config.jira.boardId, sprintCount),
    enabled: !!config.jira.boardId,
  });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'decreasing': return <TrendingDown className="h-5 w-5 text-red-600" />;
      default: return <Minus className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing': return 'text-green-600 bg-green-50';
      case 'decreasing': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sprint Velocity Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track team velocity and sprint performance trends
        </p>
      </div>

      {/* Configuration */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium text-gray-900">Current Configuration</h2>
            <p className="text-xs text-gray-500 mt-1">
              Using board: <span className="font-semibold">{config.jira.boardName}</span> (ID: {config.jira.boardId})
            </p>
          </div>
          <Link to="/" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">
            <Settings className="h-4 w-4" />
            Change Board
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Jira Board</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{config.jira.boardName}</p>
              </div>
              <Badge variant="secondary">ID: {config.jira.boardId}</Badge>
            </div>
          </div>

          <div>
            <label htmlFor="sprintCount" className="block text-sm font-medium text-gray-700 mb-2">
              Number of Sprints to Analyze
            </label>
            <Select
              value={sprintCount.toString()}
              onValueChange={(e:any) => setSprintCount(parseInt(e, 10))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select sprint count" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 Sprints</SelectItem>
                <SelectItem value="5">Last 5 Sprints</SelectItem>
                <SelectItem value="10">Last 10 Sprints</SelectItem>
                <SelectItem value="15">Last 15 Sprints</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Velocity Summary */}
      {velocityData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Average Velocity</h3>
                <BarChart3 className="h-5 w-5 text-blue-500" />
              </div>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {Math.round(velocityData.average)}
              </p>
              <p className="mt-1 text-xs text-gray-500">Story Points per Sprint</p>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Velocity Trend</h3>
                {getTrendIcon(velocityData.trend)}
              </div>
              <p className={`mt-2 text-xl font-bold capitalize ${getTrendColor(velocityData.trend)}`}>
                {velocityData.trend}
              </p>
              <p className="mt-1 text-xs text-gray-500">Over {sprintCount} sprints</p>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-500">Sprints Analyzed</h3>
                <Target className="h-5 w-5 text-purple-500" />
              </div>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {velocityData.sprints.length}
              </p>
              <p className="mt-1 text-xs text-gray-500">Total sprints in data</p>
            </div>
          </div>

          {/* Sprint Details */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Sprint Performance</h2>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
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
                      Completion %
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {velocityData.sprints.map((sprint) => {
                    const completionRate = sprint.commitment > 0
                      ? Math.round((sprint.completed / sprint.commitment) * 100)
                      : 0;

                    return (
                      <tr key={sprint.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {sprint.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sprint.commitment}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sprint.completed}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                          {sprint.velocity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className={`text-sm font-medium ${
                              completionRate >= 90 ? 'text-green-600' :
                              completionRate >= 70 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {completionRate}%
                            </span>
                            <div className="ml-2 w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  completionRate >= 90 ? 'bg-green-600' :
                                  completionRate >= 70 ? 'bg-yellow-600' :
                                  'bg-red-600'
                                }`}
                                style={{ width: `${Math.min(completionRate, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Velocity Chart (Simple Bar Chart) */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Velocity Trend</h2>

            <div className="space-y-4">
              {velocityData.sprints.map((sprint) => {
                const maxVelocity = Math.max(...velocityData.sprints.map(s => s.velocity));
                const widthPercentage = (sprint.velocity / maxVelocity) * 100;

                return (
                  <div key={sprint.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{sprint.name}</span>
                      <span className="text-sm font-semibold text-blue-600">{sprint.velocity}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-8">
                      <div
                        className="bg-blue-600 h-8 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                        style={{ width: `${widthPercentage}%` }}
                      >
                        {widthPercentage > 15 && (
                          <span className="text-xs text-white font-medium">{sprint.velocity}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {isLoading && (
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {!isLoading && !velocityData && config.jira.boardId && (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500">
            No velocity data available for board <span className="font-semibold">{config.jira.boardName}</span> (ID: {config.jira.boardId})
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Try selecting a different board or check if the board has completed sprints
          </p>
        </div>
      )}
    </div>
  );
}
