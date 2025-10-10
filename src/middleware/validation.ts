import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// Validation schemas
export const schemas = {
  reportGeneration: Joi.object({
    sprint_id: Joi.string().required().min(1).max(50),
    github_owner: Joi.string().optional().min(1).max(100),
    github_repo: Joi.string().optional().min(1).max(100),
    format: Joi.string().valid('html', 'markdown', 'json', 'csv').required(),
    include_commits: Joi.boolean().required(),
    include_prs: Joi.boolean().required(),
    include_velocity: Joi.boolean().required(),
    include_burndown: Joi.boolean().required(),
    theme: Joi.string().valid('default', 'dark', 'corporate').required(),
  }),

  boardId: Joi.object({
    boardId: Joi.string().required().min(1).max(50),
  }),

  githubParams: Joi.object({
    owner: Joi.string().required().min(1).max(100),
    repo: Joi.string().required().min(1).max(100),
  }),

  sprintId: Joi.object({
    sprintId: Joi.string().required().min(1).max(50),
  }),

  paginationQuery: Joi.object({
    page: Joi.number().integer().min(1).max(1000).optional(),
    per_page: Joi.number().integer().min(1).max(100).optional(),
    since: Joi.date().iso().optional(),
    until: Joi.date().iso().optional(),
  }),

  exportOptions: Joi.object({
    reportData: Joi.object().required(),
    options: Joi.object({
      format: Joi.string().valid('A4', 'A3', 'Letter').optional(),
      orientation: Joi.string().valid('portrait', 'landscape').optional(),
    }).optional(),
  }),
};

// Validation middleware factory
export function validateRequest(
  schema: Joi.ObjectSchema,
  target: 'body' | 'params' | 'query' = 'body'
): (req: Request, _res: Response, next: NextFunction) => Response | void {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    const data =
      target === 'body'
        ? req.body
        : target === 'params'
          ? req.params
          : req.query;

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errorMessages,
      });
    }

    // Replace the original data with validated and sanitized data
    if (target === 'body') {
      req.body = value;
    } else if (target === 'params') {
      req.params = value;
    } else {
      req.query = value;
    }

    next();
  };
}

// Security headers middleware
export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  // Remove server information
  res.removeHeader('X-Powered-By');

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self'; " +
      "connect-src 'self'; " +
      "frame-src 'self'"
  );

  // Other security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
}

// Request sanitization middleware
export function sanitizeRequest(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Basic SQL injection prevention
  const sqlInjectionPattern =
    /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT( +INTO)?|MERGE|SELECT|UPDATE|UNION( +ALL)?)\b)/gi;

  const sanitizeString = (str: any): any => {
    if (typeof str === 'string') {
      // Remove potential SQL injection patterns
      str = str.replace(sqlInjectionPattern, '');

      // Remove potential XSS patterns
      str = str.replace(
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        ''
      );
      str = str.replace(/javascript:/gi, '');
      str = str.replace(/on\w+\s*=/gi, '');

      return str.trim();
    }
    return str;
  };

  const sanitizeObject = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }

    return sanitizeString(obj);
  };

  // Sanitize request data
  // For Express 5 compatibility, we need to handle read-only properties differently
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // For query and params, we can't directly assign in Express 5
  // Instead, we'll use Object.defineProperty or just skip sanitization for these
  // since they're typically validated by the validateRequest middleware anyway

  next();
}

// Rate limiting configuration
export const rateLimitConfig = {
  windowMs: 1 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for development
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60, // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000),
    });
  },
};

// API key validation middleware (if needed for external integrations)
export function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Response | void {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide a valid API key in the X-API-Key header',
    });
  }

  // In a real implementation, validate against a database or environment variable
  const validApiKeys = process.env.API_KEYS?.split(',') || [];

  if (!validApiKeys.includes(apiKey)) {
    return res.status(403).json({
      error: 'Invalid API key',
      message: 'The provided API key is not valid',
    });
  }

  next();
}

// Request size validation
export function validateRequestSize(
  maxSize: number = 10 * 1024 * 1024
): (req: Request, _res: Response, next: NextFunction) => Response | void {
  // 10MB default
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    const contentLength = parseInt(req.headers['content-length'] || '0');

    if (contentLength > maxSize) {
      return res.status(413).json({
        error: 'Request too large',
        message: `Request size exceeds maximum allowed size of ${Math.round(maxSize / 1024 / 1024)}MB`,
      });
    }

    next();
  };
}
