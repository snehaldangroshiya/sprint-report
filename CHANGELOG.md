# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.1] - 2025-10-04

### Added
- Initial public release
- MCP server implementation for Jira and GitHub integration
- Web UI with React + TypeScript + shadcn/ui
- Multi-tier caching system with Redis support
- Sprint analytics and velocity tracking
- Report generation (HTML, Markdown, JSON)
- Performance monitoring and optimization
- Comprehensive documentation

### Changed
- Reorganized documentation structure (docs/ and .claude/ folders)
- Improved cache management with Redis optimization
- Enhanced sprint sorting policy (newest → oldest)
- Updated analytics page with real data integration

### Fixed
- GitHub health check using real public repository
- Sprint sorting across all pages
- Redis KEYS command replaced with SCAN for production
- TypeScript compilation errors
- Cache management and clearing procedures

### Documentation
- Created comprehensive README.md
- Added .editorconfig for consistent formatting
- Updated CLAUDE.md with new file locations
- Added MIT LICENSE

## [2.1.0] - 2025-10-02

### Added
- shadcn/ui component migration (100% coverage)
- Redis optimization (SCAN + Pipeline = 5-100x performance)
- TypeScript cleanup and type safety improvements

### Changed
- Migrated to shadcn/ui component library
- Improved code organization and imports

## [2.0.0] - 2025-10-01

### Added
- React 18 web application with TypeScript
- Complete REST API for web UI
- Real-time metrics and monitoring
- Multi-format report generation

## [1.0.0] - 2025-09-15

### Added
- Initial MCP server functionality
- Jira and GitHub integration
- Command-line report generation
- Basic caching system
- Performance monitoring

---

[2.1.1]: https://github.com/yourorg/nextrelease-mcp/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/yourorg/nextrelease-mcp/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/yourorg/nextrelease-mcp/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/yourorg/nextrelease-mcp/releases/tag/v1.0.0
