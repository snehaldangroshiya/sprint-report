#!/usr/bin/env node

// Web API Server Entry Point
import { WebAPIServer } from './web/api-server';
import { runServer } from './utils/server-runner';

// Start the Web API server
runServer(
  () => new WebAPIServer(),
  'Web API Server'
);
