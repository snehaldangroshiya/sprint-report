import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FileText, Download, Trash2, ArrowLeft, Clock, Eye, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { api } from '../lib/api';

export function ReportViewer() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Fetch report details
  const { data: report, isLoading, error } = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => api.getReport(reportId!),
    enabled: !!reportId,
  });

  // Delete report mutation
  const deleteReport = useMutation({
    mutationFn: () => api.deleteReport(reportId!),
    onSuccess: () => {
      navigate('/');
    },
  });

  const downloadReport = () => {
    if (!report) return;

    const blob = new Blob([report.content], {
      type: report.format === 'html' ? 'text/html' :
           report.format === 'csv' ? 'text/csv' :
           report.format === 'json' ? 'application/json' :
           'text/plain'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sprint-${report.sprint_id}-${report.id}.${report.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = () => {
    if (deleteConfirm) {
      deleteReport.mutate();
    } else {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Report</AlertTitle>
        <AlertDescription>
          <p className="mb-4">
            {error instanceof Error ? error.message : 'Report not found or unable to load.'}
          </p>
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sprint Report</h1>
            <p className="mt-1 text-sm text-gray-500">
              Report ID: {report.id} • Sprint: {report.sprint_id}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            onClick={downloadReport}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleteReport.isPending}
            variant="destructive"
            size="sm"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deleteReport.isPending
              ? 'Deleting...'
              : deleteConfirm
              ? 'Confirm Delete'
              : 'Delete'
            }
          </Button>
        </div>
      </div>

      {/* Report Metadata */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Report Information</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center">
              <FileText className="h-5 w-5 text-gray-400 mr-2" />
              <div>
                <p className="text-sm font-medium text-gray-900">Format</p>
                <p className="text-sm text-gray-500 uppercase">{report.format}</p>
              </div>
            </div>

            <div className="flex items-center">
              <Clock className="h-5 w-5 text-gray-400 mr-2" />
              <div>
                <p className="text-sm font-medium text-gray-900">Created</p>
                <p className="text-sm text-gray-500">
                  {new Date(report.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <Eye className="h-5 w-5 text-gray-400 mr-2" />
              <div>
                <p className="text-sm font-medium text-gray-900">Size</p>
                <p className="text-sm text-gray-500">
                  {(report.content.length / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Report Content</h3>

          <div className="border rounded-md overflow-hidden">
            {report.format === 'html' ? (
              <iframe
                srcDoc={report.content}
                className="w-full h-96 border-0"
                title="Report Preview"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="bg-gray-50">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-900">
                    {report.format.toUpperCase()} Content
                  </span>
                  <span className="text-xs text-gray-500">
                    {report.content.split('\n').length} lines
                  </span>
                </div>
                <pre className="p-4 text-xs overflow-auto h-96 bg-gray-50">
                  {report.content}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}