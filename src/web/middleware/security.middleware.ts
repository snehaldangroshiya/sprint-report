// Security middleware configuration
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import {
  securityHeaders,
  sanitizeRequest,
  rateLimitConfig,
  validateRequestSize,
} from '@/middleware/validation';

/**
 * Apply security headers to Express app
 */
export function applySecurityHeaders(app: express.Application): void {
  // Custom security headers
  app.use(securityHeaders);

  // Helmet security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          frameSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );
}

/**
 * Apply CORS configuration to Express app
 */
export function applyCorsConfiguration(app: express.Application): void {
  app.use(
    cors({
      origin:
        process.env.NODE_ENV === 'production'
          ? process.env.ALLOWED_ORIGINS?.split(',') || [
              'https://your-domain.com',
            ]
          : [
              'http://localhost:3000',
              'http://localhost:3001',
              'http://localhost:3002',
              'http://localhost:5173',
            ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      exposedHeaders: ['Content-Disposition'],
    })
  );
}

/**
 * Apply rate limiting to API routes
 */
export function applyRateLimiting(app: express.Application): void {
  const limiter = rateLimit(rateLimitConfig);
  app.use('/api/', limiter);
}

/**
 * Apply request validation and sanitization
 */
export function applyRequestValidation(app: express.Application): void {
  // Request size validation (10MB limit)
  app.use(validateRequestSize(10 * 1024 * 1024));

  // Request sanitization
  app.use(sanitizeRequest);
}

/**
 * Apply compression and JSON/URL parsing
 */
export function applyBodyParsing(app: express.Application): void {
  app.use(compression());
  app.use(
    express.json({
      limit: '10mb',
      strict: true,
      type: 'application/json',
    })
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: '10mb',
      parameterLimit: 1000,
    })
  );
}

/**
 * Configure trust proxy for production environments
 */
export function configureTrustProxy(app: express.Application): void {
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }
}
