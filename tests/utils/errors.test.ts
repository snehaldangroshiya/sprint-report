// Tests for error handling utilities

import {
  BaseError,
  ValidationError,
  JiraAPIError,
  GitHubAPIError,
  CacheError,
  RateLimitError,
  withErrorHandling,
  sanitizeError,
} from '../../src/utils/errors';

describe('BaseError', () => {
  test('should create error with all properties', () => {
    const error = new BaseError(
      'TEST_ERROR',
      'Test error message',
      true,
      'User-friendly message'
    );

    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('Test error message');
    expect(error.retryable).toBe(true);
    expect(error.userMessage).toBe('User-friendly message');
    expect(error.timestamp).toBeValidISODate();
    expect(error.name).toBe('BaseError');
  });

  test('should have default values', () => {
    const error = new BaseError('TEST_ERROR', 'Test message');

    expect(error.retryable).toBe(false);
    expect(error.userMessage).toBe('Test message');
  });

  test('should be instance of Error', () => {
    const error = new BaseError('TEST_ERROR', 'Test message');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BaseError);
  });
});

describe('ValidationError', () => {
  test('should create validation error', () => {
    const error = new ValidationError('field', 'Invalid value', { expected: 'string' });

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.field).toBe('field');
    expect(error.details).toEqual({ expected: 'string' });
    expect(error.retryable).toBe(false);
    expect(error.name).toBe('ValidationError');
  });

  test('should include field in message', () => {
    const error = new ValidationError('email', 'Invalid email format');

    expect(error.message).toContain('email');
    expect(error.message).toContain('Invalid email format');
  });
});

describe('JiraAPIError', () => {
  test('should create Jira API error', () => {
    const error = new JiraAPIError('GET', '/api/test', 404, 'Not Found', { details: 'test' });

    expect(error.code).toBe('JIRA_API_ERROR');
    expect(error.method).toBe('GET');
    expect(error.endpoint).toBe('/api/test');
    expect(error.statusCode).toBe(404);
    expect(error.apiMessage).toBe('Not Found');
    expect(error.details).toEqual({ details: 'test' });
    expect(error.name).toBe('JiraAPIError');
  });

  test('should determine retryability based on status code', () => {
    const retryableError = new JiraAPIError('GET', '/api/test', 500, 'Server Error');
    const nonRetryableError = new JiraAPIError('GET', '/api/test', 400, 'Bad Request');

    expect(retryableError.retryable).toBe(true);
    expect(nonRetryableError.retryable).toBe(false);
  });

  test('should include status code in message', () => {
    const error = new JiraAPIError('POST', '/api/issue', 403, 'Forbidden');

    expect(error.message).toContain('POST');
    expect(error.message).toContain('/api/issue');
    expect(error.message).toContain('403');
    expect(error.message).toContain('Forbidden');
  });
});

describe('GitHubAPIError', () => {
  test('should create GitHub API error', () => {
    const error = new GitHubAPIError('GET', '/repos/test', 404, 'Repository not found');

    expect(error.code).toBe('GITHUB_API_ERROR');
    expect(error.method).toBe('GET');
    expect(error.endpoint).toBe('/repos/test');
    expect(error.statusCode).toBe(404);
    expect(error.apiMessage).toBe('Repository not found');
    expect(error.name).toBe('GitHubAPIError');
  });

  test('should handle rate limiting', () => {
    const error = new GitHubAPIError('GET', '/repos/test', 403, 'Rate limit exceeded');

    expect(error.retryable).toBe(true);
    expect(error.message).toContain('Rate limit');
  });
});

describe('CacheError', () => {
  test('should create cache error', () => {
    const originalError = new Error('Redis connection failed');
    const error = new CacheError('get:user:123', originalError);

    expect(error.code).toBe('CACHE_ERROR');
    expect(error.operation).toBe('get:user:123');
    expect(error.originalError).toBe(originalError);
    expect(error.retryable).toBe(true);
    expect(error.name).toBe('CacheError');
  });

  test('should include operation in message', () => {
    const error = new CacheError('set:session:abc');

    expect(error.message).toContain('set:session:abc');
  });
});

describe('RateLimitError', () => {
  test('should create rate limit error', () => {
    const error = new RateLimitError('user:123', 30, { remaining: 0, resetTime: Date.now() });

    expect(error.code).toBe('RATE_LIMIT_ERROR');
    expect(error.identifier).toBe('user:123');
    expect(error.retryAfter).toBe(30);
    expect(error.rateLimitInfo).toEqual({ remaining: 0, resetTime: expect.any(Number) });
    expect(error.retryable).toBe(true);
    expect(error.name).toBe('RateLimitError');
  });

  test('should include retry information in message', () => {
    const error = new RateLimitError('api:github', 60);

    expect(error.message).toContain('api:github');
    expect(error.message).toContain('60');
  });
});

describe('withErrorHandling', () => {
  test('should return result when operation succeeds', async () => {
    const result = await withErrorHandling(async () => 'success');

    expect(result).toBe('success');
  });

  test('should rethrow BaseError as-is', async () => {
    const originalError = new ValidationError('field', 'Invalid');

    await expect(withErrorHandling(async () => {
      throw originalError;
    })).rejects.toThrow(originalError);
  });

  test('should wrap unknown errors', async () => {
    const originalError = new Error('Unknown error');

    await expect(withErrorHandling(async () => {
      throw originalError;
    })).rejects.toThrow(BaseError);

    try {
      await withErrorHandling(async () => {
        throw originalError;
      });
    } catch (error) {
      expect(error).toBeInstanceOf(BaseError);
      if (error instanceof BaseError) {
        expect(error.code).toBe('UNKNOWN_ERROR');
        expect(error.originalError).toBe(originalError);
      }
    }
  });

  test('should handle non-Error objects', async () => {
    await expect(withErrorHandling(async () => {
      throw 'string error';
    })).rejects.toThrow(BaseError);

    await expect(withErrorHandling(async () => {
      throw { message: 'object error' };
    })).rejects.toThrow(BaseError);
  });
});

describe('sanitizeError', () => {
  test('should sanitize error for logging', () => {
    const error = new ValidationError('password', 'Invalid password', {
      password: 'secret123',
      token: 'abc123',
      publicField: 'safe'
    });

    const sanitized = sanitizeError(error);

    expect(sanitized.code).toBe('VALIDATION_ERROR');
    expect(sanitized.message).toBe('Validation error for field: password - Invalid password');
    expect(sanitized.details).toEqual({
      password: '[REDACTED]',
      token: '[REDACTED]',
      publicField: 'safe'
    });
    expect(sanitized.timestamp).toBeValidISODate();
  });

  test('should handle errors without details', () => {
    const error = new BaseError('TEST_ERROR', 'Test message');
    const sanitized = sanitizeError(error);

    expect(sanitized.code).toBe('TEST_ERROR');
    expect(sanitized.message).toBe('Test message');
    expect(sanitized.details).toBeUndefined();
  });

  test('should sanitize nested sensitive data', () => {
    const error = new BaseError('TEST_ERROR', 'Test', false, 'Test', {
      user: {
        id: 123,
        password: 'secret',
        profile: {
          apiKey: 'key123',
          name: 'John'
        }
      }
    });

    const sanitized = sanitizeError(error);
    expect(sanitized.details).toEqual({
      user: {
        id: 123,
        password: '[REDACTED]',
        profile: {
          apiKey: '[REDACTED]',
          name: 'John'
        }
      }
    });
  });

  test('should handle circular references', () => {
    const obj: any = { name: 'test' };
    obj.self = obj;

    const error = new BaseError('TEST_ERROR', 'Test', false, 'Test', obj);
    const sanitized = sanitizeError(error);

    expect(sanitized.details).toEqual({ name: 'test' });
  });
});