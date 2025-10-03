// Tests for validation utilities

import { ValidationUtils, ToolSchemas } from '../../src/utils/validation';
import { ValidationError } from '../../src/utils/errors';

describe('ValidationUtils', () => {
  describe('validateAndParse', () => {
    test('should validate valid data', () => {
      const schema = ToolSchemas.jiraGetSprints;
      const validData = { board_id: '123', state: 'active' };

      const result = ValidationUtils.validateAndParse(schema, validData);

      expect(result).toEqual({
        board_id: '123',
        state: 'active',
      });
    });

    test('should throw ValidationError for invalid data', () => {
      const schema = ToolSchemas.jiraGetSprints;
      const invalidData = { board_id: 123 }; // Should be string

      expect(() => {
        ValidationUtils.validateAndParse(schema, invalidData);
      }).toThrow(ValidationError);
    });

    test('should include field information in error', () => {
      const schema = ToolSchemas.githubGetCommits;
      const invalidData = { owner: '', repo: 'test' }; // Empty owner

      try {
        ValidationUtils.validateAndParse(schema, invalidData);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.field).toBe('owner');
        }
      }
    });
  });

  describe('validateDateRange', () => {
    test('should accept valid date range', () => {
      expect(() => {
        ValidationUtils.validateDateRange('2023-01-01', '2023-01-31');
      }).not.toThrow();
    });

    test('should throw error when start date is after end date', () => {
      expect(() => {
        ValidationUtils.validateDateRange('2023-01-31', '2023-01-01');
      }).toThrow('Start date must be before or equal to end date');
    });

    test('should accept same start and end date', () => {
      expect(() => {
        ValidationUtils.validateDateRange('2023-01-01', '2023-01-01');
      }).not.toThrow();
    });

    test('should throw error for invalid date format', () => {
      expect(() => {
        ValidationUtils.validateDateRange('invalid-date', '2023-01-01');
      }).toThrow('Invalid date format');

      expect(() => {
        ValidationUtils.validateDateRange('2023-01-01', 'invalid-date');
      }).toThrow('Invalid date format');
    });
  });

  describe('validateJQL', () => {
    test('should accept safe JQL queries', () => {
      const safeQueries = [
        'project = "TEST"',
        'assignee = currentUser()',
        'status IN ("To Do", "In Progress")',
        'created >= -30d AND labels = "bug"',
        'fixVersion = "1.0.0" ORDER BY priority DESC',
      ];

      safeQueries.forEach(jql => {
        expect(() => {
          ValidationUtils.validateJQL(jql);
        }).not.toThrow();
      });
    });

    test('should reject potentially dangerous JQL', () => {
      const dangerousQueries = [
        'project = "TEST" AND 1=1; DROP TABLE users; --',
        "project = 'TEST' UNION SELECT * FROM sensitive_data",
        'project = "TEST" AND (SELECT COUNT(*) FROM admin_table) > 0',
        'project = "TEST"; DELETE FROM projects WHERE id=1',
      ];

      dangerousQueries.forEach(jql => {
        expect(() => {
          ValidationUtils.validateJQL(jql);
        }).toThrow('Potentially unsafe JQL query detected');
      });
    });

    test('should reject empty or whitespace-only JQL', () => {
      expect(() => {
        ValidationUtils.validateJQL('');
      }).toThrow('JQL query cannot be empty');

      expect(() => {
        ValidationUtils.validateJQL('   ');
      }).toThrow('JQL query cannot be empty');
    });

    test('should reject overly long JQL queries', () => {
      const longJQL = 'project = "TEST" AND ' + 'assignee = "user" AND '.repeat(200);

      expect(() => {
        ValidationUtils.validateJQL(longJQL);
      }).toThrow('JQL query too long');
    });
  });

  describe('sanitizeInput', () => {
    test('should sanitize string input', () => {
      const input = 'Hello <script>alert("xss")</script> World';
      const sanitized = ValidationUtils.sanitizeInput(input);

      expect(sanitized).toBe('Hello World');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });

    test('should handle non-string input', () => {
      expect(ValidationUtils.sanitizeInput(123)).toBe(123);
      expect(ValidationUtils.sanitizeInput(null)).toBe(null);
      expect(ValidationUtils.sanitizeInput(undefined)).toBe(undefined);
      expect(ValidationUtils.sanitizeInput(true)).toBe(true);
    });

    test('should sanitize object properties', () => {
      const input = {
        name: 'John <script>alert("xss")</script>',
        age: 30,
        tags: ['<b>admin</b>', 'user'],
      };

      const sanitized = ValidationUtils.sanitizeInput(input);

      expect(sanitized).toEqual({
        name: 'John',
        age: 30,
        tags: ['admin', 'user'],
      });
    });

    test('should handle deeply nested objects', () => {
      const input = {
        user: {
          profile: {
            bio: 'Developer <script>evil()</script> and designer',
          },
        },
      };

      const sanitized = ValidationUtils.sanitizeInput(input);

      expect(sanitized.user.profile.bio).toBe('Developer and designer');
    });

    test('should handle arrays', () => {
      const input = [
        'Normal text',
        '<img src="x" onerror="alert(1)">',
        { text: 'Hello <b>world</b>' },
      ];

      const sanitized = ValidationUtils.sanitizeInput(input);

      expect(sanitized).toEqual([
        'Normal text',
        '',
        { text: 'Hello world' },
      ]);
    });
  });

  describe('isValidEmail', () => {
    test('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.email+tag@domain.co.uk',
        'user123@test-domain.com',
        'a@b.c',
      ];

      validEmails.forEach(email => {
        expect(ValidationUtils.isValidEmail(email)).toBe(true);
      });
    });

    test('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        'user name@domain.com',
        'user@domain..com',
        '',
        null,
        undefined,
      ];

      invalidEmails.forEach(email => {
        expect(ValidationUtils.isValidEmail(email as any)).toBe(false);
      });
    });
  });

  describe('isValidUrl', () => {
    test('should accept valid URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://test.com',
        'https://api.github.com/repos/owner/repo',
        'https://company.atlassian.net/rest/api/3/issue/TEST-123',
      ];

      validUrls.forEach(url => {
        expect(ValidationUtils.isValidUrl(url)).toBe(true);
      });
    });

    test('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com', // Only http/https allowed
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '',
        null,
        undefined,
      ];

      invalidUrls.forEach(url => {
        expect(ValidationUtils.isValidUrl(url as any)).toBe(false);
      });
    });
  });

  describe('validateRequiredFields', () => {
    test('should pass when all required fields are present', () => {
      const data = { name: 'John', email: 'john@example.com', age: 30 };
      const required = ['name', 'email'];

      expect(() => {
        ValidationUtils.validateRequiredFields(data, required);
      }).not.toThrow();
    });

    test('should throw error for missing required fields', () => {
      const data = { name: 'John' };
      const required = ['name', 'email'];

      expect(() => {
        ValidationUtils.validateRequiredFields(data, required);
      }).toThrow('Missing required field: email');
    });

    test('should throw error for null/undefined values', () => {
      const data = { name: 'John', email: null };
      const required = ['name', 'email'];

      expect(() => {
        ValidationUtils.validateRequiredFields(data, required);
      }).toThrow('Missing required field: email');
    });

    test('should throw error for empty string values', () => {
      const data = { name: 'John', email: '' };
      const required = ['name', 'email'];

      expect(() => {
        ValidationUtils.validateRequiredFields(data, required);
      }).toThrow('Missing required field: email');
    });
  });
});

describe('ToolSchemas', () => {
  test('should have all required Jira schemas', () => {
    expect(ToolSchemas.jiraGetSprints).toBeDefined();
    expect(ToolSchemas.jiraGetSprintIssues).toBeDefined();
    expect(ToolSchemas.jiraGetIssueDetails).toBeDefined();
    expect(ToolSchemas.jiraSearchIssues).toBeDefined();
  });

  test('should have all required GitHub schemas', () => {
    expect(ToolSchemas.githubGetCommits).toBeDefined();
    expect(ToolSchemas.githubGetPullRequests).toBeDefined();
    expect(ToolSchemas.githubSearchCommitsByMessage).toBeDefined();
    expect(ToolSchemas.githubFindCommitsWithJiraReferences).toBeDefined();
  });

  test('should have reporting schemas', () => {
    expect(ToolSchemas.generateSprintReport).toBeDefined();
    expect(ToolSchemas.getSprintMetrics).toBeDefined();
  });

  test('should have utility schemas', () => {
    expect(ToolSchemas.healthCheck).toBeDefined();
    expect(ToolSchemas.cacheStats).toBeDefined();
  });

  test('jiraGetSprints schema should validate correctly', () => {
    const validData = { board_id: '123' };
    const invalidData = { board_id: 123 };

    expect(() => {
      ValidationUtils.validateAndParse(ToolSchemas.jiraGetSprints, validData);
    }).not.toThrow();

    expect(() => {
      ValidationUtils.validateAndParse(ToolSchemas.jiraGetSprints, invalidData);
    }).toThrow();
  });

  test('githubGetCommits schema should validate date formats', () => {
    const validData = {
      owner: 'testorg',
      repo: 'testrepo',
      since: '2023-01-01T00:00:00Z',
      until: '2023-01-31T23:59:59Z',
    };

    const invalidData = {
      owner: 'testorg',
      repo: 'testrepo',
      since: 'invalid-date',
    };

    expect(() => {
      ValidationUtils.validateAndParse(ToolSchemas.githubGetCommits, validData);
    }).not.toThrow();

    expect(() => {
      ValidationUtils.validateAndParse(ToolSchemas.githubGetCommits, invalidData);
    }).toThrow();
  });
});