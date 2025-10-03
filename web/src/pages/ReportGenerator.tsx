import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileText, Download, Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

  // Fetch sprints when board ID is provided (sorted by start date descending)
  const { data: sprints, isLoading: sprintsLoading } = useQuery({
    queryKey: ['sprints', boardId],
    queryFn: async () => {
      const data = await api.getSprints(boardId, 'closed');
      return sortSprintsByStartDate(data);
    },
    enabled: !!boardId,
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Generate Sprint Report</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create comprehensive sprint reports with Jira and GitHub integration
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Report Configuration */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Report Configuration asdasdasdasdasdasd
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Board ID */}
              <div>
                <label htmlFor="boardId" className="block text-sm font-medium text-gray-700">
                  Jira Board ID sdsddd
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="github_owner" className="block text-sm font-medium text-gray-700">
                    GitHub Owner
                  </label>
                  <Input
                    type="text"
                    id="github_owner"
                    value={options.github_owner || ''}
                    onChange={(e) => setOptions({ ...options, github_owner: e.target.value || undefined })}
                    placeholder="organization"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="github_repo" className="block text-sm font-medium text-gray-700">
                    GitHub Repository
                  </label>
                  <Input
                    type="text"
                    id="github_repo"
                    value={options.github_repo || ''}
                    onChange={(e) => setOptions({ ...options, github_repo: e.target.value || undefined })}
                    placeholder="repository"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
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

              {/* Submit Button */}
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
            </form>

            {/* Error Display */}
            {generateReport.error && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>
                  Error: {(generateReport.error as any).message || 'Failed to generate report'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {/* Report Preview/Download */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Generated Report</h3>

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
          </div>
        </div>
      </div>
    </div>
  );
}
