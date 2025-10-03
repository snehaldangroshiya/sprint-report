import { test, expect } from '@playwright/test';

test.describe('Report Generation', () => {
  test('loads report generator page', async ({ page }) => {
    await page.goto('/generate');

    await expect(page.getByRole('heading', { name: 'Generate Sprint Report' })).toBeVisible();
    await expect(page.getByText('Create comprehensive sprint reports with Jira and GitHub integration')).toBeVisible();
  });

  test('displays report configuration form', async ({ page }) => {
    await page.goto('/generate');

    // Check form elements
    await expect(page.getByLabel('Jira Board ID')).toBeVisible();
    await expect(page.getByLabel('Sprint')).toBeVisible();
    await expect(page.getByLabel('GitHub Owner')).toBeVisible();
    await expect(page.getByLabel('GitHub Repository')).toBeVisible();
    await expect(page.getByLabel('Report Format')).toBeVisible();
    await expect(page.getByText('Include in Report')).toBeVisible();
  });

  test('shows sprint options when board ID is entered', async ({ page }) => {
    // Mock API responses
    await page.route('/api/sprints/*', async route => {
      const json = [
        { id: '1', name: 'Sprint 1', state: 'active' },
        { id: '2', name: 'Sprint 2', state: 'closed' }
      ];
      await route.fulfill({ json });
    });

    await page.goto('/generate');

    // Enter board ID
    await page.getByLabel('Jira Board ID').fill('TEST-123');

    // Wait for sprints to load
    await expect(page.getByText('Sprint 1 (active)')).toBeVisible();
    await expect(page.getByText('Sprint 2 (closed)')).toBeVisible();
  });

  test('generates and displays report', async ({ page }) => {
    // Mock sprints API
    await page.route('/api/sprints/*', async route => {
      const json = [{ id: '1', name: 'Sprint 1', state: 'active' }];
      await route.fulfill({ json });
    });

    // Mock report generation API
    await page.route('/api/generate-report', async route => {
      const json = '<h1>Sprint Report</h1><p>Test report content</p>';
      await route.fulfill({ json });
    });

    await page.goto('/generate');

    // Fill form
    await page.getByLabel('Jira Board ID').fill('TEST-123');
    await page.getByLabel('Sprint').selectOption('1');
    await page.getByLabel('Report Format').selectOption('html');

    // Generate report
    await page.getByRole('button', { name: 'Generate Report' }).click();

    // Wait for report to be generated
    await expect(page.getByText('Report generated successfully (html format)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download HTML' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
  });

  test('validates required fields', async ({ page }) => {
    await page.goto('/generate');

    // Try to generate without required fields
    const generateButton = page.getByRole('button', { name: 'Generate Report' });
    await expect(generateButton).toBeDisabled();

    // Enter board ID but no sprint
    await page.getByLabel('Jira Board ID').fill('TEST-123');
    await expect(generateButton).toBeDisabled();
  });

  test('handles generation errors', async ({ page }) => {
    // Mock error response
    await page.route('/api/sprints/*', async route => {
      const json = [{ id: '1', name: 'Sprint 1', state: 'active' }];
      await route.fulfill({ json });
    });

    await page.route('/api/generate-report', async route => {
      await route.fulfill({
        status: 500,
        json: { error: 'Failed to connect to Jira' }
      });
    });

    await page.goto('/generate');

    // Fill form
    await page.getByLabel('Jira Board ID').fill('TEST-123');
    await page.getByLabel('Sprint').selectOption('1');

    // Generate report
    await page.getByRole('button', { name: 'Generate Report' }).click();

    // Check error message
    await expect(page.getByText('Error:')).toBeVisible();
  });

  test('shows theme selection for HTML format', async ({ page }) => {
    await page.goto('/generate');

    // Default format should be HTML
    await expect(page.getByLabel('Theme')).toBeVisible();

    // Change to other format
    await page.getByLabel('Report Format').selectOption('json');
    await expect(page.getByLabel('Theme')).not.toBeVisible();

    // Change back to HTML
    await page.getByLabel('Report Format').selectOption('html');
    await expect(page.getByLabel('Theme')).toBeVisible();
  });

  test('can configure include options', async ({ page }) => {
    await page.goto('/generate');

    // Check all include options are present
    await expect(page.getByText('Commits')).toBeVisible();
    await expect(page.getByText('Pull Requests')).toBeVisible();
    await expect(page.getByText('Velocity Data')).toBeVisible();
    await expect(page.getByText('Burndown Chart')).toBeVisible();

    // Toggle options
    await page.getByRole('checkbox', { name: /Commits/ }).check();
    await page.getByRole('checkbox', { name: /Pull Requests/ }).check();

    // Verify checkboxes are checked
    await expect(page.getByRole('checkbox', { name: /Commits/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Pull Requests/ })).toBeChecked();
  });
});