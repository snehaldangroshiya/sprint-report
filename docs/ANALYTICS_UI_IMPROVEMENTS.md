# Analytics Page UI Improvements

## Changes Made - October 5, 2025

### Removed: "Update Charts" Button
**Reason**: The button was redundant because:
- React Query automatically refetches data when dependencies change (board, date range, GitHub repo)
- The `queryKey` in each `useQuery` hook includes all relevant parameters
- Data automatically updates when user changes any filter
- Manual refresh button adds unnecessary complexity

### Added: GitHub Repository Configuration Fields

**New UI Controls**:
1. **GitHub Owner** input field
   - Replaces hardcoded `VITE_GITHUB_OWNER` environment variable
   - Allows users to dynamically change the GitHub owner/organization
   - Default value: `Sage` (from environment or fallback)
   - Placeholder: "e.g., Sage"

2. **GitHub Repo** input field
   - Replaces hardcoded `VITE_GITHUB_REPO` environment variable
   - Allows users to dynamically change the repository name
   - Default value: `sage-connect` (from environment or fallback)
   - Placeholder: "e.g., sage-connect"

### Technical Implementation

**Before**:
```typescript
const [githubOwner] = useState(import.meta.env.VITE_GITHUB_OWNER || 'Sage');
const [githubRepo] = useState(import.meta.env.VITE_GITHUB_REPO || 'sage-connect');

// Update Charts button with manual refetch
<Button onClick={handleUpdateCharts}>
  Update Charts
</Button>
```

**After**:
```typescript
const [githubOwner, setGithubOwner] = useState(import.meta.env.VITE_GITHUB_OWNER || 'Sage');
const [githubRepo, setGithubRepo] = useState(import.meta.env.VITE_GITHUB_REPO || 'sage-connect');

// Editable input fields
<Input
  value={githubOwner}
  onChange={(e) => setGithubOwner(e.target.value)}
  placeholder="e.g., Sage"
/>
<Input
  value={githubRepo}
  onChange={(e) => setGithubRepo(e.target.value)}
  placeholder="e.g., sage-connect"
/>
```

### Automatic Data Refresh

React Query automatically refetches data when:
- **Board** changes → Refetches velocity, team performance, and issue types
- **Time Period** changes → Refetches all analytics with new sprint count
- **GitHub Owner** changes → Refetches commit trends
- **GitHub Repo** changes → Refetches commit trends

This is achieved through the `queryKey` dependency array:
```typescript
// Example: Commit trends auto-refresh when any parameter changes
useQuery({
  queryKey: ['commit-trends', githubOwner, githubRepo, dateRange],
  queryFn: () => api.getCommitTrends(githubOwner, githubRepo, dateRange),
  enabled: !!githubOwner && !!githubRepo,
})
```

### UI Layout Changes

**Grid Layout**: Changed from 3 columns to 4 columns
```typescript
// Before
<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

// After  
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
```

This creates a balanced layout:
- **Mobile**: 1 column (stacked vertically)
- **Tablet**: 2 columns
- **Desktop**: 4 columns (Board | Time Period | GitHub Owner | GitHub Repo)

### Benefits

1. **Better UX**: Users can test different GitHub repositories without changing environment variables
2. **Dynamic Configuration**: No need to rebuild or restart the application
3. **Automatic Updates**: Data refreshes automatically when inputs change
4. **Cleaner UI**: Removed unnecessary button, added useful configuration fields
5. **Development Flexibility**: Easier to test with different repositories

### Files Modified

- `/web/src/pages/Analytics.tsx`
  - Added `Input` component import
  - Made `githubOwner` and `githubRepo` state editable
  - Replaced "Update Charts" button with two input fields
  - Removed `handleUpdateCharts` function
  - Removed unused `refetch` functions from `useQuery` hooks
  - Updated grid layout for 4-column responsive design

### Testing

To test the changes:
1. Navigate to `http://localhost:3001/analytics`
2. Change the **GitHub Owner** field (e.g., try "microsoft", "facebook")
3. Change the **GitHub Repo** field (e.g., try "vscode", "react")
4. Observe the **Code Activity Trends** chart automatically update
5. Verify other charts update when changing **Board** or **Time Period**

### Future Enhancements

Consider adding:
- Save/Load GitHub repo presets
- Recent repositories dropdown
- Validation for GitHub repo existence
- Loading indicator while fetching commit trends
- Error messages for invalid repositories

---

**Date**: October 5, 2025  
**Component**: Analytics Page  
**Type**: UI Improvement  
**Status**: Complete  
