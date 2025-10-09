/**
 * Sprint-related constants
 * Centralized configuration for better maintainability
 */

export const SPRINT_CONSTANTS = {
  // Default board ID
  DEFAULT_BOARD_ID: '6306',

  // Default GitHub repository
  DEFAULT_GITHUB: {
    owner: 'Sage',
    repo: 'sage-connect',
  },

  // Jira configuration
  JIRA_BASE_URL: 'https://jira.sage.com',

  // Pagination defaults
  PAGINATION: {
    API_PAGE_SIZE: 20,
    COMMITS_PER_PAGE: 10,
    VELOCITY_HISTORY_COUNT: 15,
  },

  // Comprehensive report options
  REPORT_DEFAULTS: {
    includeTier1: true,
    includeTier2: true,
    includeTier3: false,
    includeForwardLooking: false,
    includeEnhancedGithub: true,
  },

  // Cache times (in milliseconds)
  CACHE: {
    SPRINT_DATA: 5 * 60 * 1000,  // 5 minutes
    HISTORICAL_DATA: 30 * 60 * 1000, // 30 minutes
  },
} as const;
