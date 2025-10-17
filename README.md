# NextReleaseMCP

**MCP Server for Jira & GitHub Sprint Report Generation**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

NextReleaseMCP is a Model Context Protocol (MCP) server that integrates Jira and GitHub to generate comprehensive sprint reports. It provides both a backend API server and a modern web-based UI for sprint tracking, metrics analysis, and automated report generation.

## ✨ Features

### Core Features
- 🚀 **MCP Server** - Full Model Context Protocol implementation for Claude Desktop
- 📊 **Sprint Analytics** - Velocity tracking, completion rates, story point analysis
- 📝 **Report Generation** - Export to HTML, Markdown, and JSON formats
- 🔄 **Real-time Sync** - Live data from Jira Server API v2
- 🐙 **GitHub Integration** - Correlate commits and PRs with Jira issues
- ⚡ **Performance** - Multi-tier caching with Redis support
- 🎨 **Modern Web UI** - React + TypeScript + shadcn/ui components
- 🔒 **Enterprise Ready** - Authentication, rate limiting, error recovery

### 🤖 AI Agents (NEW!)
- **🤖 Claude Agent** - Premium AI with natural language access to all MCP tools
- **🦙 Ollama Agent** - 100% FREE local LLM alternative (privacy-first, offline-capable)
- **💬 Interactive CLI** - Ask questions like "List all bugs in current sprint"
- **🌐 REST API** - Integrate AI capabilities into any application
- **📡 Streaming** - Real-time responses via Server-Sent Events

> **Quick Start:** `npm run agent` (Claude) or `npm run agent:ollama` (FREE!)  
> **See:** [GET_STARTED.md](GET_STARTED.md) | [OLLAMA_QUICK_START.md](docs/OLLAMA_QUICK_START.md)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Jira Server account with API access
- GitHub Personal Access Token (optional)
- Redis (optional, for caching)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd NextReleaseMCP

# Install dependencies
npm install
cd web && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env with your credentials
```

### Configuration

Create a `.env` file:

```bash
# Jira Configuration (Required)
JIRA_BASE_URL=https://jira.sage.com
JIRA_API_TOKEN=your_bearer_token
JIRA_EMAIL=your.email@company.com

# GitHub Configuration (Optional)
GITHUB_TOKEN=ghp_your_token

# Server Configuration
MCP_SERVER_PORT=3000
NODE_ENV=development
```

### Running the Application

NextReleaseMCP supports **four server modes**:

1. **MCP Server (stdio)** - For Claude Desktop and MCP clients
2. **Web API Server** - REST API for web/mobile apps (Port 3000)
3. **HTTP/StreamableHttp Server** - MCP over HTTP with bidirectional streaming (Port 3001)
4. **SSE Server** - MCP over Server-Sent Events for browser clients (Port 3002)

**Development Mode** (Recommended):
```bash
# MCP stdio mode (Claude Desktop)
npm run dev

# Web API + UI
npm run dev:web
cd web && npm run dev

# HTTP/StreamableHttp MCP server
npm run dev:http

# SSE MCP server (NEW!)
npm run dev:sse
```

**Access the Application**:
- Web UI: http://localhost:5173 (dev)
- API: http://localhost:3000/api
- HTTP MCP: http://localhost:3001/mcp
- SSE MCP: http://localhost:3002/sse
- Health Checks: `/health` on each server

> 📖 **See [docs/SERVER_MODES.md](./docs/SERVER_MODES.md)** for detailed comparison and usage

## 📚 Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Complete project overview and architecture
- **[docs/QUICKSTART.md](./docs/QUICKSTART.md)** - 5-minute setup guide
- **[docs/USAGE_GUIDE.md](./docs/USAGE_GUIDE.md)** - Complete usage instructions
- **[docs/SERVER_MODES.md](./docs/SERVER_MODES.md)** - Server modes comparison (stdio, Web API, HTTP, SSE)
- **[docs/SSE_SERVER_GUIDE.md](./docs/SSE_SERVER_GUIDE.md)** - SSE server complete guide
- **[docs/API_WORKING_EXAMPLES.md](./docs/API_WORKING_EXAMPLES.md)** - API examples with real data
- **[docs/QUICK_REFERENCE.md](./docs/QUICK_REFERENCE.md)** - Quick reference card

### Technical Documentation

- **[.claude/CLAUDE_ARCHITECTURE.md](./.claude/CLAUDE_ARCHITECTURE.md)** - System architecture
- **[.claude/CLAUDE_INTEGRATIONS.md](./.claude/CLAUDE_INTEGRATIONS.md)** - Integration details
- **[docs/CLAUDE_WEB_UI.md](./docs/CLAUDE_WEB_UI.md)** - Web UI architecture
- **[docs/REDIS_CACHE_ARCHITECTURE.md](./docs/REDIS_CACHE_ARCHITECTURE.md)** - Cache optimization

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│  Web UI (React + TypeScript)   Port: 3002      │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│  MCP Server + Express API      Port: 3000      │
│  - MCP Tools (Jira, GitHub, Reports)           │
│  - REST API (/api/sprints, /api/reports)       │
│  - Performance Monitoring & Cache              │
└─────────┬───────────────┬──────────────────────┘
          │               │
┌─────────▼────┐   ┌──────▼──────┐   ┌──────────┐
│ Jira Server  │   │ GitHub API  │   │  Redis   │
│  API v2      │   │  REST API   │   │  Cache   │
└──────────────┘   └─────────────┘   └──────────┘
```

## 🔧 Development

### Build

```bash
npm run build        # Build TypeScript
npm run build:web    # Build web app
```

### Testing

```bash
npm run test         # Run all tests
npm run type-check   # TypeScript validation
npm run lint         # ESLint
```

### Available Scripts

```bash
npm run dev          # Start MCP server (dev)
npm run dev:web      # Start Web API server (dev)
npm start            # Start MCP server (prod)
npm run start:web    # Start Web API server (prod)
```

## 🔌 MCP Integration

### Claude Desktop Configuration

Add to your Claude Desktop `config.json`:

```json
{
  "mcpServers": {
    "nextrelease-mcp": {
      "command": "node",
      "args": ["<path-to-project>/dist/server.js"],
      "env": {
        "JIRA_BASE_URL": "https://jira.sage.com",
        "JIRA_API_TOKEN": "your_token",
        "JIRA_EMAIL": "your.email@company.com",
        "GITHUB_TOKEN": "your_github_token",
        "LOG_LEVEL": "error",
        "ENABLE_API_LOGGING": "false"
      }
    }
  }
}
```

### VSCode MCP Integration

See **[docs/VSCODE_MCP_TROUBLESHOOTING.md](./docs/VSCODE_MCP_TROUBLESHOOTING.md)** for detailed setup instructions.

## 📊 Key Features

### Sprint Management
- Fetch sprints by board ID and state
- Get detailed sprint information with full metadata
- Calculate sprint metrics (velocity, completion rate, story points)
- Real-time data synchronization

### Report Generation
- Multiple formats: HTML, Markdown, JSON
- Three templates: Executive, Detailed, Technical
- GitHub integration (commits & PRs)
- Download and export functionality

### Performance & Monitoring
- Multi-tier caching (memory + Redis)
- Real-time performance monitoring
- Automatic cache optimization
- Health check endpoints

## 🛠️ Technology Stack

**Backend:**
- Node.js 18+
- TypeScript 5.7
- Express.js
- Model Context Protocol (MCP)
- Redis (optional)

**Frontend:**
- React 18
- TypeScript
- Vite
- shadcn/ui
- Tailwind CSS
- Recharts

**Testing:**
- Jest
- Playwright
- React Testing Library

## 🔒 Security

- Environment variable management
- Rate limiting and throttling
- Input validation and sanitization
- Secure credential handling
- CORS configuration

## 📈 Performance

- **Multi-tier caching**: Memory + Redis (5-100x improvement)
- **Request batching**: Reduced API calls
- **Connection pooling**: Optimized HTTP clients
- **Error recovery**: Automatic retry with exponential backoff

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

## 📧 Support

For issues and questions:
- Open an issue on GitHub
- Check the [documentation](./CLAUDE.md)
- Review [troubleshooting guide](./.claude/CLAUDE_TROUBLESHOOTING.md)

---

**Version**: 2.1.1
**Last Updated**: October 4, 2025
**Status**: ✅ Production Ready


```
Couldn't find '/home/sd/.ollama/id_ed25519'. Generating new private key.
Your new public key is: 

ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFwAMZ6cxg37WMD48oRKBbvFEkarDD6+LNKXSvsMnQkN

Error: listen tcp 127.0.0.1:11434: bind: address already in use

```
