#!/usr/bin/env node

// Register module aliases for production build
import 'module-alias/register';

// Main entry point for the Enhanced MCP Server
import { EnhancedMCPServer } from './server/enhanced-mcp-server';
import { runServer } from './utils/server-runner';

// Start the Enhanced MCP server
runServer(() => new EnhancedMCPServer(), 'Enhanced MCP Server');
