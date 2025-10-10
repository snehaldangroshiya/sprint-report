#!/usr/bin/env node

// Register module aliases for runtime path resolution
import 'module-alias/register';

// Web API Server Entry Point
import { runServer } from './utils/server-runner';
import { WebAPIServer } from './web/api-server';

// Start the Web API server
runServer(() => new WebAPIServer(), 'Web API Server');
