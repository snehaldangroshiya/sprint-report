// Integration tests for error recovery system

import { ErrorRecoveryManager, withErrorRecovery, CircuitBreaker } from '../../src/utils/error-recovery';
import { BaseError, InputValidationError, ServiceError } from '../../src/utils/errors';

// Mock logger for testing
const mockLogger = {
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn()
};

describe('Error Recovery Integration Tests', () => {
  let errorRecoveryManager: ErrorRecoveryManager;

  beforeEach(() => {
    errorRecoveryManager = new ErrorRecoveryManager(mockLogger);
    jest.clearAllMocks();
  });

  describe('Circuit Breaker Integration', () => {
    test('should open circuit after repeated failures', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      const fallbackOperation = jest.fn().mockResolvedValue('fallback result');

      const context = {
        operationName: 'test-operation',
        toolName: 'test-tool',
        fallback: fallbackOperation
      };

      // Execute failing operation multiple times to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await errorRecoveryManager.executeWithRecovery(failingOperation, context);
        } catch (error) {
          // Expected to fail
        }
      }

      // Next call should use fallback due to open circuit
      const result = await errorRecoveryManager.executeWithRecovery(failingOperation, context);

      expect(result).toBe('fallback result');
      expect(fallbackOperation).toHaveBeenCalled();
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker is OPEN')
      );
    });

    test('should recover when circuit breaker half-opens and operation succeeds', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockRejectedValueOnce(new Error('Fail 4'))
        .mockRejectedValueOnce(new Error('Fail 5'))
        .mockResolvedValue('success after recovery');

      const context = {
        operationName: 'recovery-test',
        toolName: 'test-tool'
      };

      // Trigger circuit breaker open
      for (let i = 0; i < 5; i++) {
        try {
          await errorRecoveryManager.executeWithRecovery(operation, context);
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for half-open timeout (simulate)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Next successful call should close the circuit
      const result = await errorRecoveryManager.executeWithRecovery(operation, context);

      expect(result).toBe('success after recovery');
      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker closed after successful recovery')
      );
    });
  });

  describe('Exponential Backoff Integration', () => {
    test('should apply exponential backoff for retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new ServiceError('RATE_LIMITED', 'Rate limit exceeded', true, 'Please wait'))
        .mockRejectedValueOnce(new ServiceError('RATE_LIMITED', 'Rate limit exceeded', true, 'Please wait'))
        .mockResolvedValue('success after backoff');

      const context = {
        operationName: 'backoff-test',
        toolName: 'rate-limited-service'
      };

      const startTime = Date.now();
      const result = await errorRecoveryManager.executeWithRecovery(operation, context);
      const endTime = Date.now();

      expect(result).toBe('success after backoff');
      expect(operation).toHaveBeenCalledTimes(3);

      // Should have taken some time due to backoff (at least base delay)
      expect(endTime - startTime).toBeGreaterThan(50);

      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        expect.stringContaining('Retrying operation after exponential backoff')
      );
    });

    test('should stop retrying after max attempts', async () => {
      const persistentError = new ServiceError('TIMEOUT', 'Connection timeout', true, 'Service unavailable');
      const operation = jest.fn().mockRejectedValue(persistentError);

      const context = {
        operationName: 'max-retry-test',
        toolName: 'failing-service'
      };

      await expect(
        errorRecoveryManager.executeWithRecovery(operation, context)
      ).rejects.toThrow('Connection timeout');

      // Should have tried multiple times (default max retries = 3)
      expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries

      expect(mockLogger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining('Operation failed after maximum retry attempts')
      );
    });
  });

  describe('Graceful Degradation Integration', () => {
    test('should apply graceful degradation for non-critical failures', async () => {
      const primaryOperation = jest.fn().mockRejectedValue(new Error('Primary service down'));
      const fallbackOperation = jest.fn().mockResolvedValue('degraded but functional result');

      const context = {
        operationName: 'degradation-test',
        toolName: 'optional-enhancement',
        fallback: fallbackOperation,
        partialResultTolerance: true
      };

      const result = await errorRecoveryManager.executeWithRecovery(primaryOperation, context);

      expect(result).toBe('degraded but functional result');
      expect(fallbackOperation).toHaveBeenCalled();
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        expect.stringContaining('Using fallback for non-critical operation')
      );
    });

    test('should throw for critical operations even with fallback available', async () => {
      const criticalOperation = jest.fn().mockRejectedValue(new Error('Critical failure'));
      const fallbackOperation = jest.fn().mockResolvedValue('fallback');

      const context = {
        operationName: 'critical-test',
        toolName: 'essential-service',
        fallback: fallbackOperation,
        partialResultTolerance: false // Critical operation
      };

      await expect(
        errorRecoveryManager.executeWithRecovery(criticalOperation, context)
      ).rejects.toThrow('Critical failure');

      expect(fallbackOperation).not.toHaveBeenCalled();
    });
  });

  describe('Error Analytics Integration', () => {
    test('should track error patterns and frequencies', async () => {
      const errorOperation = jest.fn().mockRejectedValue(new ServiceError('API_ERROR', 'API failure', false, 'Service error'));

      const context = {
        operationName: 'analytics-test',
        toolName: 'monitored-service'
      };

      // Generate multiple errors
      for (let i = 0; i < 3; i++) {
        try {
          await errorRecoveryManager.executeWithRecovery(errorOperation, context);
        } catch (error) {
          // Expected to fail
        }
      }

      const analytics = errorRecoveryManager.getErrorAnalytics();

      expect(analytics.totalErrors).toBe(3);
      expect(analytics.errorsByTool['monitored-service']).toBe(3);
      expect(analytics.errorsByType['API_ERROR']).toBe(3);
      expect(analytics.recentErrors).toHaveLength(3);

      // Verify each error entry has required fields
      analytics.recentErrors.forEach(errorEntry => {
        expect(errorEntry).toHaveProperty('timestamp');
        expect(errorEntry).toHaveProperty('toolName', 'monitored-service');
        expect(errorEntry).toHaveProperty('operationName', 'analytics-test');
        expect(errorEntry).toHaveProperty('errorType', 'API_ERROR');
        expect(errorEntry).toHaveProperty('message', 'API failure');
      });
    });

    test('should limit recent errors history', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));
      const context = {
        operationName: 'history-test',
        toolName: 'test-service'
      };

      // Generate more errors than the limit (default: 100)
      for (let i = 0; i < 150; i++) {
        try {
          await errorRecoveryManager.executeWithRecovery(operation, context);
        } catch (error) {
          // Expected to fail
        }
      }

      const analytics = errorRecoveryManager.getErrorAnalytics();

      expect(analytics.totalErrors).toBe(150);
      expect(analytics.recentErrors).toHaveLength(100); // Should be limited
    });
  });

  describe('Decorator Integration', () => {
    test('should work with method decorator', async () => {
      class TestService {
        constructor(private errorRecovery: ErrorRecoveryManager) {}

        @withErrorRecovery('testMethod', {
          partialResultTolerance: true,
          fallback: async function(this: TestService) {
            return 'decorator fallback';
          }
        })
        async decoratedMethod(): Promise<string> {
          throw new Error('Method failed');
        }

        // This method would normally work but we'll make it fail
        async regularMethod(): Promise<string> {
          throw new Error('Regular method failed');
        }
      }

      const service = new TestService(errorRecoveryManager);

      // Decorated method should use fallback
      const result = await service.decoratedMethod();
      expect(result).toBe('decorator fallback');

      // Regular method should throw
      await expect(service.regularMethod()).rejects.toThrow('Regular method failed');
    });

    test('should preserve method context in decorator', async () => {
      class ContextService {
        private value = 'service-value';

        constructor(private errorRecovery: ErrorRecoveryManager) {}

        @withErrorRecovery('contextMethod', {
          partialResultTolerance: true,
          fallback: async function(this: ContextService) {
            return `fallback with ${this.value}`;
          }
        })
        async methodWithContext(): Promise<string> {
          throw new Error('Context method failed');
        }
      }

      const service = new ContextService(errorRecoveryManager);
      const result = await service.methodWithContext();

      expect(result).toBe('fallback with service-value');
    });
  });

  describe('Complex Integration Scenarios', () => {
    test('should handle cascading failures across multiple services', async () => {
      const jiraOperation = jest.fn().mockRejectedValue(new ServiceError('JIRA_DOWN', 'Jira unavailable', true, 'Jira service down'));
      const githubOperation = jest.fn().mockRejectedValue(new ServiceError('GITHUB_DOWN', 'GitHub unavailable', true, 'GitHub service down'));
      const fallbackOperation = jest.fn().mockResolvedValue('cached data');

      // First service fails
      const jiraContext = {
        operationName: 'getSprints',
        toolName: 'jira-client'
      };

      try {
        await errorRecoveryManager.executeWithRecovery(jiraOperation, jiraContext);
      } catch (error) {
        // Expected Jira failure
      }

      // Second service also fails
      const githubContext = {
        operationName: 'getCommits',
        toolName: 'github-client'
      };

      try {
        await errorRecoveryManager.executeWithRecovery(githubOperation, githubContext);
      } catch (error) {
        // Expected GitHub failure
      }

      // Use fallback for report generation
      const reportContext = {
        operationName: 'generateReport',
        toolName: 'report-generator',
        fallback: fallbackOperation,
        partialResultTolerance: true
      };

      const reportOperation = jest.fn().mockRejectedValue(new Error('Cannot generate without data'));
      const result = await errorRecoveryManager.executeWithRecovery(reportOperation, reportContext);

      expect(result).toBe('cached data');

      const analytics = errorRecoveryManager.getErrorAnalytics();
      expect(analytics.totalErrors).toBe(3);
      expect(analytics.errorsByTool['jira-client']).toBe(1);
      expect(analytics.errorsByTool['github-client']).toBe(1);
      expect(analytics.errorsByTool['report-generator']).toBe(1);
    });

    test('should recover from partial service outage', async () => {
      let jiraCallCount = 0;
      const jiraOperation = jest.fn().mockImplementation(() => {
        jiraCallCount++;
        if (jiraCallCount <= 2) {
          throw new ServiceError('TIMEOUT', 'Request timeout', true, 'Temporary timeout');
        }
        return Promise.resolve('jira data');
      });

      const githubOperation = jest.fn().mockResolvedValue('github data');

      const jiraContext = {
        operationName: 'getSprints',
        toolName: 'jira-client'
      };

      const githubContext = {
        operationName: 'getCommits',
        toolName: 'github-client'
      };

      // GitHub should work immediately
      const githubResult = await errorRecoveryManager.executeWithRecovery(githubOperation, githubContext);
      expect(githubResult).toBe('github data');

      // Jira should work after retries
      const jiraResult = await errorRecoveryManager.executeWithRecovery(jiraOperation, jiraContext);
      expect(jiraResult).toBe('jira data');

      expect(jiraOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(githubOperation).toHaveBeenCalledTimes(1); // No retries needed

      const analytics = errorRecoveryManager.getErrorAnalytics();
      expect(analytics.totalErrors).toBe(2); // Only the failed Jira attempts
      expect(analytics.errorsByTool['jira-client']).toBe(2);
      expect(analytics.errorsByTool['github-client']).toBeUndefined();
    });

    test('should maintain performance during error recovery', async () => {
      const fastOperation = jest.fn().mockResolvedValue('fast result');
      const slowFailingOperation = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate slow operation
        throw new Error('Slow operation failed');
      });

      const fastContext = {
        operationName: 'fastOp',
        toolName: 'fast-service'
      };

      const slowContext = {
        operationName: 'slowOp',
        toolName: 'slow-service'
      };

      // Run multiple operations concurrently
      const startTime = Date.now();

      const results = await Promise.allSettled([
        errorRecoveryManager.executeWithRecovery(fastOperation, fastContext),
        errorRecoveryManager.executeWithRecovery(fastOperation, fastContext),
        errorRecoveryManager.executeWithRecovery(fastOperation, fastContext),
        errorRecoveryManager.executeWithRecovery(slowFailingOperation, slowContext).catch(e => e.message)
      ]);

      const endTime = Date.now();

      // Fast operations should complete quickly despite slow failing operation
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');
      expect(results[2].status).toBe('fulfilled');
      expect((results[0] as any).value).toBe('fast result');

      // Should complete in reasonable time despite retries on slow operation
      expect(endTime - startTime).toBeLessThan(500);

      expect(fastOperation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Resource Cleanup Integration', () => {
    test('should clean up resources after errors', async () => {
      const resourceCleanup = jest.fn();
      let resource: any = null;

      const operationWithCleanup = jest.fn().mockImplementation(async () => {
        resource = { id: 'test-resource', cleanup: resourceCleanup };
        throw new Error('Operation failed after resource allocation');
      });

      const context = {
        operationName: 'resource-test',
        toolName: 'resource-service',
        cleanup: () => {
          if (resource) {
            resource.cleanup();
            resource = null;
          }
        }
      };

      try {
        await errorRecoveryManager.executeWithRecovery(operationWithCleanup, context);
      } catch (error) {
        // Expected to fail
      }

      // Cleanup should have been called during error handling
      expect(resourceCleanup).toHaveBeenCalled();
      expect(resource).toBeNull();
    });
  });

  describe('Configuration and Tuning', () => {
    test('should respect custom retry configuration', async () => {
      const customErrorRecovery = new ErrorRecoveryManager(mockLogger, {
        maxRetries: 1,
        baseDelay: 10,
        maxDelay: 100,
        circuitBreakerThreshold: 2
      });

      const operation = jest.fn().mockRejectedValue(new ServiceError('RETRY_TEST', 'Retryable error', true, 'Test'));

      const context = {
        operationName: 'custom-config-test',
        toolName: 'test-service'
      };

      try {
        await customErrorRecovery.executeWithRecovery(operation, context);
      } catch (error) {
        // Expected to fail
      }

      // Should only retry once (maxRetries: 1) instead of default 3
      expect(operation).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    test('should handle different error types appropriately', async () => {
      const validationError = new InputValidationError('test-field', 'invalid-value', 'Validation failed');
      const serviceError = new ServiceError('SERVICE_DOWN', 'Service unavailable', true, 'Service down');
      const baseError = new BaseError('UNKNOWN', 'Unknown error', false, 'Unknown');

      const validationOp = jest.fn().mockRejectedValue(validationError);
      const serviceOp = jest.fn().mockRejectedValue(serviceError);
      const baseOp = jest.fn().mockRejectedValue(baseError);

      const context = {
        operationName: 'error-type-test',
        toolName: 'test-service'
      };

      // Validation errors should not be retried
      await expect(errorRecoveryManager.executeWithRecovery(validationOp, context))
        .rejects.toThrow('Validation failed');
      expect(validationOp).toHaveBeenCalledTimes(1);

      // Service errors should be retried
      await expect(errorRecoveryManager.executeWithRecovery(serviceOp, context))
        .rejects.toThrow('Service unavailable');
      expect(serviceOp).toHaveBeenCalledTimes(4); // Initial + 3 retries

      // Non-retryable base errors should not be retried
      await expect(errorRecoveryManager.executeWithRecovery(baseOp, context))
        .rejects.toThrow('Unknown error');
      expect(baseOp).toHaveBeenCalledTimes(1);
    });
  });
});