# Security Requirements & Review
# Jira-GitHub Sprint Reporting MCP Server

**Version**: 1.0
**Date**: 2025-09-29
**Classification**: Internal Use
**Security Review Status**: ✅ Approved

## Executive Summary

This document provides a comprehensive security review and requirements specification for the Jira-GitHub Sprint Reporting MCP Server. The analysis covers authentication, data protection, input validation, and operational security considerations.

### Security Posture
- **Risk Level**: Medium (handles sensitive organizational data)
- **Compliance**: Internal security standards, API provider security requirements
- **Attack Surface**: Limited (internal tool, API integrations only)
- **Data Classification**: Internal business data, no PII/PHI

## Threat Model

### Assets
1. **Jira API Credentials** - High value (full Jira access)
2. **GitHub Personal Access Tokens** - High value (repository access)
3. **Sprint Report Data** - Medium value (business intelligence)
4. **MCP Server Infrastructure** - Medium value (service availability)

### Threat Actors
1. **Internal Malicious Users** - High likelihood, medium impact
2. **External Attackers** - Low likelihood, high impact
3. **Compromised Dependencies** - Medium likelihood, high impact
4. **API Provider Breaches** - Low likelihood, high impact

### Attack Vectors
1. **Credential Theft** - Environment variables, memory dumps
2. **Injection Attacks** - JQL injection, command injection
3. **Data Exfiltration** - Report data, API responses
4. **Service Disruption** - DoS attacks, resource exhaustion
5. **Supply Chain** - Compromised npm packages

## Security Requirements

### 1. Authentication & Authorization

#### API Token Management
```typescript
interface SecurityRequirements {
  tokenStorage: {
    location: "environment_variables_only";
    encryption: "not_required"; // OS-level protection sufficient
    rotation: "manual"; // Automated rotation in Phase 2
    validation: "startup_and_periodic";
  };

  tokenScope: {
    jira: "read_only_minimum_required";
    github: "repo_read_only"; // No write access needed
    validation: "runtime_scope_checking";
  };
}
```

**Implementation Requirements**:
- ✅ Store tokens only in `.env` files
- ✅ Validate token permissions on startup
- ✅ Implement token expiration checking
- ✅ Log authentication failures (without credentials)
- ✅ Fail gracefully on authentication errors

#### Token Validation Service
```typescript
class TokenValidator {
  async validateJiraToken(token: string, email: string): Promise<ValidationResult> {
    try {
      // Test with minimal API call
      const response = await this.jiraClient.get('/rest/api/3/myself');

      return {
        valid: true,
        permissions: this.extractPermissions(response),
        expiresAt: null, // Jira tokens don't expire
      };
    } catch (error) {
      return {
        valid: false,
        error: this.sanitizeError(error),
        requiresAction: "check_token_and_email"
      };
    }
  }

  async validateGitHubToken(token: string): Promise<ValidationResult> {
    try {
      // Test with user info endpoint
      const response = await this.githubClient.get('/user', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Check token scopes
      const scopes = response.headers['x-oauth-scopes'] || '';
      const requiredScopes = ['repo', 'read:org'];

      const hasRequiredScopes = requiredScopes.every(scope =>
        scopes.includes(scope)
      );

      return {
        valid: true,
        scopes: scopes.split(',').map(s => s.trim()),
        hasRequiredScopes,
        rateLimit: this.parseRateLimit(response.headers)
      };
    } catch (error) {
      return {
        valid: false,
        error: this.sanitizeError(error)
      };
    }
  }
}
```

### 2. Input Validation & Sanitization

#### Request Validation Schema
```typescript
// Strict input validation to prevent injection attacks
const inputValidationRules = {
  sprintId: z.string()
    .regex(/^\d+$/, "Sprint ID must be numeric")
    .min(1)
    .max(20),

  boardId: z.string()
    .regex(/^\d+$/, "Board ID must be numeric")
    .min(1)
    .max(20),

  jqlQuery: z.string()
    .max(1000, "JQL query too long")
    .refine(query => !this.containsDangerousJQL(query), "Unsafe JQL query"),

  repositoryOwner: z.string()
    .regex(/^[a-zA-Z0-9\-_]+$/, "Invalid repository owner")
    .min(1)
    .max(50),

  repositoryName: z.string()
    .regex(/^[a-zA-Z0-9\-_\.]+$/, "Invalid repository name")
    .min(1)
    .max(100),

  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }).refine(data => new Date(data.start) < new Date(data.end), "Invalid date range")
};

class InputValidator {
  containsDangerousJQL(query: string): boolean {
    const dangerousPatterns = [
      /\bDROP\b/i,
      /\bDELETE\b/i,
      /\bUPDATE\b/i,
      /\bINSERT\b/i,
      /\bEXEC\b/i,
      /\bSCRIPT\b/i,
      /<script/i,
      /javascript:/i
    ];

    return dangerousPatterns.some(pattern => pattern.test(query));
  }

  sanitizeHTML(input: string): string {
    // Use DOMPurify for HTML sanitization in reports
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: []
    });
  }
}
```

#### JQL Injection Prevention
```typescript
class JQLSanitizer {
  private readonly ALLOWED_FIELDS = [
    'project', 'sprint', 'status', 'assignee', 'priority',
    'created', 'updated', 'resolved', 'labels', 'fixVersion'
  ];

  private readonly ALLOWED_OPERATORS = [
    '=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN',
    'IS', 'IS NOT', 'WAS', 'WAS NOT', 'CHANGED'
  ];

  sanitizeJQL(query: string): string {
    // Parse and validate JQL components
    const parsed = this.parseJQL(query);

    // Validate field names
    parsed.clauses.forEach(clause => {
      if (!this.ALLOWED_FIELDS.includes(clause.field.toLowerCase())) {
        throw new SecurityError(`Forbidden JQL field: ${clause.field}`);
      }

      if (!this.ALLOWED_OPERATORS.includes(clause.operator.toUpperCase())) {
        throw new SecurityError(`Forbidden JQL operator: ${clause.operator}`);
      }
    });

    return this.reconstructJQL(parsed);
  }
}
```

### 3. Data Protection

#### Data Classification & Handling
```typescript
interface DataClassification {
  level: "internal" | "confidential" | "restricted";
  retention: number; // days
  encryption: {
    atRest: boolean;
    inTransit: boolean;
  };
  logging: {
    logData: boolean;
    maskSensitive: boolean;
  };
}

const dataClassifications = {
  sprintData: {
    level: "internal",
    retention: 90,
    encryption: { atRest: false, inTransit: true },
    logging: { logData: true, maskSensitive: false }
  },

  apiCredentials: {
    level: "confidential",
    retention: 0, // Never log
    encryption: { atRest: true, inTransit: true },
    logging: { logData: false, maskSensitive: true }
  },

  reportData: {
    level: "internal",
    retention: 30,
    encryption: { atRest: false, inTransit: true },
    logging: { logData: true, maskSensitive: false }
  }
};
```

#### Secure Logging
```typescript
class SecureLogger {
  private sensitiveFields = [
    'password', 'token', 'secret', 'key', 'authorization',
    'cookie', 'session', 'credential', 'api_key', 'access_token'
  ];

  log(level: LogLevel, message: string, data?: any): void {
    const sanitizedData = this.sanitizeLogData(data);

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: sanitizedData,
      requestId: this.getRequestId(),
      userId: this.getCurrentUserId(),
    };

    this.writeLog(logEntry);
  }

  private sanitizeLogData(data: any): any {
    if (!data) return data;

    const sanitized = JSON.parse(JSON.stringify(data));

    this.deepRedact(sanitized, this.sensitiveFields);

    return sanitized;
  }

  private deepRedact(obj: any, sensitiveFields: string[]): void {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.deepRedact(obj[key], sensitiveFields);
      } else if (sensitiveFields.some(field =>
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        obj[key] = '[REDACTED]';
      }
    }
  }
}
```

### 4. Network Security

#### HTTPS/TLS Requirements
```typescript
const tlsConfig = {
  minVersion: 'TLSv1.2',
  ciphers: [
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-SHA384',
    'ECDHE-RSA-AES128-SHA256'
  ],
  honorCipherOrder: true,
  secureProtocol: 'TLSv1_2_method'
};

// API client configuration
const apiClientConfig = {
  httpsAgent: new https.Agent({
    ...tlsConfig,
    rejectUnauthorized: true, // Always verify certificates
    checkServerIdentity: (hostname: string, cert: any) => {
      // Additional hostname verification
      return tls.checkServerIdentity(hostname, cert);
    }
  }),

  timeout: 30000,
  maxRedirects: 3, // Limit redirects to prevent redirect attacks

  headers: {
    'User-Agent': 'JiraGitHubReporter/1.0.0',
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate'
  }
};
```

#### Request Headers Security
```typescript
class SecurityHeaders {
  static getSecureHeaders(): Record<string, string> {
    return {
      // Prevent XSS
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',

      // HSTS for HTTPS enforcement
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',

      // Content Security Policy for HTML reports
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'", // For embedded charts
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'none'"
      ].join('; '),

      // Prevent MIME sniffing
      'X-Download-Options': 'noopen',

      // Referrer policy
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
  }
}
```

### 5. Error Handling & Information Disclosure

#### Secure Error Handling
```typescript
class SecureErrorHandler {
  handleError(error: Error, context: ErrorContext): ErrorResponse {
    const errorId = this.generateErrorId();

    // Log full error details securely
    this.secureLogger.error('Application error', {
      errorId,
      error: error.message,
      stack: error.stack,
      context: this.sanitizeContext(context)
    });

    // Return sanitized error to client
    return {
      errorId,
      message: this.getSafeErrorMessage(error),
      timestamp: new Date().toISOString(),
      // Never expose: stack traces, internal paths, credentials
    };
  }

  private getSafeErrorMessage(error: Error): string {
    // Map internal errors to safe public messages
    const errorMappings = {
      'AxiosError': 'External service temporarily unavailable',
      'ValidationError': 'Invalid input provided',
      'AuthenticationError': 'Authentication failed',
      'RateLimitError': 'Request rate limit exceeded',
      'TimeoutError': 'Request timeout - please try again'
    };

    const errorType = error.constructor.name;
    return errorMappings[errorType] || 'An unexpected error occurred';
  }
}
```

### 6. Dependency Security

#### Package Security Management
```typescript
// Security audit configuration
const securityConfig = {
  // Automated security scanning
  auditLevel: "moderate", // Fail build on moderate+ vulnerabilities

  // Dependency validation
  allowedLicenses: [
    'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'
  ],

  // Package restrictions
  blockedPackages: [
    // Known vulnerable or problematic packages
    'lodash@<4.17.21',
    'handlebars@<4.7.7',
    'axios@<0.21.2'
  ],

  // Security headers for npm
  npmConfig: {
    audit: true,
    'audit-level': 'moderate',
    'fund': false // Reduce noise in CI
  }
};
```

#### Package.json Security Configuration
```json
{
  "scripts": {
    "audit": "npm audit --audit-level=moderate",
    "audit:fix": "npm audit fix",
    "license:check": "license-checker --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC'",
    "security:check": "npm run audit && npm run license:check"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
```

### 7. Runtime Security

#### Resource Protection
```typescript
class ResourceGuard {
  private readonly limits = {
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    maxCacheSize: 100 * 1024 * 1024,  // 100MB
    maxConcurrentRequests: 10,
    maxReportSize: 50 * 1024 * 1024,  // 50MB
    requestTimeout: 30000,             // 30 seconds
  };

  validateRequest(request: any): void {
    if (JSON.stringify(request).length > this.limits.maxRequestSize) {
      throw new SecurityError('Request size exceeds limit');
    }
  }

  checkResourceUsage(): ResourceStatus {
    const memUsage = process.memoryUsage();

    return {
      memory: {
        used: memUsage.rss,
        percentage: (memUsage.rss / (512 * 1024 * 1024)) * 100, // 512MB limit
        withinLimits: memUsage.rss < (512 * 1024 * 1024)
      },

      handles: {
        active: process.getActiveResourcesInfo?.().length || 0,
        withinLimits: true // Monitor in production
      }
    };
  }
}
```

#### Rate Limiting & DoS Protection
```typescript
class SecurityLimiter {
  private requestCounts = new Map<string, RequestCounter>();

  async checkRateLimit(clientId: string): Promise<boolean> {
    const now = Date.now();
    const counter = this.requestCounts.get(clientId) || {
      count: 0,
      windowStart: now,
      blocked: false
    };

    // 1-minute sliding window
    if (now - counter.windowStart > 60000) {
      counter.count = 0;
      counter.windowStart = now;
      counter.blocked = false;
    }

    // 100 requests per minute limit
    if (counter.count >= 100) {
      counter.blocked = true;
      this.securityLogger.warn('Rate limit exceeded', { clientId });
      return false;
    }

    counter.count++;
    this.requestCounts.set(clientId, counter);
    return true;
  }
}
```

### 8. Operational Security

#### Monitoring & Alerting
```typescript
interface SecurityAlert {
  type: 'authentication_failure' | 'rate_limit_exceeded' | 'injection_attempt' | 'resource_exhaustion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata: any;
  timestamp: string;
}

class SecurityMonitor {
  private alertThresholds = {
    authFailures: 5,        // per minute
    rateLimitHits: 10,      // per minute
    errorRate: 0.1,         // 10% error rate
    responseTime: 10000,    // 10 seconds
  };

  checkAuthFailures(failures: number): void {
    if (failures > this.alertThresholds.authFailures) {
      this.sendAlert({
        type: 'authentication_failure',
        severity: 'high',
        description: `${failures} authentication failures in the last minute`,
        metadata: { failures, threshold: this.alertThresholds.authFailures },
        timestamp: new Date().toISOString()
      });
    }
  }
}
```

#### Security Headers for HTML Reports
```typescript
const htmlSecurityConfig = {
  csp: {
    'default-src': "'self'",
    'script-src': "'self' 'unsafe-inline'", // For Chart.js
    'style-src': "'self' 'unsafe-inline'",
    'img-src': "'self' data: https:",
    'font-src': "'self'",
    'connect-src': "'none'",
    'base-uri': "'self'",
    'form-action': "'none'"
  },

  sanitizeOptions: {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'ul', 'ol', 'li', 'strong', 'em', 'br'
    ],
    ALLOWED_ATTR: ['class', 'id', 'data-*'],
    FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form'],
    FORBID_ATTR: ['on*', 'style'] // No inline event handlers or styles
  }
};
```

## Security Testing Requirements

### 1. Static Analysis
- ✅ ESLint security plugin for code scanning
- ✅ npm audit for dependency vulnerabilities
- ✅ TypeScript strict mode for type safety
- ✅ License compliance checking

### 2. Dynamic Testing
```typescript
// Security test cases
describe('Security Tests', () => {
  describe('Input Validation', () => {
    it('should reject malicious JQL queries', async () => {
      const maliciousQueries = [
        "project = 'TEST' AND summary ~ '<script>alert(1)</script>'",
        "project = 'TEST'; DROP TABLE issues;",
        "project = 'TEST' AND javascript:alert(1)"
      ];

      for (const query of maliciousQueries) {
        await expect(jiraService.searchIssues(query))
          .rejects.toThrow('Unsafe JQL query');
      }
    });

    it('should sanitize HTML in report outputs', async () => {
      const maliciousData = {
        summary: '<script>alert("xss")</script>Legitimate Summary'
      };

      const report = await reportService.generateReport(maliciousData);
      expect(report.content).not.toContain('<script>');
      expect(report.content).toContain('Legitimate Summary');
    });
  });

  describe('Authentication', () => {
    it('should fail gracefully on invalid tokens', async () => {
      const invalidToken = 'invalid-token-12345';

      await expect(jiraClient.validateToken(invalidToken))
        .rejects.toThrow('Authentication failed');
    });

    it('should not expose credentials in error messages', async () => {
      try {
        await jiraClient.makeRequest('/invalid', { token: 'secret-token' });
      } catch (error) {
        expect(error.message).not.toContain('secret-token');
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const clientId = 'test-client';

      // Make 100 requests rapidly
      const requests = Array(101).fill(null).map(() =>
        rateLimiter.checkRateLimit(clientId)
      );

      const results = await Promise.all(requests);
      expect(results[100]).toBe(false); // 101st request should be blocked
    });
  });
});
```

### 3. Penetration Testing
- **Scope**: Input validation, authentication, error handling
- **Tools**: OWASP ZAP, Burp Suite (manual testing)
- **Frequency**: Before each major release
- **Reporting**: Security findings tracked in security backlog

## Compliance & Standards

### Internal Security Standards
- ✅ Secure coding practices (OWASP)
- ✅ Data classification and handling
- ✅ Incident response procedures
- ✅ Security monitoring and logging

### API Provider Requirements
- ✅ Jira API security guidelines compliance
- ✅ GitHub API rate limiting respect
- ✅ OAuth 2.0 security best practices
- ✅ Token scope minimization

## Security Incident Response

### Incident Classification
- **P0 - Critical**: Credential compromise, data breach
- **P1 - High**: Service compromise, authentication bypass
- **P2 - Medium**: Injection vulnerabilities, DoS
- **P3 - Low**: Information disclosure, minor vulnerabilities

### Response Procedures
1. **Detection**: Automated monitoring alerts
2. **Containment**: Isolate affected systems
3. **Investigation**: Forensic analysis and root cause
4. **Remediation**: Patch vulnerabilities, rotate credentials
5. **Recovery**: Restore normal operations
6. **Lessons Learned**: Update security measures

## Security Review Checklist

### Pre-Deployment Security Verification
- [ ] ✅ All credentials stored in environment variables only
- [ ] ✅ Input validation implemented for all user inputs
- [ ] ✅ Error handling doesn't expose sensitive information
- [ ] ✅ Security headers configured for HTTP responses
- [ ] ✅ Dependencies scanned for vulnerabilities
- [ ] ✅ Rate limiting and resource protection enabled
- [ ] ✅ Logging configured with sensitive data redaction
- [ ] ✅ HTTPS/TLS enforced for all communications
- [ ] ✅ Authentication tokens validated on startup
- [ ] ✅ Security tests passing in CI/CD pipeline

### Ongoing Security Maintenance
- [ ] Monthly dependency security audits
- [ ] Quarterly penetration testing
- [ ] Annual security architecture review
- [ ] Continuous monitoring and alerting
- [ ] Regular security training for developers

---

**Security Approval**: This security requirements document has been reviewed and approved for implementation. All requirements marked as ✅ must be implemented before production deployment.

**Next Steps**:
1. Implement security requirements during development phases
2. Conduct security testing alongside functional testing
3. Set up security monitoring and alerting
4. Document incident response procedures
5. Schedule regular security reviews