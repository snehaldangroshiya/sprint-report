// Environment configuration and validation

import * as dotenv from 'dotenv';
import { z } from 'zod';

import { AppConfig } from '../types';
import { ConfigurationError } from '../utils/errors';

// Load environment variables from .env file
dotenv.config();

// Validation schemas for configuration
const JiraConfigSchema = z.object({
  baseUrl: z.string().url('Jira base URL must be a valid URL'),
  email: z.string().email('Jira email must be a valid email address'),
  apiToken: z.string().min(1, 'Jira API token is required'),
  authType: z.enum(['basic', 'bearer']).default('basic'), // Add authentication type
  maxResults: z.number().int().min(1).max(1000).default(100),
  timeout: z.number().int().min(1000).max(120000).default(30000),
});

const GitHubConfigSchema = z.object({
  token: z.string().min(1, 'GitHub token is required'),
  apiUrl: z
    .string()
    .url('GitHub API URL must be valid')
    .default('https://api.github.com'),
  timeout: z.number().int().min(1000).max(120000).default(30000),
  userAgent: z.string().min(1).default('JiraGitHubReporter/1.0.0'),
});

const CacheConfigSchema = z.object({
  memory: z.object({
    maxSize: z.number().int().min(10).max(1000000).default(50000),
    ttl: z.number().int().min(60).max(3600).default(300),
  }),
  redis: z
    .object({
      host: z.string().min(1).default('localhost'),
      port: z.number().int().min(1).max(65535).default(6379),
      password: z.string().optional(),
      db: z.number().int().min(0).max(15).default(0),
    })
    .optional(),
});

const ServerConfigSchema = z.object({
  port: z.number().int().min(1000).max(65535).default(3000),
  host: z.string().min(1).default('localhost'),
  cors: z.boolean().default(true),
  corsOrigin: z.string().default('*'),
});

const ReportsConfigSchema = z.object({
  outputDir: z.string().min(1).default('./sprint-reports'),
  templateDir: z.string().min(1).default('./src/templates'),
  maxSize: z
    .number()
    .int()
    .min(1024)
    .max(100 * 1024 * 1024)
    .default(50 * 1024 * 1024),
});

const SecurityConfigSchema = z.object({
  rateLimitPerMinute: z.number().int().min(1).max(1000).default(100),
  maxRequestSize: z
    .number()
    .int()
    .min(1024)
    .max(50 * 1024 * 1024)
    .default(10 * 1024 * 1024),
  enableHelmet: z.boolean().default(true),
});

const LoggingConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  enableApiLogging: z.boolean().default(true),
});

const AppConfigSchema = z.object({
  jira: JiraConfigSchema,
  github: GitHubConfigSchema,
  cache: CacheConfigSchema,
  server: ServerConfigSchema,
  reports: ReportsConfigSchema,
  security: SecurityConfigSchema,
  logging: LoggingConfigSchema,
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
});

// Environment variable mapping
function getEnvironmentVariables(): Record<string, any> {
  return {
    // Jira configuration
    jira: {
      baseUrl: process.env.JIRA_BASE_URL,
      email: process.env.JIRA_EMAIL,
      apiToken: process.env.JIRA_API_TOKEN,
      authType: (process.env.JIRA_AUTH_TYPE as 'basic' | 'bearer') || 'basic',
      maxResults: process.env.JIRA_MAX_RESULTS
        ? parseInt(process.env.JIRA_MAX_RESULTS, 10)
        : undefined,
      timeout: process.env.JIRA_TIMEOUT
        ? parseInt(process.env.JIRA_TIMEOUT, 10)
        : undefined,
    },

    // GitHub configuration
    github: {
      token: process.env.GITHUB_TOKEN,
      apiUrl: process.env.GITHUB_API_URL,
      timeout: process.env.GITHUB_TIMEOUT
        ? parseInt(process.env.GITHUB_TIMEOUT, 10)
        : undefined,
      userAgent: process.env.GITHUB_USER_AGENT,
    },

    // Cache configuration
    cache: {
      memory: {
        maxSize: process.env.MEMORY_CACHE_MAX_SIZE
          ? parseInt(process.env.MEMORY_CACHE_MAX_SIZE, 10)
          : undefined,
        ttl: process.env.MEMORY_CACHE_TTL
          ? parseInt(process.env.MEMORY_CACHE_TTL, 10)
          : undefined,
      },
      redis: process.env.REDIS_HOST
        ? {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT
              ? parseInt(process.env.REDIS_PORT, 10)
              : undefined,
            password: process.env.REDIS_PASSWORD,
            db: process.env.REDIS_DB
              ? parseInt(process.env.REDIS_DB, 10)
              : undefined,
          }
        : undefined,
    },

    // Server configuration
    server: {
      port: process.env.MCP_SERVER_PORT
        ? parseInt(process.env.MCP_SERVER_PORT, 10)
        : undefined,
      host: process.env.MCP_SERVER_HOST,
      cors: process.env.ENABLE_CORS
        ? process.env.ENABLE_CORS === 'true'
        : undefined,
      corsOrigin: process.env.CORS_ORIGIN,
    },

    // Reports configuration
    reports: {
      outputDir: process.env.REPORT_OUTPUT_DIR,
      templateDir: process.env.REPORT_TEMPLATE_DIR,
      maxSize: process.env.REPORT_MAX_SIZE
        ? parseInt(process.env.REPORT_MAX_SIZE, 10)
        : undefined,
    },

    // Security configuration
    security: {
      rateLimitPerMinute: process.env.RATE_LIMIT_PER_MINUTE
        ? parseInt(process.env.RATE_LIMIT_PER_MINUTE, 10)
        : undefined,
      maxRequestSize: process.env.MAX_REQUEST_SIZE
        ? parseInt(process.env.MAX_REQUEST_SIZE, 10)
        : undefined,
      enableHelmet: process.env.ENABLE_HELMET
        ? process.env.ENABLE_HELMET === 'true'
        : undefined,
    },

    // Logging configuration
    logging: {
      level: process.env.LOG_LEVEL as
        | 'error'
        | 'warn'
        | 'info'
        | 'debug'
        | undefined,
      enableApiLogging: process.env.ENABLE_API_LOGGING
        ? process.env.ENABLE_API_LOGGING === 'true'
        : undefined,
    },

    // Node environment
    nodeEnv: process.env.NODE_ENV as
      | 'development'
      | 'test'
      | 'production'
      | undefined,
  };
}

// Configuration validation and creation
export function createAppConfig(): AppConfig {
  try {
    const envVars = getEnvironmentVariables();
    const parsedConfig = AppConfigSchema.parse(envVars);

    // Additional validation
    validateConfiguration(parsedConfig as AppConfig);

    return parsedConfig as AppConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('\n');

      throw new ConfigurationError(
        'environment_validation',
        `Configuration validation failed:\n${errorMessages}`
      );
    }

    throw error;
  }
}

// Additional configuration validation
function validateConfiguration(config: AppConfig): void {
  // Validate Jira URL format with strict domain validation
  try {
    const jiraUrl = new URL(config.jira.baseUrl);
    const validDomains = ['atlassian.net', 'jira.com'];
    const validKeywords = ['jira'];

    // Check if hostname contains valid domain or jira keyword
    const hasValidDomain = validDomains.some(domain =>
      jiraUrl.hostname.endsWith(domain)
    );
    const hasValidKeyword = validKeywords.some(keyword =>
      jiraUrl.hostname.includes(keyword)
    );

    if (!hasValidDomain && !hasValidKeyword) {
      throw new ConfigurationError(
        'jira.baseUrl',
        `Jira base URL must be from a valid Jira domain (e.g., *.atlassian.net, *.jira.com) or contain 'jira' in hostname. Got: ${jiraUrl.hostname}`
      );
    }

    // Enforce HTTPS in production
    if (config.nodeEnv === 'production' && jiraUrl.protocol !== 'https:') {
      throw new ConfigurationError(
        'jira.baseUrl',
        'Jira base URL must use HTTPS in production environment'
      );
    }
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    throw new ConfigurationError(
      'jira.baseUrl',
      `Invalid Jira base URL format: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Validate GitHub token format (basic check)
  if (
    !config.github.token.startsWith('ghp_') &&
    !config.github.token.startsWith('github_pat_')
  ) {
    console.warn(
      'GitHub token format may be invalid. Expected format: ghp_* or github_pat_*'
    );
  }

  // Validate output directory exists or can be created
  const fs = require('fs');
  const path = require('path');

  try {
    const outputDir = path.resolve(config.reports.outputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  } catch (error: unknown) {
    throw new ConfigurationError(
      'reports.outputDir',
      `Cannot create output directory: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Validate template directory exists
  try {
    const templateDir = path.resolve(config.reports.templateDir);
    if (!fs.existsSync(templateDir)) {
      throw new Error('Template directory does not exist');
    }
  } catch (error: unknown) {
    throw new ConfigurationError(
      'reports.templateDir',
      `Template directory validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Production-specific validations
  if (config.nodeEnv === 'production') {
    if (config.server.corsOrigin === '*') {
      console.warn(
        'WARNING: CORS origin is set to "*" in production. Consider restricting it.'
      );
    }

    if (config.logging.level === 'debug') {
      console.warn('WARNING: Debug logging is enabled in production.');
    }
  }
}

// Configuration utilities
export class ConfigValidator {
  static async validateJiraConnection(
    config: AppConfig
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const axios = require('axios');
      const response = await axios.get(
        `${config.jira.baseUrl}/rest/api/2/myself`,
        {
          auth: {
            username: config.jira.email,
            password: config.jira.apiToken,
          },
          timeout: config.jira.timeout,
        }
      );

      return { valid: response.status === 200 };
    } catch (error: any) {
      return {
        valid: false,
        error:
          error.response?.status === 401
            ? 'Invalid credentials'
            : error.message,
      };
    }
  }

  static async validateGitHubConnection(
    config: AppConfig
  ): Promise<{ valid: boolean; error?: string; scopes?: string[] }> {
    try {
      const axios = require('axios');
      const response = await axios.get(`${config.github.apiUrl}/user`, {
        headers: {
          Authorization: `Bearer ${config.github.token}`,
          'User-Agent': config.github.userAgent,
        },
        timeout: config.github.timeout,
      });

      const scopes = response.headers['x-oauth-scopes']?.split(', ') || [];
      const requiredScopes = ['repo'];
      const hasRequiredScopes = requiredScopes.every(scope =>
        scopes.includes(scope)
      );

      if (!hasRequiredScopes) {
        return {
          valid: false,
          error: `Missing required scopes. Required: ${requiredScopes.join(', ')}, Available: ${scopes.join(', ')}`,
          scopes,
        };
      }

      return { valid: true, scopes };
    } catch (error: any) {
      return {
        valid: false,
        error: error.response?.status === 401 ? 'Invalid token' : error.message,
      };
    }
  }

  static async validateConfiguration(config: AppConfig): Promise<{
    jira: { valid: boolean; error?: string };
    github: { valid: boolean; error?: string; scopes?: string[] };
  }> {
    const [jiraResult, githubResult] = await Promise.all([
      this.validateJiraConnection(config),
      this.validateGitHubConnection(config),
    ]);

    return {
      jira: jiraResult,
      github: githubResult,
    };
  }
}

// Export configuration helpers
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

// Configuration singleton
let appConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!appConfig) {
    appConfig = createAppConfig();
  }
  return appConfig;
}

// Reset configuration (useful for testing)
export function resetConfig(): void {
  appConfig = null;
}

// Configuration summary for logging (with sensitive data redacted)
export function getConfigSummary(config: AppConfig): Record<string, any> {
  return {
    jira: {
      baseUrl: config.jira.baseUrl,
      email: config.jira.email,
      hasApiToken: !!config.jira.apiToken,
      maxResults: config.jira.maxResults,
      timeout: config.jira.timeout,
    },
    github: {
      apiUrl: config.github.apiUrl,
      hasToken: !!config.github.token,
      userAgent: config.github.userAgent,
      timeout: config.github.timeout,
    },
    server: {
      port: config.server.port,
      host: config.server.host,
      cors: config.server.cors,
    },
    cache: {
      memoryMaxSize: config.cache.memory.maxSize,
      memoryTtl: config.cache.memory.ttl,
      hasRedis: !!config.cache.redis,
    },
    reports: {
      outputDir: config.reports.outputDir,
      templateDir: config.reports.templateDir,
      maxSize: config.reports.maxSize,
    },
    logging: {
      level: config.logging.level,
      enableApiLogging: config.logging.enableApiLogging,
    },
    nodeEnv: config.nodeEnv,
  };
}
