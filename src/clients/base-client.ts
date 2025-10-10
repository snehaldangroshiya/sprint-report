// Base API client with error handling, caching, and retry logic

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';

import { CacheManager } from '@/cache/cache-manager';
import { AppConfig } from '@/types';
import {
  withErrorHandling,
  BaseError,
  RateLimitError,
  TimeoutError,
  AuthenticationError,
} from '@/utils/errors';

export interface APIClientOptions {
  baseURL: string;
  timeout: number;
  headers?: Record<string, string>;
  maxRetries?: number;
  retryDelay?: number;
  userAgent?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryCondition: (error: AxiosError) => boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export abstract class BaseAPIClient {
  protected httpClient: AxiosInstance;
  protected cacheManager: CacheManager;
  protected rateLimitInfo: RateLimitInfo | null = null;
  protected lastRequestTime = 0;
  protected readonly retryConfig: RetryConfig;

  constructor(
    protected options: APIClientOptions,
    protected config: AppConfig,
    cacheManager?: CacheManager
  ) {
    this.httpClient = this.createAxiosInstance();
    this.retryConfig = this.createRetryConfig();
    this.setupInterceptors();

    // Use provided CacheManager or create a default one
    this.cacheManager =
      cacheManager ||
      new CacheManager({
        memory: { maxSize: 100, ttl: 300 },
      });
  }

  protected abstract get serviceName(): string;

  private createAxiosInstance(): AxiosInstance {
    return axios.create({
      baseURL: this.options.baseURL,
      timeout: this.options.timeout,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': this.options.userAgent || 'JiraGitHubReporter/1.0.0',
        ...this.options.headers,
      },
    });
  }

  private createRetryConfig(): RetryConfig {
    return {
      maxRetries: this.options.maxRetries || 3,
      baseDelay: this.options.retryDelay || 1000,
      maxDelay: 30000,
      retryCondition: (error: AxiosError) => this.isRetryableError(error),
    };
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      config => {
        // Add request ID for tracking
        config.metadata = {
          requestId: this.generateRequestId(),
          startTime: Date.now(),
        };

        return config;
      },
      error => Promise.reject(error)
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      response => {
        this.updateRateLimitInfo(response);
        this.logRequest(response);
        return response;
      },
      error => {
        this.logError(error);
        return Promise.reject(this.transformError(error));
      }
    );
  }

  // Core request method with caching and retry logic
  protected async makeRequest<T>(
    endpoint: string,
    options: AxiosRequestConfig = {},
    cacheOptions: { ttl?: number; useCache?: boolean } = {}
  ): Promise<T> {
    const { ttl = 300000, useCache = true } = cacheOptions; // Default 5 min TTL

    return withErrorHandling(
      async () => {
        // Check cache first
        if (useCache && options.method !== 'POST') {
          const cached = await this.getFromCache<T>(endpoint, options);
          if (cached) {
            return cached;
          }
        }

        // Check rate limits
        await this.checkRateLimit();

        // Make request with retry logic
        const response = await this.makeRequestWithRetry<T>(endpoint, options);

        // Cache successful response
        if (useCache && options.method !== 'POST') {
          await this.setCache(endpoint, options, response.data, ttl);
        }

        return response.data;
      },
      {
        operation: `${this.serviceName}_request`,
        service: this.serviceName,
        metadata: { endpoint, method: options.method || 'GET' },
      }
    );
  }

  private async makeRequestWithRetry<T>(
    endpoint: string,
    options: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    let lastError: AxiosError | null = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await this.httpClient.request<T>({
          url: endpoint,
          ...options,
        });

        return response;
      } catch (error) {
        const axiosError = error as AxiosError;
        lastError = axiosError;

        // Don't retry on the last attempt
        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.retryConfig.retryCondition(axiosError)) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateRetryDelay(attempt);
        await this.delay(delay);

        // Log retry attempt (skip in stdio mode to avoid protocol interference)
        if (process.stdin.isTTY !== false || process.stdout.isTTY !== false) {
          console.error(
            `Retrying request to ${endpoint}, attempt ${attempt + 1}/${this.retryConfig.maxRetries}`
          );
        }
      }
    }

    throw this.transformError(lastError!);
  }

  private isRetryableError(error: AxiosError): boolean {
    // Don't retry client errors (4xx) except rate limiting and auth
    if (error.response?.status) {
      const status = error.response.status;

      // Always retry rate limit errors
      if (status === 429) return true;

      // Don't retry client errors
      if (status >= 400 && status < 500) return false;

      // Retry server errors
      if (status >= 500) return true;
    }

    // Retry network errors
    if (!error.response) {
      return true;
    }

    return false;
  }

  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay =
      this.retryConfig.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, this.retryConfig.maxDelay);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cache management - using CacheManager for Redis support
  private generateCacheKey(
    endpoint: string,
    options: AxiosRequestConfig
  ): string {
    const params = JSON.stringify({
      endpoint,
      method: options.method || 'GET',
      params: options.params,
      data: options.data,
    });

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < params.length; i++) {
      const char = params.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `${this.serviceName}:${Math.abs(hash)}`;
  }

  private async getFromCache<T>(
    endpoint: string,
    options: AxiosRequestConfig
  ): Promise<T | null> {
    const key = this.generateCacheKey(endpoint, options);
    return await this.cacheManager.get<T>(key);
  }

  private async setCache<T>(
    endpoint: string,
    options: AxiosRequestConfig,
    data: T,
    ttl: number
  ): Promise<void> {
    const key = this.generateCacheKey(endpoint, options);
    // Convert milliseconds to seconds for CacheManager
    const ttlSeconds = Math.floor(ttl / 1000);
    await this.cacheManager.set(key, data, { ttl: ttlSeconds });
  }

  // Rate limiting
  private async checkRateLimit(): Promise<void> {
    if (!this.rateLimitInfo) {
      return;
    }

    const now = Date.now() / 1000;

    // Check if rate limit is exceeded
    if (this.rateLimitInfo.remaining <= 0 && now < this.rateLimitInfo.reset) {
      const retryAfter = this.rateLimitInfo.reset - now;
      throw new RateLimitError(this.serviceName, Math.ceil(retryAfter));
    }

    // Basic request throttling
    const minInterval = 100; // 100ms between requests
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < minInterval) {
      await this.delay(minInterval - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
  }

  private updateRateLimitInfo(response: AxiosResponse): void {
    const headers = response.headers;

    // GitHub rate limit headers
    if (headers['x-ratelimit-limit']) {
      this.rateLimitInfo = {
        limit: parseInt(headers['x-ratelimit-limit'], 10),
        remaining: parseInt(headers['x-ratelimit-remaining'], 10),
        reset: parseInt(headers['x-ratelimit-reset'], 10),
      };
    }

    // Handle 429 responses
    if (response.status === 429) {
      const retryAfter = parseInt(headers['retry-after'] || '60', 10);
      if (this.rateLimitInfo) {
        this.rateLimitInfo.retryAfter = retryAfter;
      }
    }
  }

  // Error transformation
  private transformError(error: AxiosError): BaseError {
    const response = error.response;
    const status = response?.status;
    const message = this.extractErrorMessage(error);

    if (status === 401 || status === 403) {
      return new AuthenticationError(this.serviceName, {
        status,
        message,
        endpoint: error.config?.url,
      });
    }

    if (status === 429) {
      const retryAfter = this.extractRetryAfter(error);
      return new RateLimitError(this.serviceName, retryAfter, {
        status,
        message,
        endpoint: error.config?.url,
      });
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return new TimeoutError(
        error.config?.url || 'unknown',
        this.options.timeout,
        {
          status,
          message,
          code: error.code,
        }
      );
    }

    // Default API error
    const retryable = this.isRetryableError(error);
    return new BaseError(
      message,
      `${this.serviceName.toUpperCase()}_API_ERROR`,
      retryable,
      undefined,
      {
        status,
        endpoint: error.config?.url,
        method: error.config?.method,
      }
    );
  }

  private extractErrorMessage(error: AxiosError): string {
    if (error.response?.data) {
      const data = error.response.data as any;

      // GitHub error format
      if (data.message) {
        return data.message;
      }

      // Jira error format
      if (data.errorMessages && Array.isArray(data.errorMessages)) {
        return data.errorMessages[0] || 'Unknown API error';
      }

      if (data.errors && typeof data.errors === 'object') {
        const firstError = Object.values(data.errors)[0];
        if (typeof firstError === 'string') {
          return firstError;
        }
      }
    }

    return error.message || 'Unknown API error';
  }

  private extractRetryAfter(error: AxiosError): number {
    const retryAfter = error.response?.headers['retry-after'];
    if (retryAfter) {
      return parseInt(retryAfter, 10);
    }

    // Default retry after for rate limits
    return 60;
  }

  // Utility methods
  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private logRequest(response: AxiosResponse): void {
    if (!this.config.logging.enableApiLogging) return;

    const config = response.config;
    const duration = Date.now() - (config.metadata?.startTime || Date.now());

    // Don't log in stdio mode - console output interferes with JSON-RPC protocol
    // Even console.error with objects gets converted to MCP notifications
    if (process.stdin.isTTY === false && process.stdout.isTTY === false) {
      return;
    }

    console.error({
      service: this.serviceName,
      method: config.method?.toUpperCase(),
      url: config.url,
      status: response.status,
      duration,
      requestId: config.metadata?.requestId,
    });
  }

  private logError(error: AxiosError): void {
    if (!this.config.logging.enableApiLogging) return;

    const config = error.config;
    const duration = config?.metadata?.startTime
      ? Date.now() - config.metadata.startTime
      : 0;

    // Don't log in stdio mode - console output interferes with JSON-RPC protocol
    if (process.stdin.isTTY === false && process.stdout.isTTY === false) {
      return;
    }

    console.error({
      service: this.serviceName,
      method: config?.method?.toUpperCase(),
      url: config?.url,
      status: error.response?.status,
      error: error.message,
      duration,
      requestId: config?.metadata?.requestId,
    });
  }

  // Public utility methods
  public async clearCache(): Promise<void> {
    await this.cacheManager.clear();
  }

  public getCacheStats(): {
    size: number;
    entries: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const stats = this.cacheManager.getStats();
    return {
      size: stats.memory,
      entries: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hitRate,
    };
  }

  public getCacheManager(): CacheManager {
    return this.cacheManager;
  }

  public getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo ? { ...this.rateLimitInfo } : null;
  }

  public async healthCheck(): Promise<{
    healthy: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      await this.performHealthCheck();
      return {
        healthy: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  protected abstract performHealthCheck(): Promise<void>;
}
