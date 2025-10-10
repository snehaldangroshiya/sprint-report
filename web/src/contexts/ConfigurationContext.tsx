/**
 * Configuration Context Provider
 * Provides global access to application configuration
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  AppConfiguration,
  loadConfiguration,
  saveConfiguration,
  resetConfiguration as resetConfigStorage,
  updateConfiguration as updateConfigStorage,
} from '../lib/config-storage';

interface ConfigurationContextValue {
  config: AppConfiguration;
  updateConfig: (partial: Partial<AppConfiguration>) => void;
  resetConfig: () => void;
  isLoading: boolean;
}

const ConfigurationContext = createContext<ConfigurationContextValue | undefined>(
  undefined
);

interface ConfigurationProviderProps {
  children: ReactNode;
}

export const ConfigurationProvider: React.FC<ConfigurationProviderProps> = ({
  children,
}) => {
  const [config, setConfig] = useState<AppConfiguration>(() => loadConfiguration());
  const [isLoading, setIsLoading] = useState(false);

  // Persist configuration changes to localStorage
  useEffect(() => {
    saveConfiguration(config);
  }, [config]);

  const updateConfig = (partial: Partial<AppConfiguration>) => {
    setIsLoading(true);
    try {
      const updated = updateConfigStorage(partial);
      setConfig(updated);
    } finally {
      setIsLoading(false);
    }
  };

  const resetConfig = () => {
    setIsLoading(true);
    try {
      const defaults = resetConfigStorage();
      setConfig(defaults);
    } finally {
      setIsLoading(false);
    }
  };

  const value: ConfigurationContextValue = {
    config,
    updateConfig,
    resetConfig,
    isLoading,
  };

  return (
    <ConfigurationContext.Provider value={value}>
      {children}
    </ConfigurationContext.Provider>
  );
};

/**
 * Hook to access configuration context
 * Throws error if used outside ConfigurationProvider
 */
export const useConfiguration = (): ConfigurationContextValue => {
  const context = useContext(ConfigurationContext);
  if (!context) {
    throw new Error(
      'useConfiguration must be used within a ConfigurationProvider'
    );
  }
  return context;
};

/**
 * Hook to access configuration values directly
 * Convenience hook for read-only access
 */
export const useConfigValues = () => {
  const { config } = useConfiguration();
  return config;
};

/**
 * Hook to access Jira configuration
 */
export const useJiraConfig = () => {
  const { config } = useConfiguration();
  return config.jira;
};

/**
 * Hook to access GitHub configuration
 */
export const useGitHubConfig = () => {
  const { config } = useConfiguration();
  return config.github;
};
