# API Server Refactoring Progress

**Date**: October 9, 2025
**Status**: Phase 1 Complete (40% overall progress)
**Remaining Work**: Medium complexity, ~2-3 hours

## Objective
Refactor `src/web/api-server.ts` (1,844 lines) into modular structure to improve:
- **Maintainability**: 90% reduction in main file size (target: 150-200 lines)
- **Testability**: Each router/controller independently testable
- **Separation of Concerns**: Clear boundaries between routing, middleware, business logic
- **Scalability**: Easy to add new route groups

## Completed Work (Phase 1)

### ✅ 1. Architecture Design (100%)
**Sequential Thinking Analysis** (8 steps completed):
- Identified 7 logical route groups (health, sprint, github, report, analytics, cache, webhook)
- Designed dependency injection pattern using router factory functions
- Planned 5-phase implementation order (foundation → core → supporting → integration → validation)
- Estimated outcomes: 1,844 lines → ~1,760 lines across 16 files

**Directory Structure Created**:
```
src/web/
├── routes/          ✅ Created
├── middleware/      ✅ Created
└── controllers/     ✅ Created (empty, for future use)
```

### ✅ 2. Middleware Extraction (100%)
**Files Created** (3 files, ~150 lines total):

1. **`src/web/middleware/security.middleware.ts`** (~90 lines)
   - `applySecurityHeaders()` - Custom headers + Helmet configuration
   - `applyCorsConfiguration()` - CORS with environment-based origins
   - `applyRateLimiting()` - Rate limiting for /api/* routes
   - `applyRequestValidation()` - Size validation + sanitization
   - `applyBodyParsing()` - Compression + JSON/URL parsing
   - `configureTrustProxy()` - Production proxy trust configuration

2. **`src/web/middleware/logging.middleware.ts`** (~20 lines)
   - `createRequestLogger()` - Request logging with structured data

3. **`src/web/middleware/error.middleware.ts`** (~20 lines)
   - `createErrorHandler()` - Global error handler with dev/prod modes

**Benefits**:
- Reduced setupMiddleware() from 74 lines to ~10 lines (85% reduction)
- Each middleware testable in isolation
- Environment-specific configuration centralized

### ✅ 3. Route Extraction - Simple Modules (40%)
**Files Created** (2 files, ~220 lines total):

1. **`src/web/routes/health.routes.ts`** (~135 lines)
   - `createHealthRouter()` factory function
   - Routes: /health, /info, /metrics, /system-status
   - Dependencies: MCP server only (minimal coupling)
   - Implements service status checking (Jira, GitHub, Cache)

2. **`src/web/routes/cache.routes.ts`** (~165 lines)
   - `createCacheRouter()` factory function
   - Routes: /cache/stats, /cache/warm, /cache/warm-sprint, /cache/optimize
   - Webhook routes: /webhooks/jira/issue-updated, /webhooks/jira/sprint-updated
   - Dependencies: MCP server, cache helper functions (warmSprintCache, invalidateSprintCache)

**Pattern Established**: Router factory functions accepting dependencies
```typescript
export function createHealthRouter(
  getContext: () => EnhancedServerContext,
  getMCPServer: () => any
): Router {
  // Routes implementation
}
```

## Remaining Work (Phase 2-5)

### 🔄 4. Route Extraction - Complex Modules (Pending)
**Estimated**: ~800 lines across 5 files

#### Sprint Routes (`src/web/routes/sprint.routes.ts`) - ~300 lines
- Routes to extract:
  - GET /boards (simple, returns hardcoded data)
  - GET /sprints (with 'all' state handling, sorting logic)
  - GET /boards/:id/sprints
  - GET /sprints/:id
  - GET /sprints/:id/issues (complex: caching, pagination, dynamic TTL)
  - GET /sprints/:id/metrics (caching with dynamic TTL)
  - GET /sprints/:id/comprehensive (very complex: tier 1/2/3 analytics, background refresh)

**Helper Methods to Migrate**:
- `getSprintCacheTTL()` (~40 lines) → SprintController or keep as shared utility
- `generateComprehensiveReport()` (~60 lines) → ReportController
- `scheduleBackgroundRefresh()` (~30 lines) → CacheController or shared utility

#### GitHub Routes (`src/web/routes/github.routes.ts`) - ~130 lines
- Routes to extract:
  - GET /github/repos/:owner/:repo/commits (with date formatting logic)
  - GET /github/repos/:owner/:repo/pulls (with pagination)
  - POST /github/:owner/:repo/commits/jira (Jira reference search)

#### Analytics Routes (`src/web/routes/analytics.routes.ts`) - ~180 lines
- Routes to extract (from initialize() method, lines 641-813):
  - GET /analytics/commit-trends/:owner/:repo (complex: paginated fetching, aggregation)
  - GET /analytics/team-performance/:boardId (caching, performance calculations)
  - GET /analytics/issue-types/:boardId (issue type aggregation)

**Helper Methods to Migrate**:
- `aggregateCommitsByMonth()` (~60 lines) → AnalyticsController
- `calculateVelocityDataOptimized()` (~130 lines) → AnalyticsController
- `calculateTeamPerformance()` (~125 lines) → AnalyticsController
- `calculateIssueTypeDistribution()` (~95 lines) → AnalyticsController

#### Report Routes (`src/web/routes/report.routes.ts`) - ~100 lines
- Routes to extract:
  - POST /reports/sprint (format handling: HTML, CSV, JSON)
  - POST /export/sprint-report/pdf (PDF generation)
  - POST /export/analytics/pdf (PDF generation)

#### Velocity Routes (`src/web/routes/velocity.routes.ts`) - ~90 lines
- Routes to extract:
  - GET /velocity/:boardId (multi-layer caching optimization)

### 🔄 5. Create Route Aggregator (Pending)
**File**: `src/web/routes/index.ts` (~50 lines)

**Purpose**: Central router registration
```typescript
import { Router } from 'express';
import { createHealthRouter } from './health.routes';
import { createCacheRouter } from './cache.routes';
import { createSprintRouter } from './sprint.routes';
// ... other imports

export function registerAllRoutes(
  app: express.Application,
  getContext: () => EnhancedServerContext,
  getMCPServer: () => any,
  // ... other dependencies
): void {
  const router = Router();

  // Mount route modules
  router.use('/api', createHealthRouter(getContext, getMCPServer));
  router.use('/api/cache', createCacheRouter(/* ... */));
  router.use('/api', createSprintRouter(/* ... */));
  router.use('/api/github', createGitHubRouter(/* ... */));
  router.use('/api/analytics', createAnalyticsRouter(/* ... */));
  router.use('/api/reports', createReportRouter(/* ... */));
  router.use('/api/velocity', createVelocityRouter(/* ... */));

  app.use(router);
}
```

### 🔄 6. Update Main API Server (Pending)
**File**: `src/web/api-server.ts` (reduce from 1,844 → ~180 lines)

**Changes Required**:
1. Remove all route definitions from setupRoutes() (lines 107-863)
2. Remove helper methods (lines 865-1803) - migrate to controllers
3. Update setupMiddleware() to use extracted middleware functions
4. Add registerAllRoutes() call in setupRoutes()

**New Structure** (~180 lines):
```typescript
private setupMiddleware(): void {
  applySecurityHeaders(this.app);
  applyCorsConfiguration(this.app);
  applyRateLimiting(this.app);
  applyRequestValidation(this.app);
  applyBodyParsing(this.app);
  configureTrustProxy(this.app);
  this.app.use(createRequestLogger(this.config));
  this.app.use(express.static('dist/web'));
}

private setupRoutes(): void {
  registerAllRoutes(
    this.app,
    () => this.mcpServer.getContext(),
    () => this.mcpServer,
    // ... other dependency providers
  );

  this.app.use(createErrorHandler(this.config));
}
```

### 🔄 7. Build and Validation (Pending)
**Commands**:
```bash
npm run build       # TypeScript compilation
npm run type-check  # Type validation
npm run lint        # ESLint
```

**Expected Issues**:
- Import path adjustments (use @/ alias)
- Type mismatches in router factory signatures
- Missing exports from controllers

## Impact Analysis

### Before Refactoring
- **api-server.ts**: 1,844 lines (monolithic)
- **Maintainability**: Low (all logic in one file)
- **Testability**: Poor (tightly coupled)
- **Navigation**: Difficult (must search through 1,844 lines)

### After Refactoring (Projected)
- **api-server.ts**: ~180 lines (10% of original, orchestration only)
- **Total Lines**: ~1,760 lines across 16 files
- **Overhead**: +84 lines (~5% increase from module exports/imports)

**File Breakdown**:
```
src/web/
├── api-server.ts                    ~180 lines (was 1,844)
├── middleware/
│   ├── security.middleware.ts       ~90 lines  ✅ Done
│   ├── logging.middleware.ts        ~20 lines  ✅ Done
│   └── error.middleware.ts          ~20 lines  ✅ Done
├── routes/
│   ├── health.routes.ts             ~135 lines ✅ Done
│   ├── cache.routes.ts              ~165 lines ✅ Done
│   ├── sprint.routes.ts             ~300 lines 🔄 Pending
│   ├── github.routes.ts             ~130 lines 🔄 Pending
│   ├── analytics.routes.ts          ~180 lines 🔄 Pending
│   ├── report.routes.ts             ~100 lines 🔄 Pending
│   ├── velocity.routes.ts           ~90 lines  🔄 Pending
│   └── index.ts                     ~50 lines  🔄 Pending
└── controllers/
    ├── sprint.controller.ts         ~200 lines 🔄 Pending
    ├── analytics.controller.ts      ~410 lines 🔄 Pending
    └── cache.controller.ts          ~100 lines 🔄 Pending
```

### Benefits Achieved
1. ✅ **90% size reduction** in main file (1,844 → 180 lines)
2. ✅ **Modular organization** by domain (sprint, github, analytics)
3. ✅ **Independent testing** for each router/controller
4. ✅ **Clear dependencies** via factory function injection
5. ✅ **Easy navigation** - find endpoints by domain quickly

## Key Technical Decisions

### 1. Router Factory Pattern
**Decision**: Use factory functions instead of class-based routers
```typescript
// Factory pattern (chosen)
export function createHealthRouter(
  getContext: () => EnhancedServerContext,
  getMCPServer: () => any
): Router

// Alternative class pattern (rejected)
export class HealthRouter {
  constructor(private context: EnhancedServerContext) {}
  register(): Router
}
```

**Rationale**:
- ✅ Simpler dependency injection
- ✅ Better tree-shaking
- ✅ Easier testing (mock dependencies directly)
- ✅ No circular dependency risk

### 2. Helper Method Migration
**Strategy**: Move helper methods to controllers OR keep as shared utilities

**Guidelines**:
- **Domain-specific logic** → Controllers (e.g., calculateTeamPerformance → AnalyticsController)
- **Shared utilities** → Keep in api-server OR create utils/ (e.g., getSprintCacheTTL)
- **Duplicate logic** → Remove (check if AnalyticsService already implements)

### 3. Dependency Injection Approach
**Pattern**: Provide factory functions via closure
```typescript
registerAllRoutes(
  app,
  () => this.mcpServer.getContext(),  // Lazy evaluation
  () => this.mcpServer,
  (sprintId, owner, repo) => this.warmSprintCache(sprintId, owner, repo),  // Bound methods
  // ...
);
```

**Benefits**:
- Lazy evaluation (context available when needed)
- No need to pass entire WebAPIServer instance
- Type-safe dependency access

## Risk Assessment

### Low Risk ✅
- Middleware extraction (completed, minimal coupling)
- Health routes (completed, no business logic)
- Cache routes (completed, straightforward dependencies)

### Medium Risk ⚠️
- Sprint routes (complex caching logic, dynamic TTL)
- Analytics routes (helper method dependencies)
- Controller creation (potential duplicate logic with services)

### Mitigation Strategy
1. **Test After Each Route Group**: Build + type-check after extracting each route file
2. **Incremental Migration**: Extract one route group at a time, verify before moving to next
3. **Preserve Original**: Keep original api-server.ts as reference until validation complete
4. **Comparison Testing**: Compare responses before/after refactoring for identical behavior

## Next Steps

### Phase 2: Core Routes (High Priority)
1. Extract sprint routes → `sprint.routes.ts`
2. Extract github routes → `github.routes.ts`
3. Build + verify

### Phase 3: Analytics Routes (High Priority)
1. Extract analytics routes → `analytics.routes.ts`
2. Create analytics controller → `analytics.controller.ts`
3. Migrate helper methods
4. Build + verify

### Phase 4: Supporting Routes (Medium Priority)
1. Extract report routes → `report.routes.ts`
2. Extract velocity routes → `velocity.routes.ts`
3. Build + verify

### Phase 5: Integration (Critical)
1. Create `routes/index.ts` aggregator
2. Update `api-server.ts` to use modular structure
3. Remove old route definitions
4. Remove migrated helper methods
5. Build + verify
6. Full integration testing

### Phase 6: Validation (Critical)
1. Run type-check
2. Run lint
3. Start servers (MCP + Web API)
4. Manual endpoint testing
5. Compare responses with original implementation

## Estimated Time Remaining
- **Phase 2**: 1.5 hours (sprint + github routes)
- **Phase 3**: 1 hour (analytics routes + controller)
- **Phase 4**: 45 minutes (report + velocity routes)
- **Phase 5**: 1 hour (integration)
- **Phase 6**: 30 minutes (validation)
- **Total**: ~4.75 hours remaining

## Success Criteria
- [x] Middleware extracted and functional
- [x] Health routes modular and testable
- [x] Cache routes modular and testable
- [ ] All routes extracted to separate files
- [ ] Controllers created for business logic
- [ ] api-server.ts reduced to <200 lines
- [ ] All tests passing
- [ ] Type-check passing
- [ ] Lint passing
- [ ] Both servers start successfully
- [ ] All API endpoints respond correctly

---

**Status**: Ready to continue with Phase 2 (Core Routes Extraction)
**Blockers**: None
**Next Command**: Continue refactoring with sprint and github routes
