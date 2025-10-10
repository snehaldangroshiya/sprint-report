/**
 * Configuration Widget Component
 * Compact dashboard widget for quick configuration overview with dialog editor
 */

import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, CheckCircle, AlertCircle, Edit2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';
import { BoardSelector } from './BoardSelector';
import { useConfiguration } from '../contexts/ConfigurationContext';
import { isDefaultConfiguration } from '../lib/config-storage';

export function ConfigurationWidget() {
  const { config, updateConfig, resetConfig } = useConfiguration();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState(config);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Sync localConfig when dialog opens or global config changes
  useEffect(() => {
    if (isDialogOpen) {
      setLocalConfig(config);
    }
  }, [isDialogOpen, config]);

  const isConfigured = !isDefaultConfiguration(config);
  const hasChanges =
    localConfig.jira.boardId !== config.jira.boardId ||
    localConfig.jira.boardName !== config.jira.boardName ||
    localConfig.github.owner !== config.github.owner ||
    localConfig.github.repo !== config.github.repo;

  const handleSave = () => {
    try {
      updateConfig(localConfig);
      setSaveStatus('success');
      setTimeout(() => {
        setSaveStatus('idle');
        setIsDialogOpen(false);
      }, 1500);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleReset = () => {
    resetConfig();
    setLocalConfig(config);
    setSaveStatus('success');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleCancel = () => {
    setLocalConfig(config);
    setIsDialogOpen(false);
    setSaveStatus('idle');
  };

  return (
    <>
      {/* Compact Widget */}
      <Card className="bg-white border border-indigo-100 hover:border-indigo-300 transition-all duration-200 hover:shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Settings className="h-4 w-4 mr-2 text-indigo-600" />
              Configuration
            </CardTitle>
            <Badge
              variant={isConfigured ? 'default' : 'secondary'}
              className={isConfigured ? 'bg-green-500' : 'bg-yellow-500'}
            >
              {isConfigured ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Default
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Board</p>
            <p className="text-sm font-semibold text-gray-900 truncate">
              {config.jira.boardName || 'Not configured'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Repository</p>
            <p className="text-sm font-semibold text-gray-900 truncate">
              {config.github.owner && config.github.repo
                ? `${config.github.owner}/${config.github.repo}`
                : 'Not configured'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDialogOpen(true)}
            className="w-full mt-3"
          >
            <Edit2 className="h-3 w-3 mr-2" />
            Edit Settings
          </Button>
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Settings className="h-5 w-5 mr-2 text-indigo-600" />
              Configuration Settings
            </DialogTitle>
            <DialogDescription>
              Configure your Jira board and GitHub repository for sprint reporting.
              Changes are saved automatically to browser storage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Status Alert */}
            {saveStatus === 'success' && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Configuration saved successfully!
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

            {/* Jira Configuration */}
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Jira Configuration</h3>
                <Badge variant="secondary" className="text-xs">Required</Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="board-selector">Jira Board</Label>
                <BoardSelector
                  value={localConfig.jira.boardId}
                  initialBoardName={localConfig.jira.boardName}
                  onChange={(boardId: string, boardName: string) => {
                    setLocalConfig({
                      ...localConfig,
                      jira: { ...localConfig.jira, boardId, boardName },
                    });
                  }}
                />
                <p className="text-xs text-gray-500">
                  Select the Jira board you want to track sprints for
                </p>
              </div>
            </div>

            {/* GitHub Configuration */}
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">GitHub Configuration</h3>
                <Badge variant="secondary" className="text-xs">Required</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="github-owner">Organization/Owner</Label>
                  <Input
                    id="github-owner"
                    placeholder="e.g., facebook"
                    value={localConfig.github.owner}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        github: { ...localConfig.github, owner: e.target.value },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="github-repo">Repository</Label>
                  <Input
                    id="github-repo"
                    placeholder="e.g., react"
                    value={localConfig.github.repo}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        github: { ...localConfig.github, repo: e.target.value },
                      })
                    }
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Enter the GitHub repository to link commits and PRs with Jira issues
              </p>
            </div>

            {/* Configuration Preview */}
            {localConfig.jira.boardName && localConfig.github.owner && localConfig.github.repo && (
              <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                <div className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Configuration Preview</h4>
                    <div className="space-y-1 text-xs text-gray-700">
                      <p>
                        <span className="font-medium">Board:</span> {localConfig.jira.boardName}
                      </p>
                      <p>
                        <span className="font-medium">Repository:</span>{' '}
                        {localConfig.github.owner}/{localConfig.github.repo}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={saveStatus === 'success'}
              className="mr-auto"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={saveStatus === 'success'}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saveStatus === 'success'}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
