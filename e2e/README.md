# E2E Testing with Playwright

This directory contains end-to-end tests for the NextReleaseMCP web application using Playwright.

## Prerequisites

Make sure you have both servers running:

1. **API Server** (port 3000):
   ```bash
   npm run dev:web
   ```

2. **Web Application** (port 3001):
   ```bash
   cd web && npm run dev
   ```

Or use Playwright's built-in web server (configured in `playwright.config.ts`).

## Running Tests

### All Tests
```bash
npm run test:playwright
```

### Interactive UI Mode (Recommended)
```bash
npm run test:playwright:ui
```

### Headed Mode (See Browser)
```bash
npm run test:playwright:headed
```

### Debug Mode
```bash
npm run test:playwright:debug
```

### Specific Test File
```bash
npx playwright test dashboard.spec.ts
```

### Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Structure

### Dashboard Tests (`dashboard.spec.ts`)

Comprehensive tests for the Dashboard page covering:

- ✅ Page header and description
- ✅ Quick stat cards (Active Sprint, Velocity, Completion Rate, Sprints Tracked)
- ✅ Quick action cards with navigation
- ✅ System Status (Jira, GitHub, Cache)
- ✅ Performance Metrics
- ✅ Recent Sprint Activity
- ✅ Loading states (skeleton loaders)
- ✅ Error handling
- ✅ Mobile responsive layout
- ✅ Interactive hover effects

## Configuration

The Playwright configuration is located in `/playwright.config.ts`:

- **Base URL**: `http://localhost:3001` (web app)
- **API URL**: `http://localhost:3000` (API server)
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome
- **Screenshot on failure**: Enabled
- **Trace on retry**: Enabled

## Mock Data

Tests use realistic mock data based on production data:

- **Board**: Sage Connect (ID: 6306)
- **Active Sprint**: SCNT-2025-26
- **Velocity**: ~147 story points
- **System Status**: Healthy services with realistic latencies

## Viewing Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

## Writing New Tests

Follow this pattern:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API endpoints
    await page.route('**/api/endpoint', async route => {
      await route.fulfill({ json: mockData });
    });
  });

  test('should test specific behavior', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Expected Text')).toBeVisible();
  });
});
```

## Debugging Tips

1. **Use UI Mode**: Best for development and debugging
   ```bash
   npm run test:playwright:ui
   ```

2. **Enable Debug Mode**: Step through tests
   ```bash
   npm run test:playwright:debug
   ```

3. **Use Headed Mode**: Watch tests run in real browser
   ```bash
   npm run test:playwright:headed
   ```

4. **Add Breakpoints**: Add `await page.pause()` in tests

5. **Check Screenshots**: Failed tests automatically capture screenshots in `test-results/`

## Continuous Integration

Tests are configured to run in CI environments:

- Retries: 2 attempts on failure
- Workers: 1 (prevents flakiness)
- Screenshots and traces on failure

## Common Issues

### Port Already in Use
If ports 3000 or 3001 are in use:
```bash
# Kill processes on ports
lsof -ti:3000 | xargs kill
lsof -ti:3001 | xargs kill
```

### Tests Timing Out
Increase timeout in test:
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ... test code
});
```

### API Mocking Not Working
Ensure route is set up before navigation:
```typescript
await page.route('**/api/endpoint', handler);
await page.goto('/'); // Route must be set before goto
```

## Related Documentation

- [Playwright Documentation](https://playwright.dev)
- [Project README](../CLAUDE.md)
- [API Documentation](../docs/API_WORKING_EXAMPLES.md)
- [Web Integration Guide](../docs/WEB_INTEGRATION_GUIDE.md)
