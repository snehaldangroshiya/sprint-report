/**
 * Configuration Storage Utility
 * Manages application configuration persistence using localStorage
 */

export interface AppConfiguration {
  jira: {
    boardId: string;
    boardName: string;
  };
  github: {
    owner: string;
    repo: string;
  };
  lastModified: string;
}

// Default configuration matches existing constants
export const DEFAULT_CONFIG: AppConfiguration = {
  jira: {
    boardId: '6306',
    boardName: 'Sage Connect',
  },
  github: {
    owner: 'Sage',
    repo: 'sage-connect',
  },
  lastModified: new Date().toISOString(),
};

const CONFIG_STORAGE_KEY = 'nextrelease_app_configuration';

/**
 * Load configuration from localStorage
 * Falls back to defaults if not found or invalid
 */
export const loadConfiguration = (): AppConfiguration => {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate structure
      if (parsed.jira?.boardId && parsed.github?.owner && parsed.github?.repo) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Failed to load configuration from localStorage:', error);
  }
  return DEFAULT_CONFIG;
};

/**
 * Save configuration to localStorage
 */
export const saveConfiguration = (config: AppConfiguration): void => {
  try {
    const configWithTimestamp = {
      ...config,
      lastModified: new Date().toISOString(),
    };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configWithTimestamp));
  } catch (error) {
    console.error('Failed to save configuration to localStorage:', error);
  }
};

/**
 * Reset configuration to defaults
 */
export const resetConfiguration = (): AppConfiguration => {
  const defaults = { ...DEFAULT_CONFIG, lastModified: new Date().toISOString() };
  saveConfiguration(defaults);
  return defaults;
};

/**
 * Update partial configuration
 */
export const updateConfiguration = (
  partial: Partial<AppConfiguration>
): AppConfiguration => {
  const current = loadConfiguration();
  const updated = {
    ...current,
    ...partial,
    jira: { ...current.jira, ...partial.jira },
    github: { ...current.github, ...partial.github },
    lastModified: new Date().toISOString(),
  };
  saveConfiguration(updated);
  return updated;
};

/**
 * Check if configuration has been customized
 */
export const isDefaultConfiguration = (config: AppConfiguration): boolean => {
  return (
    config.jira.boardId === DEFAULT_CONFIG.jira.boardId &&
    config.github.owner === DEFAULT_CONFIG.github.owner &&
    config.github.repo === DEFAULT_CONFIG.github.repo
  );
};
