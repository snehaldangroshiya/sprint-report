/**
 * IssueCard - Reusable issue card component
 * Eliminates ~200 lines of code duplication across 4 sections
 */

import { ExternalLink, CheckCircle, Clock, AlertCircle, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface Issue {
  id: string;
  key: string;
  summary: string;
  status: string;
  assignee: string;
  storyPoints?: number;
  priority: string;
  issueType: string;
  created: string;
  updated: string;
  resolved?: string;
  labels: string[];
  components: string[];
}

export interface IssueCardProps {
  issue: Issue;
  variant?: 'completed' | 'in-progress' | 'todo' | 'discarded';
  jiraBaseUrl?: string;
  showJiraLink?: boolean;
}

const VARIANT_CONFIG = {
  completed: {
    icon: CheckCircle,
    iconColor: 'text-green-600',
    storyPointsColor: 'bg-blue-500',
    opacity: 'opacity-100',
  },
  'in-progress': {
    icon: Clock,
    iconColor: 'text-blue-600',
    storyPointsColor: 'bg-blue-500',
    opacity: 'opacity-100',
  },
  todo: {
    icon: AlertCircle,
    iconColor: 'text-gray-600',
    storyPointsColor: 'bg-blue-500',
    opacity: 'opacity-100',
  },
  discarded: {
    icon: AlertCircle,
    iconColor: 'text-red-600',
    storyPointsColor: 'bg-gray-500',
    opacity: 'opacity-60',
  },
} as const;

export function IssueCard({
  issue,
  variant = 'completed',
  jiraBaseUrl = 'https://jira.sage.com',
  showJiraLink = true,
}: IssueCardProps) {
  const config = VARIANT_CONFIG[variant];
  const StatusIcon = config.icon;

  return (
    <div
      className={`group relative border rounded-lg p-4 hover:bg-accent/50 transition-all duration-200 hover:shadow-sm ${config.opacity}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs">
              {issue.key}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {issue.issueType}
            </Badge>
            {issue.storyPoints && (
              <Badge variant="default" className={`text-xs ${config.storyPointsColor}`}>
                {issue.storyPoints} SP
              </Badge>
            )}
            {variant === 'discarded' && (
              <Badge variant="destructive" className="text-xs">
                {issue.status}
              </Badge>
            )}
          </div>

          {/* Summary */}
          <h4 className={`font-medium text-gray-900 mb-1 ${variant === 'discarded' ? 'line-through text-gray-700' : ''}`}>
            {issue.summary}
          </h4>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {issue.assignee || 'Unassigned'}
            </span>
            {variant !== 'discarded' && (
              <span className="flex items-center gap-1">
                <StatusIcon className={`h-3 w-3 ${config.iconColor}`} />
                {issue.status}
              </span>
            )}
          </div>
        </div>

        {/* Jira Link */}
        {showJiraLink && (
          <a
            href={`${jiraBaseUrl}/browse/${issue.key}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 p-2 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="View in Jira"
            aria-label={`View ${issue.key} in Jira`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}
