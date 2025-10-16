/**
 * Configuration Widget Component
 * Compact dashboard widget for quick configuration overview with dialog editor
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, Save, RotateCcw, CheckCircle, AlertCircle, Edit2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
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
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [localConfig, setLocalConfig] = useState(config);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // Debounced values for GitHub inputs
  const [githubOwnerInput, setGithubOwnerInput] = useState(config.github.owner);
  const [githubRepoInput, setGithubRepoInput] = useState(config.github.repo);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync localConfig when dialog opens or global config changes
  useEffect(() => {
    if (isDialogOpen) {
      setLocalConfig(config);
      setGithubOwnerInput(config.github.owner);
      setGithubRepoInput(config.github.repo);
    }
  }, [isDialogOpen, config]);

  const isConfigured = !isDefaultConfiguration(config);
  const hasChanges =
    localConfig.jira.boardId !== config.jira.boardId ||
    localConfig.jira.boardName !== config.jira.boardName ||
    localConfig.github.owner !== config.github.owner ||
    localConfig.github.repo !== config.github.repo;

  // Debounced update for GitHub fields
  const handleGithubChange = useCallback((field: 'owner' | 'repo', value: string) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Update input immediately for responsive UI
    if (field === 'owner') {
      setGithubOwnerInput(value);
    } else {
      setGithubRepoInput(value);
    }

    // Debounce the actual state update
    debounceTimerRef.current = setTimeout(() => {
      setLocalConfig((prev) => ({
        ...prev,
        github: {
          ...prev.github,
          [field]: value,
        },
      }));
    }, 500); // 500ms debounce delay
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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
      {/* Collapsible Configuration Widget */}
      <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
        <Card className="border bg-card transition-all duration-200 hover:shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 mb-1">
                    <Settings className="h-4 w-4" />
                    Configuration
                  </CardTitle>
                  {/* Show key details when collapsed */}
                  {isCollapsed && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1.5">
                      <span className="truncate">
                        <span className="font-medium">Board:</span> {config.jira.boardName || 'Not configured'}
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span className="truncate">
                        <span className="font-medium">Repo:</span>{' '}
                        {config.github.owner && config.github.repo
                          ? `${config.github.owner}/${config.github.repo}`
                          : 'Not configured'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <Badge variant={isConfigured ? 'default' : 'secondary'}>
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
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    {isCollapsed ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                    <span className="sr-only">Toggle configuration details</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Jira Board</p>
                  <p className="text-sm font-medium">
                    {config.jira.boardName || 'Not configured'}
                  </p>
                  {config.jira.boardId && (
                    <p className="text-xs text-muted-foreground">ID: {config.jira.boardId}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">GitHub Repository</p>
                  <p className="text-sm font-medium">
                    {config.github.owner && config.github.repo
                      ? `${config.github.owner}/${config.github.repo}`
                      : 'Not configured'}
                  </p>
                  {config.github.owner && config.github.repo && (
                    <a
                      href={`https://github.com/${config.github.owner}/${config.github.repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      View on GitHub →
                    </a>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end pt-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsDialogOpen(true)}
                  className="shadow-sm"
                >
                  <Edit2 className="h-3.5 w-3.5 mr-2" />
                  {isConfigured ? 'Edit Configuration' : 'Configure Now'}
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
                    placeholder="e.g., sage connect"
                    value={githubOwnerInput}
                    onChange={(e) => handleGithubChange('owner', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="github-repo">Repository</Label>
                  <Input
                    id="github-repo"
                    placeholder="e.g., react"
                    value={githubRepoInput}
                    onChange={(e) => handleGithubChange('repo', e.target.value)}
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
