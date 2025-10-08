#!/usr/bin/env node

// Register module aliases for runtime path resolution
import 'module-alias/register';

// Web API Server Entry Point
import { WebAPIServer } from './web/api-server';
import { runServer } from './utils/server-runner';

// Start the Web API server
runServer(
  () => new WebAPIServer(),
  'Web API Server'
);
