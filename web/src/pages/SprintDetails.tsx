import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Target, 
  TrendingUp, 
  CheckCircle,
  Clock,
  AlertCircle,
  GitCommit,
  GitPullRequest,
  ExternalLink,
  Users
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  getSprintMetrics, 
  getSprintIssues, 
  getSprints, 
  getVelocityData,
  getComprehensiveSprintReport 
} from '@/lib/api';

export function SprintDetails() {
  const { sprintId } = useParams<{ sprintId: string }>();

  // Fetch sprint information
  const { data: allSprints, isLoading: sprintsLoading } = useQuery({
    queryKey: ['sprints', '6306'],
    queryFn: () => getSprints('6306', 'all')
  });

  const sprint = allSprints?.find(s => s.id === sprintId);

  // Fetch sprint metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['sprint-metrics', sprintId],
    queryFn: () => getSprintMetrics(sprintId!),
    enabled: !!sprintId
  });

  // Fetch sprint issues
  const { data: issues, isLoading: issuesLoading } = useQuery({
    queryKey: ['sprint-issues', sprintId],
    queryFn: () => getSprintIssues(sprintId!),
    enabled: !!sprintId
  });

  // Fetch velocity data for comparison
  const { data: velocityData, isLoading: velocityLoading } = useQuery({
    queryKey: ['velocity', '6306', 5],
    queryFn: () => getVelocityData('6306', 5)
  });

  // Fetch comprehensive report with GitHub data
  const { data: comprehensiveReport, isLoading: reportLoading } = useQuery({
    queryKey: ['comprehensive-report', sprintId],
    queryFn: () => getComprehensiveSprintReport(sprintId!, {
      github_owner: 'Sage',
      github_repo: 'network-directory-service',
      include_tier1: true,
      include_tier2: true,
      include_tier3: false,
      include_forward_looking: false,
      include_enhanced_github: true
    }),
    enabled: !!sprintId
  });

  const isLoading = sprintsLoading || metricsLoading || issuesLoading || velocityLoading || reportLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!sprint) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Sprint not found. Please go back to the dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const sprintStartDate = sprint.startDate ? new Date(sprint.startDate) : null;
  const sprintEndDate = sprint.endDate ? new Date(sprint.endDate) : null;
  const isActive = sprint.state === 'active';

  // Calculate sprint comparison
  const currentSprintData = velocityData?.sprints?.find(s => s.id === sprintId);
  const previousSprintData = velocityData?.sprints?.[1]; // Assuming sorted by date

  // Group issues by status
  const completedIssues = issues?.filter(i => 
    i.status.toLowerCase() === 'done' || 
    i.status.toLowerCase() === 'closed' ||
    i.status.toLowerCase() === 'resolved'
  ) || [];
  
  const inProgressIssues = issues?.filter(i => 
    i.status.toLowerCase() === 'in progress' ||
    i.status.toLowerCase() === 'in review'
  ) || [];
  
  const todoIssues = issues?.filter(i => 
    i.status.toLowerCase() === 'to do' ||
    i.status.toLowerCase() === 'open' ||
    i.status.toLowerCase() === 'backlog'
  ) || [];

  // Get GitHub data from comprehensive report
  const commitActivity = comprehensiveReport?.enhanced_github?.commit_activity || [];
  const prStats = comprehensiveReport?.enhanced_github?.pull_request_stats;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link 
              to="/" 
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">{sprint.name}</h1>
            {isActive && (
              <Badge variant="default" className="bg-blue-500">Active</Badge>
            )}
            {sprint.state === 'closed' && (
              <Badge variant="secondary">Closed</Badge>
            )}
          </div>
          {sprintStartDate && sprintEndDate && (
            <p className="text-gray-500">
              {sprintStartDate.toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })} - {sprintEndDate.toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </p>
          )}
        </div>
      </div>

      {/* Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.completion_rate ? `${(metrics.completion_rate * 100).toFixed(0)}%` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.completed_issues || 0} of {metrics?.total_issues || 0} issues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Velocity</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.velocity || 0}</div>
            <p className="text-xs text-muted-foreground">
              Story points completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Story Points</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.completed_story_points || 0}/{metrics?.total_story_points || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Completed / Total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.in_progress_issues || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active work items
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sprint Comparison */}
      {currentSprintData && previousSprintData && (
        <Card>
          <CardHeader>
            <CardTitle>Sprint Comparison</CardTitle>
            <CardDescription>
              Comparing current sprint with previous sprint
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Velocity</h4>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{currentSprintData.velocity}</span>
                  <span className="text-sm text-gray-500">vs {previousSprintData.velocity}</span>
                  {currentSprintData.velocity > previousSprintData.velocity ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <span className="text-gray-400">→</span>
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Commitment</h4>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{currentSprintData.commitment}</span>
                  <span className="text-sm text-gray-500">vs {previousSprintData.commitment}</span>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Completion</h4>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{currentSprintData.completed}</span>
                  <span className="text-sm text-gray-500">vs {previousSprintData.completed}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="deliverables" className="space-y-4">
        <TabsList>
          <TabsTrigger value="deliverables">Sprint Deliverables</TabsTrigger>
          <TabsTrigger value="commits">Commits ({commitActivity.length})</TabsTrigger>
          <TabsTrigger value="metrics">Detailed Metrics</TabsTrigger>
        </TabsList>

        {/* Sprint Deliverables Tab */}
        <TabsContent value="deliverables" className="space-y-4">
          {/* Completed Issues */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Completed Issues ({completedIssues.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {completedIssues.map(issue => (
                  <div key={issue.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {issue.key}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {issue.issueType}
                          </Badge>
                          {issue.storyPoints && (
                            <Badge variant="default" className="text-xs bg-blue-500">
                              {issue.storyPoints} SP
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">{issue.summary}</h4>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {issue.assignee || 'Unassigned'}
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {issue.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {completedIssues.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No completed issues yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* In Progress Issues */}
          {inProgressIssues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  In Progress ({inProgressIssues.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {inProgressIssues.map(issue => (
                    <div key={issue.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {issue.key}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {issue.issueType}
                            </Badge>
                            {issue.storyPoints && (
                              <Badge variant="default" className="text-xs bg-blue-500">
                                {issue.storyPoints} SP
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-medium text-gray-900 mb-1">{issue.summary}</h4>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {issue.assignee || 'Unassigned'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {issue.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* To Do Issues */}
          {todoIssues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-gray-600" />
                  To Do ({todoIssues.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {todoIssues.map(issue => (
                    <div key={issue.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {issue.key}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {issue.issueType}
                            </Badge>
                            {issue.storyPoints && (
                              <Badge variant="default" className="text-xs bg-blue-500">
                                {issue.storyPoints} SP
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-medium text-gray-900 mb-1">{issue.summary}</h4>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {issue.assignee || 'Unassigned'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Commits Tab */}
        <TabsContent value="commits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCommit className="h-5 w-5" />
                Commit Activity
              </CardTitle>
              <CardDescription>
                All commits during this sprint period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {commitActivity.length > 0 ? (
                <div className="space-y-3">
                  {commitActivity.slice(0, 50).map((commit: any, idx: number) => (
                    <div key={idx} className="border-l-2 border-blue-500 pl-4 py-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">
                            {commit.message}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                            <span>{commit.author}</span>
                            <span>•</span>
                            <span>{new Date(commit.date).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className="font-mono text-xs">{commit.sha?.slice(0, 7)}</span>
                          </div>
                        </div>
                        {commit.url && (
                          <a 
                            href={commit.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 ml-2"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {commitActivity.length > 50 && (
                    <p className="text-center text-sm text-gray-500 py-4">
                      Showing first 50 of {commitActivity.length} commits
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  No commits found for this sprint period
                </p>
              )}
            </CardContent>
          </Card>

          {/* Pull Request Stats */}
          {prStats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitPullRequest className="h-5 w-5" />
                  Pull Request Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Total PRs</p>
                    <p className="text-2xl font-bold">{prStats.total || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Merged</p>
                    <p className="text-2xl font-bold text-green-600">{prStats.merged || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Open</p>
                    <p className="text-2xl font-bold text-blue-600">{prStats.open || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Closed</p>
                    <p className="text-2xl font-bold text-gray-600">{prStats.closed || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Detailed Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Issue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Issues</span>
                    <span className="font-bold">{metrics?.total_issues || 0}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Completed</span>
                    <span className="font-bold text-green-600">{metrics?.completed_issues || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">In Progress</span>
                    <span className="font-bold text-blue-600">{metrics?.in_progress_issues || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">To Do</span>
                    <span className="font-bold text-gray-600">
                      {(metrics?.total_issues || 0) - (metrics?.completed_issues || 0) - (metrics?.in_progress_issues || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Story Points</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Committed</span>
                    <span className="font-bold">{metrics?.total_story_points || 0}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Completed</span>
                    <span className="font-bold text-green-600">{metrics?.completed_story_points || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Remaining</span>
                    <span className="font-bold text-gray-600">
                      {(metrics?.total_story_points || 0) - (metrics?.completed_story_points || 0)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Velocity</span>
                    <span className="font-bold text-blue-600">{metrics?.velocity || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
