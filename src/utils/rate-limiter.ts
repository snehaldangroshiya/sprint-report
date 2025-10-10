// Rate limiting implementation with token bucket algorithm

import { RateLimitError } from './errors';

import { RateLimitStatus, TokenBucket } from '@/types';

export interface RateLimiterOptions {
  tokensPerInterval: number;
  interval: number; // in milliseconds
  burstLimit?: number;
}

export class RateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private options: RateLimiterOptions) {
    this.startCleanup();
  }

  // Check if request is allowed for a given identifier
  async checkLimit(identifier: string): Promise<RateLimitStatus> {
    const bucket = this.getBucket(identifier);
    const now = Date.now();

    // Refill tokens based on time passed
    this.refillBucket(bucket, now);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetTime: now + this.options.interval,
      };
    }

    // Calculate when tokens will be available
    const tokensNeeded = 1 - bucket.tokens;
    const timeToWait =
      (tokensNeeded / this.options.tokensPerInterval) * this.options.interval;

    return {
      allowed: false,
      remaining: 0,
      resetTime: now + this.options.interval,
      retryAfter: Math.ceil(timeToWait / 1000), // Convert to seconds
    };
  }

  // Acquire a token (throws if rate limited)
  async acquire(identifier: string): Promise<void> {
    const status = await this.checkLimit(identifier);

    if (!status.allowed) {
      throw new RateLimitError(identifier, status.retryAfter || 60, {
        remaining: status.remaining,
        resetTime: status.resetTime,
      });
    }
  }

  // Get current status without consuming tokens
  async getStatus(identifier: string): Promise<RateLimitStatus> {
    const bucket = this.getBucket(identifier);
    const now = Date.now();

    // Refill tokens based on time passed (without modifying the bucket)
    const tempBucket = { ...bucket };
    this.refillBucket(tempBucket, now);

    return {
      allowed: tempBucket.tokens >= 1,
      remaining: Math.floor(tempBucket.tokens),
      resetTime: now + this.options.interval,
    };
  }

  // Reset rate limit for identifier
  reset(identifier: string): void {
    this.buckets.delete(identifier);
  }

  // Clear all rate limits
  clear(): void {
    this.buckets.clear();
  }

  // Get or create bucket for identifier
  private getBucket(identifier: string): TokenBucket {
    let bucket = this.buckets.get(identifier);

    if (!bucket) {
      const capacity =
        this.options.burstLimit || this.options.tokensPerInterval;
      bucket = {
        tokens: capacity,
        lastRefill: Date.now(),
        capacity,
        refillRate: this.options.tokensPerInterval / this.options.interval,
      };
      this.buckets.set(identifier, bucket);
    }

    return bucket;
  }

  // Refill tokens in bucket based on elapsed time
  private refillBucket(bucket: TokenBucket, now: number): void {
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = elapsed * bucket.refillRate;

    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  // Start periodic cleanup of old buckets
  private startCleanup(): void {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldBuckets();
      },
      5 * 60 * 1000
    ); // Cleanup every 5 minutes
  }

  // Remove buckets that haven't been used recently
  private cleanupOldBuckets(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    for (const [identifier, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAge) {
        this.buckets.delete(identifier);
      }
    }
  }

  // Cleanup method
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.buckets.clear();
  }

  // Get statistics
  getStats(): {
    activeBuckets: number;
    totalRequests: number;
    averageTokens: number;
  } {
    const buckets = Array.from(this.buckets.values());
    const totalTokens = buckets.reduce((sum, bucket) => sum + bucket.tokens, 0);

    return {
      activeBuckets: buckets.length,
      totalRequests: buckets.length, // Approximation
      averageTokens: buckets.length > 0 ? totalTokens / buckets.length : 0,
    };
  }
}

// Specialized rate limiters for different services
export class ServiceRateLimiter {
  private rateLimiters = new Map<string, RateLimiter>();

  constructor() {
    // GitHub API rate limits
    this.rateLimiters.set(
      'github-core',
      new RateLimiter({
        tokensPerInterval: 5000,
        interval: 60 * 60 * 1000, // 1 hour
        burstLimit: 100, // Allow burst of 100 requests
      })
    );

    this.rateLimiters.set(
      'github-search',
      new RateLimiter({
        tokensPerInterval: 30,
        interval: 60 * 1000, // 1 minute
        burstLimit: 10,
      })
    );

    // Jira API rate limits (more conservative)
    this.rateLimiters.set(
      'jira',
      new RateLimiter({
        tokensPerInterval: 600, // 10 requests per second
        interval: 60 * 1000, // 1 minute
        burstLimit: 50,
      })
    );

    // General API rate limits
    this.rateLimiters.set(
      'general',
      new RateLimiter({
        tokensPerInterval: 100,
        interval: 60 * 1000, // 1 minute
        burstLimit: 20,
      })
    );
  }

  async checkLimit(
    service: string,
    identifier: string
  ): Promise<RateLimitStatus> {
    const rateLimiter = this.rateLimiters.get(service);
    if (!rateLimiter) {
      throw new Error(`Unknown service: ${service}`);
    }

    return rateLimiter.checkLimit(identifier);
  }

  async acquire(service: string, identifier: string): Promise<void> {
    const rateLimiter = this.rateLimiters.get(service);
    if (!rateLimiter) {
      throw new Error(`Unknown service: ${service}`);
    }

    await rateLimiter.acquire(identifier);
  }

  async getStatus(
    service: string,
    identifier: string
  ): Promise<RateLimitStatus> {
    const rateLimiter = this.rateLimiters.get(service);
    if (!rateLimiter) {
      throw new Error(`Unknown service: ${service}`);
    }

    return rateLimiter.getStatus(identifier);
  }

  reset(service: string, identifier: string): void {
    const rateLimiter = this.rateLimiters.get(service);
    if (rateLimiter) {
      rateLimiter.reset(identifier);
    }
  }

  clear(): void {
    for (const rateLimiter of this.rateLimiters.values()) {
      rateLimiter.clear();
    }
  }

  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [service, rateLimiter] of this.rateLimiters.entries()) {
      stats[service] = rateLimiter.getStats();
    }

    return stats;
  }

  destroy(): void {
    for (const rateLimiter of this.rateLimiters.values()) {
      rateLimiter.destroy();
    }
    this.rateLimiters.clear();
  }
}

// Middleware for express-style applications
export class RateLimitMiddleware {
  constructor(
    private rateLimiter: RateLimiter,
    private keyGenerator: (req: any) => string = req => req.ip || 'default'
  ) {}

  middleware() {
    return async (req: any, res: any, next: any) => {
      try {
        const key = this.keyGenerator(req);
        const status = await this.rateLimiter.checkLimit(key);

        // Set rate limit headers
        res.setHeader(
          'X-RateLimit-Limit',
          this.rateLimiter['options'].tokensPerInterval
        );
        res.setHeader('X-RateLimit-Remaining', status.remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(status.resetTime / 1000));

        if (!status.allowed) {
          res.setHeader('Retry-After', status.retryAfter || 60);
          return res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: status.retryAfter,
          });
        }

        next();
      } catch (error) {
        console.error('Rate limit middleware error:', error);
        next(error);
      }
    };
  }
}

// Utility functions
export function createRateLimiterFromConfig(config: {
  requestsPerMinute: number;
  burstLimit?: number;
}): RateLimiter {
  return new RateLimiter({
    tokensPerInterval: config.requestsPerMinute,
    interval: 60 * 1000, // 1 minute
    burstLimit: config.burstLimit || Math.floor(config.requestsPerMinute / 4),
  });
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Exponential backoff utility
export async function withBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Check if it's a rate limit error
      if (error instanceof RateLimitError) {
        const delayMs = error.retryAfter * 1000;
        console.log(
          `Rate limited, waiting ${error.retryAfter} seconds before retry`
        );
        await delay(delayMs);
      } else {
        // Exponential backoff for other errors
        const delayMs = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 0.1 * delayMs;
        await delay(delayMs + jitter);
      }

      console.log(`Retrying operation, attempt ${attempt + 1}/${maxRetries}`);
    }
  }

  throw lastError!;
}
