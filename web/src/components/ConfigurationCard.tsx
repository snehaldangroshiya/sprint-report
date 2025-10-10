/**
 * Configuration Card Component
 * Dashboard card for managing application configuration
 */

import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { BoardSelector } from './BoardSelector';
import { useConfiguration } from '../contexts/ConfigurationContext';
import { isDefaultConfiguration } from '../lib/config-storage';

export function ConfigurationCard() {
  const { config, updateConfig, resetConfig, isLoading } = useConfiguration();
  const [localConfig, setLocalConfig] = useState(config);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Sync localConfig when global config changes (e.g., after reset)
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const hasChanges =
    localConfig.jira.boardId !== config.jira.boardId ||
    localConfig.jira.boardName !== config.jira.boardName ||
    localConfig.github.owner !== config.github.owner ||
    localConfig.github.repo !== config.github.repo;

  const isUsingDefaults = isDefaultConfiguration(config);

  const handleSave = () => {
    try {
      updateConfig(localConfig);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleReset = () => {
    resetConfig();
    // localConfig will be synced automatically via useEffect
    setSaveStatus('success');
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const handleCancel = () => {
    setLocalConfig(config);
  };

  return (
    <Card className="border-blue-100">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            <CardTitle>Configuration Settings</CardTitle>
          </div>
          {!isUsingDefaults && (
            <Badge variant="secondary" className="bg-blue-50 text-blue-700">
              Custom
            </Badge>
          )}
        </div>
        <CardDescription>
          Configure Jira board and GitHub repository for sprint tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Jira Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-sm font-medium text-gray-600">Jira Configuration</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="boardSelector">Board</Label>
            <BoardSelector
              value={localConfig.jira.boardId}
              onChange={(boardId, boardName) => {
                setLocalConfig({
                  ...localConfig,
                  jira: { boardId, boardName },
                });
              }}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Search and select from {process.env.NODE_ENV === 'production' ? '2,900+' : '2,921'} available Jira boards
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Current: {config.jira.boardId} ({config.jira.boardName})
            </p>
          </div>
        </div>

        {/* GitHub Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-sm font-medium text-gray-600">GitHub Configuration</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="githubOwner">Organization/Owner</Label>
              <Input
                id="githubOwner"
                value={localConfig.github.owner}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    github: { ...localConfig.github, owner: e.target.value },
                  })
                }
                placeholder="Sage"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="githubRepo">Repository</Label>
              <Input
                id="githubRepo"
                value={localConfig.github.repo}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    github: { ...localConfig.github, repo: e.target.value },
                  })
                }
                placeholder="sage-connect"
                disabled={isLoading}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Current: {config.github.owner}/{config.github.repo}
          </p>
        </div>

        {/* Status Messages */}
        {saveStatus === 'success' && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Configuration saved successfully! Changes will apply immediately.
            </AlertDescription>
          </Alert>
        )}

        {saveStatus === 'error' && (
          <Alert className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Failed to save configuration. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isLoading}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>

          {hasChanges && (
            <Button onClick={handleCancel} variant="outline" disabled={isLoading}>
              Cancel
            </Button>
          )}

          {!isUsingDefaults && (
            <Button onClick={handleReset} variant="outline" disabled={isLoading}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
          )}
        </div>

        {hasChanges && (
          <p className="text-xs text-amber-600 text-center">
            You have unsaved changes
          </p>
        )}
      </CardContent>
    </Card>
  );
}
