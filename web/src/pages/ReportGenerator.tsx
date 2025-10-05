import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileText, Download, Loader2, Settings, TrendingUp, AlertCircle, Users, Code, GitPullRequest, Bug, Zap, Clock, Target, CheckCircle, XCircle, Activity, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '../lib/api';
import { sortSprintsByStartDate } from '../lib/sprint-utils';
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ReportOptions {
  sprint_id: string;
  github_owner?: string;
  github_repo?: string;
  format: 'html' | 'markdown' | 'json';
  include_github: boolean;
  template_type: 'executive' | 'detailed' | 'technical';
}

export function ReportGenerator() {
  const [boardId, setBoardId] = useState('6306'); // Default to user's board
  const [options, setOptions] = useState<ReportOptions>({
    sprint_id: '',
    format: 'html',
    include_github: false,
    template_type: 'detailed'
  });
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'download' | 'comprehensive'>('comprehensive');

  // Debounced GitHub owner/repo to prevent excessive API calls while typing
  const [debouncedGithubOwner, setDebouncedGithubOwner] = useState(options.github_owner);
  const [debouncedGithubRepo, setDebouncedGithubRepo] = useState(options.github_repo);

  // Debounce GitHub owner/repo changes (wait 800ms after user stops typing)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedGithubOwner(options.github_owner);
      setDebouncedGithubRepo(options.github_repo);
    }, 800);

    return () => clearTimeout(timer);
  }, [options.github_owner, options.github_repo]);

  // Fetch sprints when board ID is provided (sorted by start date descending)
  const { data: sprints, isLoading: sprintsLoading } = useQuery({
    queryKey: ['sprints', boardId],
    queryFn: async () => {
      const data = await api.getSprints(boardId, 'closed');
      return sortSprintsByStartDate(data);
    },
    enabled: !!boardId,
  });

  // Fetch comprehensive sprint report data (uses debounced GitHub values)
  const { data: comprehensiveData, isLoading: comprehensiveLoading } = useQuery({
    queryKey: ['comprehensive-report', options.sprint_id, debouncedGithubOwner, debouncedGithubRepo],
    queryFn: () => api.getComprehensiveSprintReport(options.sprint_id, {
      github_owner: debouncedGithubOwner,
      github_repo: debouncedGithubRepo,
      include_tier1: true,
      include_tier2: true,
      include_tier3: true,
      include_forward_looking: true,
      include_enhanced_github: !!debouncedGithubOwner && !!debouncedGithubRepo,
    }),
    enabled: !!options.sprint_id && viewMode === 'comprehensive',
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Generate report mutation
  const generateReport = useMutation({
    mutationFn: api.generateSprintReport,
    onSuccess: (data) => {
      setGeneratedReport(data.report);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!options.sprint_id) return;

    generateReport.mutate(options);
  };

  const downloadReport = () => {
    if (!generatedReport) return;

    const blob = new Blob([generatedReport], {
      type: options.format === 'html' ? 'text/html' :
           options.format === 'json' ? 'application/json' :
           'text/markdown'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sprint-report-${options.sprint_id}.${options.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadPDF = async () => {
    if (!generatedReport) return;

    try {
      const reportData = {
        sprint: { name: `Sprint ${options.sprint_id}` },
        metrics: {
          totalIssues: 25,
          completedIssues: 20,
          velocity: 40,
          completionRate: 80
        },
        // Include generated report content
        content: generatedReport
      };

      const response = await fetch('/api/export/sprint-report/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportData,
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
        a.download = `sprint-${options.sprint_id}-report.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        console.error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Generate Sprint Report</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create comprehensive sprint reports with Jira and GitHub integration
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'comprehensive' ? 'default' : 'outline'}
            onClick={() => setViewMode('comprehensive')}
            size="sm"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Comprehensive View
          </Button>
          <Button
            variant={viewMode === 'download' ? 'default' : 'outline'}
            onClick={() => setViewMode('download')}
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </Button>
        </div>
      </div>

      {/* Configuration Panel - Shared by both views */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Report Configuration
          </CardTitle>
          <CardDescription>
            Select sprint and configure report options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Board ID */}
              <div>
                <label htmlFor="boardId" className="block text-sm font-medium text-gray-700">
                  Jira Board ID
                </label>
                <Input
                  type="text"
                  id="boardId"
                  value={boardId}
                  onChange={(e) => setBoardId(e.target.value)}
                  placeholder="Enter Jira board ID"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

              {/* Sprint Selection */}
              <div>
                <label htmlFor="sprint" className="block text-sm font-medium text-gray-700">
                  Sprint
                </label>


                 <Select
                  value={options.sprint_id}
                  onValueChange={(e) => setOptions({ ...options, sprint_id: e as any })}
                  disabled={!sprints || sprintsLoading}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select a sprint" />
                  </SelectTrigger>
                  <SelectContent>

                    {sprints?.map((sprint: any) => (
                    <SelectItem key={sprint.id} value={sprint.id}>
                      {sprint.name} ({sprint.state})
                    </SelectItem>
                  ))}
                  </SelectContent>
                </Select>
                {sprintsLoading && <Skeleton className="mt-1 h-4 w-32" />}
              </div>

              {/* GitHub Repository (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    GitHub Integration (Optional)
                  </label>
                  {(options.github_owner !== debouncedGithubOwner || options.github_repo !== debouncedGithubRepo) && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Waiting to load...
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Input
                      type="text"
                      id="github_owner"
                      value={options.github_owner || ''}
                      onChange={(e) => setOptions({ ...options, github_owner: e.target.value || undefined })}
                      placeholder="GitHub Owner (e.g., Sage)"
                      className="block w-full"
                    />
                  </div>
                  <div>
                    <Input
                      type="text"
                      id="github_repo"
                      value={options.github_repo || ''}
                      onChange={(e) => setOptions({ ...options, github_repo: e.target.value || undefined })}
                      placeholder="Repository (e.g., sage-connect)"
                      className="block w-full"
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Data will load automatically 800ms after you stop typing
                </p>
              </div>

              {/* Format */}
              <div>
                <label htmlFor="format" className="block text-sm font-medium text-gray-700">
                  Report Format
                </label>
                <Select
                  value={options.format}
                  onValueChange={(e) => setOptions({ ...options, format: e as any })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Template Type */}
              <div>
                <label htmlFor="template_type" className="block text-sm font-medium text-gray-700">
                  Template Type
                </label>

                <Select
                  value={options.template_type}
                  onValueChange={(e) => setOptions({ ...options, template_type: e as any })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select template type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="executive">Executive Summary</SelectItem>
                    <SelectItem value="detailed">Detailed Report</SelectItem>
                    <SelectItem value="technical">Technical Analysis</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Include Options */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">GitHub Integration</label>

                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={options.include_github}
                      onChange={(e) => setOptions({ ...options, include_github: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include GitHub Commits & PRs</span>
                  </label>
                  <p className="ml-6 text-xs text-gray-500">
                    Requires GitHub owner and repository to be specified above
                  </p>
                </div>
              </div>

              {/* Submit Button - Only show in download mode */}
              {viewMode === 'download' && (
                <Button
                  type="submit"
                  disabled={!options.sprint_id || generateReport.isPending}
                  className="w-full"
                >
                  {generateReport.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
              )}
            </form>

            {/* Error Display */}
            {generateReport.error && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>
                  Error: {(generateReport.error as any).message || 'Failed to generate report'}
                </AlertDescription>
              </Alert>
            )}
        </CardContent>
      </Card>

      {/* Download Mode - Report Preview/Download */}
      {viewMode === 'download' && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Report</CardTitle>
            <CardDescription>Preview and download your sprint report</CardDescription>
          </CardHeader>
          <CardContent>
            {generatedReport ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">
                    Report generated successfully ({options.format} format)
                  </p>
                  <div className="flex space-x-2">
                    <Button
                      onClick={downloadReport}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download {options.format.toUpperCase()}
                    </Button>
                    <Button
                      onClick={downloadPDF}
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  </div>
                </div>

                {/* Preview */}
                <div className="border rounded-md overflow-hidden">
                  {options.format === 'html' ? (
                    <iframe
                      srcDoc={generatedReport}
                      className="w-full h-96 border-0"
                      title="Report Preview"
                    />
                  ) : (
                    <pre className="p-4 text-xs overflow-auto h-96 bg-gray-50">
                      {generatedReport.substring(0, 2000)}
                      {generatedReport.length > 2000 && '...'}
                    </pre>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No report generated</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Configure options and click Generate Report to create a sprint report.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Comprehensive Mode - All Metrics Display */}
      {viewMode === 'comprehensive' && options.sprint_id && (
        <>
          {comprehensiveLoading ? (
            <Card>
              <CardContent className="p-8">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin mr-3" />
                  <span>Loading comprehensive sprint report...</span>
                </div>
              </CardContent>
            </Card>
          ) : comprehensiveData ? (
            <Tabs defaultValue="forecast" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="forecast">Next Sprint</TabsTrigger>
                <TabsTrigger value="github">GitHub Metrics</TabsTrigger>
                <TabsTrigger value="team">Team & Quality</TabsTrigger>
                <TabsTrigger value="technical">Technical Health</TabsTrigger>
              </TabsList>

              {/* Tab 1: Next Sprint Forecast & Carryover */}
              <TabsContent value="forecast" className="space-y-4">
                {comprehensiveData.forward_looking && (
                  <>
                    {/* Next Sprint Forecast */}
                    {comprehensiveData.forward_looking.next_sprint_forecast && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-blue-600" />
                            Next Sprint Forecast
                          </CardTitle>
                          <CardDescription>Projected capacity and recommended commitment</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Recommended Points</div>
                              <div className="text-2xl font-bold text-blue-700">
                                {comprehensiveData.forward_looking.next_sprint_forecast.recommended_story_points}
                              </div>
                              <div className="text-xs text-gray-500">Based on velocity</div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Confidence Level</div>
                              <div className="text-2xl font-bold text-green-700">
                                {(comprehensiveData.forward_looking.next_sprint_forecast.confidence_level * 100).toFixed(0)}%
                              </div>
                              <div className="text-xs text-gray-500">Success probability</div>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Team Capacity</div>
                              <div className="text-2xl font-bold text-purple-700">
                                {comprehensiveData.forward_looking.next_sprint_forecast.team_capacity.toFixed(1)}
                              </div>
                              <div className="text-xs text-gray-500">Available points</div>
                            </div>
                          </div>
                          {comprehensiveData.forward_looking.next_sprint_forecast.recommendations && (
                            <div className="space-y-2">
                              <div className="font-semibold text-sm">Recommendations:</div>
                              {comprehensiveData.forward_looking.next_sprint_forecast.recommendations.map((rec: string, idx: number) => (
                                <Alert key={idx}>
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>{rec}</AlertDescription>
                                </Alert>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Carryover Items */}
                    {comprehensiveData.forward_looking.carryover_items && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-orange-600" />
                            Carryover Items Analysis
                          </CardTitle>
                          <CardDescription>Items requiring continued attention</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-orange-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Total Carryover</div>
                              <div className="text-2xl font-bold text-orange-700">
                                {comprehensiveData.forward_looking.carryover_items.total_items}
                              </div>
                              <div className="text-xs text-gray-500">
                                {comprehensiveData.forward_looking.carryover_items.total_story_points} story points
                              </div>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Impact</div>
                              <div className="text-2xl font-bold text-red-700">
                                {(comprehensiveData.forward_looking.carryover_items.percentage_of_sprint * 100).toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500">Of sprint capacity</div>
                            </div>
                          </div>
                          {comprehensiveData.forward_looking.carryover_items.high_priority_items?.length > 0 && (
                            <div>
                              <div className="font-semibold text-sm mb-2">High Priority Carryovers:</div>
                              <div className="space-y-2">
                                {comprehensiveData.forward_looking.carryover_items.high_priority_items.map((item: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <span className="text-sm font-mono">{item.key}</span>
                                    <div className="flex gap-2">
                                      <Badge variant="destructive">{item.priority}</Badge>
                                      <Badge>{item.story_points} pts</Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </TabsContent>

              {/* Tab 2: GitHub Metrics */}
              <TabsContent value="github" className="space-y-4">
                {comprehensiveData.enhanced_github ? (
                  <>
                    {/* Commit Activity */}
                    {comprehensiveData.enhanced_github.commit_activity && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Code className="h-5 w-5 text-green-600" />
                            Commit Activity
                          </CardTitle>
                          <CardDescription>Development activity and contribution patterns</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-4 gap-4">
                            <div className="bg-green-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Total Commits</div>
                              <div className="text-2xl font-bold text-green-700">
                                {comprehensiveData.enhanced_github.commit_activity.total_commits}
                              </div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Avg Commits/Day</div>
                              <div className="text-2xl font-bold text-blue-700">
                                {comprehensiveData.enhanced_github.commit_activity.average_commits_per_day.toFixed(1)}
                              </div>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Peak Day</div>
                              <div className="text-sm font-bold text-purple-700 truncate">
                                {new Date(comprehensiveData.enhanced_github.commit_activity.peak_commit_day).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="bg-indigo-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Contributors</div>
                              <div className="text-2xl font-bold text-indigo-700">
                                {Object.keys(comprehensiveData.enhanced_github.commit_activity.commits_by_author).length}
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-sm mb-2">Top Contributors:</div>
                            <div className="space-y-1">
                              {Object.entries(comprehensiveData.enhanced_github.commit_activity.commits_by_author)
                                .sort((a: any, b: any) => b[1] - a[1])
                                .slice(0, 5)
                                .map(([author, commits]: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <span className="text-sm">{author}</span>
                                    <Badge>{commits} commits</Badge>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Pull Request Stats */}
                    {comprehensiveData.enhanced_github.pull_request_stats && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <GitPullRequest className="h-5 w-5 text-purple-600" />
                            Pull Request Statistics
                          </CardTitle>
                          <CardDescription>PR review time and merge rates</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-purple-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Total PRs</div>
                              <div className="text-2xl font-bold text-purple-700">
                                {comprehensiveData.enhanced_github.pull_request_stats.total_prs}
                              </div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Merge Rate</div>
                              <div className="text-2xl font-bold text-green-700">
                                {(comprehensiveData.enhanced_github.pull_request_stats.merge_rate * 100).toFixed(0)}%
                              </div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Avg Time to Merge</div>
                              <div className="text-xl font-bold text-blue-700">
                                {(comprehensiveData.enhanced_github.pull_request_stats.average_time_to_merge / 3600).toFixed(1)}h
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Code Changes */}
                    {comprehensiveData.enhanced_github.code_change_stats && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                            Code Changes Analysis
                          </CardTitle>
                          <CardDescription>Lines added, removed, and net changes</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-4 gap-4">
                            <div className="bg-green-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Lines Added</div>
                              <div className="text-2xl font-bold text-green-700">
                                +{comprehensiveData.enhanced_github.code_change_stats.total_lines_added.toLocaleString()}
                              </div>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Lines Deleted</div>
                              <div className="text-2xl font-bold text-red-700">
                                -{comprehensiveData.enhanced_github.code_change_stats.total_lines_deleted.toLocaleString()}
                              </div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Net Change</div>
                              <div className="text-2xl font-bold text-blue-700">
                                {comprehensiveData.enhanced_github.code_change_stats.net_line_change.toLocaleString()}
                              </div>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Files Changed</div>
                              <div className="text-2xl font-bold text-purple-700">
                                {comprehensiveData.enhanced_github.code_change_stats.files_changed}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Code Review Stats */}
                    {comprehensiveData.enhanced_github.code_review_stats && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            Code Review Statistics
                          </CardTitle>
                          <CardDescription>Review participation and approval rates</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Total Reviews</div>
                              <div className="text-2xl font-bold text-blue-700">
                                {comprehensiveData.enhanced_github.code_review_stats.total_reviews}
                              </div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Approval Rate</div>
                              <div className="text-2xl font-bold text-green-700">
                                {(comprehensiveData.enhanced_github.code_review_stats.approval_rate * 100).toFixed(0)}%
                              </div>
                            </div>
                            <div className="bg-orange-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Changes Requested</div>
                              <div className="text-2xl font-bold text-orange-700">
                                {(comprehensiveData.enhanced_github.code_review_stats.changes_requested_rate * 100).toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      GitHub integration not configured. Add GitHub owner and repository to see detailed metrics.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              {/* Tab 3: Team & Quality Metrics */}
              <TabsContent value="team" className="space-y-4">
                {comprehensiveData.tier2 && (
                  <>
                    {/* Team Capacity */}
                    {comprehensiveData.tier2.team_capacity && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600" />
                            Team Capacity
                          </CardTitle>
                          <CardDescription>Planned vs actual capacity utilization</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Planned Capacity</div>
                              <div className="text-2xl font-bold text-blue-700">
                                {comprehensiveData.tier2.team_capacity.planned_capacity} pts
                              </div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Actual Delivered</div>
                              <div className="text-2xl font-bold text-green-700">
                                {comprehensiveData.tier2.team_capacity.actual_delivered} pts
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Bug Metrics */}
                    {comprehensiveData.tier2.bug_metrics && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Bug className="h-5 w-5 text-red-600" />
                            Bug Metrics
                          </CardTitle>
                          <CardDescription>Bugs created vs resolved during sprint</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-red-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Created</div>
                              <div className="text-2xl font-bold text-red-700">
                                {comprehensiveData.tier2.bug_metrics.bugs_created}
                              </div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Resolved</div>
                              <div className="text-2xl font-bold text-green-700">
                                {comprehensiveData.tier2.bug_metrics.bugs_resolved}
                              </div>
                            </div>
                            <div className={`p-4 rounded-lg ${comprehensiveData.tier2.bug_metrics.net_bug_change > 0 ? "bg-red-50" : "bg-green-50"}`}>
                              <div className="text-sm text-gray-600">Net Change</div>
                              <div className={`text-2xl font-bold ${comprehensiveData.tier2.bug_metrics.net_bug_change > 0 ? "text-red-700" : "text-green-700"}`}>
                                {comprehensiveData.tier2.bug_metrics.net_bug_change > 0 ? '+' : ''}
                                {comprehensiveData.tier2.bug_metrics.net_bug_change}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Cycle Time Metrics */}
                    {comprehensiveData.tier2.cycle_time_metrics && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-purple-600" />
                            Cycle Time Metrics
                          </CardTitle>
                          <CardDescription>Time from start to completion</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-purple-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Average Cycle Time</div>
                              <div className="text-2xl font-bold text-purple-700">
                                {comprehensiveData.tier2.cycle_time_metrics.average_cycle_time.toFixed(1)} days
                              </div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Lead Time</div>
                              <div className="text-2xl font-bold text-blue-700">
                                {comprehensiveData.tier2.cycle_time_metrics.average_lead_time.toFixed(1)} days
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Blockers */}
                    {comprehensiveData.tier2.blockers && comprehensiveData.tier2.blockers.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-orange-600" />
                            Blockers & Dependencies
                          </CardTitle>
                          <CardDescription>Issues blocking progress</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {comprehensiveData.tier2.blockers.map((blocker: any, idx: number) => (
                              <Alert key={idx} variant="destructive">
                                <AlertDescription>
                                  <strong>{blocker.key}:</strong> {blocker.summary}
                                </AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </TabsContent>

              {/* Tab 4: Technical Health */}
              <TabsContent value="technical" className="space-y-4">
                {comprehensiveData.tier3 && (
                  <>
                    {/* Technical Debt */}
                    {comprehensiveData.tier3.technical_debt && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-yellow-600" />
                            Technical Debt
                          </CardTitle>
                          <CardDescription>Technical debt items and impact</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-yellow-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Total Items</div>
                              <div className="text-2xl font-bold text-yellow-700">
                                {comprehensiveData.tier3.technical_debt.total_items}
                              </div>
                            </div>
                            <div className="bg-orange-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Story Points</div>
                              <div className="text-2xl font-bold text-orange-700">
                                {comprehensiveData.tier3.technical_debt.total_story_points}
                              </div>
                            </div>
                          </div>
                          {comprehensiveData.tier3.technical_debt.items?.length > 0 && (
                            <div className="space-y-2">
                              {comprehensiveData.tier3.technical_debt.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                  <span className="text-sm font-mono">{item.key}</span>
                                  <Badge>{item.story_points} pts</Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Epic Progress */}
                    {comprehensiveData.tier3.epic_progress && comprehensiveData.tier3.epic_progress.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-indigo-600" />
                            Epic Progress
                          </CardTitle>
                          <CardDescription>Completion status of active epics</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {comprehensiveData.tier3.epic_progress.map((epic: any, idx: number) => (
                            <div key={idx} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{epic.epic_name || epic.epic_key}</span>
                                <Badge>{epic.completion_percentage.toFixed(0)}%</Badge>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-indigo-600 h-2 rounded-full"
                                  style={{ width: `${epic.completion_percentage}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>{epic.completed_issues} / {epic.total_issues} issues</span>
                                <span>{epic.completed_story_points} / {epic.total_story_points} pts</span>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Risk Items */}
                    {comprehensiveData.tier3.risks && comprehensiveData.tier3.risks.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-red-600" />
                            Risk Items
                          </CardTitle>
                          <CardDescription>Identified risks and concerns</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {comprehensiveData.tier3.risks.map((risk: any, idx: number) => (
                              <Alert key={idx} variant="destructive">
                                <AlertDescription>
                                  <div className="flex items-center justify-between mb-1">
                                    <strong>{risk.key}</strong>
                                    <Badge variant="destructive">{risk.severity || 'High'}</Badge>
                                  </div>
                                  <div className="text-sm">{risk.summary}</div>
                                  {risk.description && (
                                    <div className="text-xs text-gray-600 mt-1">{risk.description}</div>
                                  )}
                                </AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          ) : null}
        </>
      )}

      {viewMode === 'comprehensive' && !options.sprint_id && (
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Sprint</h3>
            <p className="text-sm text-gray-500">
              Choose a sprint from the configuration panel above to view comprehensive analytics
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
