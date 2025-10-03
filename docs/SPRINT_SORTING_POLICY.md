# Sprint Sorting Policy

**Last Updated**: October 3, 2025

## 📋 Overview

This document defines the **global sprint sorting and display policy** implemented across the NextReleaseMCP application. All pages must follow this consistent approach to ensure a unified user experience.

## 🎯 Core Principle

**Sprint Display Order**: Start Date Descending (Newest → Oldest)

This mirrors how users naturally think about sprints - the most recent sprint activity is most relevant and appears first.

## 📊 Implementation Details

### Sorting Logic
```typescript
// Standard sorting function (web/src/lib/sprint-utils.ts)
export function sortSprintsByStartDate(sprints: Sprint[]): Sprint[] {
  return [...sprints].sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });
}
```

### Key Rules

1. **Always sort by start date** (not by sprint name or ID)
2. **Descending order** (newest first, oldest last)
3. **Null handling**: Sprints without start dates appear at the end
4. **Consistent everywhere**: All pages use the same sorting logic

## 🔧 Where Applied

### Frontend Pages

#### Dashboard (`web/src/pages/Dashboard.tsx`)
- **Shows**: Active + Closed sprints (combined)
- **Order**: Newest → Oldest
- **Special**: Active sprints show "X days remaining"
- **Limit**: Top 5 sprints
```typescript
const recentSprints = combineAndSortSprints(activeSprints, closedSprints, 5);
```

#### Analytics (`web/src/pages/Analytics.tsx`)
- **Shows**: Closed sprints only
- **Order**: Newest → Oldest
- **Context**: Sprint Comparison table, all charts
- **Limit**: Based on time period (2-24 sprints)

#### Report Generator (`web/src/pages/ReportGenerator.tsx`)
- **Shows**: Closed sprints only (can't report on active)
- **Order**: Newest → Oldest
- **Usage**: Sprint selection dropdown

#### Velocity (`web/src/pages/Velocity.tsx`)
- **Shows**: Closed sprints only
- **Order**: Newest → Oldest (via API)
- **Charts**: Display newest first for trend analysis

### Backend API (`src/web/api-server.ts`)

All analytics endpoints sort BEFORE slicing:

```typescript
// Pattern used in all endpoints
const sprints = await this.callMCPTool('jira_get_sprints', {...});

// CRITICAL: Sort before slice
const sortedSprints = (sprints as any[]).sort((a, b) => {
  if (!a.startDate) return 1;
  if (!b.startDate) return -1;
  return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
});

const recentSprints = sortedSprints.slice(0, sprintCount);
```

**Applied to**:
- `/api/analytics/velocity/:boardId` (line 280)
- `/api/analytics/team-performance/:boardId` (line 345)
- `/api/analytics/issue-types/:boardId` (line 411)

## 🚫 What NOT to Do

### ❌ Wrong Approaches

**Don't sort after slicing**:
```typescript
// WRONG - Gets wrong sprints
const sprints = await getSprints();
const recent = sprints.slice(0, 6); // Takes first 6 unsorted
const sorted = recent.sort(...);    // Sorts wrong subset
```

**Don't use different sort orders**:
```typescript
// WRONG - Inconsistent UX
// Dashboard: newest first
// Analytics: oldest first
```

**Don't reverse in display**:
```typescript
// WRONG - Causes confusion
{data.sprints.slice().reverse().map(...)} // UI reverses API order
```

### ✅ Correct Approach

**Always sort before slice**:
```typescript
// CORRECT - Gets right sprints in right order
const sprints = await getSprints();
const sorted = sortSprintsByStartDate(sprints);
const recent = sorted.slice(0, 6);
```

## 🔄 Active vs Closed Sprints

### Dashboard (Special Case)
- **Shows both** active and closed sprints
- Active sprints provide current status context
- Still sorted by start date (newest first)

### All Other Pages
- **Closed sprints only**
- Can't generate reports for active sprints
- Analytics requires complete sprint data

## 🗂️ Utility Functions

Central location: `web/src/lib/sprint-utils.ts`

```typescript
// Single sprint list sorting
sortSprintsByStartDate(sprints: Sprint[]): Sprint[]

// Combine active + closed with limit
combineAndSortSprints(
  activeSprints: Sprint[],
  closedSprints: Sprint[],
  limit?: number
): Sprint[]
```

## 📝 Implementation Checklist

When adding new sprint-related features:

- [ ] Import sorting utility: `import { sortSprintsByStartDate } from '@/lib/sprint-utils'`
- [ ] Fetch sprints from API
- [ ] Sort BEFORE any slicing or limiting
- [ ] Display newest → oldest
- [ ] Consider if active sprints are needed (Dashboard only)
- [ ] Test with real data to verify order

## 🐛 Common Issues

### Issue: Wrong sprints appear in analytics
**Cause**: API sorted after slicing
**Fix**: Move sort before slice in API endpoint

### Issue: Sprint order inconsistent across pages
**Cause**: Different sorting logic in each page
**Fix**: Use centralized `sortSprintsByStartDate()` utility

### Issue: Cache showing old sort order
**Cause**: Redis cache has old data
**Fix**: Clear cache: `redis-cli --scan --pattern "*6306*" | xargs redis-cli DEL`

## 🔍 Debugging Sprint Order

```bash
# Check what sprints are cached
redis-cli KEYS "velocity:*"
redis-cli KEYS "team-performance:*"
redis-cli KEYS "issue-types:*"

# Clear specific board cache
redis-cli --scan --pattern "*6306*" | xargs redis-cli DEL

# Verify cache is empty
redis-cli --scan --pattern "*6306*" | wc -l
```

## 📊 Cache Impact

Sprint data is cached with different TTLs:
- **Closed sprints**: 30 minutes
- **Issue types**: 10 minutes
- **Team performance**: 5 minutes

**Important**: After code changes affecting sprint order, clear Redis cache to see updates immediately.

## 🔗 Related Files

- **Utility**: `web/src/lib/sprint-utils.ts` - Central sorting logic
- **Backend**: `src/web/api-server.ts` - API endpoints with sorting
- **Frontend**: `web/src/pages/*.tsx` - Page implementations
- **Types**: Sprint interface definition (startDate, endDate, state)

## 📈 Version History

### v2.1.0 (October 3, 2025)
- ✅ Created centralized sprint-utils.ts
- ✅ Applied consistent sorting across all pages
- ✅ Fixed API endpoints to sort before slice
- ✅ Updated Dashboard to show active + closed
- ✅ Documented global sorting policy

---

**Principle**: One sorting policy, consistently applied everywhere, newest sprint first.
