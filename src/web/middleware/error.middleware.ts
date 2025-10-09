// Global error handling middleware
import express from 'express';
import { getLogger } from '@/utils/logger';
import { AppConfig } from '@/types';

/**
 * Create global error handler middleware
 * Must have 4 parameters for Express to recognize it as error middleware
 */
export function createErrorHandler(config: AppConfig): express.ErrorRequestHandler {
  const logger = getLogger(config.logging);

  return (error: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.logError(error, 'api_error', {
      method: req.method,
      path: req.path,
      body: req.body
    });

    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  };
}
