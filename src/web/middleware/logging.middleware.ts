// Request logging middleware
import express from 'express';

import { AppConfig } from '@/types';
import { getLogger } from '@/utils/logger';

/**
 * Create request logging middleware
 */
export function createRequestLogger(config: AppConfig): express.RequestHandler {
  const logger = getLogger(config.logging);

  return (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    logger.info(`${req.method} ${req.path}`, {
      type: 'api_request',
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    next();
  };
}
