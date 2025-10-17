# Analytics Page - shadcn UI Refactoring

**Date:** October 17, 2025  
**File:** `/web/src/pages/Analytics.tsx`  
**Status:** ✅ Complete

## Overview

Refactored the Analytics page to be fully compatible with shadcn UI component library, following best practices and design patterns for consistency across the application.

## Changes Made

### 1. **Updated Imports**
Added missing shadcn components:
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` - for dropdown controls
- `Badge` - for status indicators
- `Alert`, `AlertDescription`, `AlertTitle` - for empty states and error messages
- `CardDescription` - for card subtitles
- `AlertCircle` icon - for error states

### 2. **Replaced Native HTML Select**
**Before:**
```tsx
<select
  id="dateRange"
  value={dateRange}
  onChange={(e) => setDateRange(e.target.value)}
  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500..."
>
  <option value="1month">Last Month</option>
  ...
</select>
```

**After:**
```tsx
<Select value={dateRange} onValueChange={setDateRange}>
  <SelectTrigger id="dateRange">
    <SelectValue placeholder="Select time period" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1month">Last Month</SelectItem>
    ...
  </SelectContent>
</Select>
```

### 3. **Replaced Hardcoded Colors with Theme Tokens**

**Before:**
- `text-gray-900` → `tracking-tight` (default text color)
- `text-gray-500` → `text-muted-foreground`
- `text-gray-600` → `text-muted-foreground`
- `text-gray-700` → removed (uses default)
- `text-blue-500`, `text-green-500`, etc. → `text-muted-foreground` for icons
- Manual color classes for completion rate → contextual descriptions

**Key Metrics Card - Before:**
```tsx
<p className={`text-lg font-medium ${
  completionRate >= 80 ? 'text-green-600' :
  completionRate >= 60 ? 'text-yellow-600' :
  'text-red-600'
}`}>
```

**Key Metrics Card - After:**
```tsx
<div className="text-2xl font-bold">
  {completionRate > 0 ? `${completionRate}%` : '--'}
</div>
<p className="text-xs text-muted-foreground mt-1">
  {completionRate >= 80 ? 'Excellent performance' :
   completionRate >= 60 ? 'Good performance' : ...}
</p>
```

### 4. **Improved Card Structure**

Added proper `CardDescription` to all chart cards:
```tsx
<CardHeader>
  <div className="flex items-center justify-between">
    <div>
      <CardTitle>Sprint Velocity Trend</CardTitle>
      <CardDescription>Commitment vs. completion over time</CardDescription>
    </div>
    <TrendingUp className="h-5 w-5 text-muted-foreground" />
  </div>
</CardHeader>
```

### 5. **Enhanced Configuration Card**

Replaced plain text with structured components:
```tsx
<div className="flex items-center gap-2">
  <span className="text-sm text-muted-foreground">Board:</span>
  <Badge variant="secondary">{config.jira.boardName}</Badge>
  <Badge variant="outline">ID: {config.jira.boardId}</Badge>
</div>
<div className="flex items-center gap-2">
  <span className="text-sm text-muted-foreground">GitHub:</span>
  <code className="text-xs bg-muted px-2 py-1 rounded">
    {config.github.owner}/{config.github.repo}
  </code>
</div>
```

### 6. **Replaced Empty States with Alert Components**

**Before:**
```tsx
<div className="h-72 flex items-center justify-center text-muted-foreground">
  <div className="text-center">
    <BarChart3 className="h-12 w-12 mx-auto mb-2 text-muted" />
    <p className="text-sm">Select a board and click "Update Charts"</p>
  </div>
</div>
```

**After:**
```tsx
<div className="h-72 flex items-center justify-center">
  <Alert variant="default" className="max-w-md">
    <BarChart3 className="h-4 w-4" />
    <AlertTitle>No Data Available</AlertTitle>
    <AlertDescription>
      Select a board from the dashboard to view velocity trends.
    </AlertDescription>
  </Alert>
</div>
```

### 7. **Improved Error States**

Added proper destructive alerts for errors:
```tsx
<Alert variant="destructive" className="max-w-md">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error Loading Data</AlertTitle>
  <AlertDescription>
    {error.message || 'Failed to load data. Please try again.'}
  </AlertDescription>
</Alert>
```

### 8. **Enhanced Key Metrics Cards**

Standardized the layout following shadcn patterns:
```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">Average Velocity</CardTitle>
    <TrendingUp className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{value}</div>
    <p className="text-xs text-muted-foreground mt-1">Description</p>
  </CardContent>
</Card>
```

### 9. **Improved Sprint Comparison Table**

Added:
- Border wrapper: `<div className="rounded-md border">`
- Text alignment: `className="text-right"` for numeric columns
- Badge variants for success rates:
  ```tsx
  <Badge variant={
    successRate >= 80 ? "default" : 
    successRate >= 60 ? "secondary" : 
    "destructive"
  }>
    {successRate.toFixed(1)}%
  </Badge>
  ```
- Conditional rendering to only show when data exists

### 10. **Consistent Skeleton Loading**

Added proper spacing to skeleton states:
```tsx
<div className="h-72 space-y-2">
  <Skeleton className="h-full w-full" />
</div>
```

## Benefits

✅ **Full shadcn Compatibility** - All components now use shadcn primitives  
✅ **Theme Consistency** - Uses CSS variables instead of hardcoded colors  
✅ **Better UX** - Proper error states, loading states, and empty states  
✅ **Improved Accessibility** - Semantic HTML with proper ARIA attributes  
✅ **Dark Mode Ready** - Uses theme tokens that work in light/dark modes  
✅ **Maintainability** - Consistent patterns across the application  
✅ **Type Safety** - Full TypeScript support with no errors  

## Testing Checklist

- [ ] Visit `http://localhost:3001/analytics`
- [ ] Verify all cards render correctly
- [ ] Test time period selector (dropdown should work smoothly)
- [ ] Check loading states (skeletons)
- [ ] Verify empty states (when no board selected)
- [ ] Test error states (GitHub API failures)
- [ ] Check table rendering and badges
- [ ] Verify responsive layout on mobile/tablet
- [ ] Test dark mode compatibility (if enabled)
- [ ] Verify all metrics display correctly

## Related Files

- `/web/src/pages/Analytics.tsx` - Main file refactored
- `/web/src/components/ui/alert.tsx` - Alert component used
- `/web/src/components/ui/select.tsx` - Select component used
- `/web/src/components/ui/badge.tsx` - Badge component used
- `/web/src/components/ui/card.tsx` - Card components used

## Notes

- All color changes use shadcn theme tokens (`muted-foreground`, `muted`, etc.)
- Error handling is more user-friendly with clear messages
- Component structure follows shadcn best practices
- No breaking changes to functionality—only UI/UX improvements
