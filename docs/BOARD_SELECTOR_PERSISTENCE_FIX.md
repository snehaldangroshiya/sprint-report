# Board Selector Persistence Fix

**Date:** October 10, 2025
**Issue:** Board dropdown resets when navigating between pages
**Status:** ✅ FIXED

---

## 🐛 Problem Description

### User Report
> "Board dropdown in configuration settings gets reset when user switches from Dashboard to Analytics and comes back to Dashboard. Board dropdown should persist the selection."

### Reproduction Steps
1. Go to Dashboard page
2. Open Configuration Settings
3. Select a board (e.g., "Sage Connect")
4. Navigate to Analytics page
5. Return to Dashboard page
6. ❌ **BUG:** Board dropdown shows "Select board..." instead of "Sage Connect"

### Expected Behavior
The selected board name should **persist** and display correctly when returning to the Dashboard page.

---

## 🔍 Root Cause Analysis

### Component Lifecycle Issue

The `BoardSelector` component uses **local state** (`selectedBoardCache`) to cache the selected board information for display purposes:

```typescript
const [selectedBoardCache, setSelectedBoardCache] = useState<BoardInfo | null>(null);
```

**Problem:** When navigating between pages:
1. User selects board → `selectedBoardCache` is set
2. Navigate to Analytics → Dashboard unmounts → `selectedBoardCache` is **destroyed**
3. Return to Dashboard → Component remounts → `selectedBoardCache` is **re-initialized to null**
4. Result: Board name doesn't display until cache is rebuilt

### Why Configuration Persists But Display Doesn't

The configuration system works correctly:
- ✅ `config.jira.boardId` persists in localStorage
- ✅ `value` prop is passed correctly to BoardSelector
- ✅ Configuration context maintains state

The issue is the **display cache** in BoardSelector:
- ❌ `selectedBoardCache` resets on remount
- ❌ Board name requires fetching/finding board details by ID
- ❌ Display shows "Select board..." until cache rebuilds

---

## 🔧 Solution Implemented

### Initial Fix (v1)
First attempt added initialization only when `selectedBoardCache` was null, with dependencies `[value, defaultBoards, selectedBoardCache]`.

**Problem with v1:**
- Only ran when cache was empty
- Could miss value changes if cache was already populated
- Dependency on `selectedBoardCache` could cause unnecessary re-runs

### Improved Fix (v2) ✅
Enhanced to trigger on **any value change**, not just when cache is empty:

```typescript
useEffect(() => {
  if (value) {
    // Early return if already cached correctly
    if (selectedBoardCache && selectedBoardCache.id === value) {
      return;
    }

    // Update cache with new value
    const boardInDefaults = defaultBoards?.find(b => b.id === value);
    if (boardInDefaults) {
      setSelectedBoardCache(boardInDefaults);
    }
  }
}, [value, defaultBoards]); // Removed selectedBoardCache from deps
```

### Final Fix (v3) - October 10, 2025 ⭐
**BEST SOLUTION:** Added `initialBoardName` prop to provide immediate fallback display:

```typescript
interface BoardSelectorProps {
  value: string;
  onChange: (boardId: string, boardName: string) => void;
  disabled?: boolean;
  initialBoardName?: string; // NEW - provides fallback display name
}

// In BoardSelector component
const selectedBoard = selectedBoardCache ||
  boards?.find(b => b.id === value) ||
  selectedBoardData?.[0] ||
  (value && initialBoardName ? { id: value, name: initialBoardName, type: 'scrum' } : null);
```

**Why v3 is better:**
- ✅ Shows board name **immediately** on mount (no waiting for queries)
- ✅ Works even if `defaultBoards` query is slow or fails
- ✅ Simpler logic - no complex useEffect dependencies
- ✅ Backward compatible - optional prop
- ✅ One source of truth: persisted config provides display name

### How It Works

**On Component Mount or Value Change:**
1. Check if `value` prop exists (board ID from config)
2. Check if board is already cached with the same ID (skip if yes)
3. Search for board in `defaultBoards` (already fetched by React Query)
4. If found, immediately populate `selectedBoardCache`
5. Display updates instantly with board name

**Key Improvement:** The effect now triggers on **both mount AND value changes**, ensuring the cache always syncs with the configuration, even if the value changes while the component is mounted.

**Fallback System:**
If board isn't in default boards (rare), the existing system kicks in:
- Fallback query fetches board by ID: `queryKey: ['board', value]`
- Second useEffect updates cache when board data arrives
- Display updates when cache is populated

---

## 📝 Code Changes

### File: `/web/src/components/BoardSelector.tsx`

**v3 Changes (October 10, 2025):**

1. **Added `initialBoardName` prop:**
```typescript
interface BoardSelectorProps {
  value: string;
  onChange: (boardId, boardName) => void;
  disabled?: boolean;
  initialBoardName?: string; // ⭐ NEW
}

export function BoardSelector({
  value,
  onChange,
  disabled,
  initialBoardName // ⭐ NEW
}: BoardSelectorProps)
```

2. **Updated selectedBoard logic with fallback:**
```typescript
// Find selected board with multiple fallbacks:
// 1. Local cache (fastest)
// 2. Current boards list (from search or defaults)
// 3. Fetched board data (by ID query)
// 4. ⭐ NEW: Minimal board object using initialBoardName as last resort
const selectedBoard = selectedBoardCache ||
  boards?.find(b => b.id === value) ||
  selectedBoardData?.[0] ||
  (value && initialBoardName ? { id: value, name: initialBoardName, type: 'scrum' } : null);
```

**ConfigurationCard.tsx Changes:**
```typescript
<BoardSelector
  value={localConfig.jira.boardId}
  initialBoardName={localConfig.jira.boardName} // ⭐ NEW - provides fallback name
  onChange={(boardId, boardName) => {
    setLocalConfig({
      ...localConfig,
      jira: { boardId, boardName },
    });
  }}
  disabled={isLoading}
/>
```

---

## 🎯 Benefits

### 1. **Instant Display on Mount** ⚡
- Board name shows immediately when returning to Dashboard
- No waiting for API calls or query processing
- Leverages React Query's cache of default boards

### 2. **Better UX** 😊
- Users see consistent state across navigation
- No confusing "Select board..." when board is already selected
- Professional, polished experience

### 3. **Performance** 🚀
- Reuses already-cached `defaultBoards` data
- No additional API calls in most cases
- Fast board lookup by ID in array

### 4. **Reliability** 🛡️
- Works for all boards in default list (most common scenario)
- Fallback system handles edge cases (rare boards)
- Multi-layered approach ensures display always works

---

## 🧪 Testing Scenarios

### Test 1: Navigation Persistence ✅
1. Dashboard → Select "Sage Connect"
2. Navigate to Analytics
3. Return to Dashboard
4. **Expected:** Board shows "Sage Connect" ✅
5. **Result:** PASS

### Test 2: Default Board ✅
1. Fresh app load (default config)
2. Dashboard loads
3. **Expected:** Board shows "Sage Connect" (board 6306) ✅
4. **Result:** PASS

### Test 3: Custom Board ✅
1. Select rare board not in default list
2. Navigate away and back
3. **Expected:** Board name displays (via fallback query) ✅
4. **Result:** PASS

### Test 4: Multiple Navigations ✅
1. Dashboard → Analytics → Velocity → Dashboard
2. **Expected:** Board persists through all navigations ✅
3. **Result:** PASS

### Test 5: Board Change + Navigation ✅
1. Select Board A
2. Navigate to Analytics
3. Return to Dashboard
4. Change to Board B
5. Navigate to Velocity
6. Return to Dashboard
7. **Expected:** Board shows Board B ✅
8. **Result:** PASS

---

## 🔍 Technical Details

### React Component Lifecycle

**Problem Pattern:**
```
Mount → Select Board → Set Cache → Navigate Away → Unmount
         ↓                                           ↓
    Cache = Board Info                        Cache = DESTROYED

Remount → Cache = null → Display "Select board..."
```

**Solution Pattern:**
```
Mount → Cache = null → Check value prop → Find in defaults → Set Cache
         ↓                                                       ↓
    useEffect runs                                      Cache = Board Info
         ↓                                                       ↓
    Display updates                                    Display "Sage Connect"
```

### React Query Integration

The fix leverages React Query's caching:
- `defaultBoards` is cached by React Query with `queryKey: ['boards']`
- When component remounts, data is already available
- No additional API call needed
- Instant board lookup and display

### useEffect Dependencies

```typescript
useEffect(() => {
  if (value && !selectedBoardCache) {
    const boardInDefaults = defaultBoards?.find(b => b.id === value);
    if (boardInDefaults) {
      setSelectedBoardCache(boardInDefaults);
    }
  }
}, [value, defaultBoards, selectedBoardCache]);
```

**Dependencies Explained:**
- `value`: Board ID from config - triggers when board changes externally
- `defaultBoards`: Default boards list - triggers when data loads
- **Removed** `selectedBoardCache` from dependencies to prevent infinite loops
- Early return check prevents unnecessary updates when board is already cached

---

## 📊 Before vs After

### Before ❌
```
User Flow:
Dashboard (Board: "Sage Connect")
    → Navigate to Analytics
    → Return to Dashboard (Board: "Select board...") ← BUG

State:
- config.jira.boardId = "6306" ✓
- config.jira.boardName = "Sage Connect" ✓
- selectedBoardCache = null ✗ ← PROBLEM
- Display = "Select board..." ✗
```

### After ✅
```
User Flow:
Dashboard (Board: "Sage Connect")
    → Navigate to Analytics
    → Return to Dashboard (Board: "Sage Connect") ✓

State:
- config.jira.boardId = "6306" ✓
- config.jira.boardName = "Sage Connect" ✓
- selectedBoardCache = { id: "6306", name: "Sage Connect", ... } ✓
- Display = "Sage Connect" ✓
```

---

## 🔄 State Management Flow

### Configuration Layer (Persists)
```
localStorage
    ↓
ConfigurationContext
    ↓
ConfigurationCard
    ↓
BoardSelector (value prop = "6306")
```

### Display Layer (Previously Reset, Now Fixed)
```
BoardSelector mounts with value="6306"
    ↓
useEffect runs
    ↓
Find board in defaultBoards
    ↓
Set selectedBoardCache = { id: "6306", name: "Sage Connect", ... }
    ↓
Display updates → "Sage Connect" shows in dropdown
```

---

## 🎓 Lessons Learned

### 1. **Component State vs Global State**
- Global state (ConfigurationContext) persists across navigation
- Local component state (selectedBoardCache) resets on unmount
- **v3 Solution:** Pass persisted display data as prop to bridge the gap

### 2. **React Component Lifecycle**
- Mounting/unmounting destroys local state
- `useEffect` can have race conditions with async queries
- **v3 Solution:** Immediate fallback display eliminates timing issues

### 3. **Performance Optimization**
- Leverage React Query's cache instead of fetching again
- Lookup in existing data before making API calls
- **v3 Solution:** Multi-layer fallback (cache → query → persisted name) ensures instant display

### 4. **UX Impact of Technical Decisions**
- Small technical detail (cache initialization) = big UX impact
- User sees "lost" selection even though data is saved
- Display state is as important as data persistence
- **v3 Solution:** Always show something meaningful, never show "Select board..." when board is selected

### 5. **Prop Design Patterns**
- Optional props with sensible fallbacks improve flexibility
- Controlled components should accept all display data they need
- **v3 Solution:** `initialBoardName` prop provides graceful degradation

---

## ✅ Verification

### Manual Testing
- [x] Navigate Dashboard → Analytics → Dashboard
- [x] Board name persists and displays correctly
- [x] Works with default board (Sage Connect)
- [x] Works with custom boards
- [x] No TypeScript errors
- [x] No console errors
- [x] Fast display update (no flash of "Select board...")

### Edge Cases Tested
- [x] First app load with default config
- [x] Board change + navigation
- [x] Multiple rapid navigations
- [x] Rare boards not in default list
- [x] Page refresh (config loads from localStorage)

---

## 🚀 Next Steps

### Potential Enhancements

1. **Persist Cache in SessionStorage**
   ```typescript
   // Optional: Persist display cache across page refreshes
   const [selectedBoardCache, setSelectedBoardCache] = useState(() => {
     const cached = sessionStorage.getItem('board-display-cache');
     return cached ? JSON.parse(cached) : null;
   });
   ```

2. **Memoize Board Lookup**
   ```typescript
   const findBoard = useMemo(() =>
     (id: string) => defaultBoards?.find(b => b.id === id),
     [defaultBoards]
   );
   ```

3. **Preload Board Data on App Init**
   - Prefetch default boards in App.tsx
   - Ensures data is ready before any component mounts

---

## 📚 Related Issues

### Previously Fixed
- ✅ Board selector search functionality (BOARD_SELECTOR_SEARCH_FIX.md)
- ✅ Board selector display bug after search (BOARD_SELECTOR_DISPLAY_BUG_FIX.md)
- ✅ Configuration reset functionality (CONFIGURATION_RESET_FIX.md)

### Related Components
- `ConfigurationCard.tsx` - Parent component managing configuration
- `ConfigurationContext.tsx` - Global configuration state
- `config-storage.ts` - localStorage persistence

---

## 📖 References

### React Documentation
- [Component Lifecycle](https://react.dev/learn/lifecycle-of-reactive-effects)
- [useEffect Hook](https://react.dev/reference/react/useEffect)
- [Component State](https://react.dev/learn/state-a-components-memory)

### React Query
- [Caching](https://tanstack.com/query/latest/docs/react/guides/caching)
- [Query Keys](https://tanstack.com/query/latest/docs/react/guides/query-keys)

---

## 🎯 Summary

**Problem:** Board dropdown reset when navigating between pages
**Cause:** Local state (`selectedBoardCache`) destroyed on component unmount
**Solution v1:** useEffect initialization (timing issues)
**Solution v2:** Enhanced useEffect (better, but still depends on query timing)
**Solution v3:** ⭐ `initialBoardName` prop with fallback (BEST - instant display)

**Result:** ✅ Board name persists and displays correctly across all navigation with zero delay

**Final Impact:**
- ✅ **Instant display** - no waiting for queries
- ✅ **Better UX** - always shows meaningful state
- ✅ **Reliable** - works even if queries are slow/fail
- ✅ **Simple** - minimal code change (3 lines modified)
- ✅ **Type safe** - full TypeScript validation
- ✅ **No additional API calls** - uses persisted data

**Technical Changes:**
- Added optional `initialBoardName` prop to `BoardSelector`
- Modified fallback logic to create minimal board object for display
- Updated `ConfigurationCard` to pass `boardName` from config

---

**Status:** ✅ COMPLETE - Ready for production (v3 - October 10, 2025)
