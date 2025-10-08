import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  getSprintMetrics,
  getSprintIssuesPaginated,
  getSprints,
  getVelocityData,
  getComprehensiveSprintReport
} from '@/lib/api';

// Helper function to parse commit message into title and body
function parseCommitMessage(message: string) {
  if (!message) return { title: '', body: '' };

  const lines = message.split('\n');
  const title = lines[0] || '';
  const body = lines.slice(1).join('\n').trim();

  return { title, body };
}

// Helper function to format commit body (handle markdown and HTML)
function formatCommitBody(body: string) {
  if (!body) return null;

  // Split into paragraphs
  const paragraphs = body.split('\n\n').filter(p => p.trim());

  return paragraphs.map((paragraph, idx) => {
    // Handle bullet points
    if (paragraph.includes('\n- ') || paragraph.includes('\n* ')) {
      const items = paragraph.split('\n').filter(line => line.trim());
      return (
        <ul key={idx} className="list-disc list-inside space-y-1 ml-2">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-muted-foreground">
              {item.replace(/^[-*]\s*/, '')}
            </li>
          ))}
        </ul>
      );
    }

    // Handle numbered lists
    if (/^\d+\./.test(paragraph)) {
      const items = paragraph.split('\n').filter(line => line.trim());
      return (
        <ol key={idx} className="list-decimal list-inside space-y-1 ml-2">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-muted-foreground">
              {item.replace(/^\d+\.\s*/, '')}
            </li>
          ))}
        </ol>
      );
    }

    // Regular paragraph
    return (
      <p key={idx} className="text-sm text-muted-foreground leading-relaxed">
        {paragraph}
      </p>
    );
  });
}

export function SprintDetails() {
  const { sprintId } = useParams<{ sprintId: string }>();

  // Jira base URL for linking to issues
  const JIRA_BASE_URL = 'https://jira.sage.com';

  // Pagination state for commits
  const [commitsPage, setCommitsPage] = useState(1);
  const commitsPerPage = 10;

  // Pagination state for completed issues (client-side pagination)
  const [completedIssuesPage, setCompletedIssuesPage] = useState(1);
  const completedIssuesPerPage = 20;

  // Fetch sprint information
  const { data: allSprints, isLoading: sprintsLoading } = useQuery({
    queryKey: ['sprints', '6306'],
    queryFn: () => getSprints('6306', 'all')
  });

  const sprint = allSprints?.find(s => s.id === sprintId);

  // Fetch sprint metrics (lightweight - just numbers, no full issue data)
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['sprint-metrics', sprintId],
    queryFn: () => getSprintMetrics(sprintId!),
    enabled: !!sprintId
  });

  // Fetch sprint issues with pagination (default 20 per page)
  const { data: issuesResponse, isLoading: issuesLoading } = useQuery({
    queryKey: ['sprint-issues-paginated', sprintId],
    queryFn: () => getSprintIssuesPaginated(sprintId!, 1, 20),
    enabled: !!sprintId
  });

  // Extract issues array and pagination metadata from response
  const issues = issuesResponse?.issues || [];
  const issuesPagination = issuesResponse?.pagination;
  // Note: Fetching first page (20 issues). Use pagination.has_next to load more if needed.

  // Fetch velocity data for comparison (use 15 sprints max for better performance)
  const { data: velocityData, isLoading: velocityLoading } = useQuery({
    queryKey: ['velocity', '6306', 15],
    queryFn: () => getVelocityData('6306', 15)
  });

  // Fetch comprehensive report with GitHub data
  const { data: comprehensiveReport, isLoading: reportLoading } = useQuery({
    queryKey: ['comprehensive-report', sprintId],
    queryFn: () => getComprehensiveSprintReport(sprintId!, {
      github_owner: 'Sage',
      github_repo: 'sage-connect',
      include_tier1: true,
      include_tier2: true,
      include_tier3: false,
      include_forward_looking: false,
      include_enhanced_github: true
    }),
    enabled: !!sprintId
  });

  // Find previous sprint ID for comparison
  const previousSprintId = useMemo(() => {
    if (!allSprints || !sprintId) return null;
    const currentIndex = allSprints.findIndex(s => s.id === sprintId);
    if (currentIndex > 0 && currentIndex < allSprints.length) {
      return allSprints[currentIndex + 1]?.id; // Next in array is previous chronologically
    }
    return null;
  }, [allSprints, sprintId]);

  // Fetch previous sprint's comprehensive report for PR comparison
  const { data: previousComprehensiveReport } = useQuery({
    queryKey: ['comprehensive-report', previousSprintId],
    queryFn: () => getComprehensiveSprintReport(previousSprintId!, {
      github_owner: 'Sage',
      github_repo: 'sage-connect',
      include_tier1: false,
      include_tier2: false,
      include_tier3: false,
      include_forward_looking: false,
      include_enhanced_github: true
    }),
    enabled: !!previousSprintId
  });

  const isLoading = sprintsLoading || metricsLoading || issuesLoading || velocityLoading || reportLoading;

  // Use metrics from API (calculated on backend from all issues)
  const metrics = useMemo(() => {
    if (!metricsData || !metricsData.metrics) {
      return {
        total_issues: 0,
        completed_issues: 0,
        in_progress_issues: 0,
        total_story_points: 0,
        completed_story_points: 0,
        completion_rate: 0,
        velocity: 0
      };
    }

    const m = metricsData.metrics;
    return {
      total_issues: m.totalIssues || 0,
      completed_issues: m.completedIssues || 0,
      in_progress_issues: m.inProgressIssues || 0,
      total_story_points: m.totalStoryPoints || 0,
      completed_story_points: m.completedStoryPoints || 0,
      completion_rate: (m.completionRate || 0) / 100, // Backend returns percentage (0-100), convert to decimal (0-1)
      velocity: m.completedStoryPoints || 0
    };
  }, [metricsData]);

  // Find current and previous sprint data for comparison
  const currentSprintData = useMemo(() => {
    if (!velocityData?.sprints || !sprintId) return null;
    return velocityData.sprints.find(s => s.id === sprintId);
  }, [velocityData, sprintId]);

  const previousSprintData = useMemo(() => {
    if (!velocityData?.sprints || !sprintId) return null;
    const currentIndex = velocityData.sprints.findIndex(s => s.id === sprintId);
    if (currentIndex > 0) {
      return velocityData.sprints[currentIndex - 1];
    }
    return null;
  }, [velocityData, sprintId]);

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

  // Group issues by status
  const completedIssues = issues?.filter(i =>
    i.status.toLowerCase() === 'done' ||
    i.status.toLowerCase() === 'closed' ||
    i.status.toLowerCase() === 'resolved'
  ) || [];

  const inProgressIssues = issues?.filter(i =>
    i.status.toLowerCase() === 'in progress' ||
    i.status.toLowerCase() === 'in review' ||
    i.status.toLowerCase() === 'code review' ||
    i.status.toLowerCase() === 'in development'
  ) || [];

  const todoIssues = issues?.filter(i =>
    i.status.toLowerCase() === 'to do' ||
    i.status.toLowerCase() === 'open' ||
    i.status.toLowerCase() === 'backlog' ||
    i.status.toLowerCase() === 'new' ||
    i.status.toLowerCase() === 'blocked'
  ) || [];

  const discardedIssues = issues?.filter(i =>
    i.status.toLowerCase() === 'discarded' ||
    i.status.toLowerCase() === 'cancelled' ||
    i.status.toLowerCase() === 'rejected'
  ) || [];

  // Get GitHub data from comprehensive report
  const commitActivity = comprehensiveReport?.commits || [];
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
            <CardTitle>Sprint vs Previous</CardTitle>
            <CardDescription>
              How this sprint compares to {previousSprintData.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Velocity Comparison */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Velocity</span>
                  {currentSprintData.velocity !== undefined && previousSprintData.velocity !== undefined && (
                    <Badge
                      variant={currentSprintData.velocity >= previousSprintData.velocity ? "default" : "secondary"}
                      className={currentSprintData.velocity >= previousSprintData.velocity ? "bg-green-500" : ""}
                    >
                      {currentSprintData.velocity >= previousSprintData.velocity ? "+" : ""}
                      {((currentSprintData.velocity - previousSprintData.velocity) / (previousSprintData.velocity || 1) * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{currentSprintData.velocity || 0}</span>
                  <span className="text-sm text-muted-foreground">pts</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Previous: {previousSprintData.velocity || 0} pts
                </p>
              </div>

              {/* Commitment Comparison */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Commitment</span>
                  {currentSprintData.commitment !== undefined && previousSprintData.commitment !== undefined && currentSprintData.commitment !== previousSprintData.commitment && (
                    <Badge variant="secondary">
                      {currentSprintData.commitment >= previousSprintData.commitment ? "+" : ""}
                      {currentSprintData.commitment - previousSprintData.commitment}
                    </Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{currentSprintData.commitment || 0}</span>
                  <span className="text-sm text-muted-foreground">pts</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Previous: {previousSprintData.commitment || 0} pts
                </p>
              </div>

              {/* Completion Comparison */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Completed</span>
                  {currentSprintData.completed !== undefined && previousSprintData.completed !== undefined && currentSprintData.completed !== previousSprintData.completed && (
                    <Badge variant="secondary">
                      {currentSprintData.completed >= previousSprintData.completed ? "+" : ""}
                      {currentSprintData.completed - previousSprintData.completed}
                    </Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{currentSprintData.completed || 0}</span>
                  <span className="text-sm text-muted-foreground">pts</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Previous: {previousSprintData.completed || 0} pts
                </p>
              </div>

              {/* Pull Requests Comparison */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Merged PRs</span>
                  {(() => {
                    const currentPRs = comprehensiveReport?.enhanced_github?.pull_request_stats?.mergedPRs || 0;
                    const previousPRs = previousComprehensiveReport?.enhanced_github?.pull_request_stats?.mergedPRs || 0;
                    const diff = currentPRs - previousPRs;
                    return diff !== 0 ? (
                      <Badge
                        variant={diff >= 0 ? "default" : "secondary"}
                        className={diff >= 0 ? "bg-green-500" : ""}
                      >
                        {diff >= 0 ? "+" : ""}{diff}
                      </Badge>
                    ) : null;
                  })()}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {comprehensiveReport?.enhanced_github?.pull_request_stats?.mergedPRs || 0}
                  </span>
                  <span className="text-sm text-muted-foreground">PRs</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Previous: {previousComprehensiveReport?.enhanced_github?.pull_request_stats?.mergedPRs || 0} PRs
                </p>
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
              <CardDescription>
                Showing {Math.min(completedIssuesPerPage, completedIssues.length)} of {completedIssues.length} completed issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {completedIssues
                  .slice((completedIssuesPage - 1) * completedIssuesPerPage, completedIssuesPage * completedIssuesPerPage)
                  .map(issue => (
                  <div
                    key={issue.id}
                    className="group relative border rounded-lg p-4 hover:bg-accent/50 transition-all duration-200 hover:shadow-sm"
                  >
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

                      {/* Jira Link */}
                      <a
                        href={`${JIRA_BASE_URL}/browse/${issue.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 p-2 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="View in Jira"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                ))}
                {completedIssues.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No completed issues yet</p>
                )}
              </div>

              {/* Pagination for Completed Issues */}
              {completedIssues.length > completedIssuesPerPage && (
                <div className="mt-6 pt-4 border-t">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCompletedIssuesPage(p => Math.max(1, p - 1))}
                          className={completedIssuesPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>

                      {Array.from({ length: Math.ceil(completedIssues.length / completedIssuesPerPage) }).map((_, i) => {
                        const pageNum = i + 1;
                        // Show first page, last page, current page, and pages around current
                        const totalPages = Math.ceil(completedIssues.length / completedIssuesPerPage);
                        if (
                          pageNum === 1 ||
                          pageNum === totalPages ||
                          (pageNum >= completedIssuesPage - 1 && pageNum <= completedIssuesPage + 1)
                        ) {
                          return (
                            <PaginationItem key={i}>
                              <PaginationLink
                                onClick={() => setCompletedIssuesPage(pageNum)}
                                isActive={completedIssuesPage === pageNum}
                                className="cursor-pointer"
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        } else if (pageNum === completedIssuesPage - 2 || pageNum === completedIssuesPage + 2) {
                          return <PaginationItem key={i}><span className="px-2">...</span></PaginationItem>;
                        }
                        return null;
                      })}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCompletedIssuesPage(p => Math.min(Math.ceil(completedIssues.length / completedIssuesPerPage), p + 1))}
                          className={completedIssuesPage >= Math.ceil(completedIssues.length / completedIssuesPerPage) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
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
                            <span className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
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

          {/* Discarded/Cancelled Issues */}
          {discardedIssues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Discarded ({discardedIssues.length})
                </CardTitle>
                <CardDescription>
                  Issues that were cancelled or removed from the sprint
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {discardedIssues.map(issue => (
                    <div key={issue.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors opacity-60">
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
                              <Badge variant="default" className="text-xs bg-gray-500">
                                {issue.storyPoints} SP
                              </Badge>
                            )}
                            <Badge variant="destructive" className="text-xs">
                              {issue.status}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-gray-700 mb-1 line-through">{issue.summary}</h4>
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
                    <p className="text-2xl font-bold">{prStats.totalPRs || prStats.total || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Merged</p>
                    <p className="text-2xl font-bold text-green-600">{prStats.mergedPRs || prStats.merged || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Open</p>
                    <p className="text-2xl font-bold text-blue-600">{prStats.openPRs || prStats.open || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Closed (No Merge)</p>
                    <p className="text-2xl font-bold text-gray-600">{prStats.closedWithoutMerge || prStats.closed || 0}</p>
                  </div>
                </div>

                {/* Additional PR Metrics */}
                <div className="mt-6 pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Merge Rate</p>
                      <p className="text-lg font-semibold text-green-600">
                        {prStats.mergeRate ? `${prStats.mergeRate.toFixed(1)}%` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Time to Merge</p>
                      <p className="text-lg font-semibold">
                        {prStats.averageTimeToMerge ? `${prStats.averageTimeToMerge.toFixed(1)}h` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Review Comments</p>
                      <p className="text-lg font-semibold">
                        {prStats.averageReviewComments || 0}
                      </p>
                    </div>
                  </div>
                </div>

                {/* PRs by Author */}
                {prStats.prsByAuthor && Object.keys(prStats.prsByAuthor).length > 0 && (
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-sm font-medium text-muted-foreground mb-3">PRs by Author</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(prStats.prsByAuthor).map(([author, count]) => (
                        <Badge key={author} variant="secondary" className="text-xs">
                          {author}: {count as number}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <GitCommit className="h-5 w-5" />
                    Commit Activity
                  </CardTitle>
                  <CardDescription>
                    {commitActivity.length} commits during this sprint period
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {commitActivity.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {commitActivity
                      .slice((commitsPage - 1) * commitsPerPage, commitsPage * commitsPerPage)
                      .map((commit: any, idx: number) => {
                        const { title, body } = parseCommitMessage(commit.message);
                        const formattedBody = formatCommitBody(body);

                        return (
                          <div
                            key={commit.sha || idx}
                            className="group relative border rounded-lg p-5 hover:bg-accent/50 transition-all duration-200 hover:shadow-sm"
                          >
                            <div className="flex items-start gap-4">
                              {/* Commit Icon */}
                              <div className="mt-1 p-2 rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-colors flex-shrink-0">
                                <GitCommit className="h-4 w-4" />
                              </div>

                              {/* Commit Details */}
                              <div className="flex-1 min-w-0 space-y-3">
                                {/* Commit Title */}
                                <h4 className="font-semibold text-base leading-snug text-foreground pr-8">
                                  {title}
                                </h4>

                                {/* Commit Body */}
                                {formattedBody && (
                                  <div className="space-y-2 pl-1 border-l-2 border-muted pl-3">
                                    {formattedBody}
                                  </div>
                                )}

                                {/* Metadata */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-1">
                                  {/* Author */}
                                  <div className="flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5" />
                                    <span className="font-medium">
                                      {commit.author?.name || commit.author || 'Unknown'}
                                    </span>
                                  </div>

                                  {/* Date */}
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>
                                      {new Date(commit.date).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                      })}
                                    </span>
                                  </div>

                                  {/* SHA */}
                                  <Badge variant="secondary" className="font-mono text-xs">
                                    {commit.sha?.slice(0, 7)}
                                  </Badge>
                                </div>
                              </div>

                              {/* GitHub Link */}
                              {commit.url && (
                                <a
                                  href={commit.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-shrink-0 p-2 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                  title="View on GitHub"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Pagination */}
                  {commitActivity.length > commitsPerPage && (
                    <div className="mt-6 pt-4 border-t">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setCommitsPage(p => Math.max(1, p - 1))}
                              className={commitsPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                          </PaginationItem>

                          {[...Array(Math.ceil(commitActivity.length / commitsPerPage))].map((_, i) => (
                            <PaginationItem key={i}>
                              <PaginationLink
                                onClick={() => setCommitsPage(i + 1)}
                                isActive={commitsPage === i + 1}
                                className="cursor-pointer"
                              >
                                {i + 1}
                              </PaginationLink>
                            </PaginationItem>
                          ))}

                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setCommitsPage(p => Math.min(Math.ceil(commitActivity.length / commitsPerPage), p + 1))}
                              className={commitsPage >= Math.ceil(commitActivity.length / commitsPerPage) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>

                      <p className="text-center text-sm text-muted-foreground mt-4">
                        Showing {(commitsPage - 1) * commitsPerPage + 1} - {Math.min(commitsPage * commitsPerPage, commitActivity.length)} of {commitActivity.length} commits
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <GitCommit className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No commits found for this sprint period</p>
                </div>
              )}
            </CardContent>
          </Card>
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
