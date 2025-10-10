# Flexible Configuration System Architecture

**Date:** October 10, 2025
**Purpose:** Complete guide to the flexible board and GitHub configuration system
**Status:** ✅ Production Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Implementation Examples](#implementation-examples)
5. [Sprint Not Found Fix](#sprint-not-found-fix)
6. [Cross-Board Sprint Viewing](#cross-board-sprint-viewing)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### The Problem

**Before:**
- Frontend hardcoded to board ID `6306` (Sage Connect)
- GitHub hardcoded to `Sage/sage-connect`
- No way to switch boards without code changes
- Sprint viewing limited to configured board only

**After:**
- Users can select any of 2,900+ available Jira boards
- Flexible GitHub owner/repository configuration
- Configuration persists across sessions in localStorage
- Can view ANY sprint regardless of configured board

### Key Features

- ✅ **Flexible Board Selection** - Choose from 2,900+ Jira boards
- ✅ **GitHub Configuration** - Configure any owner/repo combination
- ✅ **localStorage Persistence** - Configuration survives browser restarts
- ✅ **React Context** - Global state accessible from any component
- ✅ **Cross-Board Sprint Viewing** - View sprints from any board via URL
- ✅ **Searchable Board Selector** - Find boards quickly with real-time search
- ✅ **Visual Feedback** - Success/error alerts for configuration changes
- ✅ **Reset to Defaults** - One-click reset to SCNT board

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   User Interface Layer                       │
│  ┌──────────────────┐        ┌──────────────────┐          │
│  │ ConfigurationCard│        │  BoardSelector   │          │
│  │  (Dashboard)     │        │  (Search 2900+)  │          │
│  └──────────────────┘        └──────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                    │                        │
                    └────────────┬───────────┘
                                 │
┌─────────────────────────────────────────────────────────────┐
│                   State Management Layer                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         ConfigurationContext (React Context)          │  │
│  │  - Global state for board ID, board name              │  │
│  │  - Global state for GitHub owner/repo                 │  │
│  │  - updateConfig(), resetConfig() functions            │  │
│  │  - Convenience hooks: useJiraConfig(), useGithubConfig│  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                    │                        │
        ┌───────────┴──────────┐  ┌─────────┴──────────┐
        │                      │  │                     │
┌───────▼────────┐    ┌────────▼──▼───────┐  ┌─────────▼─────────┐
│ localStorage   │    │  Pages (consume   │  │  API Calls        │
│ Persistence    │    │  configuration)   │  │  (use config      │
│                │    │  - Dashboard      │  │   as params)      │
│ Key:           │    │  - SprintDetails  │  │  - getSprints()   │
│ nextrelease_   │    │  - Velocity       │  │  - getMetrics()   │
│ config         │    │  - Analytics      │  │  - getCommits()   │
└────────────────┘    └───────────────────┘  └───────────────────┘
```

### Data Flow

**Configuration Update:**
```
User Action (BoardSelector)
    ↓
ConfigurationCard.handleSave()
    ↓
updateConfig({ jira: { boardId: '1234', boardName: 'New Board' } })
    ↓
ConfigurationContext updates state
    ↓
saveConfiguration() writes to localStorage
    ↓
All consuming components re-render with new config
```

**Page Load:**
```
App Initialization
    ↓
ConfigurationProvider mounted
    ↓
loadConfiguration() reads from localStorage
    ↓
Context provides config to all pages
    ↓
Pages use useConfiguration() hook
    ↓
API calls use config values as parameters
```

---

## Core Components

### 1. Configuration Storage (`web/src/lib/config-storage.ts`)

**Purpose:** Handle localStorage persistence and configuration utilities

#### Interface Definition

```typescript
export interface AppConfiguration {
  jira: {
    boardId: string;        // E.g., '6306'
    boardName: string;      // E.g., 'SCNT (Sage Connect) Board'
  };
  github: {
    owner: string;          // E.g., 'Sage'
    repo: string;           // E.g., 'sage-connect'
  };
  lastModified: string;     // ISO timestamp
}
```

#### Key Functions

```typescript
// Load configuration from localStorage (with defaults fallback)
export function loadConfiguration(): AppConfiguration {
  const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
  return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
}

// Save complete configuration
export function saveConfiguration(config: AppConfiguration): void {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

// Update partial configuration (merge with existing)
export function updateConfiguration(
  partial: Partial<AppConfiguration>
): AppConfiguration {
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
}

// Reset to default values
export function resetConfiguration(): AppConfiguration {
  saveConfiguration(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

// Check if using default configuration
export function isDefaultConfiguration(config: AppConfiguration): boolean {
  return (
    config.jira.boardId === SPRINT_CONSTANTS.DEFAULT_BOARD_ID &&
    config.github.owner === SPRINT_CONSTANTS.DEFAULT_GITHUB.owner &&
    config.github.repo === SPRINT_CONSTANTS.DEFAULT_GITHUB.repo
  );
}
```

**Location:** `web/src/lib/config-storage.ts`
**Lines:** 1-80 (approximately)

---

### 2. Configuration Context (`web/src/contexts/ConfigurationContext.tsx`)

**Purpose:** Provide React Context for global configuration state

#### Context Interface

```typescript
interface ConfigurationContextValue {
  config: AppConfiguration;
  isLoading: boolean;
  updateConfig: (partial: Partial<AppConfiguration>) => void;
  resetConfig: () => void;
  isDefault: boolean;
}
```

#### Provider Implementation

```typescript
export const ConfigurationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [config, setConfig] = useState<AppConfiguration>(() => loadConfiguration());
  const [isLoading, setIsLoading] = useState(false);

  const updateConfig = useCallback((partial: Partial<AppConfiguration>) => {
    setIsLoading(true);
    const updated = updateConfiguration(partial);
    setConfig(updated);
    setIsLoading(false);
  }, []);

  const resetConfig = useCallback(() => {
    setIsLoading(true);
    const reset = resetConfiguration();
    setConfig(reset);
    setIsLoading(false);
  }, []);

  const value = {
    config,
    isLoading,
    updateConfig,
    resetConfig,
    isDefault: isDefaultConfiguration(config),
  };

  return (
    <ConfigurationContext.Provider value={value}>
      {children}
    </ConfigurationContext.Provider>
  );
};
```

#### Convenience Hooks

```typescript
// Get full configuration
export const useConfiguration = (): ConfigurationContextValue => {
  const context = useContext(ConfigurationContext);
  if (!context) {
    throw new Error('useConfiguration must be used within ConfigurationProvider');
  }
  return context;
};

// Get configuration values only
export const useConfigValues = (): AppConfiguration => {
  return useConfiguration().config;
};

// Get Jira config only
export const useJiraConfig = () => {
  const { config } = useConfiguration();
  return config.jira;
};

// Get GitHub config only
export const useGithubConfig = () => {
  const { config } = useConfiguration();
  return config.github;
};
```

**Location:** `web/src/contexts/ConfigurationContext.tsx`
**Lines:** 1-100 (approximately)

---

### 3. Board Selector Component (`web/src/components/BoardSelector.tsx`)

**Purpose:** Searchable dropdown for selecting from 2,900+ Jira boards

#### Component Interface

```typescript
interface BoardSelectorProps {
  value: string;              // Current board ID
  onChange: (boardId: string, boardName: string) => void;
  disabled?: boolean;
}
```

#### Key Features

- **Search Integration** - Real-time API search via `/api/boards/search`
- **Command Palette UI** - Uses shadcn/ui Command component
- **Popover Display** - Clean dropdown with keyboard navigation
- **Loading States** - Shows skeleton during search
- **Error Handling** - Graceful fallback on API errors

#### Usage Example

```typescript
<BoardSelector
  value={localConfig.jira.boardId}
  onChange={(boardId, boardName) => {
    setLocalConfig({
      ...localConfig,
      jira: { boardId, boardName },
    });
  }}
  disabled={saveStatus === 'saving'}
/>
```

**Location:** `web/src/components/BoardSelector.tsx`
**Lines:** 1-150 (approximately)

---

### 4. Configuration Card Component (`web/src/components/ConfigurationCard.tsx`)

**Purpose:** Complete UI for managing configuration on Dashboard

#### Features

- **Board Selection** - Uses BoardSelector component
- **GitHub Input** - Text inputs for owner/repo
- **Save/Reset/Cancel** - Three-button workflow
- **Visual Feedback** - Success/error alerts
- **Custom Badge** - Shows when using non-default config
- **Current Values Display** - Shows active configuration

#### State Management

```typescript
const { config, updateConfig, resetConfig, isDefault } = useConfiguration();
const [localConfig, setLocalConfig] = useState(config);
const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
const [hasChanges, setHasChanges] = useState(false);
```

#### Save Flow

```typescript
const handleSave = async () => {
  setSaveStatus('saving');
  try {
    updateConfig(localConfig);
    setSaveStatus('success');
    setHasChanges(false);

    // Reset success message after 3 seconds
    setTimeout(() => setSaveStatus('idle'), 3000);
  } catch (error) {
    setSaveStatus('error');
  }
};
```

**Location:** `web/src/components/ConfigurationCard.tsx`
**Lines:** 1-250 (approximately)

---

## Implementation Examples

### Example 1: Using Configuration in a Page

**Before (Hardcoded):**
```typescript
// ❌ BAD - Hardcoded values
const boardId = '6306';
const githubOwner = 'Sage';
const githubRepo = 'sage-connect';

const { data: sprints } = useQuery({
  queryKey: ['sprints', boardId],
  queryFn: () => api.getSprints(boardId, 'active'),
});
```

**After (Configuration):**
```typescript
// ✅ GOOD - Uses configuration
import { useConfiguration } from '@/contexts/ConfigurationContext';

const { config } = useConfiguration();

const { data: sprints } = useQuery({
  queryKey: ['sprints', config.jira.boardId],
  queryFn: () => api.getSprints(config.jira.boardId, 'active'),
  enabled: !!config.jira.boardId,
});
```

### Example 2: Dashboard Page (web/src/pages/Dashboard.tsx)

**Implementation:**
```typescript
import { useConfiguration } from '@/contexts/ConfigurationContext';

export function Dashboard() {
  const { config } = useConfiguration();

  // Use config for API calls
  const { data: sprints, isLoading } = useQuery({
    queryKey: ['active-sprints', config.jira.boardId],
    queryFn: () => api.getSprints(config.jira.boardId, 'active'),
    enabled: !!config.jira.boardId,
  });

  return (
    <div>
      {/* Display ConfigurationCard */}
      <ConfigurationCard />

      {/* Display sprints from configured board */}
      <SprintList sprints={sprints} />
    </div>
  );
}
```

### Example 3: GitHub Page (web/src/pages/GitHub.tsx)

**Implementation:**
```typescript
import { useConfiguration } from '@/contexts/ConfigurationContext';

export function GitHub() {
  const { config } = useConfiguration();
  const [owner, setOwner] = useState(config.github.owner);
  const [repo, setRepo] = useState(config.github.repo);

  // Sync with configuration changes
  useEffect(() => {
    setOwner(config.github.owner);
    setRepo(config.github.repo);
  }, [config.github.owner, config.github.repo]);

  const { data: commits } = useQuery({
    queryKey: ['commits', owner, repo],
    queryFn: () => api.getCommits(owner, repo),
    enabled: !!owner && !!repo,
  });

  return <CommitList commits={commits} />;
}
```

---

## Sprint Not Found Fix

### The Problem

**Issue:** When accessing `http://localhost:3001/sprint/44127`, the page showed "Sprint not found" error.

**Root Cause:**
```typescript
// ❌ OLD CODE - useSprintDetails.ts:lines 91-94
const sprint = useMemo(() => {
  // This searches allSprints from configured board (6306)
  // Sprint 44127 belongs to NAS board, not SCNT board
  return sprintData?.allSprints?.find(s => s.id === sprintId);
}, [sprintData?.allSprints, sprintId]);
```

**Why It Failed:**
1. Hook called `getSprints(boardId, 'all')` to fetch all sprints from configured board
2. Searched for sprint 44127 in that board's sprint list
3. Sprint 44127 belonged to NAS board, not the configured SCNT board (6306)
4. Sprint lookup returned `undefined`, triggering "not found" error

### The Solution

**Key Insight:** The metrics endpoint `/api/sprints/:id/metrics` works for ANY sprint ID without requiring a board ID.

**Fixed Code:**
```typescript
// ✅ NEW CODE - useSprintDetails.ts:lines 92-94
const sprint = useMemo(() => {
  // Get sprint from metrics endpoint instead of searching allSprints
  // Metrics endpoint works for any sprint ID
  return sprintData?.metrics?.sprint;
}, [sprintData?.metrics]);
```

**Why It Works:**
1. Metrics endpoint fetches sprint data directly: `GET /api/sprints/44127/metrics`
2. Returns sprint object without needing to know which board it belongs to
3. More efficient - one API call instead of fetching hundreds of sprints
4. Enables viewing ANY sprint via direct URL, regardless of configured board

**Additional Change (web/src/pages/SprintDetails.tsx):**
```typescript
// Added configuration context for consistency
import { useConfiguration } from '@/contexts/ConfigurationContext';

const { config } = useConfiguration();

const { sprint, metrics } = useSprintDetails({
  sprintId: sprintId!,
  boardId: config.jira.boardId,       // FROM CONFIG (not hardcoded)
  githubOwner: config.github.owner,   // FROM CONFIG
  githubRepo: config.github.repo,     // FROM CONFIG
  // ...
});
```

**Testing:**
```bash
# Sprint from NAS board (different from configured board)
curl -s "http://localhost:3000/api/sprints/44127/metrics" | jq '.sprint.name'
# Returns: "NAS-FY25-24"

# Sprint from configured SCNT board
curl -s "http://localhost:3000/api/sprints/44298/metrics" | jq '.sprint.name'
# Returns: "SCNT-2025-26"

# Both work! 🎉
```

---

## Cross-Board Sprint Viewing

### Architecture Benefits

**Before:**
- Could only view sprints from configured board
- Switching boards required configuration change
- Sprint URLs only worked for configured board

**After:**
- Can view ANY sprint by direct URL
- Configuration determines default board for dashboard
- Sprint details work independently of configuration

### Use Cases

**1. Multi-Board Organization:**
```
User configures Dashboard to show SCNT board (6306)
But can still view sprints from:
- NAS board: /sprint/44127
- Other teams: /sprint/12345
- Any board: /sprint/:id
```

**2. Sprint Sharing:**
```
Team members can share sprint URLs:
https://app.example.com/sprint/44127

Recipient sees sprint details regardless of their configured board
```

**3. Historical Analysis:**
```
View old sprints from archived boards
Access sprints from reorganized teams
Compare sprints across multiple boards
```

### Implementation Pattern

**✅ Recommended Pattern:**
```typescript
// For sprint-specific pages (SprintDetails)
const sprint = sprintData?.metrics?.sprint;  // From metrics endpoint

// For board-wide pages (Dashboard, Velocity)
const { config } = useConfiguration();
const { data } = useQuery({
  queryKey: ['sprints', config.jira.boardId],
  queryFn: () => api.getSprints(config.jira.boardId, 'active'),
});
```

---

## Best Practices

### 1. **Always Use Configuration Hook**

```typescript
// ✅ GOOD
import { useConfiguration } from '@/contexts/ConfigurationContext';

const { config } = useConfiguration();
const boardId = config.jira.boardId;

// ❌ BAD
import { SPRINT_CONSTANTS } from '@/constants/sprint';
const boardId = SPRINT_CONSTANTS.DEFAULT_BOARD_ID;
```

### 2. **Enable Queries Conditionally**

```typescript
// ✅ GOOD - Prevents queries with empty config
const { data } = useQuery({
  queryKey: ['sprints', config.jira.boardId],
  queryFn: () => api.getSprints(config.jira.boardId, 'active'),
  enabled: !!config.jira.boardId,  // Only run if boardId exists
});

// ❌ BAD - May fail if config not loaded
const { data } = useQuery({
  queryKey: ['sprints', config.jira.boardId],
  queryFn: () => api.getSprints(config.jira.boardId, 'active'),
});
```

### 3. **Sync Local State with Configuration**

```typescript
// ✅ GOOD - Syncs when configuration changes
const { config } = useConfiguration();
const [localValue, setLocalValue] = useState(config.github.owner);

useEffect(() => {
  setLocalValue(config.github.owner);
}, [config.github.owner]);

// ❌ BAD - Local state gets out of sync
const [localValue, setLocalValue] = useState(config.github.owner);
// No sync effect
```

### 4. **Use Convenience Hooks**

```typescript
// ✅ GOOD - Cleaner for single value access
import { useJiraConfig } from '@/contexts/ConfigurationContext';

const { boardId, boardName } = useJiraConfig();

// ✅ ALSO GOOD - Use full config if accessing multiple values
import { useConfiguration } from '@/contexts/ConfigurationContext';

const { config } = useConfiguration();
const { boardId, boardName } = config.jira;
const { owner, repo } = config.github;
```

### 5. **Handle Loading States**

```typescript
// ✅ GOOD - Shows loading indicator
const { config, isLoading } = useConfiguration();

if (isLoading) {
  return <Skeleton />;
}

return <Component config={config} />;
```

---

## Troubleshooting

### Issue 1: Configuration Not Persisting

**Symptom:** Changes don't survive page refresh

**Diagnosis:**
```typescript
// Check localStorage
const stored = localStorage.getItem('nextrelease_config');
console.log('Stored config:', stored);
```

**Solution:**
- Verify localStorage is enabled in browser
- Check for privacy/incognito mode
- Verify `saveConfiguration()` is called
- Check for localStorage quota errors

### Issue 2: Pages Using Old Hardcoded Values

**Symptom:** Configuration changes but pages don't update

**Diagnosis:**
```bash
# Search for hardcoded references
grep -r "6306" web/src/pages/
grep -r "DEFAULT_BOARD_ID" web/src/pages/
grep -r "Sage" web/src/pages/
```

**Solution:**
- Replace all hardcoded values with `config.jira.boardId`
- Replace GitHub hardcodes with `config.github.owner/repo`
- Ensure `useConfiguration()` hook is imported and used

### Issue 3: Sprint Not Found After Configuration Change

**Symptom:** Sprint details page shows "not found" after changing boards

**Diagnosis:**
```typescript
// Check if using board-dependent sprint lookup
const sprint = sprintData?.allSprints?.find(s => s.id === sprintId);
```

**Solution:**
```typescript
// Use metrics endpoint instead
const sprint = sprintData?.metrics?.sprint;
```

### Issue 4: Query Not Refetching After Configuration Change

**Symptom:** Old data displayed after changing configuration

**Solution:**
```typescript
// Include config in query key
const { data } = useQuery({
  queryKey: ['sprints', config.jira.boardId],  // ✅ Config in key
  queryFn: () => api.getSprints(config.jira.boardId, 'active'),
});

// NOT
const { data } = useQuery({
  queryKey: ['sprints'],  // ❌ Missing config dependency
  queryFn: () => api.getSprints(config.jira.boardId, 'active'),
});
```

---

## File Locations Reference

| Component | File Path | Key Lines |
|-----------|-----------|-----------|
| Configuration Storage | `web/src/lib/config-storage.ts` | 1-80 |
| Configuration Context | `web/src/contexts/ConfigurationContext.tsx` | 1-100 |
| Board Selector | `web/src/components/BoardSelector.tsx` | 1-150 |
| Configuration Card | `web/src/components/ConfigurationCard.tsx` | 1-250 |
| Sprint Details Fix | `web/src/hooks/useSprintDetails.ts` | 92-94 |
| SprintDetails Page | `web/src/pages/SprintDetails.tsx` | 20-70 |
| Dashboard Page | `web/src/pages/Dashboard.tsx` | 30-100 |
| GitHub Page | `web/src/pages/GitHub.tsx` | 20-60 |
| Sprint Constants | `web/src/constants/sprint.ts` | 1-50 |

---

## Related Documentation

- **[docs/FLEXIBLE_CONFIGURATION_BRAINSTORM.md](../docs/FLEXIBLE_CONFIGURATION_BRAINSTORM.md)** - Initial brainstorming and implementation planning
- **[CLAUDE.md](../CLAUDE.md)** - Project overview and key learnings
- **[web/src/lib/config-storage.ts](../web/src/lib/config-storage.ts)** - Source code for configuration storage
- **[web/src/contexts/ConfigurationContext.tsx](../web/src/contexts/ConfigurationContext.tsx)** - Source code for React Context

---

**Last Updated:** October 10, 2025
**Status:** ✅ Production Ready
**Next Steps:** See Phase 2/3 enhancements in brainstorming doc
