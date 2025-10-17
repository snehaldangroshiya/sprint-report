import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, BarChart3, Target, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Current Configuration</CardTitle>
              <CardDescription>
                Using board: <span className="font-semibold">{config.jira.boardName}</span> (ID: {config.jira.boardId})
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Change Board
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Jira Board</p>
                  <p className="text-sm font-semibold mt-1">{config.jira.boardName}</p>
                </div>
                <Badge variant="secondary">ID: {config.jira.boardId}</Badge>
              </div>
            </div>

            <div>
              <label htmlFor="sprintCount" className="block text-sm font-medium mb-2">
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
        </CardContent>
      </Card>

      {/* Velocity Summary */}
      {velocityData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Velocity</CardTitle>
                <BarChart3 className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {Math.round(velocityData.average)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Story points per sprint (avg across {velocityData.sprints.length} sprints)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Velocity Trend</CardTitle>
                {getTrendIcon(velocityData.trend)}
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-bold capitalize ${getTrendColor(velocityData.trend)}`}>
                  {velocityData.trend}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {velocityData.trend === 'increasing' 
                    ? 'Team velocity is improving over time' 
                    : velocityData.trend === 'decreasing'
                    ? 'Team velocity is declining over time'
                    : 'Team velocity is relatively stable'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sprints Analyzed</CardTitle>
                <Target className="h-5 w-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {velocityData.sprints.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Completed sprints included in analysis
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sprint Details */}
          <Card>
            <CardHeader>
              <CardTitle>Sprint Performance</CardTitle>
              <CardDescription>
                Detailed breakdown of commitment vs completion for each sprint
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sprint</TableHead>
                      <TableHead>Commitment</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Velocity</TableHead>
                      <TableHead>Completion %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {velocityData.sprints.map((sprint) => {
                      const completionRate = sprint.commitment > 0
                        ? Math.round((sprint.completed / sprint.commitment) * 100)
                        : 0;

                      return (
                        <TableRow key={sprint.id}>
                          <TableCell className="font-medium">
                            {sprint.name}
                          </TableCell>
                          <TableCell>
                            {sprint.commitment}
                          </TableCell>
                          <TableCell>
                            {sprint.completed}
                          </TableCell>
                          <TableCell className="font-semibold text-blue-600">
                            {sprint.velocity}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${
                                completionRate >= 90 ? 'text-green-600' :
                                completionRate >= 70 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {completionRate}%
                              </span>
                              <Progress 
                                value={completionRate} 
                                className="w-20 h-2"
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Velocity Chart (Simple Bar Chart) */}
          <Card>
            <CardHeader>
              <CardTitle>Velocity History</CardTitle>
              <CardDescription>
                Visual comparison of story points completed across sprints
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {velocityData.sprints.map((sprint) => {
                  const maxVelocity = Math.max(...velocityData.sprints.map(s => s.velocity));
                  const widthPercentage = (sprint.velocity / maxVelocity) * 100;

                  return (
                    <div key={sprint.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{sprint.name}</span>
                        <span className="text-sm font-semibold text-blue-600">{sprint.velocity}</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-8">
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
            </CardContent>
          </Card>
        </>
      )}

      {isLoading && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      )}

      {!isLoading && !velocityData && config.jira.boardId && (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <p className="text-muted-foreground">
              No velocity data available for board <span className="font-semibold">{config.jira.boardName}</span> (ID: {config.jira.boardId})
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Try selecting a different board or check if the board has completed sprints
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
