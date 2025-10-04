# NextReleaseMCP - Project Overview

## 🎯 Project Purpose

NextReleaseMCP is an **MCP (Model Context Protocol) server** that integrates Jira and GitHub to generate comprehensive sprint reports. It provides both a **backend API server** and a **web-based UI** for sprint tracking, metrics analysis, and automated report generation.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│  ┌──────────────────┐              ┌────────────────────────────┐  │
│  │  MCP Client      │              │  Web Application           │  │
│  │  (Claude Desktop)│              │  (React + TypeScript)      │  │
│  │  Port: stdio     │              │  Port: 3002                │  │
│  └──────────────────┘              └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                    │                            │
                    └────────────┬───────────────┘
                                 │
┌─────────────────────────────────────────────────────────────────────┐
│                       SERVER LAYER                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Enhanced MCP Server + Express API                           │  │
│  │  Port: 3000                                                  │  │
│  │  - MCP Tools (jira, github, report generation)              │  │
│  │  - REST API (/api/sprints, /api/reports, /api/github)       │  │
│  │  - Performance Monitoring & Cache Optimization              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                    │                            │
        ┌───────────┴──────────┐    ┌───────────┴──────────┐
        │                      │    │                       │
┌───────▼────────┐    ┌────────▼────────┐    ┌────────────▼────────┐
│ Jira Server    │    │  GitHub API     │    │  Cache & Storage    │
│ API v2         │    │  REST API       │    │  In-Memory + Redis  │
│ sage.com       │    │  api.github.com │    │                     │
└────────────────┘    └─────────────────┘    └─────────────────────┘
```

## 📂 Project Structure

```
NextReleaseMCP/
├── src/
│   ├── server/              # MCP Server core
│   │   ├── enhanced-mcp-server.ts    # Main MCP server with monitoring
│   │   ├── mcp-server.ts             # Legacy MCP server
│   │   └── tool-registry.ts          # Tool registration & execution
│   │
│   ├── web/                 # Web API server
│   │   └── api-server.ts             # Express server with REST endpoints
│   │
│   ├── clients/             # External API clients
│   │   ├── base-client.ts            # Base HTTP client with retry logic
│   │   ├── jira-client.ts            # Jira Server API v2 client
│   │   └── github-client.ts          # GitHub REST API client
│   │
│   ├── tools/               # MCP tools
│   │   ├── jira-tools.ts             # Jira operations (sprints, issues)
│   │   ├── github-tools.ts           # GitHub operations (commits, PRs)
│   │   └── report-tools.ts           # Report generation
│   │
│   ├── cache/               # Caching layer
│   │   ├── cache-manager.ts          # Multi-tier cache (memory/Redis)
│   │   └── cache-optimizer.ts        # Intelligent cache optimization
│   │
│   ├── performance/         # Monitoring & metrics
│   │   └── performance-monitor.ts    # Real-time performance tracking
│   │
│   ├── reporting/           # Report generation
│   │   ├── report-generator.ts       # Main report generator
│   │   ├── formatter.ts              # Format converters (HTML/MD/JSON)
│   │   └── templates/                # Report templates
│   │
│   ├── services/            # Business logic
│   │   ├── sprint-service.ts         # Sprint data aggregation
│   │   ├── analytics-service.ts      # Metrics & analytics
│   │   └── export-service.ts         # Export to various formats
│   │
│   ├── utils/               # Utilities
│   │   ├── logger.ts                 # Structured logging
│   │   ├── errors.ts                 # Error handling
│   │   ├── validation.ts             # Request validation
│   │   ├── rate-limiter.ts           # Rate limiting
│   │   └── error-recovery.ts         # Automatic retry logic
│   │
│   ├── middleware/          # Express middleware
│   │   └── validation.ts             # Security & validation
│   │
│   ├── config/              # Configuration
│   │   └── environment.ts            # Environment config & validation
│   │
│   ├── server.ts            # MCP server entry point
│   └── web-server.ts        # Web API server entry point
│
├── web/                     # React web application
│   ├── src/
│   │   ├── pages/                    # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ReportGenerator.tsx
│   │   │   ├── ReportViewer.tsx
│   │   │   └── Analytics.tsx
│   │   ├── components/               # Reusable components
│   │   ├── lib/
│   │   │   └── api.ts                # API client
│   │   └── main.tsx                  # App entry point
│   └── package.json
│
├── docs/                    # Documentation
│   └── *.md
│
└── .claude/                 # Claude-specific docs
    ├── architecture/        # See CLAUDE_ARCHITECTURE.md
    ├── integrations/        # See CLAUDE_INTEGRATIONS.md
    ├── operations/          # See CLAUDE_OPERATIONS.md
    └── troubleshooting/     # See CLAUDE_TROUBLESHOOTING.md
```

## 🔑 Key Components

### 1. Enhanced MCP Server
- **Location**: `src/server/enhanced-mcp-server.ts`
- **Purpose**: Core MCP server with monitoring and optimization
- **Features**:
  - Tool registration and execution
  - Performance monitoring
  - Cache optimization
  - Health monitoring
  - Error recovery

### 2. Web API Server
- **Location**: `src/web/api-server.ts`
- **Purpose**: REST API for web application
- **Port**: 3000
- **Features**:
  - Sprint management endpoints
  - Report generation API
  - GitHub integration
  - CORS enabled for web UI

### 3. Jira Client
- **Location**: `src/clients/jira-client.ts`
- **API**: Jira Server API v2
- **Authentication**: Bearer Token
- **Features**:
  - Sprint data retrieval
  - Issue fetching with pagination
  - JQL search support
  - Health checks

### 4. GitHub Client
- **Location**: `src/clients/github-client.ts`
- **API**: GitHub REST API v3
- **Authentication**: Personal Access Token
- **Features**:
  - Commit history
  - Pull request data
  - Rate limit handling

### 5. Report Generator
- **Location**: `src/reporting/report-generator.ts`
- **Formats**: HTML, Markdown, JSON
- **Templates**: Executive, Detailed, Technical
- **Features**:
  - Sprint metrics
  - Issue breakdown
  - GitHub integration
  - Customizable templates

## 🔧 Configuration

### Environment Variables
```bash
# Jira Configuration (REQUIRED)
JIRA_BASE_URL=https://jira.sage.com
JIRA_API_TOKEN=your_bearer_token
JIRA_EMAIL=your.email@company.com

# GitHub Configuration (REQUIRED)
GITHUB_TOKEN=ghp_your_token

# Server Configuration (OPTIONAL)
MCP_SERVER_PORT=3000
NODE_ENV=development

# Cache Configuration (OPTIONAL)
MEMORY_CACHE_MAX_SIZE=100
MEMORY_CACHE_TTL=300
```

### Critical Configuration Notes

1. **Jira Server vs Jira Cloud**:
   - This project uses **Jira Server API v2** (not Cloud API v3)
   - Authentication: Bearer Token (not Basic Auth)
   - Endpoint: `/rest/api/2/` (not `/rest/api/3/`)

2. **CORS Configuration**:
   - Allowed origins: `localhost:3000`, `3001`, `3002`, `5173`
   - Location: `src/web/api-server.ts:56`

3. **Path Aliases**:
   - Uses `@/` for imports
   - Configured in `tsconfig.json` and `package.json`
   - Production build uses `module-alias` package

## 🚀 Quick Start

### 1. Installation
```bash
npm install
cd web && npm install
```

### 2. Configuration
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Start Servers

**Option A: Development Mode (Recommended)**
```bash
# Terminal 1: MCP + Web API Server
npm run dev:web

# Terminal 2: Web Application
cd web && npm run dev
```

**Option B: Separate Servers**
```bash
# Terminal 1: MCP Server only
npm run dev

# Terminal 2: Web API Server
npm run dev:web

# Terminal 3: Web Application
cd web && npm run dev
```

### 4. Access
- Web UI: http://localhost:3002
- API: http://localhost:3000/api
- Health: http://localhost:3000/api/health

## 📊 Current Status

### Production Environment
- **Board ID**: 6306 (Sage Connect)
- **Active Sprint**: SCNT-2025-26 (ID: 44298)
- **Period**: Sept 17 - Oct 1, 2025
- **Issues**: 121 total (93 done, 77% complete)
- **Story Points**: 207 total (147 done, 71% velocity)

### System Health
```
✅ MCP Server:      http://localhost:3000    (Healthy)
✅ Web Application: http://localhost:3002    (Running)
✅ Jira Connection: 184ms response time      (Healthy)
✅ GitHub Connection: 368ms response time    (Healthy)
✅ Cache Service:   1ms response time        (Healthy)
```

## 📚 Documentation Index

### Quick Start & Reference
- **[docs/QUICK_REFERENCE.md](./docs/QUICK_REFERENCE.md)** - ⚡ Quick reference card for common operations
- **[docs/QUICKSTART.md](./docs/QUICKSTART.md)** - 5-minute setup guide
- **[docs/USAGE_GUIDE.md](./docs/USAGE_GUIDE.md)** - Complete usage instructions
- **[docs/WEB_INTEGRATION_GUIDE.md](./docs/WEB_INTEGRATION_GUIDE.md)** - Web app integration
- **[docs/API_WORKING_EXAMPLES.md](./docs/API_WORKING_EXAMPLES.md)** - API examples with real data

### Feature Documentation
- **[.claude/CLAUDE_COMPREHENSIVE_ANALYTICS.md](./.claude/CLAUDE_COMPREHENSIVE_ANALYTICS.md)** - 🆕 ⭐ Complete guide to Tier 1, 2, 3 analytics metrics

### VSCode MCP Integration (CRITICAL)
- **[docs/VSCODE_MCP_TROUBLESHOOTING.md](./docs/VSCODE_MCP_TROUBLESHOOTING.md)** - ⚠️ VSCode MCP setup and debugging
- **[docs/RECOMMENDATION.md](./docs/RECOMMENDATION.md)** - Server mode comparison and recommendations
- **[docs/SERVER_MODES.md](./docs/SERVER_MODES.md)** - Detailed server mode documentation
- **[docs/VSCODE_MCP_SETUP.md](./docs/VSCODE_MCP_SETUP.md)** - VSCode MCP setup guide
- **[.claude/CLAUDE_LOGGER.md](./.claude/CLAUDE_LOGGER.md)** - Critical logging architecture for stdio mode

### Technical Documentation
- **[CLAUDE_ARCHITECTURE.md](./.claude/CLAUDE_ARCHITECTURE.md)** - System architecture
- **[CLAUDE_INTEGRATIONS.md](./.claude/CLAUDE_INTEGRATIONS.md)** - Integration details
- **[CLAUDE_OPERATIONS.md](./.claude/CLAUDE_OPERATIONS.md)** - Operations guide
- **[CLAUDE_TROUBLESHOOTING.md](./.claude/CLAUDE_TROUBLESHOOTING.md)** - Common issues

### Component Documentation (October 2-3, 2025)
- **[docs/CLAUDE_WEB_UI.md](./docs/CLAUDE_WEB_UI.md)** - ⭐ Complete web UI architecture and shadcn/ui integration
- **[docs/README_SHADCN.md](./docs/README_SHADCN.md)** - shadcn/ui component library integration
- **[docs/REDIS_CACHE_ARCHITECTURE.md](./docs/REDIS_CACHE_ARCHITECTURE.md)** - ⭐ Redis optimization and performance guide
- **[docs/SPRINT_SORTING_POLICY.md](./docs/SPRINT_SORTING_POLICY.md)** - 🆕 Global sprint sorting and display policy
- **[docs/CACHE_MANAGEMENT.md](./docs/CACHE_MANAGEMENT.md)** - 🆕 Cache management, Redis operations, troubleshooting
- **[docs/ANALYTICS_PAGE_IMPROVEMENTS.md](./docs/ANALYTICS_PAGE_IMPROVEMENTS.md)** - 🆕 Analytics page enhancements and real data integration

### Historical Documentation & Optimization Reports
- **[docs/OCTOBER_3_2025_IMPROVEMENTS.md](./docs/OCTOBER_3_2025_IMPROVEMENTS.md)** - 🆕 Sprint sorting & analytics improvements
- **[docs/PERFORMANCE_IMPROVEMENTS_OCT2025.md](./docs/PERFORMANCE_IMPROVEMENTS_OCT2025.md)** - Performance optimization summary
- **[docs/JIRA_FIX_SUMMARY.md](./docs/JIRA_FIX_SUMMARY.md)** - Jira Server authentication fix
- **[docs/INTEGRATION_COMPLETE.md](./docs/INTEGRATION_COMPLETE.md)** - Integration completion summary
- **[docs/IMPLEMENTATION_SUMMARY.md](./docs/IMPLEMENTATION_SUMMARY.md)** - Implementation summary
- **[docs/REDIS_KEYS_FIX.md](./docs/REDIS_KEYS_FIX.md)** - KEYS to SCAN migration
- **[docs/REDIS_PIPELINING.md](./docs/REDIS_PIPELINING.md)** - Pipeline implementation
- **[docs/REDIS_OPTIMIZATION_SUMMARY.md](./docs/REDIS_OPTIMIZATION_SUMMARY.md)** - Overall Redis improvements
- **[docs/VELOCITY_PERFORMANCE_OPTIMIZATION.md](./docs/VELOCITY_PERFORMANCE_OPTIMIZATION.md)** - Velocity calculation optimization
- **[docs/API_SERVER_BUG_FIX.md](./docs/API_SERVER_BUG_FIX.md)** - TypeScript type fixes
- **[docs/WEB_CLEANUP_JS_DUPLICATES.md](./docs/WEB_CLEANUP_JS_DUPLICATES.md)** - JavaScript file cleanup

## 🔍 Key Features

### Sprint Management
- ✅ Fetch sprints by board ID and state
- ✅ Get detailed sprint information
- ✅ Retrieve all issues with full metadata
- ✅ Calculate sprint metrics (velocity, completion rate)

### Report Generation
- ✅ Multiple formats: HTML, Markdown, JSON
- ✅ Three templates: Executive, Detailed, Technical
- ✅ GitHub integration (commits & PRs)
- ✅ Download and export functionality
- ✅ Real-time data from Jira

### Comprehensive Analytics (NEW in v2.2.0)
- ✅ **Next Sprint Planning**: Velocity forecasting with confidence levels, carryover analysis with recommendations
- ✅ **GitHub Metrics**: Commit activity tracking, PR stats with merge rates, code change analysis, review quality metrics
- ✅ **Team & Quality**: Capacity utilization, bug trend analysis, cycle time metrics, blocker tracking
- ✅ **Technical Health**: Epic progress monitoring, technical debt tracking, risk assessment with impact analysis
- ✅ **Interactive UI**: 4-tab interface with color-coded indicators and gradient cards for visual hierarchy

### Performance & Monitoring
- ✅ Multi-tier caching (memory + optional Redis)
- ✅ Real-time performance monitoring
- ✅ Automatic cache optimization
- ✅ Health check endpoints
- ✅ Rate limiting and throttling

### Error Handling
- ✅ Automatic retry with exponential backoff
- ✅ Graceful degradation
- ✅ Detailed error logging
- ✅ Circuit breaker pattern

## 🛠️ Development

### Build
```bash
npm run build        # Build TypeScript
npm run build:web    # Build web app
```

### Test
```bash
npm run test         # Run all tests
npm run type-check   # TypeScript validation
npm run lint         # ESLint
```

### Scripts
```bash
npm run dev          # Start MCP server (dev)
npm run dev:web      # Start Web API server (dev)
npm start            # Start MCP server (prod)
npm run start:web    # Start Web API server (prod)
```

## ⚠️ CRITICAL: stdio Mode Requirements for VSCode MCP

### Why VSCode MCP Integration Fails
The MCP stdio transport has **strict requirements** that cause "unable to start successfully" errors:

1. **stdout is RESERVED for JSON-RPC protocol ONLY**
   - NO console.log() statements allowed
   - NO build tool output (tsx watch messages)
   - NO npm script output
   - ANY non-JSON output breaks the protocol

2. **ALL logging MUST go to stderr**
   - Use `process.stderr.write()` not `console.log/info/warn`
   - Logger implementation: `src/utils/logger.ts:50`
   - Environment variables: `LOG_LEVEL=error`, `ENABLE_API_LOGGING=false`

3. **Use production build, NOT dev mode**
   - ✅ `node dist/server.js` - Clean stdout
   - ❌ `tsx watch src/server.ts` - Outputs "[tsx] rerunning" to stdout
   - ❌ `npm run dev` - Adds npm script output

### Working VSCode Configuration
```json
{
  "servers": {
    "nextrelease-mcp": {
      "command": "node",
      "args": ["dist/server.js"],
      "env": {
        "LOG_LEVEL": "error",
        "ENABLE_API_LOGGING": "false"
      }
    }
  }
}
```

### Code Consolidation (Recent Improvements)
- **Created**: `src/utils/server-runner.ts` - Shared server startup utility
- **Deleted**: `src/index.ts` - Unused legacy MCPServer code
- **Simplified**: `server.ts` and `web-server.ts` now use server-runner
- **Result**: 34% code reduction (115 → 76 lines), eliminated duplicate error handling

### Jira Integration
- **API Version**: Must use v2 (not v3)
- **Authentication**: Bearer Token (not Basic Auth)
- **Server Type**: Jira Server 9.12.27 (not Jira Cloud)
- **Base URL**: https://jira.sage.com

### CORS Configuration
- Web app runs on port 3002
- API server must allow this origin
- Configuration in `src/web/api-server.ts:56`

### Path Aliases
- Development: Uses tsx with tsconfig paths
- Production: Requires `module-alias` package
- Config: `_moduleAliases` in package.json

## 🎯 Use Cases

1. **Sprint Reporting**: Generate comprehensive reports for stakeholders
2. **Metrics Tracking**: Monitor velocity, completion rates, story points
3. **GitHub Integration**: Correlate commits/PRs with Jira issues
4. **Real-time Monitoring**: Track sprint progress in real-time
5. **Export & Sharing**: Download reports in multiple formats

## 🔗 Related Files

- [Architecture Details](./.claude/CLAUDE_ARCHITECTURE.md)
- [Integration Guide](./.claude/CLAUDE_INTEGRATIONS.md)
- [Operations Manual](./.claude/CLAUDE_OPERATIONS.md)
- [Troubleshooting](./.claude/CLAUDE_TROUBLESHOOTING.md)

## 📝 Version History

### v2.2.0 (October 4, 2025) - Current
**Comprehensive Sprint Analytics - Tier 1, 2, 3 Metrics**
- ✅ **Tier 1 (Must Have)**: Next sprint forecast, carryover analysis, commit activity, PR stats, code changes, PR-to-issue traceability
- ✅ **Tier 2 (Should Have)**: Team capacity tracking, blockers & dependencies, bug metrics, cycle time analysis
- ✅ **Tier 3 (Nice to Have)**: Epic progress tracking, technical debt analysis, risk management
- ✅ **UI Enhancement**: Added comprehensive analytics section with 4 tabbed views (Next Sprint, GitHub Metrics, Team & Quality, Technical Health)
- ✅ **API Enhancement**: New endpoint `/api/sprints/:id/comprehensive` with full tier support
- ✅ **Performance**: All metrics calculated in parallel (5-6x faster)
- ✅ **Documentation**: Complete implementation guide in `.claude/CLAUDE_COMPREHENSIVE_ANALYTICS.md`

### v2.1.1 (October 3, 2025)
**Analytics & Sprint Sorting Improvements**
- ✅ **Sprint Sorting Policy**: Global policy (newest → oldest) applied across all pages
- ✅ **Analytics Page**: Real data integration, 4 working widgets, GitHub env variable support
- ✅ **Cache Management**: Redis operations guide, clear troubleshooting procedures
- ✅ **Health Check Fix**: GitHub health check uses real public repo, no more 404 errors
- ✅ **Documentation**: 3 new comprehensive guides (sorting, cache, analytics)

### v2.1.0 (October 2, 2025)
**Web UI & Performance Improvements**
- ✅ **shadcn/ui Migration**: 100% component coverage (Alert, Badge, Skeleton, Separator, Tabs, Table)
- ✅ **Redis Optimization**: 8/10 effectiveness (SCAN + Pipeline = 5-100x performance)
- ✅ **TypeScript Cleanup**: Fixed all compilation errors, removed duplicates
- ✅ **Code Quality**: Cleaner imports, better type safety

### v2.0.0
**Full Web Integration**
- ✅ React 18 web application with TypeScript
- ✅ Complete REST API for web UI
- ✅ Real-time metrics and monitoring
- ✅ Multi-format report generation

### v1.0.0
**Initial Release**
- ✅ Basic MCP server functionality
- ✅ Jira and GitHub integration
- ✅ Command-line report generation

## 🤝 Contributing

When making changes:
1. Update relevant CLAUDE.md files
2. Run type-check and tests
3. Update API documentation if endpoints change
4. Test both MCP and web API modes
5. Verify CORS configuration for web integration

## 🔑 Key Learnings (October 3, 2025)

### Sprint Sorting Architecture
1. **Always sort before slice** - API endpoints must sort sprints by start date BEFORE limiting results
2. **Centralized utilities** - Use `web/src/lib/sprint-utils.ts` for consistent sorting across all pages
3. **Display order** - Newest → Oldest (descending by start date) is the global standard
4. **Active vs Closed** - Dashboard shows both, all other pages show closed only

### Cache Management Best Practices
1. **TTL Strategy** - Different data types need different cache durations (1-30 minutes)
2. **Redis Commands** - Use `--scan --pattern` instead of `KEYS` for production
3. **Clear on Changes** - Always clear cache when sprint sorting logic changes
4. **Verification** - Check cache is empty after clearing: `wc -l` should return 0

### Analytics Integration
1. **Real Data First** - Replace mock data with actual API endpoints
2. **Environment Variables** - Use `VITE_*` prefix for frontend env vars
3. **Optional Features** - GitHub integration should degrade gracefully when not configured
4. **Health Checks** - Use real public repos (like octocat/hello-world) to avoid errors

### Common Pitfalls
1. ❌ Sorting after slicing → Gets wrong subset of sprints
2. ❌ Different sort orders per page → Confusing UX
3. ❌ Hardcoded test values in health checks → Error log pollution
4. ❌ Forgetting to clear cache → Changes don't appear

---

**Last Updated**: October 3, 2025
**Status**: ✅ Production Ready
**Maintainer**: Development Team
