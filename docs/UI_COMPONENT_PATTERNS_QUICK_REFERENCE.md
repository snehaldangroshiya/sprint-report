# UI Component Patterns - Quick Reference

**Last Updated:** October 10, 2025
**Purpose:** Fast reference for common UI patterns and component usage

---

## 🎨 shadcn/ui Card Patterns

### ✅ Compact Stats Card (Recommended Pattern)

**Use for:** Dashboard metrics, KPIs, status indicators

```tsx
<Card className="border-violet-100 hover:border-violet-300">
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium text-gray-600">
      Metric Name
    </CardTitle>
    <Icon className="h-4 w-4 text-violet-600" />
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-bold text-gray-900">85%</div>
    <p className="text-xs text-violet-600 font-medium">Description</p>
  </CardContent>
</Card>
```

**Reference:** `SprintDetails.tsx:151-205`, `Dashboard.tsx:127-187`

---

### ✅ Form Card Pattern

**Use for:** Configuration forms, settings panels, input groups

```tsx
<Card>
  <CardHeader>
    <CardTitle>Form Title</CardTitle>
    <CardDescription>Form description</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label>Field Label</Label>
      <Input value={value} onChange={handleChange} />
    </div>
  </CardContent>
  <CardFooter className="flex justify-end gap-2">
    <Button variant="outline">Cancel</Button>
    <Button>Save</Button>
  </CardFooter>
</Card>
```

**Reference:** `ConfigurationCard.tsx`

---

## 🎯 Configuration System

### Using Configuration Context

```tsx
// Import hook
import { useConfiguration, useJiraConfig, useGitHubConfig } from '@/contexts/ConfigurationContext';

// In component
const { config, updateConfig, resetConfig } = useConfiguration();

// Access Jira config
const { boardId, boardName } = useJiraConfig();

// Access GitHub config
const { owner, repo } = useGitHubConfig();

// Update configuration
updateConfig({
  jira: { boardId: '1234', boardName: 'New Board' }
});
```

**Reference:** `.claude/CLAUDE_CONFIGURATION_SYSTEM.md`

---

### Board Selector with Persistence

```tsx
import { BoardSelector } from '@/components/BoardSelector';
import { useConfiguration } from '@/contexts/ConfigurationContext';

function MyComponent() {
  const { config, updateConfig } = useConfiguration();

  return (
    <BoardSelector
      value={config.jira.boardId}
      initialBoardName={config.jira.boardName}  // ⭐ For persistence
      onChange={(boardId, boardName) => {
        updateConfig({
          jira: { boardId, boardName }
        });
      }}
    />
  );
}
```

**Reference:** `docs/BOARD_SELECTOR_PERSISTENCE_FIX.md`

---

## 🔧 Common Patterns

### API Calls with Configuration

```tsx
import { useQuery } from '@tanstack/react-query';
import { useJiraConfig } from '@/contexts/ConfigurationContext';
import { api } from '@/lib/api';

function MyComponent() {
  const { boardId } = useJiraConfig();

  const { data, isLoading } = useQuery({
    queryKey: ['sprints', boardId],
    queryFn: () => api.getSprints(boardId, 'closed'),
    enabled: !!boardId,  // Only fetch if boardId exists
  });

  return (/* render */);
}
```

---

### Sprint Sorting (Global Standard)

```tsx
import { combineAndSortSprints } from '@/lib/sprint-utils';

// Combine active and closed sprints, sorted newest → oldest
const recentSprints = combineAndSortSprints(
  activeSprints,
  closedSprints,
  limit  // optional
);
```

**Policy:** Always sort newest → oldest (descending by start date)
**Reference:** `docs/SPRINT_SORTING_POLICY.md`

---

## ❌ Common Mistakes

### 1. Missing CardHeader

```tsx
// ❌ WRONG
<Card>
  <CardContent className="pt-6">  {/* Manual padding workaround */}
    <p className="font-medium">Title</p>
  </CardContent>
</Card>

// ✅ CORRECT
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>  {/* Semantic h3 */}
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

---

### 2. Board Selector Without initialBoardName

```tsx
// ❌ WRONG - Loses display on navigation
<BoardSelector
  value={boardId}
  onChange={handleChange}
/>

// ✅ CORRECT - Persists across navigation
<BoardSelector
  value={boardId}
  initialBoardName={boardName}  // ⭐ Provides fallback display
  onChange={handleChange}
/>
```

---

### 3. Inconsistent Icon Sizing

```tsx
// ❌ WRONG - Non-standard sizes
<Icon className="h-7 w-7" />  // Odd size
<Icon className="h-5 w-5" />  // Inconsistent

// ✅ CORRECT - Standard sizes
<Icon className="h-4 w-4" />   // Compact stat cards
<Icon className="h-8 w-8" />   // Icon-prominent cards
<Icon className="h-12 w-12" />  // Hero cards
```

---

## 📚 Documentation Quick Links

| Topic | Document | Location |
|-------|----------|----------|
| **Card Patterns** | Design patterns & standards | `.claude/CLAUDE_CARD_DESIGN_PATTERNS.md` |
| **Configuration** | System architecture | `.claude/CLAUDE_CONFIGURATION_SYSTEM.md` |
| **Board Persistence** | Fix documentation | `docs/BOARD_SELECTOR_PERSISTENCE_FIX.md` |
| **Sprint Sorting** | Global sorting policy | `docs/SPRINT_SORTING_POLICY.md` |
| **Web UI** | Complete architecture | `docs/CLAUDE_WEB_UI.md` |
| **shadcn/ui** | Component integration | `docs/README_SHADCN.md` |

---

## 🎓 Reference Implementations

### Gold Standard Examples

| Component | File | Lines | What to Learn |
|-----------|------|-------|---------------|
| **Compact Stats Cards** | `SprintDetails.tsx` | 151-205 | Proper Card structure |
| **Configuration Form** | `ConfigurationCard.tsx` | 80-200 | Form Card pattern |
| **Board Selector** | `BoardSelector.tsx` | 1-193 | Searchable dropdown |
| **Dashboard Stats** | `Dashboard.tsx` | 127-187 | Consistent with SprintDetails |

---

## 🚀 Quick Start Checklist

### Creating New Component with Config

- [ ] Import `useConfiguration` or specific config hook
- [ ] Access needed config values (`boardId`, `boardName`, etc.)
- [ ] Pass config to API calls via `enabled: !!boardId`
- [ ] Use `initialBoardName` prop if using BoardSelector
- [ ] Follow card pattern from reference implementation

### Adding New Configuration Option

- [ ] Update `AppConfiguration` interface in `config-storage.ts`
- [ ] Update `DEFAULT_CONFIG` with default value
- [ ] Add to `ConfigurationCard.tsx` UI
- [ ] Update `updateConfiguration()` logic
- [ ] Test persistence with localStorage
- [ ] Document in `.claude/CLAUDE_CONFIGURATION_SYSTEM.md`

---

## 🔍 Troubleshooting Quick Fixes

### Board dropdown resets on navigation
→ **Solution:** Add `initialBoardName` prop to BoardSelector

### Card looks different from SprintDetails
→ **Solution:** Use CardHeader + CardTitle, remove manual padding

### Configuration not persisting
→ **Solution:** Verify ConfigurationProvider wraps entire app in `App.tsx`

### Sprints in wrong order
→ **Solution:** Use `combineAndSortSprints()` utility function

---

**Full Documentation:** See `.claude/` and `docs/` directories
**Questions:** Refer to comprehensive guides listed above
