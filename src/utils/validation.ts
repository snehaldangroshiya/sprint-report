// Input validation utilities

import { z } from 'zod';

import { InputValidationError, SecurityError } from './errors';

// Common validation patterns
export const ValidationPatterns = {
  sprintId: /^\d{1,20}$/,
  boardId: /^\d{1,20}$/,
  issueKey: /^[A-Z][A-Z0-9_]*-\d+$/,
  repositoryOwner: /^[a-zA-Z0-9\-_]{1,50}$/,
  repositoryName: /^[a-zA-Z0-9\-_\.]{1,100}$/,
  dateISO: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
  sha: /^[a-f0-9]{7,40}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

// Base validation schemas
export const BaseSchemas = {
  sprintId: z
    .string()
    .regex(ValidationPatterns.sprintId, 'Sprint ID must be numeric'),
  boardId: z
    .string()
    .regex(ValidationPatterns.boardId, 'Board ID must be numeric'),
  issueKey: z
    .string()
    .regex(ValidationPatterns.issueKey, 'Invalid Jira issue key format'),
  repositoryOwner: z
    .string()
    .regex(ValidationPatterns.repositoryOwner, 'Invalid repository owner'),
  repositoryName: z
    .string()
    .regex(ValidationPatterns.repositoryName, 'Invalid repository name'),
  dateString: z.string().datetime('Invalid ISO date format'),
  sha: z.string().regex(ValidationPatterns.sha, 'Invalid git SHA format'),

  repository: z.object({
    owner: z
      .string()
      .regex(ValidationPatterns.repositoryOwner, 'Invalid repository owner'),
    repo: z
      .string()
      .regex(ValidationPatterns.repositoryName, 'Invalid repository name'),
  }),

  dateRange: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .refine(
      data => new Date(data.start) < new Date(data.end),
      'Start date must be before end date'
    ),

  pagination: z.object({
    page: z.number().int().min(1).max(1000).default(1),
    limit: z.number().int().min(1).max(1000).default(50),
  }),
} as const;

// MCP tool parameter validation schemas
export const MCPToolSchemas = {
  jiraGetSprints: z.object({
    board_id: BaseSchemas.boardId,
    state: z.enum(['active', 'closed', 'future']).default('active'),
  }),

  jiraGetSprintIssues: z.object({
    sprint_id: BaseSchemas.sprintId,
    fields: z.array(z.string()).optional(),
    max_results: z.number().int().min(1).max(1000).default(100),
  }),

  jiraGetIssueDetails: z.object({
    issue_key: BaseSchemas.issueKey,
    expand: z.array(z.string()).default(['changelog', 'comments']),
  }),

  jiraGetIssue: z.object({
    issue_key: BaseSchemas.issueKey,
    expand: z.array(z.string()).default(['changelog', 'comments']),
  }),

  jiraGetSprintDetails: z.object({
    sprint_id: BaseSchemas.sprintId,
    include_issues: z.boolean().default(true),
  }),

  jiraGetVelocityData: z.object({
    board_id: BaseSchemas.boardId,
    sprint_count: z.number().int().min(1).max(20).optional(),
  }),

  jiraGetBurndownData: z.object({
    sprint_id: BaseSchemas.sprintId,
  }),

  jiraSearchIssues: z.object({
    jql: z.string().max(1000, 'JQL query too long'),
    fields: z.array(z.string()).optional(),
    max_results: z.number().int().min(1).max(1000).default(100),
  }),

  githubGetCommits: z.object({
    owner: BaseSchemas.repositoryOwner,
    repo: BaseSchemas.repositoryName,
    since: BaseSchemas.dateString.optional(),
    until: BaseSchemas.dateString.optional(),
    author: z.string().max(100).optional(),
    per_page: z.number().int().min(1).max(100).default(30),
    page: z.number().int().min(1).max(1000).default(1),
  }),

  githubGetPullRequests: z.object({
    owner: BaseSchemas.repositoryOwner,
    repo: BaseSchemas.repositoryName,
    state: z.enum(['open', 'closed', 'all']).default('all'),
    since: BaseSchemas.dateString.optional(),
    until: BaseSchemas.dateString.optional(),
    per_page: z.number().int().min(1).max(100).default(30),
    page: z.number().int().min(1).max(1000).default(1),
  }),

  githubSearchCommitsByMessage: z.object({
    owner: BaseSchemas.repositoryOwner,
    repo: BaseSchemas.repositoryName,
    query: z.string().min(1).max(256, 'Search query too long'),
    since: BaseSchemas.dateString.optional(),
    until: BaseSchemas.dateString.optional(),
  }),

  githubSearchPullRequestsByDate: z.object({
    owner: BaseSchemas.repositoryOwner,
    repo: BaseSchemas.repositoryName,
    since: BaseSchemas.dateString.optional(),
    until: BaseSchemas.dateString.optional(),
    state: z.enum(['open', 'closed', 'merged', 'all']).default('all'),
  }),

  correlateIssuesWithCommits: z.object({
    sprint_id: BaseSchemas.sprintId,
    github_repos: z
      .array(BaseSchemas.repository)
      .min(1, 'At least one repository required')
      .max(10, 'Too many repositories'),
  }),

  generateBasicSprintReport: z.object({
    sprint_id: BaseSchemas.sprintId,
    github_repos: z
      .array(BaseSchemas.repository)
      .max(10, 'Too many repositories'),
    format: z.enum(['html', 'json']).default('html'),
    include_charts: z.boolean().default(true),
    include_details: z.boolean().default(true),
  }),

  generateSprintReport: z.object({
    sprint_id: BaseSchemas.sprintId,
    github_owner: BaseSchemas.repositoryOwner.optional(),
    github_repo: BaseSchemas.repositoryName.optional(),
    format: z.enum(['markdown', 'html', 'json', 'csv']).default('markdown'),
    include_commits: z.boolean().default(false),
    include_prs: z.boolean().default(false),
    include_velocity: z.boolean().default(false),
    include_burndown: z.boolean().default(false),
    include_tier1: z.boolean().default(false),
    include_tier2: z.boolean().default(false),
    include_tier3: z.boolean().default(false),
    include_forward_looking: z.boolean().default(false),
    include_enhanced_github: z.boolean().default(false),
    since: BaseSchemas.dateString.optional(),
    until: BaseSchemas.dateString.optional(),
    theme: z.enum(['default', 'dark', 'corporate']).default('default'),
    max_commits_per_issue: z.number().int().min(1).max(20).default(10),
    max_prs_per_issue: z.number().int().min(1).max(10).default(5),
  }),

  getSprintMetrics: z.object({
    sprint_id: BaseSchemas.sprintId,
    include_velocity: z.boolean().default(false),
    include_burndown: z.boolean().default(false),
    velocity_history_count: z.number().int().min(1).max(10).default(3),
  }),

  githubFindCommitsWithJiraReferences: z.object({
    owner: BaseSchemas.repositoryOwner,
    repo: BaseSchemas.repositoryName,
    issue_keys: z
      .array(BaseSchemas.issueKey)
      .min(1)
      .max(100, 'Too many issue keys'),
    since: BaseSchemas.dateString.optional(),
    until: BaseSchemas.dateString.optional(),
    max_commits_per_issue: z.number().int().min(1).max(50).default(20),
  }),

  healthCheck: z.object({
    include_detailed_status: z.boolean().default(false),
    check_external_dependencies: z.boolean().default(true),
  }),

  cacheStats: z.object({
    include_detailed_breakdown: z.boolean().default(false),
    reset_stats: z.boolean().default(false),
  }),

  // Report management schemas
  getReport: z.object({
    report_id: z.string(),
  }),

  deleteReport: z.object({
    report_id: z.string(),
  }),

  exportSprintReportToPDF: z.object({
    report_id: z.string(),
    format: z.enum(['pdf', 'html']).default('pdf'),
  }),

  exportAnalyticsToPDF: z.object({
    sprint_id: BaseSchemas.sprintId,
    format: z.enum(['pdf', 'html']).default('pdf'),
  }),

  getAnalyticsReport: z.object({
    board_id: BaseSchemas.boardId,
    owner: z.string().optional(),
    repo: z.string().optional(),
    period: z.enum(['1month', '3months', '6months', '1year']).optional(),
  }),

  getVelocityData: z.object({
    board_id: BaseSchemas.boardId,
    sprint_count: z.number().int().min(1).max(20).optional(),
  }),

  getBurndownData: z.object({
    board_id: BaseSchemas.boardId,
    sprints: z.number().int().min(1).max(10).optional(),
  }),

  getTeamPerformanceData: z.object({
    board_id: BaseSchemas.boardId,
    sprints: z.number().int().min(1).max(10).optional(),
  }),

  // GitHub-specific schemas
  githubGetRepository: z.object({
    owner: BaseSchemas.repositoryOwner,
    repo: BaseSchemas.repositoryName,
  }),

  githubGetCommitTrends: z.object({
    owner: BaseSchemas.repositoryOwner,
    repo: BaseSchemas.repositoryName,
    period: z
      .enum(['1month', '3months', '6months', '1year'])
      .default('6months'),
  }),

  githubGetRepositoryStats: z.object({
    owner: BaseSchemas.repositoryOwner,
    repo: BaseSchemas.repositoryName,
    period: z.enum(['1month', '3months', '6months', '1year']).optional(),
  }),

  // Comprehensive sprint report (matches Web API endpoint)
  generateComprehensiveReport: z.object({
    sprint_id: BaseSchemas.sprintId,
    github_owner: BaseSchemas.repositoryOwner.optional(),
    github_repo: BaseSchemas.repositoryName.optional(),
    include_tier1: z.boolean().default(true),
    include_tier2: z.boolean().default(true),
    include_tier3: z.boolean().default(false),
    include_forward_looking: z.boolean().default(false),
    include_enhanced_github: z.boolean().default(true),
    nocache: z.boolean().default(false), // For debugging
  }),
} as const;

// JQL security validation
export class JQLValidator {
  private static readonly DANGEROUS_PATTERNS = [
    /\bDROP\b/i,
    /\bDELETE\b/i,
    /\bUPDATE\b/i,
    /\bINSERT\b/i,
    /\bEXEC\b/i,
    /\bSCRIPT\b/i,
    /<script/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i,
    /eval\s*\(/i,
    /setTimeout\s*\(/i,
    /setInterval\s*\(/i,
  ];

  static validateJQL(jql: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(jql)) {
        errors.push(`Dangerous pattern detected: ${pattern.source}`);
      }
    }

    // Basic structure validation
    if (jql.includes('/*') || jql.includes('*/')) {
      errors.push('SQL-style comments are not allowed');
    }

    if (jql.includes('--')) {
      errors.push('SQL-style line comments are not allowed');
    }

    // Check for excessive complexity
    const wordCount = jql.split(/\s+/).length;
    if (wordCount > 100) {
      errors.push('JQL query is too complex');
    }

    // Check for nested queries (basic check)
    const openParens = (jql.match(/\(/g) || []).length;
    const closeParens = (jql.match(/\)/g) || []).length;

    if (openParens !== closeParens) {
      errors.push('Unbalanced parentheses in JQL query');
    }

    if (openParens > 10) {
      errors.push('JQL query has too many nested conditions');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static sanitizeJQL(jql: string): string {
    // Basic sanitization
    return jql
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
      .replace(/--.*$/gm, '') // Remove -- comments
      .trim();
  }
}

// Input sanitizer
export class InputSanitizer {
  static sanitizeString(input: string, maxLength = 1000): string {
    return input
      .trim()
      .slice(0, maxLength)
      .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
      .replace(/[<>]/g, ''); // Remove angle brackets
  }

  static sanitizeArray(
    input: string[],
    maxItems = 100,
    maxLength = 100
  ): string[] {
    return input
      .slice(0, maxItems)
      .map(item => this.sanitizeString(item, maxLength))
      .filter(item => item.length > 0);
  }

  static sanitizeObject(
    input: Record<string, any>,
    allowedKeys: string[]
  ): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const key of allowedKeys) {
      if (key in input) {
        const value = input[key];

        if (typeof value === 'string') {
          sanitized[key] = this.sanitizeString(value);
        } else if (
          Array.isArray(value) &&
          value.every(item => typeof item === 'string')
        ) {
          sanitized[key] = this.sanitizeArray(value);
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }
}

// Validation utilities
export class ValidationUtils {
  static validateAndParse<T>(
    schema: z.ZodSchema<T>,
    input: unknown,
    _context?: string
  ): T {
    try {
      return schema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        if (firstError) {
          throw new InputValidationError(
            firstError.path.join('.') || 'root',
            input,
            firstError.message
          );
        }
      }
      throw error;
    }
  }

  static validateJQL(jql: string): void {
    const result = JQLValidator.validateJQL(jql);
    if (!result.valid) {
      throw new SecurityError(`Invalid JQL query: ${result.errors.join(', ')}`);
    }
  }

  static validateDateRange(start: string, end: string): void {
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime())) {
      throw new InputValidationError(
        'start',
        start,
        'Invalid start date format'
      );
    }

    if (isNaN(endDate.getTime())) {
      throw new InputValidationError('end', end, 'Invalid end date format');
    }

    if (startDate >= endDate) {
      throw new InputValidationError(
        'dateRange',
        { start, end },
        'Start date must be before end date'
      );
    }

    // Check for reasonable date range (not more than 1 year)
    const maxDays = 365;
    const diffDays =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays > maxDays) {
      throw new InputValidationError(
        'dateRange',
        { start, end },
        `Date range too large. Maximum ${maxDays} days allowed`
      );
    }
  }

  static validateRepositoryList(
    repos: Array<{ owner: string; repo: string }>
  ): void {
    if (repos.length === 0) {
      throw new InputValidationError(
        'github_repos',
        repos,
        'At least one repository is required'
      );
    }

    if (repos.length > 10) {
      throw new InputValidationError(
        'github_repos',
        repos,
        'Maximum 10 repositories allowed'
      );
    }

    // Check for duplicates
    const repoKeys = new Set();
    for (const repo of repos) {
      const key = `${repo.owner}/${repo.repo}`;
      if (repoKeys.has(key)) {
        throw new InputValidationError(
          'github_repos',
          repos,
          `Duplicate repository: ${key}`
        );
      }
      repoKeys.add(key);
    }
  }

  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9\-_\.]/g, '_') // Replace invalid chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .slice(0, 255); // Limit length
  }

  static validatePaginationParams(page: number, limit: number): void {
    if (page < 1 || page > 1000) {
      throw new InputValidationError(
        'page',
        page,
        'Page must be between 1 and 1000'
      );
    }

    if (limit < 1 || limit > 1000) {
      throw new InputValidationError(
        'limit',
        limit,
        'Limit must be between 1 and 1000'
      );
    }
  }
}

// Request size validator
export class RequestSizeValidator {
  private static readonly MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_ARRAY_LENGTH = 1000;
  private static readonly MAX_STRING_LENGTH = 10000;

  static validateRequestSize(data: any): void {
    const size = this.calculateObjectSize(data);
    if (size > this.MAX_REQUEST_SIZE) {
      throw new SecurityError(
        `Request size ${size} bytes exceeds maximum ${this.MAX_REQUEST_SIZE} bytes`
      );
    }
  }

  static validateArrayLength(array: any[], name: string): void {
    if (array.length > this.MAX_ARRAY_LENGTH) {
      throw new InputValidationError(
        name,
        array,
        `Array length ${array.length} exceeds maximum ${this.MAX_ARRAY_LENGTH}`
      );
    }
  }

  static validateStringLength(
    str: string,
    name: string,
    maxLength = this.MAX_STRING_LENGTH
  ): void {
    if (str.length > maxLength) {
      throw new InputValidationError(
        name,
        str,
        `String length ${str.length} exceeds maximum ${maxLength}`
      );
    }
  }

  private static calculateObjectSize(obj: any): number {
    return JSON.stringify(obj).length * 2; // Rough estimate (UTF-16)
  }
}

// Helper function to convert Zod schema to MCP-compatible JSON Schema
function zodToMCPSchema(zodSchema: z.ZodObject<any>): {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
} {
  const shape = zodSchema._def.shape();
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodField = value as z.ZodTypeAny;

    // Convert Zod type to JSON Schema type
    properties[key] = zodTypeToJsonSchema(zodField);

    // Check if field is optional
    if (!zodField.isOptional()) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

// Helper function to convert Zod types to JSON Schema types
function zodTypeToJsonSchema(zodType: z.ZodTypeAny): any {
  // Unwrap optional and default
  let type = zodType;
  while (type instanceof z.ZodOptional || type instanceof z.ZodDefault) {
    type = type._def.innerType;
  }

  // Handle different Zod types
  if (type instanceof z.ZodString) {
    return { type: 'string' };
  } else if (type instanceof z.ZodNumber) {
    const schema: any = { type: 'number' };
    // Add constraints if available
    const checks = (type as any)._def.checks || [];
    for (const check of checks) {
      if (check.kind === 'min') schema.minimum = check.value;
      if (check.kind === 'max') schema.maximum = check.value;
      if (check.kind === 'int') schema.type = 'integer';
    }
    return schema;
  } else if (type instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  } else if (type instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodTypeToJsonSchema(type._def.type),
    };
  } else if (type instanceof z.ZodObject) {
    return zodToMCPSchema(type);
  } else if (type instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: type._def.values,
    };
  } else if (type instanceof z.ZodLiteral) {
    return {
      type: typeof type._def.value,
      const: type._def.value,
    };
  } else if (type instanceof z.ZodUnion) {
    // For unions, try to extract the types
    const options = type._def.options.map((opt: z.ZodTypeAny) =>
      zodTypeToJsonSchema(opt)
    );
    return { anyOf: options };
  } else {
    // Fallback to string for unknown types
    return { type: 'string' };
  }
}

// Convert all schemas to MCP format
export const ToolSchemas = {
  jiraGetSprints: zodToMCPSchema(MCPToolSchemas.jiraGetSprints),
  jiraGetSprintIssues: zodToMCPSchema(MCPToolSchemas.jiraGetSprintIssues),
  jiraGetSprintDetails: zodToMCPSchema(MCPToolSchemas.jiraGetSprintDetails),
  jiraGetIssueDetails: zodToMCPSchema(MCPToolSchemas.jiraGetIssueDetails),
  jiraSearchIssues: zodToMCPSchema(MCPToolSchemas.jiraSearchIssues),
  githubGetCommits: zodToMCPSchema(MCPToolSchemas.githubGetCommits),
  githubGetPullRequests: zodToMCPSchema(MCPToolSchemas.githubGetPullRequests),
  githubSearchCommits: zodToMCPSchema(
    MCPToolSchemas.githubSearchCommitsByMessage
  ),
  githubSearchCommitsByMessage: zodToMCPSchema(
    MCPToolSchemas.githubSearchCommitsByMessage
  ), // Alias
  githubSearchPullRequestsByDate: zodToMCPSchema(
    MCPToolSchemas.githubSearchPullRequestsByDate
  ),
  githubFindCommitsByIssue: zodToMCPSchema(
    MCPToolSchemas.githubFindCommitsWithJiraReferences
  ),
  githubFindCommitsWithJiraReferences: zodToMCPSchema(
    MCPToolSchemas.githubFindCommitsWithJiraReferences
  ), // Alias
  generateSprintReport: zodToMCPSchema(MCPToolSchemas.generateSprintReport),
  generateComprehensiveReport: zodToMCPSchema(MCPToolSchemas.generateComprehensiveReport),
  getSprintMetrics: zodToMCPSchema(MCPToolSchemas.getSprintMetrics),
  getServerHealth: zodToMCPSchema(MCPToolSchemas.healthCheck),
  healthCheck: zodToMCPSchema(MCPToolSchemas.healthCheck), // Alias
  getPerformanceMetrics: zodToMCPSchema(MCPToolSchemas.cacheStats),
  cacheStats: zodToMCPSchema(MCPToolSchemas.cacheStats), // Alias
} as const;
