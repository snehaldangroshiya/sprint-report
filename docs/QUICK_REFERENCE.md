# NextReleaseMCP Quick Reference

**Last Updated**: October 3, 2025

## 🚀 Quick Start

```bash
# Start development servers
npm run dev:web          # MCP + Web API (port 3000)
cd web && npm run dev    # Web UI (port 3002)

# Production mode
npm run build && npm run start:web
cd web && npm run build
```

## 🌐 Application URLs

- **Web UI**: http://localhost:3002
- **API Server**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health
- **Metrics**: http://localhost:3000/api/metrics

## 📊 Page Overview

| Page | URL | Purpose | Data Source |
|------|-----|---------|-------------|
| Dashboard | `/` | Recent sprint activity, active + closed sprints | Jira |
| Analytics | `/analytics` | 4 widgets: velocity, team, GitHub, issue types | Jira + GitHub |
| Report Generator | `/report-generator` | Create sprint reports in HTML/MD/JSON | Jira + GitHub |
| Velocity | `/velocity` | Sprint velocity trends and charts | Jira |
| GitHub | `/github` | GitHub commits and PRs | GitHub |
| Tools Status | `/tools` | MCP tools and system health | System |

## 🔑 Sprint Sorting Policy

**Global Rule**: Start Date Descending (Newest → Oldest)

```typescript
// Utility function (use everywhere)
import { sortSprintsByStartDate } from '@/lib/sprint-utils';

const sorted = sortSprintsByStartDate(sprints);
```

**Active vs Closed**:
- Dashboard: Shows both (for current status)
- All others: Closed only (for reporting)

## 💾 Cache Management

### Redis Commands

```bash
# Check Redis is running
redis-cli ping

# View cached data
redis-cli KEYS "velocity:*"
redis-cli KEYS "team-performance:*"
redis-cli KEYS "issue-types:*"

# Clear board 6306 cache
redis-cli --scan --pattern "*6306*" | xargs redis-cli DEL

# Clear all cache
redis-cli FLUSHDB

# Verify cache cleared
redis-cli --scan --pattern "*6306*" | wc -l  # Should be 0
```

### Cache TTL Settings

| Data Type | TTL | Key Pattern |
|-----------|-----|-------------|
| Closed Sprints | 30 min | `sprints:closed:*` |
| Velocity | 30 min | `velocity:*` |
| Team Performance | 5 min | `team-performance:*` |
| Issue Types | 10 min | `issue-types:*` |
| Active Sprints | 1 min | `sprints:active:*` |

## ⚙️ Environment Variables

### Required (Jira)
```bash
JIRA_BASE_URL=https://jira.sage.com
JIRA_API_TOKEN=your_bearer_token
JIRA_EMAIL=your.email@company.com
```

### Optional (GitHub - for Code Activity widget)
```bash
# Backend
GITHUB_TOKEN=ghp_your_token

# Frontend (web/.env)
VITE_GITHUB_OWNER=your-org
VITE_GITHUB_REPO=your-repo
```

### Optional (Redis)
```bash
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 🔧 Common Operations

### Build & Deploy
```bash
# Build everything
npm run build && cd web && npm run build

# Type check
npm run type-check

# Lint
npm run lint
```

### Troubleshooting

**Changes not appearing?**
```bash
# Clear cache
redis-cli --scan --pattern "*6306*" | xargs redis-cli DEL

# Rebuild
npm run build
cd web && npm run build
```

**Health check errors?**
```bash
# Check services
redis-cli ping                    # Redis
curl http://localhost:3000/api/health  # API
```

**Wrong sprint order?**
1. Check API sorts before slice (lines 280, 345, 411)
2. Clear Redis cache
3. Verify utility import: `import { sortSprintsByStartDate } from '@/lib/sprint-utils'`

## 📝 API Endpoints

### Sprint Data
```bash
GET /api/boards                          # List boards
GET /api/sprints/:boardId/:state         # Get sprints (active/closed)
GET /api/sprints/:sprintId/issues        # Sprint issues
```

### Analytics
```bash
GET /api/analytics/velocity/:boardId?sprints=6           # Velocity data
GET /api/analytics/team-performance/:boardId?sprints=6   # Team metrics
GET /api/analytics/issue-types/:boardId?sprints=6        # Issue distribution
```

### Reports
```bash
POST /api/reports/sprint                 # Generate sprint report
GET /api/metrics                         # Performance metrics
GET /api/health                          # System health
```

### GitHub
```bash
GET /api/github/commits/:owner/:repo     # Get commits
GET /api/github/prs/:owner/:repo         # Get PRs
```

## 🐛 Common Issues & Solutions

### Issue: Analytics shows wrong sprints
**Solution**:
```bash
redis-cli --scan --pattern "*6306*" | xargs redis-cli DEL
```

### Issue: Code Activity widget empty
**Solution**: Configure GitHub env vars in `web/.env`
```bash
VITE_GITHUB_OWNER=your-org
VITE_GITHUB_REPO=your-repo
```

### Issue: GitHub health check errors
**Solution**: Fixed in v2.1.1 - uses octocat/hello-world repo

### Issue: Sprint order inconsistent
**Solution**: Import and use centralized sorting utility
```typescript
import { sortSprintsByStartDate } from '@/lib/sprint-utils';
```

## 📊 Widget Status (Analytics Page)

| Widget | Status | API Endpoint | Notes |
|--------|--------|--------------|-------|
| Sprint Velocity Trend | ✅ | `/api/analytics/velocity` | Sorted correctly |
| Team Performance | ✅ | `/api/analytics/team-performance` | By assignee |
| Code Activity Trends | ⚠️ Optional | GitHub API | Needs env config |
| Issue Type Distribution | ✅ | `/api/analytics/issue-types` | Real data |

## 🔗 Key Files

### Frontend
- `web/src/pages/Dashboard.tsx` - Main dashboard
- `web/src/pages/Analytics.tsx` - Analytics widgets
- `web/src/pages/ReportGenerator.tsx` - Report creation
- `web/src/lib/sprint-utils.ts` - **Sorting utilities**
- `web/src/lib/api.ts` - API client

### Backend
- `src/web/api-server.ts` - Main API server
- `src/server/enhanced-mcp-server.ts` - MCP server
- `src/clients/jira-client.ts` - Jira integration
- `src/clients/github-client.ts` - GitHub integration
- `src/cache/cache-manager.ts` - Cache logic

### Configuration
- `.env` - Backend environment variables
- `web/.env` - Frontend environment variables
- `tsconfig.json` - TypeScript config
- `package.json` - Dependencies and scripts

## 📚 Documentation

### User Guides
- [QUICKSTART.md](../QUICKSTART.md) - 5-minute setup
- [USAGE_GUIDE.md](../USAGE_GUIDE.md) - Complete usage
- [WEB_INTEGRATION_GUIDE.md](../WEB_INTEGRATION_GUIDE.md) - Web integration

### Technical Guides
- [SPRINT_SORTING_POLICY.md](./SPRINT_SORTING_POLICY.md) - Sorting standards
- [CACHE_MANAGEMENT.md](./CACHE_MANAGEMENT.md) - Cache operations
- [ANALYTICS_PAGE_IMPROVEMENTS.md](./ANALYTICS_PAGE_IMPROVEMENTS.md) - Analytics enhancements
- [REDIS_CACHE_ARCHITECTURE.md](./REDIS_CACHE_ARCHITECTURE.md) - Redis optimization

### Architecture
- [CLAUDE_ARCHITECTURE.md](../.claude/CLAUDE_ARCHITECTURE.md) - System architecture
- [CLAUDE_INTEGRATIONS.md](../.claude/CLAUDE_INTEGRATIONS.md) - Integrations
- [CLAUDE_OPERATIONS.md](../.claude/CLAUDE_OPERATIONS.md) - Operations
- [CLAUDE_TROUBLESHOOTING.md](../.claude/CLAUDE_TROUBLESHOOTING.md) - Troubleshooting

## 🎯 Current Production Status

- **Board**: 6306 (Sage Connect)
- **Active Sprint**: SCNT-2026-1
- **Last Sprint**: SCNT-2025-26
- **System**: ✅ Healthy
- **Cache**: Redis (localhost:6379)

## 💡 Pro Tips

1. **Always sort before slice** in API endpoints
2. **Clear cache** after sprint sorting changes
3. **Use utilities** for consistent behavior
4. **Environment variables** with VITE_ prefix for frontend
5. **Health checks** should use real public repos
6. **Batch Redis operations** with pipeline for performance
7. **Monitor cache hit rate** (target > 70%)

---

**Quick Access**: Bookmark this page for instant reference during development!
