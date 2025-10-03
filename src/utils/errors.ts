// Error handling utilities and custom error classes

import { APIError, ValidationError } from '@/types';

export class BaseError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly userMessage: string;
  public readonly context?: any;

  constructor(
    message: string,
    code: string,
    retryable = false,
    userMessage?: string,
    context?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.retryable = retryable;
    this.userMessage = userMessage || this.getDefaultUserMessage();
    this.context = context;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  private getDefaultUserMessage(): string {
    const messages: Record<string, string> = {
      'JIRA_AUTH_ERROR': 'Unable to authenticate with Jira. Please check your credentials.',
      'GITHUB_AUTH_ERROR': 'Unable to authenticate with GitHub. Please check your token.',
      'JIRA_API_ERROR': 'Jira service is temporarily unavailable. Please try again.',
      'GITHUB_API_ERROR': 'GitHub service is temporarily unavailable. Please try again.',
      'VALIDATION_ERROR': 'Invalid input provided. Please check your request.',
      'RATE_LIMIT_ERROR': 'Too many requests. Please wait before trying again.',
      'TIMEOUT_ERROR': 'Request timed out. Please try again.',
      'CACHE_ERROR': 'Caching service unavailable. Continuing without cache.',
      'REPORT_GENERATION_ERROR': 'Unable to generate report. Please try again.',
    };

    return messages[this.code] || 'An unexpected error occurred. Please try again.';
  }

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      retryable: this.retryable,
      userMessage: this.userMessage,
      context: this.context,
    };
  }
}

export class JiraAPIError extends BaseError implements APIError {
  public readonly status?: number;

  constructor(message: string, status?: number, retryable = true, context?: any) {
    super(message, 'JIRA_API_ERROR', retryable, undefined, context);
    if (status !== undefined) {
      (this as any).status = status;
    }
  }
}

export class GitHubAPIError extends BaseError implements APIError {
  public readonly status?: number;

  constructor(message: string, status?: number, retryable = true, context?: any) {
    super(message, 'GITHUB_API_ERROR', retryable, undefined, context);
    if (status !== undefined) {
      (this as any).status = status;
    }
  }
}

export class AuthenticationError extends BaseError {
  constructor(service: string, context?: any) {
    const code = service === 'jira' ? 'JIRA_AUTH_ERROR' : 'GITHUB_AUTH_ERROR';
    super(`Authentication failed for ${service}`, code, false, undefined, context);
  }
}

export class InputValidationError extends BaseError implements ValidationError {
  public readonly field: string;
  public readonly value: any;
  public readonly constraint: string;

  constructor(field: string, value: any, constraint: string) {
    super(
      `Validation failed for field '${field}': ${constraint}`,
      'VALIDATION_ERROR',
      false,
      `Invalid ${field}: ${constraint}`,
      { field, value, constraint }
    );
    this.field = field;
    this.value = value;
    this.constraint = constraint;
  }
}

export class RateLimitError extends BaseError {
  public readonly retryAfter: number;

  constructor(service: string, retryAfter: number, context?: any) {
    super(
      `Rate limit exceeded for ${service}`,
      'RATE_LIMIT_ERROR',
      true,
      `Too many requests to ${service}. Please wait ${retryAfter} seconds.`,
      context
    );
    this.retryAfter = retryAfter;
  }
}

export class TimeoutError extends BaseError {
  constructor(operation: string, timeout: number, context?: any) {
    super(
      `Operation '${operation}' timed out after ${timeout}ms`,
      'TIMEOUT_ERROR',
      true,
      `Request timed out after ${timeout / 1000} seconds. Please try again.`,
      context
    );
  }
}

export class CacheError extends BaseError {
  constructor(operation: string, cause?: Error) {
    super(
      `Cache operation failed: ${operation}`,
      'CACHE_ERROR',
      true,
      'Caching service temporarily unavailable',
      { operation, cause: cause?.message }
    );
  }
}

export class ReportGenerationError extends BaseError {
  constructor(reason: string, context?: any) {
    super(
      `Report generation failed: ${reason}`,
      'REPORT_GENERATION_ERROR',
      true,
      'Unable to generate report. Please check your parameters and try again.',
      context
    );
  }
}

export class ConfigurationError extends BaseError {
  constructor(setting: string, reason: string) {
    super(
      `Configuration error for '${setting}': ${reason}`,
      'CONFIG_ERROR',
      false,
      `Configuration issue with ${setting}. Please check your environment settings.`,
      { setting, reason }
    );
  }
}

export class SecurityError extends BaseError {
  constructor(reason: string, context?: any) {
    super(
      `Security violation: ${reason}`,
      'SECURITY_ERROR',
      false,
      'Security policy violation detected.',
      context
    );
  }
}

// Error classification utilities
export class ErrorClassifier {
  static isRetryable(error: Error): boolean {
    if (error instanceof BaseError) {
      return error.retryable;
    }

    // Network errors are generally retryable
    if (error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ETIMEDOUT')) {
      return true;
    }

    return false;
  }

  static getRetryDelay(attempt: number, baseDelay = 1000): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }

  static isRateLimitError(error: Error): boolean {
    if (error instanceof RateLimitError) {
      return true;
    }

    return error.message.toLowerCase().includes('rate limit') ||
           error.message.includes('429');
  }

  static isAuthError(error: Error): boolean {
    if (error instanceof AuthenticationError) {
      return true;
    }

    return error.message.toLowerCase().includes('unauthorized') ||
           error.message.includes('401') ||
           error.message.includes('403');
  }

  static sanitizeErrorForLogging(error: Error): any {
    const sanitized: any = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    if (error instanceof BaseError) {
      sanitized.code = error.code;
      sanitized.retryable = error.retryable;
      sanitized.context = error.context;
    }

    // Remove sensitive information
    if (sanitized.stack) {
      sanitized.stack = sanitized.stack.replace(
        /("?(?:token|password|secret|key)"?\s*[:=]\s*)"[^"]*"/gi,
        '$1"[REDACTED]"'
      );
    }

    if (sanitized.message) {
      sanitized.message = sanitized.message.replace(
        /\b[A-Za-z0-9]{20,}\b/g,
        '[REDACTED]'
      );
    }

    return sanitized;
  }

  static createUserFriendlyError(error: Error): { message: string; code?: string; retryable?: boolean } {
    if (error instanceof BaseError) {
      return {
        message: error.userMessage,
        code: error.code,
        retryable: error.retryable,
      };
    }

    // Default user-friendly messages for common errors
    if (this.isAuthError(error)) {
      return {
        message: 'Authentication failed. Please check your credentials.',
        code: 'AUTH_ERROR',
        retryable: false,
      };
    }

    if (this.isRateLimitError(error)) {
      return {
        message: 'Too many requests. Please wait before trying again.',
        code: 'RATE_LIMIT_ERROR',
        retryable: true,
      };
    }

    if (error.message.includes('timeout')) {
      return {
        message: 'Request timed out. Please try again.',
        code: 'TIMEOUT_ERROR',
        retryable: true,
      };
    }

    return {
      message: 'An unexpected error occurred. Please try again.',
      code: 'UNKNOWN_ERROR',
      retryable: true,
    };
  }
}

// Error handling wrapper for async operations
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: { operation: string; service?: string; metadata?: any }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const enhancedError = enhanceError(error as Error, context);
    throw enhancedError;
  }
}

function enhanceError(error: Error, context: any): Error {
  if (error instanceof BaseError) {
    // Already enhanced
    return error;
  }

  // Enhance based on error characteristics
  if (ErrorClassifier.isAuthError(error)) {
    return new AuthenticationError(context.service || 'unknown', {
      originalError: error.message,
      ...context.metadata,
    });
  }

  if (ErrorClassifier.isRateLimitError(error)) {
    const retryAfter = extractRetryAfter(error);
    return new RateLimitError(context.service || 'unknown', retryAfter, {
      originalError: error.message,
      ...context.metadata,
    });
  }

  if (error.message.includes('timeout')) {
    return new TimeoutError(context.operation, 30000, {
      originalError: error.message,
      ...context.metadata,
    });
  }

  // Default enhancement
  return new BaseError(
    error.message,
    'UNKNOWN_ERROR',
    true,
    'An unexpected error occurred',
    {
      originalError: error.message,
      operation: context.operation,
      service: context.service,
      ...context.metadata,
    }
  );
}

function extractRetryAfter(error: Error): number {
  // Try to extract retry-after from error message or response
  const retryAfterMatch = error.message.match(/retry.*?(\d+)/i);
  if (retryAfterMatch && retryAfterMatch[1]) {
    return parseInt(retryAfterMatch[1], 10);
  }

  // Default retry after 60 seconds
  return 60;
}