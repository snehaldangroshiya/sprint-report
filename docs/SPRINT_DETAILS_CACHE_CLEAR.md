# Sprint Details Cache Clear Button

**Date**: January 14, 2025
**Feature**: Cache clearing button for SprintDetails page
**Status**: ✅ Implemented

## Overview

Added a cache clearing button to the SprintDetails page that allows users to refresh sprint data by clearing the cache for the current sprint only.

## Implementation Details

### Files Modified

**`web/src/pages/SprintDetails.tsx`**

### Changes Made

1. **Added Required Imports** (lines 14, 26, 30, 49)
   ```typescript
   import { useMutation, useQueryClient } from '@tanstack/react-query';
   import { RefreshCw } from 'lucide-react';
   import { Button } from '@/components/ui/button';
   import { api } from '@/lib/api';
   ```

2. **Added Query Client and Cache Mutation** (lines 55, 61-72)
   ```typescript
   const queryClient = useQueryClient();

   // Mutation to clear cache for this sprint
   const clearCacheMutation = useMutation({
     mutationFn: api.clearCache,
     onSuccess: () => {
       // Invalidate all queries related to this sprint
       queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
       queryClient.invalidateQueries({ queryKey: ['sprint-metrics', sprintId] });
       queryClient.invalidateQueries({ queryKey: ['sprint-issues', sprintId] });
       queryClient.invalidateQueries({ queryKey: ['commits', sprintId] });
       queryClient.invalidateQueries({ queryKey: ['pull-requests', sprintId] });
       queryClient.invalidateQueries({ queryKey: ['comprehensive-report', sprintId] });
     },
   });
   ```

3. **Added Clear Cache Button to Header** (lines 168-177)
   ```typescript
   <Button
     onClick={() => clearCacheMutation.mutate()}
     variant="outline"
     size="sm"
     disabled={clearCacheMutation.isPending}
     className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
   >
     <RefreshCw className={`h-4 w-4 mr-2 ${clearCacheMutation.isPending ? 'animate-spin' : ''}`} />
     {clearCacheMutation.isPending ? 'Clearing...' : 'Clear Cache'}
   </Button>
   ```

## Features

### Button Behavior
- **Location**: Top-right of sprint header (next to sprint name and badges)
- **API Call**: Clears entire backend cache via `/mcp/cache/clear` endpoint
- **React Query Invalidation**: Invalidates 6 sprint-specific query keys after cache clear
- **Loading State**: Shows spinning icon and "Clearing..." text during operation
- **Disabled State**: Button disabled while clearing in progress

### Mobile Responsiveness
- **Mobile (< 640px)**: Full-width button with 44px minimum touch target
- **Desktop (≥ 640px)**: Auto-width compact button
- **Classes**: `w-full sm:w-auto min-h-[44px] sm:min-h-0`

### Query Keys Invalidated

After clearing cache, the following React Query keys are invalidated to trigger fresh data fetches:

1. `['sprint', sprintId]` - Sprint metadata
2. `['sprint-metrics', sprintId]` - Sprint metrics (velocity, completion rate)
3. `['sprint-issues', sprintId]` - Sprint issues list
4. `['commits', sprintId]` - GitHub commit activity
5. `['pull-requests', sprintId]` - GitHub PR statistics
6. `['comprehensive-report', sprintId]` - Comprehensive analytics report

## User Experience

### Before Cache Clear
1. User views sprint data (may be cached/stale)
2. Button shows "Clear Cache" with static refresh icon

### During Cache Clear
1. User clicks "Clear Cache" button
2. Button becomes disabled
3. Icon animates (spinning)
4. Text changes to "Clearing..."
5. Backend cache cleared via API call

### After Cache Clear
1. All sprint-specific queries invalidated
2. React Query automatically refetches fresh data
3. Button returns to enabled state
4. User sees updated sprint information

## API Integration

### Backend Endpoint
- **URL**: `POST /mcp/cache/clear`
- **Response**:
  ```typescript
  {
    success: boolean;
    message: string;
    timestamp: string;
  }
  ```

### Frontend API Function
- **File**: `web/src/lib/api.ts:441`
- **Function**: `clearCache()`
- **Implementation**:
  ```typescript
  export const clearCache = () =>
    apiRequest<{
      success: boolean;
      message: string;
      timestamp: string;
    }>('/mcp/cache/clear', { method: 'POST' });
  ```

## Pattern Reference

This implementation follows the same pattern used in **ToolsStatus.tsx** (lines 49-58):

```typescript
// ToolsStatus.tsx - Reference Implementation
const refreshMutation = useMutation({
  mutationFn: api.refreshMCPTools,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['health'] });
    queryClient.invalidateQueries({ queryKey: ['metrics'] });
    queryClient.invalidateQueries({ queryKey: ['mcp-tools'] });
    queryClient.invalidateQueries({ queryKey: ['cache-stats'] });
  },
});
```

## TypeScript Validation

✅ **Type Check**: Passed (no errors)

```bash
npm run type-check
# Output: No TypeScript errors
```

## Testing Recommendations

### Manual Testing
1. Navigate to any sprint details page
2. Click "Clear Cache" button
3. Verify:
   - Button shows loading state (spinning icon + "Clearing...")
   - Button is disabled during operation
   - Data refreshes after cache clear completes
   - Button returns to normal state

### Edge Cases
- Rapid clicking (should be prevented by disabled state)
- Network errors (mutation will fail gracefully)
- Offline mode (mutation will fail, button returns to normal)

### Mobile Testing
- Verify 44px minimum touch target on mobile devices
- Test full-width button behavior on small screens
- Ensure button doesn't overflow on narrow viewports

## Related Documentation

- **Mobile Responsiveness**: See `MOBILE_IMPLEMENTATION_SUMMARY.md`
- **API Reference**: See `API_WORKING_EXAMPLES.md`
- **Cache Architecture**: See `REDIS_CACHE_ARCHITECTURE.md`
- **Cache Management**: See `CACHE_MANAGEMENT.md`

## Future Enhancements

### Potential Improvements
1. **Success Feedback**: Show toast notification after successful cache clear
2. **Selective Invalidation**: Allow clearing specific data types (issues, commits, metrics)
3. **Confirmation Dialog**: Add "Are you sure?" dialog for destructive action
4. **Error Handling**: Display user-friendly error messages on failure
5. **Cache Statistics**: Show cache hit rate or last refresh time

### Example: Toast Notification
```typescript
import { useToast } from '@/components/ui/use-toast';

const { toast } = useToast();

const clearCacheMutation = useMutation({
  mutationFn: api.clearCache,
  onSuccess: () => {
    // Invalidate queries...
    toast({
      title: "Cache Cleared",
      description: "Sprint data has been refreshed successfully.",
    });
  },
  onError: () => {
    toast({
      title: "Error",
      description: "Failed to clear cache. Please try again.",
      variant: "destructive",
    });
  },
});
```

## Summary

✅ **Implemented**: Cache clearing button for SprintDetails page
✅ **Mobile-Responsive**: 44px touch target, full-width on mobile
✅ **Loading States**: Spinning icon + disabled state during operation
✅ **Query Invalidation**: 6 sprint-specific queries refreshed
✅ **Type-Safe**: TypeScript compilation passed
✅ **Pattern Consistency**: Follows ToolsStatus.tsx implementation

**Lines Modified**: 5 sections, ~25 lines added
**Complexity**: Low (reuses existing patterns)
**Testing Status**: Ready for manual testing
