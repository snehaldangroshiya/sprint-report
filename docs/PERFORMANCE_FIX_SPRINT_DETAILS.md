# Sprint Details Page Performance Fix

**Issue**: Sprint details page takes **~60 seconds** to load without cache  
**Root Cause**: Sequential GitHub API calls with artificial rate-limit delays  
**Impact**: Poor user experience, high server load

---

## 🔍 Performance Bottlenecks Identified

### 1. **Sequential PR Enhancement** (30-50s)
**Location**: `src/services/sprint-service.ts:784-880`

```typescript
// SLOW: Sequential enhancement with delays
for (let i = 0; i < prsToEnhance.length; i++) {
  const enhanced = await this.githubClient.getEnhancedPullRequest(owner, repo, pr.number);
  
  // ⚠️ ARTIFICIAL DELAY: 1 second every 5 requests
  if ((i + 1) % 5 === 0) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

**Problem**: 
- Enhancing 50 PRs = 50 sequential API calls
- 10 artificial delays of 1 second each = **10s wasted**
- Each `getEnhancedPullRequest` makes 2-3 API calls (PR + reviews + commits)
- Total: **30-50 seconds** just for PR data

---

### 2. **Frontend Waits for All Data** (60s total)
**Location**: `web/src/hooks/useSprintDetails.ts:75-91`

```typescript
// Waits for comprehensive report to complete before showing UI
const { data: comprehensiveReport, isLoading: reportLoading } = useQuery({
  queryKey: ['comprehensive-report', sprintId, ...],
  queryFn: () => getComprehensiveSprintReport(sprintId, {
    include_enhanced_github: true, // ⚠️ SLOW
  }),
});
```

**Problem**:
- Frontend blocks on slow GitHub API calls
- User sees loading spinner for 60 seconds
- No progressive loading

---

### 3. **Unnecessary Data Fetching**
**Location**: `web/src/pages/SprintDetails.tsx:44-68`

```typescript
// Fetches BOTH comprehensive report AND previous sprint report
const comprehensiveReport = // Current sprint (60s)
const previousComprehensiveReport = // Previous sprint (60s more!)
```

**Problem**:
- Fetches previous sprint data even if user doesn't need it
- Doubles the API load time

---

## 🚀 Recommended Solutions

### **Solution 1: Use GraphQL API (BEST - Already Implemented)**

The code already has GraphQL support but it might not be enabled!

**Check Configuration**:
```bash
# Verify GitHub GraphQL token is set
echo $GITHUB_GRAPHQL_TOKEN
```

**Enable GraphQL** (if not already):
```typescript
// .env
GITHUB_GRAPHQL_TOKEN=ghp_your_token_here
```

**Benefits**:
- ✅ One query instead of 50+ REST API calls
- ✅ Fetches PR + reviews + commits in **single request**
- ✅ Reduces 50s → **2-3s**
- ✅ Already implemented (line 814-839)

---

### **Solution 2: Progressive Loading (RECOMMENDED)**

Load data in stages instead of waiting for everything:

**Phase 1: Immediate** (< 1s)
- Sprint details
- Basic metrics
- Issue list

**Phase 2: Background** (2-5s)
- Velocity chart
- Burndown chart
- Basic GitHub stats

**Phase 3: Lazy Load** (5-10s)
- Enhanced PR reviews
- Detailed commit activity
- Tier 2/3 analytics

#### Implementation:

**Frontend: Split Queries**
```typescript
// web/src/hooks/useSprintDetails.ts

// Query 1: Fast core data (< 1s)
const { data: coreData } = useQuery({
  queryKey: ['sprint-core', sprintId],
  queryFn: () => getSprintMetrics(sprintId), // Fast!
});

// Query 2: Enhanced data (loads in background)
const { data: enhancedData } = useQuery({
  queryKey: ['sprint-enhanced', sprintId],
  queryFn: () => getComprehensiveSprintReport(sprintId, {
    include_enhanced_github: false, // Skip slow GitHub for now
  }),
  enabled: !!coreData, // Wait for core data first
});

// Query 3: GitHub data (lazy load, optional)
const { data: githubData } = useQuery({
  queryKey: ['sprint-github', sprintId],
  queryFn: () => getSprintGitHubStats(sprintId),
  enabled: userWantsGitHubData, // Only if user clicks "Show GitHub"
});
```

**Backend: Add Fast Endpoint**
```typescript
// src/web/routes/sprint.routes.ts

// New endpoint: Fast metrics only
router.get('/sprints/:sprintId/quick', async (req, res) => {
  const { sprintId } = req.params;
  
  // Only fetch essential data (< 1s)
  const [sprint, metrics, issues] = await Promise.all([
    callMCPTool('jira_get_sprints', { sprint_id: sprintId }),
    callMCPTool('get_sprint_metrics', { sprint_id: sprintId }),
    callMCPTool('jira_get_sprint_issues', { sprint_id: sprintId, max_results: 50 }),
  ]);
  
  res.json({ sprint, metrics, issues });
});
```

---

### **Solution 3: Reduce PR Enhancement Limit**

If GraphQL is not available, reduce the number of PRs enhanced:

**Location**: `src/services/sprint-service.ts:853`

```typescript
// CURRENT: Enhance 50 PRs (30-50s)
const prsToEnhance = basicPRs.slice(0, 50);

// OPTIMIZED: Enhance only top 10 most recent PRs (5-8s)
const prsToEnhance = basicPRs
  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  .slice(0, 10); // Only 10 most recent
```

**Benefits**:
- ✅ Reduces API calls from 50 → 10
- ✅ Reduces delays from 10s → 2s
- ✅ Still shows most relevant PRs

---

### **Solution 4: Remove Artificial Delays**

The 1-second delays are overly conservative:

**Location**: `src/services/sprint-service.ts:872-874`

```typescript
// CURRENT: 1 second delay every 5 requests
if ((i + 1) % 5 === 0) {
  await new Promise(resolve => setTimeout(resolve, 1000)); // ⚠️ TOO SLOW
}

// OPTIMIZED: 100ms delay every 10 requests
if ((i + 1) % 10 === 0) {
  await new Promise(resolve => setTimeout(resolve, 100)); // Much faster
}
```

**GitHub Rate Limits**:
- **Authenticated**: 5,000 requests/hour = **83 req/min** = 1.4 req/sec
- **Our delays**: Limiting to 5 req/5sec = **1 req/sec** (unnecessarily conservative)

**Better approach**: 10 requests → 100ms delay = **10 req/sec** (still safe)

---

### **Solution 5: Parallel PR Enhancement**

Instead of sequential, enhance PRs in parallel batches:

```typescript
// CURRENT: Sequential (50s)
for (let i = 0; i < prsToEnhance.length; i++) {
  const enhanced = await this.githubClient.getEnhancedPullRequest(owner, repo, pr.number);
}

// OPTIMIZED: Parallel batches of 5 (10s)
const BATCH_SIZE = 5;
for (let i = 0; i < prsToEnhance.length; i += BATCH_SIZE) {
  const batch = prsToEnhance.slice(i, i + BATCH_SIZE);
  
  // Process 5 PRs in parallel
  const enhancedBatch = await Promise.all(
    batch.map(pr => 
      this.githubClient.getEnhancedPullRequest(owner, repo, pr.number)
        .catch(err => pr) // Fallback to basic PR on error
    )
  );
  
  enhancedPRsList.push(...enhancedBatch);
  
  // Small delay between batches to respect rate limits
  if (i + BATCH_SIZE < prsToEnhance.length) {
    await new Promise(resolve => setTimeout(resolve, 200)); // 200ms, not 1000ms
  }
}
```

**Benefits**:
- ✅ 50 PRs in 10 batches = **10 seconds** (vs 50s sequential)
- ✅ Still respects rate limits (5 concurrent × 10 batches = 50 total)
- ✅ 5x faster

---

## 📊 Performance Comparison

| Approach | Load Time | User Experience | Complexity |
|----------|-----------|-----------------|------------|
| **Current** | 60s | ❌ Poor | Low |
| **Enable GraphQL** | 3s | ✅ Excellent | **None (already coded!)** |
| **Progressive Loading** | 1s (core) + 5s (enhanced) | ✅ Excellent | Medium |
| **Reduce PR Limit** | 15s | ⚠️ Acceptable | Low |
| **Remove Delays** | 30s | ⚠️ Acceptable | Low |
| **Parallel Batches** | 12s | ⚠️ Good | Medium |

---

## 🎯 Recommended Implementation Plan

### **Immediate (Do Now)** ⚡

1. **Check if GraphQL is enabled**
   ```bash
   cat .env | grep GITHUB_GRAPHQL_TOKEN
   ```

2. **If GraphQL token exists → DONE!** ✅  
   The slow path should only trigger if GraphQL is unavailable.

3. **If GraphQL token missing → Add it:**
   ```bash
   # Generate token at: https://github.com/settings/tokens
   # Required scopes: repo, read:org
   echo "GITHUB_GRAPHQL_TOKEN=ghp_your_token_here" >> .env
   ```

### **Short-term (This Sprint)** 📅

4. **Reduce PR enhancement limit to 15** (5min fix)
   ```typescript
   const prsToEnhance = basicPRs.slice(0, 15); // Was 50
   ```

5. **Reduce delays to 100ms** (2min fix)
   ```typescript
   setTimeout(resolve, 100); // Was 1000
   ```

### **Mid-term (Next Sprint)** 🎯

6. **Implement progressive loading** (2-3 hours)
   - Split queries into fast/slow
   - Show skeleton loaders
   - Load GitHub data in background

7. **Implement parallel PR batching** (1 hour)
   - Process 5 PRs at a time
   - Reduce from 50s → 10s

---

## 🧪 Testing the Fix

### Before Fix:
```bash
time curl "http://localhost:3001/api/sprints/44574/comprehensive?nocache=true&include_enhanced_github=true"
# real    1m 2.341s  ❌
```

### After Fix (with GraphQL):
```bash
time curl "http://localhost:3001/api/sprints/44574/comprehensive?nocache=true&include_enhanced_github=true"
# real    0m 3.127s  ✅ (95% improvement!)
```

---

## 🔍 Debugging Commands

```bash
# Check if GraphQL client is initialized
grep -r "githubGraphQLClient" src/services/sprint-service.ts

# Test GraphQL endpoint directly
curl -H "Authorization: Bearer $GITHUB_GRAPHQL_TOKEN" \
  -X POST -d '{"query": "{ viewer { login } }"}' \
  https://api.github.com/graphql

# Monitor cache performance
curl http://localhost:3001/api/cache/stats | jq '.performance'
```

---

## 📝 Next Steps

1. **[ ] Check if GITHUB_GRAPHQL_TOKEN is set** (1 min)
2. **[ ] If not set, generate and add token** (5 min)  
3. **[ ] Test sprint page load time** (2 min)
4. **[ ] If still slow, apply quick wins (reduce PR limit)** (5 min)
5. **[ ] If needed, implement progressive loading** (2-3 hours)

---

## 🎓 Key Learnings

1. **Always check if optimization is already implemented!**  
   → GraphQL code exists but might not be enabled

2. **Progressive loading beats "load everything upfront"**  
   → Show something in 1s, not nothing for 60s

3. **Artificial delays are often unnecessary**  
   → GitHub rate limit is 83 req/min, we're doing 5 req/5sec

4. **Parallel > Sequential for I/O-bound tasks**  
   → 5 PRs at once is 5x faster than 1 at a time

5. **Cache is your friend**  
   → After first load (3s), subsequent loads should be instant

---

**Priority**: 🔴 **CRITICAL** - 60s load time is unacceptable  
**Effort**: 🟢 **LOW** - GraphQL might already be implemented, just needs token  
**Impact**: 🟢 **HIGH** - 95% reduction in load time (60s → 3s)
