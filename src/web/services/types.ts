/**
 * Type definitions for web services
 */

// Logger type (matches src/utils/logger.ts)
export interface Logger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (error: Error | string, operation?: string, data?: unknown) => void;
  logError: (error: Error, operation: string, data?: unknown) => void;
}

// Sprint types
export interface Sprint {
  id: string;
  name: string;
  state?: 'active' | 'closed' | 'future';
  startDate?: string;
  endDate?: string;
}

// Issue types
export interface Issue {
  key?: string;
  status?: string;
  storyPoints?: number;
  issueType?: string;
  type?: string;
  fields?: {
    sprint?: { id: string };
    [key: string]: unknown;
  };
}

// Commit types
export interface Commit {
  date?: string;
  commit?: {
    committer?: {
      date?: string;
    };
  };
}

// Pull Request types
export interface PullRequest {
  mergedAt?: string;
  merged_at?: string;
  closedAt?: string;
  closed_at?: string;
  createdAt?: string;
  created_at?: string;
}

// Changelog types
export interface ChangelogItem {
  field?: string;
  to?: string;
  from?: string;
}

export interface Changelog {
  items?: ChangelogItem[];
}

// Analytics result types
export interface MonthlyData {
  date: string;
  commits: number;
  prs: number;
}

export interface SprintVelocityData {
  id: string;
  name: string;
  velocity: number;
  commitment: number;
  completed: number;
}

export interface VelocityResult {
  sprints: SprintVelocityData[];
  average: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface TeamPerformance {
  name: string;
  planned: number;
  completed: number;
  velocity: number;
}

export interface IssueTypeDistribution {
  name: string;
  value: number;
  color: string;
}

// Cache metadata type
export interface CacheMetadata {
  createdAt: number;
}
