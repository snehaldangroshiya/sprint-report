# Flexible Configuration Implementation - Brainstorming & Analysis

**Date:** October 10, 2025  
**Persona:** Frontend Developer  
**Status:** Analysis & Design Phase

---

## 🎯 Problem Statement

**Current State:**
- Frontend is hardcoded to `DEFAULT_BOARD_ID: '6306'` (SCNT Board)
- GitHub configuration is hardcoded to `owner: 'Sage'` and `repo: 'sage-connect'`
- Users cannot easily switch between different Jira boards and GitHub repositories
- Configuration changes require code modifications or environment variable updates

**Desired State:**
- Users can select any Jira board from 2,900+ available boards
- Users can configure any GitHub owner/repository combination
- Configuration persists across sessions
- Dashboard provides intuitive UI for configuration management
- Changes apply immediately without page refresh

---

## ✅ What's Already Implemented

### 1. **Configuration Infrastructure** ✨
**Status:** 🟢 COMPLETE

The foundation is already in place:

#### Configuration Storage (`web/src/lib/config-storage.ts`)
```typescript
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

// Utilities provided:
- loadConfiguration(): AppConfiguration
- saveConfiguration(config): void
- updateConfiguration(partial): AppConfiguration
- resetConfiguration(): AppConfiguration
- isDefaultConfiguration(config): boolean
```

#### Configuration Context (`web/src/contexts/ConfigurationContext.tsx`)
```typescript
export const ConfigurationProvider: React.FC
export const useConfiguration(): ConfigurationContextValue
export const useConfigValues(): AppConfiguration
export const useJiraConfig(): { boardId, boardName }
export const useGithubConfig(): { owner, repo }
```

**Provides:**
- Global state management
- Automatic localStorage persistence
- Reset to defaults functionality
- Loading states

#### Configuration UI (`web/src/components/ConfigurationCard.tsx`)
```tsx
<ConfigurationCard />
```

**Features:**
- Board selector with search (2,900+ boards)
- GitHub owner/repo input fields
- Save/Reset/Cancel buttons
- Visual feedback (success/error alerts)
- Custom configuration badge
- Current values display

### 2. **Board Selection UI** ✨
**Status:** 🟢 COMPLETE

#### BoardSelector Component (`web/src/components/BoardSelector.tsx`)
```typescript
interface BoardSelectorProps {
  value: string;              // Current board ID
  onChange: (boardId: string, boardName: string) => void;
  disabled?: boolean;
}
```

**Features:**
- Searchable dropdown with 2,900+ Jira boards
- Real-time search with API integration
- Displays board name + project key
- Handles loading states
- Command palette-style UI (shadcn/ui)

**API Integration:**
- Default boards: `GET /api/boards`
- Search: `GET /api/boards/search?query={query}&limit=20`

### 3. **Centralized Constants** ✨
**Status:** 🟢 COMPLETE

#### Sprint Constants (`web/src/constants/sprint.ts`)
```typescript
export const SPRINT_CONSTANTS = {
  DEFAULT_BOARD_ID: '6306',
  DEFAULT_GITHUB: {
    owner: 'Sage',
    repo: 'sage-connect',
  },
  JIRA_BASE_URL: 'https://jira.sage.com',
  PAGINATION: { ... },
  REPORT_DEFAULTS: { ... },
  CACHE: { ... }
}
```

### 4. **Pages Already Using Configuration** ✨
**Status:** 🟢 PARTIAL (needs expansion)

1. **Dashboard** (`web/src/pages/Dashboard.tsx`)
   ```typescript
   const { config } = useConfiguration();
   const boardId = config.jira.boardId;
   ```
   - ✅ Uses configured board ID
   - ✅ Displays ConfigurationCard
   - ✅ Fetches sprints from configured board

2. **GitHub Page** (`web/src/pages/GitHub.tsx`)
   ```typescript
   const { config } = useConfiguration();
   const [owner, setOwner] = useState(config.github.owner);
   const [repo, setRepo] = useState(config.github.repo);
   ```
   - ✅ Uses configured GitHub repo
   - ✅ Syncs with configuration context

---

## 🔴 What Still Needs Implementation

### 1. **SprintDetails Page** ⚠️
**Current Issue:**
```typescript
// web/src/pages/SprintDetails.tsx (lines 60-70)
const {
  sprint,
  metrics,
  issues,
  // ... other data
} = useSprintDetails({
  sprintId: sprintId!,
  boardId: SPRINT_CONSTANTS.DEFAULT_BOARD_ID,  // ❌ HARDCODED
  githubOwner: SPRINT_CONSTANTS.DEFAULT_GITHUB.owner,  // ❌ HARDCODED
  githubRepo: SPRINT_CONSTANTS.DEFAULT_GITHUB.repo,   // ❌ HARDCODED
  // ...
});
```

**Solution:**
```typescript
import { useConfiguration } from '@/contexts/ConfigurationContext';

const { config } = useConfiguration();

const {
  sprint,
  metrics,
  issues,
  // ... other data
} = useSprintDetails({
  sprintId: sprintId!,
  boardId: config.jira.boardId,       // ✅ FROM CONFIG
  githubOwner: config.github.owner,   // ✅ FROM CONFIG
  githubRepo: config.github.repo,     // ✅ FROM CONFIG
  // ...
});
```

**Impact:**
- Sprint details will reflect configured board
- GitHub data will come from configured repository
- Users can view any board's sprint details

### 2. **Velocity Page** ⚠️
**Current Issue:**
```typescript
// web/src/pages/Velocity.tsx (line 10)
const [boardId, setBoardId] = useState('6306');  // ❌ HARDCODED
```

**Solution:**
```typescript
import { useConfiguration } from '@/contexts/ConfigurationContext';

const { config } = useConfiguration();
const [boardId, setBoardId] = useState(config.jira.boardId);

// Sync with config changes
useEffect(() => {
  setBoardId(config.jira.boardId);
}, [config.jira.boardId]);
```

**Enhanced Solution (Better UX):**
```typescript
// Option A: Use config directly, remove local state
const { config } = useConfiguration();

const { data: velocityData, isLoading } = useQuery({
  queryKey: ['velocity', config.jira.boardId, sprintCount],
  queryFn: () => api.getVelocityData(config.jira.boardId, sprintCount),
  enabled: !!config.jira.boardId,
});

// Option B: Keep input but sync with config
const { config, updateConfig } = useConfiguration();
const [localBoardId, setLocalBoardId] = useState(config.jira.boardId);

const handleBoardIdChange = (newBoardId: string) => {
  setLocalBoardId(newBoardId);
  // Optionally save to global config
  updateConfig({ jira: { ...config.jira, boardId: newBoardId } });
};
```

### 3. **Analytics Page** ⚠️
**Current Status:** Partially implemented

```typescript
// web/src/pages/Analytics.tsx
const [githubOwner, setGithubOwner] = useState(
  import.meta.env.VITE_GITHUB_OWNER || 'Sage'  // ❌ USES ENV VAR
);
const [githubRepo, setGithubRepo] = useState(
  import.meta.env.VITE_GITHUB_REPO || 'sage-connect'  // ❌ USES ENV VAR
);
```

**Solution:**
```typescript
import { useConfiguration } from '@/contexts/ConfigurationContext';

const { config } = useConfiguration();
const [githubOwner, setGithubOwner] = useState(config.github.owner);
const [githubRepo, setGithubRepo] = useState(config.github.repo);

// Sync with config changes
useEffect(() => {
  setGithubOwner(config.github.owner);
  setGithubRepo(config.github.repo);
}, [config.github.owner, config.github.repo]);
```

### 4. **Report Generator Integration** ⚠️
**Assumption:** Report generator likely needs configuration

**Potential Issues:**
- Report generation may use hardcoded values
- Templates may reference specific board/repo
- Export functionality may not respect configuration

**Investigation Needed:**
- Check report generation API calls
- Verify template placeholders
- Ensure download functionality includes correct data

---

## 🎨 UI/UX Enhancement Opportunities

### 1. **Quick Board Switcher** 💡
Add a global board switcher in the app header/navbar:

```typescript
<BoardQuickSwitcher
  value={config.jira.boardId}
  onChange={(boardId, boardName) => {
    updateConfig({ jira: { boardId, boardName } });
  }}
  compact={true}
/>
```

**Benefits:**
- Fast board switching without going to Dashboard
- Always visible
- Shows current board name in header

### 2. **Recent Boards History** 💡
Track recently used boards:

```typescript
// web/src/lib/config-storage.ts
export interface AppConfiguration {
  jira: {
    boardId: string;
    boardName: string;
    recentBoards?: Array<{
      id: string;
      name: string;
      lastUsed: string;
    }>;
  };
  // ...
}
```

**UI Enhancement:**
```tsx
<BoardSelector
  value={config.jira.boardId}
  onChange={handleChange}
  recentBoards={config.jira.recentBoards}
  showRecent={true}
/>
```

### 3. **Configuration Presets** 💡
Save multiple board/repo combinations:

```typescript
interface ConfigurationPreset {
  id: string;
  name: string;
  jira: { boardId: string; boardName: string };
  github: { owner: string; repo: string };
}
```

**UI:**
```tsx
<ConfigurationPresets
  presets={savedPresets}
  onLoad={(preset) => updateConfig(preset)}
  onSave={(name) => saveCurrentAsPreset(name)}
/>
```

### 4. **Board Information Panel** 💡
Show board metadata in Dashboard:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Current Board Info</CardTitle>
  </CardHeader>
  <CardContent>
    <dl>
      <dt>Board Name:</dt>
      <dd>{config.jira.boardName}</dd>
      
      <dt>Board ID:</dt>
      <dd>{config.jira.boardId}</dd>
      
      <dt>Type:</dt>
      <dd>Scrum/Kanban</dd>
      
      <dt>Project:</dt>
      <dd>Project Key</dd>
      
      <dt>Active Sprints:</dt>
      <dd>1</dd>
    </dl>
  </CardContent>
</Card>
```

### 5. **GitHub Repository Validation** 💡
Validate GitHub config before saving:

```typescript
const validateGitHubRepo = async (owner: string, repo: string) => {
  try {
    const response = await api.validateGitHub(owner, repo);
    return { valid: true, data: response };
  } catch (error) {
    return { valid: false, error: 'Repository not found or inaccessible' };
  }
};
```

**UI Feedback:**
```tsx
{isValidating && <Spinner />}
{validationResult?.valid && <CheckCircle className="text-green-500" />}
{validationResult?.error && <AlertCircle className="text-red-500" />}
```

---

## 🔧 Implementation Plan

### Phase 1: Complete Core Integration (High Priority) ⭐
**Estimated Time:** 2-3 hours

1. **Update SprintDetails Page**
   - [ ] Import `useConfiguration`
   - [ ] Replace hardcoded values with config
   - [ ] Test sprint data loading with different boards
   - [ ] Verify GitHub data integration

2. **Update Velocity Page**
   - [ ] Import `useConfiguration`
   - [ ] Replace hardcoded boardId with config
   - [ ] Add sync effect for config changes
   - [ ] Test velocity calculations with different boards

3. **Update Analytics Page**
   - [ ] Replace env vars with config
   - [ ] Add sync effects
   - [ ] Test chart rendering with different repos

4. **Verify Report Generator**
   - [ ] Check API calls for hardcoded values
   - [ ] Update templates if needed
   - [ ] Test report generation with different configs

**Testing Checklist:**
- [ ] Switch boards on Dashboard → All pages update
- [ ] Change GitHub repo → Analytics/Sprint details update
- [ ] Refresh page → Configuration persists
- [ ] Reset to defaults → Reverts to SCNT/sage-connect
- [ ] Multiple tabs → Configuration syncs

### Phase 2: UX Enhancements (Medium Priority) 🎨
**Estimated Time:** 4-5 hours

1. **Quick Board Switcher**
   - [ ] Create compact BoardSelector variant
   - [ ] Add to app header/navbar
   - [ ] Implement smooth transitions

2. **Recent Boards History**
   - [ ] Extend configuration interface
   - [ ] Add tracking logic
   - [ ] Update BoardSelector to show recent

3. **Configuration Validation**
   - [ ] Add GitHub repo validation API
   - [ ] Add board validation
   - [ ] Show real-time validation feedback

4. **Board Information Panel**
   - [ ] Fetch board metadata
   - [ ] Create info display component
   - [ ] Add to Dashboard

### Phase 3: Advanced Features (Low Priority) 💎
**Estimated Time:** 3-4 hours

1. **Configuration Presets**
   - [ ] Design preset storage schema
   - [ ] Create preset management UI
   - [ ] Add import/export functionality

2. **Multi-Board Comparison**
   - [ ] Allow comparing 2-3 boards side-by-side
   - [ ] Create comparison view
   - [ ] Generate comparison reports

3. **Configuration Sharing**
   - [ ] Generate shareable configuration URLs
   - [ ] Add "Share Configuration" button
   - [ ] Implement URL-based config loading

---

## 📋 Code Changes Summary

### Files to Modify

#### 1. `web/src/pages/SprintDetails.tsx`
```diff
+ import { useConfiguration } from '@/contexts/ConfigurationContext';

export function SprintDetails() {
+  const { config } = useConfiguration();
   const { sprintId } = useParams<{ sprintId: string }>();
   
   const {
     sprint,
     metrics,
     // ...
   } = useSprintDetails({
     sprintId: sprintId!,
-    boardId: SPRINT_CONSTANTS.DEFAULT_BOARD_ID,
-    githubOwner: SPRINT_CONSTANTS.DEFAULT_GITHUB.owner,
-    githubRepo: SPRINT_CONSTANTS.DEFAULT_GITHUB.repo,
+    boardId: config.jira.boardId,
+    githubOwner: config.github.owner,
+    githubRepo: config.github.repo,
     ...SPRINT_CONSTANTS.REPORT_DEFAULTS,
   });
```

#### 2. `web/src/pages/Velocity.tsx`
```diff
+ import { useConfiguration } from '@/contexts/ConfigurationContext';

export function Velocity() {
-  const [boardId, setBoardId] = useState('6306');
+  const { config } = useConfiguration();
+  const [boardId, setBoardId] = useState(config.jira.boardId);
   const [sprintCount, setSprintCount] = useState(5);
   
+  useEffect(() => {
+    setBoardId(config.jira.boardId);
+  }, [config.jira.boardId]);

   const { data: velocityData, isLoading } = useQuery({
     queryKey: ['velocity', boardId, sprintCount],
     queryFn: () => api.getVelocityData(boardId, sprintCount),
```

#### 3. `web/src/pages/Analytics.tsx` (if exists)
```diff
+ import { useConfiguration } from '@/contexts/ConfigurationContext';

export function Analytics() {
-  const [githubOwner] = useState(import.meta.env.VITE_GITHUB_OWNER || 'Sage');
-  const [githubRepo] = useState(import.meta.env.VITE_GITHUB_REPO || 'sage-connect');
+  const { config } = useConfiguration();
+  const [githubOwner, setGithubOwner] = useState(config.github.owner);
+  const [githubRepo, setGithubRepo] = useState(config.github.repo);
+
+  useEffect(() => {
+    setGithubOwner(config.github.owner);
+    setGithubRepo(config.github.repo);
+  }, [config.github.owner, config.github.repo]);
```

### Files Already Correct ✅
- `web/src/pages/Dashboard.tsx` - Already uses `useConfiguration()`
- `web/src/pages/GitHub.tsx` - Already uses `useConfiguration()`
- `web/src/components/ConfigurationCard.tsx` - Already uses `useConfiguration()`

---

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('Configuration Integration', () => {
  it('should load persisted configuration on mount', () => {
    // Test localStorage loading
  });

  it('should update all pages when configuration changes', () => {
    // Test context propagation
  });

  it('should handle invalid board IDs gracefully', () => {
    // Test error handling
  });

  it('should reset to defaults correctly', () => {
    // Test reset functionality
  });
});
```

### Integration Tests
```typescript
describe('SprintDetails with Configuration', () => {
  it('should fetch sprint data for configured board', () => {
    // Change config → Verify correct API calls
  });

  it('should fetch GitHub data for configured repo', () => {
    // Change config → Verify correct API calls
  });
});
```

### E2E Tests (Playwright)
```typescript
test('User can change board and see updated data', async ({ page }) => {
  await page.goto('/');
  
  // Change board
  await page.click('[data-testid="board-selector"]');
  await page.fill('input[placeholder="Search boards..."]', 'Other Board');
  await page.click('[data-testid="board-option-1234"]');
  await page.click('button:has-text("Save Configuration")');
  
  // Navigate to sprint details
  await page.click('a:has-text("Sprint 123")');
  
  // Verify data is from new board
  await expect(page.locator('[data-testid="board-name"]')).toHaveText('Other Board');
});
```

---

## 🚨 Potential Issues & Solutions

### Issue 1: Board Not Found (404)
**Scenario:** User selects a board that no longer exists

**Solution:**
```typescript
const { data: sprints, error } = useQuery({
  queryKey: ['sprints', config.jira.boardId],
  queryFn: () => api.getSprints(config.jira.boardId, 'active'),
  enabled: !!config.jira.boardId,
  retry: 1,
  onError: (error) => {
    if (error.response?.status === 404) {
      toast.error('Board not found. Please select a different board.');
      // Optionally reset to defaults
      resetConfig();
    }
  },
});
```

### Issue 2: GitHub Repository Not Accessible
**Scenario:** User enters private repo without token or wrong owner/repo

**Solution:**
```typescript
// Add validation before saving
const validateAndSave = async () => {
  const isValid = await validateGitHubRepo(
    localConfig.github.owner,
    localConfig.github.repo
  );
  
  if (!isValid) {
    setSaveStatus('error');
    setErrorMessage('GitHub repository not accessible. Check token permissions.');
    return;
  }
  
  updateConfig(localConfig);
  setSaveStatus('success');
};
```

### Issue 3: Configuration Sync Across Tabs
**Scenario:** User has multiple tabs open, changes config in one tab

**Solution:**
```typescript
// Add storage event listener in ConfigurationContext
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === CONFIG_STORAGE_KEY && e.newValue) {
      const newConfig = JSON.parse(e.newValue);
      setConfig(newConfig);
    }
  };
  
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, []);
```

### Issue 4: Stale Query Cache
**Scenario:** Configuration changes but React Query cache returns old data

**Solution:**
```typescript
// Invalidate relevant queries when config changes
const updateConfig = (partial: Partial<AppConfiguration>) => {
  const updated = updateConfigStorage(partial);
  setConfig(updated);
  
  // Invalidate queries that depend on config
  if (partial.jira?.boardId) {
    queryClient.invalidateQueries({ queryKey: ['sprints'] });
    queryClient.invalidateQueries({ queryKey: ['velocity'] });
    queryClient.invalidateQueries({ queryKey: ['active-sprints'] });
    queryClient.invalidateQueries({ queryKey: ['closed-sprints'] });
  }
  
  if (partial.github) {
    queryClient.invalidateQueries({ queryKey: ['commits'] });
    queryClient.invalidateQueries({ queryKey: ['pull-requests'] });
    queryClient.invalidateQueries({ queryKey: ['comprehensive-report'] });
  }
};
```

---

## 📊 Success Metrics

### Functionality Metrics
- ✅ All pages use configuration (0 hardcoded values remaining)
- ✅ Configuration persists across browser sessions
- ✅ Configuration syncs across multiple tabs
- ✅ Board search returns results < 500ms
- ✅ Configuration changes apply without page refresh

### User Experience Metrics
- ✅ Board switching takes < 2 seconds
- ✅ Configuration errors show helpful messages
- ✅ UI provides clear feedback on save/reset
- ✅ Recent boards accessible in < 2 clicks

### Code Quality Metrics
- ✅ 0 direct references to '6306' in page components
- ✅ 0 direct references to 'Sage'/'sage-connect' in page components
- ✅ 100% test coverage for configuration logic
- ✅ All pages use `useConfiguration()` hook

---

## 🎓 Key Learnings & Best Practices

### 1. **Separation of Concerns**
- ✅ Configuration logic isolated in `config-storage.ts`
- ✅ UI components consume configuration via context
- ✅ API calls receive configuration as parameters

### 2. **Single Source of Truth**
- ✅ localStorage is the persistence layer
- ✅ React Context is the runtime state
- ✅ No duplicate configuration state

### 3. **Graceful Degradation**
- ✅ Falls back to defaults on invalid config
- ✅ Shows error messages for API failures
- ✅ Provides reset functionality

### 4. **Performance Optimization**
- ✅ React Query caching prevents redundant API calls
- ✅ Configuration context doesn't cause unnecessary re-renders
- ✅ Board search is debounced

---

## 🔗 Related Documentation

- Configuration Storage: `web/src/lib/config-storage.ts`
- Configuration Context: `web/src/contexts/ConfigurationContext.tsx`
- Board Selector: `web/src/components/BoardSelector.tsx`
- Sprint Constants: `web/src/constants/sprint.ts`
- API Client: `web/src/lib/api.ts`

---

## 📝 Next Steps

### Immediate Actions (Today)
1. ✅ Review this brainstorming document
2. [ ] Update SprintDetails page with configuration
3. [ ] Update Velocity page with configuration
4. [ ] Update Analytics page (if needed)
5. [ ] Test end-to-end configuration flow

### Short Term (This Week)
1. [ ] Add configuration validation
2. [ ] Implement quick board switcher
3. [ ] Add recent boards history
4. [ ] Write integration tests

### Long Term (Next Sprint)
1. [ ] Add configuration presets
2. [ ] Implement multi-board comparison
3. [ ] Add configuration sharing
4. [ ] Create admin configuration panel

---

## 💡 Additional Ideas

### 1. **Configuration Export/Import**
Allow users to export configuration as JSON and share with team:

```typescript
const exportConfiguration = () => {
  const config = loadConfiguration();
  const json = JSON.stringify(config, null, 2);
  downloadFile(json, 'nextrelease-config.json');
};

const importConfiguration = (file: File) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const config = JSON.parse(e.target.result);
    saveConfiguration(config);
    window.location.reload();
  };
  reader.readAsText(file);
};
```

### 2. **Board Favorites**
Star/favorite frequently used boards:

```typescript
interface AppConfiguration {
  jira: {
    boardId: string;
    boardName: string;
    favoriteBoards?: string[]; // Board IDs
  };
}
```

### 3. **Configuration URL Parameters**
Allow configuration via URL:
```
https://app.example.com?board=6306&owner=Sage&repo=sage-connect
```

### 4. **Team Configuration Sharing**
Store team configurations in backend:
```typescript
POST /api/configurations
GET /api/configurations/team/:teamId
```

---

**Document Status:** ✅ Complete and Ready for Implementation  
**Review Date:** October 10, 2025  
**Next Review:** After Phase 1 implementation
