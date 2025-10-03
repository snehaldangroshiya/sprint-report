import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('loads dashboard and displays navigation', async ({ page }) => {
    await page.goto('/');

    // Check header
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Monitor sprint reporting system status')).toBeVisible();

    // Check navigation
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Generate Report' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Analytics' })).toBeVisible();
  });

  test('displays quick action cards', async ({ page }) => {
    await page.goto('/');

    // Check quick action cards
    await expect(page.getByText('Generate Report')).toBeVisible();
    await expect(page.getByText('Create a new sprint report')).toBeVisible();
    await expect(page.getByText('Recent Reports')).toBeVisible();
    await expect(page.getByText('System Health')).toBeVisible();
  });

  test('navigate to report generator', async ({ page }) => {
    await page.goto('/');

    // Click on Generate Report card
    await page.getByRole('link', { name: 'Generate Report Create a new sprint report' }).click();

    // Verify navigation
    await expect(page).toHaveURL('/generate');
    await expect(page.getByRole('heading', { name: 'Generate Sprint Report' })).toBeVisible();
  });

  test('navigate to analytics', async ({ page }) => {
    await page.goto('/');

    // Click on Analytics navigation
    await page.getByRole('link', { name: 'Analytics' }).click();

    // Verify navigation
    await expect(page).toHaveURL('/analytics');
    await expect(page.getByRole('heading', { name: 'Sprint Analytics' })).toBeVisible();
  });

  test('displays system status when API is healthy', async ({ page }) => {
    // Mock API responses
    await page.route('/api/health', async route => {
      const json = {
        status: 'healthy',
        uptime: 3600000,
        services: {
          jira: { healthy: true, latency: 150 },
          github: { healthy: true, latency: 200 }
        }
      };
      await route.fulfill({ json });
    });

    await page.route('/api/metrics', async route => {
      const json = {
        summary: {
          cacheHitRate: 85,
          memoryTrend: 'stable'
        },
        cacheOptimization: {
          recommendations: []
        }
      };
      await route.fulfill({ json });
    });

    await page.goto('/');

    // Wait for system status to load
    await expect(page.getByText('System Status')).toBeVisible();
    await expect(page.getByText('Overall')).toBeVisible();
    await expect(page.getByText('healthy')).toBeVisible();

    // Check services
    await expect(page.getByText('Jira')).toBeVisible();
    await expect(page.getByText('Github')).toBeVisible();
  });

  test('displays performance metrics', async ({ page }) => {
    await page.route('/api/health', async route => {
      await route.fulfill({ json: { status: 'healthy', uptime: 3600000 } });
    });

    await page.route('/api/metrics', async route => {
      const json = {
        summary: {
          cacheHitRate: 85,
          memoryTrend: 'stable'
        },
        cacheOptimization: {
          recommendations: ['Enable Redis clustering']
        }
      };
      await route.fulfill({ json });
    });

    await page.goto('/');

    await expect(page.getByText('Performance Metrics')).toBeVisible();
    await expect(page.getByText('Cache Hit Rate')).toBeVisible();
    await expect(page.getByText('85%')).toBeVisible();
  });

  test('handles API errors gracefully', async ({ page }) => {
    // Mock API failures
    await page.route('/api/health', async route => {
      await route.abort();
    });

    await page.route('/api/metrics', async route => {
      await route.abort();
    });

    await page.goto('/');

    // Should still display basic dashboard
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Generate Report')).toBeVisible();
  });
});