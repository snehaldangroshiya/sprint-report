// Centralized configuration constants
// Single source of truth for application-wide configuration values

/**
 * Default Board Configuration
 * NOTE: Can be overridden via environment variables
 */
export const DEFAULT_BOARD_ID =
  process.env.DEFAULT_BOARD_ID || process.env.JIRA_DEFAULT_BOARD_ID || '6306';

/**
 * Cache Configuration
 */
export const CACHE_CONFIG = {
  VERSION: 'v4', // Increment when cache structure changes
  TTL: {
    SPRINT_STATE: 3600000, // 1 hour
    CLOSED_SPRINT_DATA: 2592000000, // 30 days (immutable)
    ACTIVE_SPRINT_DATA: 300000, // 5 minutes (frequently changing)
    FUTURE_SPRINT_DATA: 900000, // 15 minutes (may change during planning)
    BOARD_LIST: 1800000, // 30 minutes
    DEFAULT: 600000, // 10 minutes
  },
} as const;

/**
 * Retry Configuration
 */
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY: 1000, // 1 second
  MAX_DELAY: 30000, // 30 seconds
  BACKOFF_FACTOR: 2, // Exponential backoff
} as const;

/**
 * Timeout Configuration (milliseconds)
 */
export const TIMEOUT_CONFIG = {
  HEALTH_CHECK: 5000, // 5 seconds
  API_REQUEST: 30000, // 30 seconds
  LONG_RUNNING_OPERATION: 120000, // 2 minutes
} as const;

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMIT_CONFIG = {
  PER_MINUTE: 100,
  PER_HOUR: 3000,
  BURST_SIZE: 20,
} as const;

/**
 * Application Defaults
 */
export const APP_DEFAULTS = {
  SPRINT_COUNT: 5,
  MAX_RESULTS: 100,
  PAGE_SIZE: 50,
  MAX_PAGES: 10, // Limit to prevent infinite loops
} as const;

/**
 * Security Configuration
 */
export const SECURITY_CONFIG = {
  MAX_REQUEST_SIZE: 10 * 1024 * 1024, // 10MB
  COMPRESSION_THRESHOLD: 50 * 1024, // 50KB
  ALLOWED_JIRA_DOMAINS: ['atlassian.net', 'jira.com'],
  ALLOWED_JIRA_KEYWORDS: ['jira'],
} as const;

/**
 * GitHub Configuration
 */
export const GITHUB_CONFIG = {
  TOKEN_PREFIXES: ['ghp_', 'github_pat_'],
  MAX_COMMITS_PER_REQUEST: 100,
  MAX_PRS_PER_REQUEST: 100,
  MAX_PAGES: 10, // Limit to 1000 items
} as const;
