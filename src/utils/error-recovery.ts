// Advanced error handling and recovery mechanisms for MCP tools

import { BaseError, RateLimitError } from './errors';
import { Logger } from './logger';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: Array<new (...args: any[]) => Error>;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  timeout: number;
  monitoringPeriod: number;
}

export interface ErrorRecoveryConfig {
  retry: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;
  fallbackEnabled: boolean;
  gracefulDegradation: boolean;
}

export class ErrorRecoveryManager {
  private static readonly DEFAULT_CONFIG: ErrorRecoveryConfig = {
    retry: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableErrors: [RateLimitError],
    },
    circuitBreaker: {
      failureThreshold: 5,
      timeout: 60000,
      monitoringPeriod: 300000, // 5 minutes
    },
    fallbackEnabled: true,
    gracefulDegradation: true,
  };

  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private logger: Logger;
  private config: ErrorRecoveryConfig;

  // Error analytics tracking
  private totalErrors = 0;
  private errorsByTool = new Map<string, number>();
  private errorsByType = new Map<string, number>();
  private recentErrors: Array<{
    timestamp: number;
    toolName: string;
    operationName: string;
    errorType: string;
    message: string;
  }> = [];
  private readonly MAX_RECENT_ERRORS = 100;

  constructor(logger: Logger, config?: Partial<ErrorRecoveryConfig>) {
    this.logger = logger;
    this.config = { ...ErrorRecoveryManager.DEFAULT_CONFIG, ...config };
  }

  // Execute operation with comprehensive error handling
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context: {
      operationName: string;
      toolName: string;
      fallback?: () => Promise<T>;
      partialResultTolerance?: boolean;
      cleanup?: () => void;
    }
  ): Promise<T> {
    const circuitBreakerKey = `${context.toolName}-${context.operationName}`;

    try {
      // Check circuit breaker
      if (!this.isCircuitBreakerOpen(circuitBreakerKey)) {
        const result = await this.executeWithRetry(operation, context);
        this.recordSuccess(circuitBreakerKey);
        return result;
      }

      this.logger.warn('Circuit breaker is open, attempting fallback', {
        operation: context.operationName,
        tool: context.toolName,
      });

      // Circuit breaker is open, try fallback
      if (context.fallback && this.config.fallbackEnabled) {
        return await context.fallback();
      }

      throw new BaseError(
        'CIRCUIT_BREAKER_OPEN',
        `Service ${context.toolName} is temporarily unavailable`,
        false,
        'The service is experiencing issues and has been temporarily disabled to prevent further problems.'
      );
    } catch (error) {
      this.recordFailure(circuitBreakerKey);

      const enhancedError = this.enhanceError(error as Error, context);

      // Track error analytics
      this.trackError(enhancedError, context);

      // Call cleanup function if provided
      if (context.cleanup) {
        try {
          context.cleanup();
        } catch (cleanupError) {
          this.logger.error(`Error during cleanup: ${(cleanupError as Error).message}`);
        }
      }

      this.logger.logError(
        enhancedError,
        `${context.toolName}_${context.operationName}`,
        {
          tool: context.toolName,
          operation: context.operationName,
          circuitBreakerState: this.getCircuitBreakerState(circuitBreakerKey),
        }
      );      // Attempt graceful degradation
      if (this.config.gracefulDegradation && context.partialResultTolerance) {
        return this.handleGracefulDegradation(enhancedError, context);
      }

      throw enhancedError;
    }
  }

  // Execute with exponential backoff retry
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: { operationName: string; toolName: string }
  ): Promise<T> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < this.config.retry.maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Check if error is retryable
        if (
          !this.isRetryableError(lastError) ||
          attempt >= this.config.retry.maxAttempts
        ) {
          throw lastError;
        }

        const delay = this.calculateDelay(attempt);

        this.logger.warn(
          `Operation ${context.operationName} failed, retrying in ${delay}ms`,
          {
            attempt,
            maxAttempts: this.config.retry.maxAttempts,
            error: lastError.message,
            tool: context.toolName,
          }
        );

        await this.delay(delay);
      }
    }

    throw lastError;
  }

  // Enhance errors with additional context and user-friendly messages
  private enhanceError(
    error: Error,
    context: { operationName: string; toolName: string }
  ): Error {
    if (error instanceof BaseError) {
      return error; // Already enhanced
    }

    // Map common error patterns to user-friendly messages
    const errorMappings = [
      {
        pattern: /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH/,
        type: 'NETWORK_ERROR',
        message:
          'Unable to connect to the service. Please check your network connection.',
        userMessage:
          'The service appears to be unavailable. Please try again later.',
      },
      {
        pattern: /401|Unauthorized/,
        type: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed. Please check your credentials.',
        userMessage:
          'Your authentication credentials may have expired. Please check your API tokens.',
      },
      {
        pattern: /403|Forbidden/,
        type: 'AUTHORIZATION_ERROR',
        message: 'Access denied. Insufficient permissions.',
        userMessage: 'You do not have permission to access this resource.',
      },
      {
        pattern: /429|Rate limit/i,
        type: 'RATE_LIMIT_ERROR',
        message: 'Rate limit exceeded. Please slow down your requests.',
        userMessage:
          'You are making requests too quickly. Please wait a moment and try again.',
      },
      {
        pattern: /400|Bad Request/,
        type: 'VALIDATION_ERROR',
        message: 'Invalid request parameters.',
        userMessage:
          'The request parameters are invalid. Please check your input.',
      },
      {
        pattern: /500|Internal Server Error/,
        type: 'SERVER_ERROR',
        message: 'Internal server error on the remote service.',
        userMessage:
          'The remote service is experiencing issues. Please try again later.',
      },
      {
        pattern: /timeout|ETIMEDOUT/i,
        type: 'TIMEOUT_ERROR',
        message: 'Request timed out.',
        userMessage:
          'The operation took too long to complete. Please try again.',
      },
    ];

    for (const mapping of errorMappings) {
      if (mapping.pattern.test(error.message)) {
        return new BaseError(
          mapping.type,
          mapping.message,
          false,
          mapping.userMessage,
          {
            originalError: error.message,
            operation: context.operationName,
            tool: context.toolName,
          }
        );
      }
    }

    // Generic enhancement for unknown errors
    return new BaseError(
      'UNKNOWN_ERROR',
      `Unexpected error in ${context.toolName}.${context.operationName}: ${error.message}`,
      false,
      'An unexpected error occurred. Please try again or contact support if the problem persists.',
      {
        originalError: error.message,
        operation: context.operationName,
        tool: context.toolName,
      }
    );
  }

  // Handle graceful degradation scenarios
  private async handleGracefulDegradation<T>(
    error: Error,
    context: {
      operationName: string;
      toolName: string;
      fallback?: () => Promise<T>;
    }
  ): Promise<T> {
    this.logger.warn('Attempting graceful degradation', {
      operation: context.operationName,
      tool: context.toolName,
      error: error.message,
    });

    // Return a partial result or simplified version based on operation type
    if (context.operationName.includes('report')) {
      // For reporting operations, return a simplified report
      return this.createDegradedReport(error, context) as T;
    }

    if (context.operationName.includes('metrics')) {
      // For metrics operations, return basic metrics
      return this.createDegradedMetrics(error, context) as T;
    }

    if (
      context.operationName.includes('search') ||
      context.operationName.includes('get')
    ) {
      // For data retrieval operations, return empty result with error info
      return this.createDegradedDataResult(error, context) as T;
    }

    // If no specific degradation strategy, throw the original error
    throw error;
  }

  private createDegradedReport(error: Error, context: any): any {
    return {
      error: true,
      message: 'Report generation partially failed',
      details: error.message,
      partialData: true,
      generatedAt: new Date().toISOString(),
      degradationReason: `Error in ${context.toolName}.${context.operationName}`,
    };
  }

  private createDegradedMetrics(error: Error, context: any): any {
    return {
      error: true,
      message: 'Metrics calculation partially failed',
      details: error.message,
      partialMetrics: true,
      unavailableMetrics: [context.operationName],
      generatedAt: new Date().toISOString(),
    };
  }

  private createDegradedDataResult(error: Error, context: any): any {
    return {
      error: true,
      message: 'Data retrieval partially failed',
      details: error.message,
      data: [],
      partial: true,
      unavailableData: context.operationName,
      timestamp: new Date().toISOString(),
    };
  }

  // Circuit breaker implementation
  private isCircuitBreakerOpen(key: string): boolean {
    const state = this.circuitBreakers.get(key);
    if (!state) {
      return false;
    }

    const now = Date.now();

    // Reset if monitoring period has passed
    if (
      now - state.lastResetTime >
      this.config.circuitBreaker.monitoringPeriod
    ) {
      state.failureCount = 0;
      state.lastResetTime = now;
      state.isOpen = false;
    }

    // Check if circuit breaker should be opened
    if (
      !state.isOpen &&
      state.failureCount >= this.config.circuitBreaker.failureThreshold
    ) {
      state.isOpen = true;
      state.openedAt = now;
      this.logger.warn(`Circuit breaker opened for ${key}`, {
        failureCount: state.failureCount,
        threshold: this.config.circuitBreaker.failureThreshold,
      });
    }

    // Check if circuit breaker should be closed (half-open -> closed)
    if (
      state.isOpen &&
      now - state.openedAt! > this.config.circuitBreaker.timeout
    ) {
      state.isOpen = false;
      this.logger.info(`Circuit breaker closed for ${key}`, {
        timeoutPeriod: this.config.circuitBreaker.timeout,
      });
    }

    return state.isOpen;
  }

  private recordSuccess(key: string): void {
    const state = this.getOrCreateCircuitBreakerState(key);
    state.successCount++;
    // Reduce failure count on success (gradual recovery)
    if (state.failureCount > 0) {
      state.failureCount = Math.max(0, state.failureCount - 1);
    }
  }

  private recordFailure(key: string): void {
    const state = this.getOrCreateCircuitBreakerState(key);
    state.failureCount++;
    state.lastFailureTime = Date.now();
  }

  private getOrCreateCircuitBreakerState(key: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, {
        failureCount: 0,
        successCount: 0,
        isOpen: false,
        lastResetTime: Date.now(),
      });
    }
    return this.circuitBreakers.get(key)!;
  }

  private getCircuitBreakerState(
    key: string
  ): Partial<CircuitBreakerState> | undefined {
    return this.circuitBreakers.get(key);
  }

  // Error analytics methods
  private trackError(error: Error, context: { operationName: string; toolName: string }): void {
    this.totalErrors++;

    // Track by tool
    const toolCount = this.errorsByTool.get(context.toolName) || 0;
    this.errorsByTool.set(context.toolName, toolCount + 1);

    // Track by error type/code
    const errorType = error instanceof BaseError ? (error as any).code : error.name;
    const typeCount = this.errorsByType.get(errorType) || 0;
    this.errorsByType.set(errorType, typeCount + 1);

    // Track recent errors
    this.recentErrors.push({
      timestamp: Date.now(),
      toolName: context.toolName,
      operationName: context.operationName,
      errorType: errorType,
      message: error.message
    });

    // Keep only the most recent errors
    if (this.recentErrors.length > this.MAX_RECENT_ERRORS) {
      this.recentErrors = this.recentErrors.slice(-this.MAX_RECENT_ERRORS);
    }
  }

  getErrorAnalytics(): {
    totalErrors: number;
    errorsByTool: Record<string, number>;
    errorsByType: Record<string, number>;
    recentErrors: Array<{
      timestamp: number;
      toolName: string;
      operationName: string;
      errorType: string;
      message: string;
    }>;
  } {
    return {
      totalErrors: this.totalErrors,
      errorsByTool: Object.fromEntries(this.errorsByTool),
      errorsByType: Object.fromEntries(this.errorsByType),
      recentErrors: [...this.recentErrors]
    };
  }

  // Utility methods
  private isRetryableError(error: Error): boolean {
    return (
      this.config.retry.retryableErrors.some(
        errorType => error instanceof errorType
      ) || this.isTransientError(error)
    );
  }

  private isTransientError(error: Error): boolean {
    const transientPatterns = [
      /ECONNRESET/,
      /ECONNREFUSED/,
      /ETIMEDOUT/,
      /socket hang up/,
      /rate limit/i,
      /service unavailable/i,
      /internal server error/i,
      /bad gateway/i,
      /gateway timeout/i,
    ];

    return transientPatterns.some(pattern => pattern.test(error.message));
  }

  private calculateDelay(attempt: number): number {
    const delay =
      this.config.retry.baseDelay *
      Math.pow(this.config.retry.backoffMultiplier, attempt - 1);
    const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
    return Math.min(delay + jitter, this.config.retry.maxDelay);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for monitoring and configuration
  public getCircuitBreakerStats(): Record<string, CircuitBreakerState> {
    const stats: Record<string, CircuitBreakerState> = {};
    for (const [key, state] of this.circuitBreakers.entries()) {
      stats[key] = { ...state };
    }
    return stats;
  }

  public resetCircuitBreaker(key?: string): void {
    if (key) {
      this.circuitBreakers.delete(key);
      this.logger.info(`Circuit breaker reset for ${key}`);
    } else {
      this.circuitBreakers.clear();
      this.logger.info('All circuit breakers reset');
    }
  }

  public updateConfig(newConfig: Partial<ErrorRecoveryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Error recovery configuration updated', {
      config: this.config,
    });
  }
}

interface CircuitBreakerState {
  failureCount: number;
  successCount: number;
  isOpen: boolean;
  lastResetTime: number;
  lastFailureTime?: number;
  openedAt?: number;
}

// Decorator for automatic error recovery
export function withErrorRecovery(
  operationName: string,
  options?: {
    fallback?: () => Promise<any>;
    partialResultTolerance?: boolean;
    customConfig?: Partial<ErrorRecoveryConfig>;
  }
) {
  return function (
    _target: any,
    _propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      if (!this.errorRecoveryManager) {
        // Fallback to direct execution if error recovery manager is not available
        return method.apply(this, args);
      }

      const context = {
        operationName,
        toolName: this.constructor.name,
        fallback: options?.fallback,
        partialResultTolerance: options?.partialResultTolerance,
      };

      return this.errorRecoveryManager.executeWithRecovery(
        () => method.apply(this, args),
        context
      );
    };
  };
}

// Error analytics and reporting
export class ErrorAnalytics {
  private errorCounts = new Map<string, number>();
  private errorPatterns = new Map<
    string,
    { count: number; lastSeen: number }
  >();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  recordError(
    error: Error,
    context: { tool: string; operation: string }
  ): void {
    const key = `${context.tool}.${context.operation}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);

    // Track error patterns
    const pattern = this.extractErrorPattern(error);
    const patternKey = `${key}:${pattern}`;
    this.errorPatterns.set(patternKey, {
      count: (this.errorPatterns.get(patternKey)?.count || 0) + 1,
      lastSeen: Date.now(),
    });

    // Log analytics data
    this.logger.info('Error analytics recorded', {
      tool: context.tool,
      operation: context.operation,
      pattern,
      totalErrors: this.errorCounts.get(key),
    });
  }

  getErrorSummary(): {
    totalErrors: number;
    errorsByOperation: Record<string, number>;
    topErrorPatterns: Array<{ pattern: string; count: number }>;
    recommendations: string[];
  } {
    const totalErrors = Array.from(this.errorCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    const errorsByOperation: Record<string, number> = {};
    for (const [key, count] of this.errorCounts.entries()) {
      errorsByOperation[key] = count;
    }

    const topErrorPatterns = Array.from(this.errorPatterns.entries())
      .map(([pattern, data]) => ({ pattern, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const recommendations = this.generateRecommendations(
      topErrorPatterns,
      errorsByOperation
    );

    return {
      totalErrors,
      errorsByOperation,
      topErrorPatterns,
      recommendations,
    };
  }

  private extractErrorPattern(error: Error): string {
    // Extract common error patterns for analysis
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('connection'))
      return 'network_error';
    if (message.includes('timeout')) return 'timeout_error';
    if (message.includes('rate limit')) return 'rate_limit_error';
    if (message.includes('auth')) return 'authentication_error';
    if (message.includes('permission') || message.includes('forbidden'))
      return 'authorization_error';
    if (message.includes('validation')) return 'validation_error';
    if (message.includes('not found')) return 'not_found_error';
    if (message.includes('server error')) return 'server_error';

    return 'unknown_error';
  }

  private generateRecommendations(
    topPatterns: Array<{ pattern: string; count: number }>,
    _errorsByOperation: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];

    for (const { pattern, count } of topPatterns) {
      if (count > 10) {
        // Threshold for generating recommendations
        switch (pattern.split(':')[1]) {
          case 'network_error':
            recommendations.push(
              'Consider implementing connection pooling and health checks for network stability'
            );
            break;
          case 'timeout_error':
            recommendations.push(
              'Review timeout configurations and consider implementing circuit breakers'
            );
            break;
          case 'rate_limit_error':
            recommendations.push(
              'Implement intelligent rate limiting with backoff strategies'
            );
            break;
          case 'authentication_error':
            recommendations.push(
              'Review API credentials and implement token refresh mechanisms'
            );
            break;
          case 'validation_error':
            recommendations.push(
              'Enhance input validation and provide better error messages to users'
            );
            break;
        }
      }
    }

    return recommendations;
  }
}
