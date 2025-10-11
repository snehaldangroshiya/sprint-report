# NextReleaseMCP - Complete Server Architecture

## Overview

The NextReleaseMCP project now supports **4 different server modes**, each optimized for specific use cases.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     NextReleaseMCP Server Stack                      │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  MCP stdio   │  │  Web API     │  │  HTTP/Stream │  │  SSE Server  │
│  (Default)   │  │  (REST)      │  │  (MCP/HTTP)  │  │  (MCP/SSE)   │
│              │  │              │  │              │  │              │
│  stdin/      │  │  Port 3000   │  │  Port 3001   │  │  Port 3002   │
│  stdout      │  │              │  │              │  │              │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │                 │
       │                 │                 │                 │
       └─────────────────┴─────────────────┴─────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │    Shared Core Services    │
                    │                            │
                    │  • SprintService           │
                    │  • AnalyticsService        │
                    │  • ReportGenerator         │
                    │  • CacheManager            │
                    │  • PerformanceMonitor      │
                    └─────────────┬──────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
    ┌─────────▼────────┐  ┌───────▼────────┐  ┌──────▼──────┐
    │  Jira Server     │  │  GitHub API    │  │   Redis     │
    │  API v2          │  │  REST API      │  │   Cache     │
    └──────────────────┘  └────────────────┘  └─────────────┘
```

## Mode 1: MCP stdio (Default)

**Purpose**: Standard MCP protocol for desktop clients

```
┌─────────────────┐
│ Claude Desktop  │
│   or MCP Client │
└────────┬────────┘
         │ stdin/stdout
         │
┌────────▼────────┐
│  MCP Server     │
│  (stdio mode)   │
│                 │
│  server.ts      │
└─────────────────┘
```

**Use Cases**:
- Claude Desktop integration
- Local MCP clients
- Command-line tools
- Maximum performance

**Commands**:
```bash
npm run dev    # Development
npm run start  # Production
```

---

## Mode 2: Web API (REST)

**Purpose**: RESTful API for web applications

```
┌─────────────────┐     ┌─────────────────┐
│  React App      │────▶│  Mobile App     │
│  (Port 5173)    │     │                 │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │  HTTP REST            │
         │                       │
┌────────▼───────────────────────▼────────┐
│         Web API Server                  │
│         (Port 3000)                     │
│                                         │
│  Endpoints:                             │
│  • GET  /api/sprints                    │
│  • GET  /api/sprints/:id/issues         │
│  • POST /api/reports/sprint             │
│  • GET  /api/health                     │
└─────────────────────────────────────────┘
```

**Use Cases**:
- Web applications (React, Vue, Angular)
- Mobile apps (iOS, Android)
- Third-party integrations
- Public APIs

**Commands**:
```bash
npm run dev:web    # Development
npm run start:web  # Production
```

---

## Mode 3: HTTP/StreamableHttp (MCP over HTTP)

**Purpose**: MCP protocol over HTTP with bidirectional streaming

```
┌─────────────────┐
│  HTTP MCP       │
│  Client         │
└────────┬────────┘
         │
         │ GET/POST /mcp
         │ (mcp-session-id header)
         │
┌────────▼────────┐
│  HTTP Server    │
│  (Port 3001)    │
│                 │
│  StreamableHTTP │
│  Transport      │
└─────────────────┘
```

**Features**:
- Full MCP protocol
- Bidirectional streaming
- Session management
- Advanced HTTP features

**Use Cases**:
- Custom MCP clients
- Advanced streaming requirements
- Server-to-server communication

**Commands**:
```bash
npm run dev:http    # Development
npm run start:http  # Production
```

---

## Mode 4: SSE (Server-Sent Events) ⭐ NEW

**Purpose**: MCP over SSE for browser-native real-time updates

```
┌─────────────────┐
│  Browser        │
│  (EventSource)  │
└────────┬────────┘
         │
         │ GET /sse (SSE stream)
         │ POST /message?sessionId=xyz
         │
┌────────▼────────┐
│  SSE Server     │
│  (Port 3002)    │
│                 │
│  SSEServer      │
│  Transport      │
│                 │
│  • Real-time    │
│  • Auto-reconnect│
│  • Browser native│
└─────────────────┘
```

**Features**:
- Native EventSource API
- Automatic reconnection
- Real-time streaming
- Simple debugging

**Use Cases**:
- Web dashboards
- Browser extensions
- Progressive Web Apps
- Real-time monitoring

**Commands**:
```bash
npm run dev:sse    # Development
npm run start:sse  # Production
```

---

## Connection Flow Examples

### stdio Mode
```
User → Claude Desktop → stdin → MCP Server → stdout → Claude Desktop → User
```

### Web API Mode
```
User → Browser → HTTP Request → Web API → JSON Response → Browser → User
```

### HTTP Mode
```
User → Client → GET /mcp → Session → POST /mcp → Response → Client → User
```

### SSE Mode ⭐
```
User → Browser → GET /sse → SSE Stream ←───────────┐
                    │                               │
                    │                               │
                    └→ POST /message → MCP Server ──┘
```

---

## Complete System Architecture

```
                          ┌──────────────────────┐
                          │   External Clients   │
                          └──────────┬───────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
┌───────▼────────┐        ┌──────────▼────────┐        ┌─────────▼────────┐
│ Claude Desktop │        │  Web Browser      │        │  Mobile App      │
│                │        │  • React App      │        │  • iOS/Android   │
│  stdio mode    │        │  • Extensions     │        │  • REST client   │
└───────┬────────┘        └──────────┬────────┘        └─────────┬────────┘
        │                            │                            │
        │                  ┌─────────┴─────────┐                 │
        │                  │                   │                 │
        │           ┌──────▼─────┐      ┌──────▼─────┐          │
        │           │ SSE Server │      │ HTTP Server│          │
        │           │ Port 3002  │      │ Port 3001  │          │
        │           └──────┬─────┘      └──────┬─────┘          │
        │                  │                   │                 │
        └──────────────────┴───────────────────┴─────────────────┘
                                   │
                     ┌─────────────▼──────────────┐
                     │      MCP stdio Server      │
                     │         (stdio)            │
                     └─────────────┬──────────────┘
                                   │
                     ┌─────────────▼──────────────┐
                     │     Web API Server         │
                     │      (Port 3000)           │
                     └─────────────┬──────────────┘
                                   │
                     ┌─────────────▼──────────────┐
                     │    Shared Core Services    │
                     │  • Sprint Service          │
                     │  • Analytics Service       │
                     │  • Report Generator        │
                     │  • Cache Manager (Redis)   │
                     │  • Performance Monitor     │
                     └─────────────┬──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────▼────────┐  ┌────────▼────────┐  ┌───────▼───────┐
    │   Jira Server    │  │   GitHub API    │  │  Redis Cache  │
    │   API v2         │  │   REST API      │  │               │
    └──────────────────┘  └─────────────────┘  └───────────────┘
```

---

## Comparison Matrix

| Feature | stdio | Web API | HTTP | SSE |
|---------|-------|---------|------|-----|
| **Protocol** | MCP | REST | MCP/HTTP | MCP/SSE |
| **Transport** | stdin/stdout | HTTP | StreamableHTTP | SSE + POST |
| **Port** | - | 3000 | 3001 | 3002 |
| **Real-time** | ✅ | ❌ | ✅ | ✅ |
| **Browser Native** | ❌ | ✅ | ❌ | ✅ |
| **Auto-Reconnect** | ❌ | ❌ | ❌ | ✅ |
| **MCP Protocol** | ✅ | ❌ | ✅ | ✅ |
| **Bidirectional** | ✅ | ✅ | ✅ | ⚠️ |
| **Complexity** | Low | Medium | High | Medium |
| **Best For** | Desktop | Web Apps | Advanced | Real-time Web |

⚠️ SSE uses POST for client → server, SSE for server → client

---

## Running All Modes Simultaneously

You can run all four modes at the same time:

```bash
# Terminal 1: MCP stdio
npm run dev

# Terminal 2: Web API
npm run dev:web

# Terminal 3: HTTP/StreamableHttp
npm run dev:http

# Terminal 4: SSE Server
npm run dev:sse

# Terminal 5: Web Frontend
cd web && npm run dev
```

**Active Ports**:
- stdin/stdout: MCP stdio
- Port 3000: Web API (REST)
- Port 3001: HTTP/StreamableHttp (MCP)
- Port 3002: SSE (MCP)
- Port 5173: React frontend (dev)

---

## Quick Reference

| Need | Use Mode | Command | Port |
|------|----------|---------|------|
| Claude Desktop | stdio | `npm run dev` | - |
| React App | Web API | `npm run dev:web` | 3000 |
| Custom MCP Client | HTTP | `npm run dev:http` | 3001 |
| Browser Dashboard | SSE | `npm run dev:sse` | 3002 |

---

## Documentation

- **[docs/SERVER_MODES.md](./docs/SERVER_MODES.md)** - Complete comparison
- **[docs/SSE_SERVER_GUIDE.md](./docs/SSE_SERVER_GUIDE.md)** - SSE guide
- **[docs/QUICKSTART.md](./docs/QUICKSTART.md)** - Quick start
- **[CLAUDE.md](./CLAUDE.md)** - Full documentation

---

**Last Updated**: October 11, 2025  
**Status**: All 4 modes operational ✅
