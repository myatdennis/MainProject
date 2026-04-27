import { test, expect } from '@playwright/test';

// This test ensures no network request ever contains 'undefined' or 'null' in the URL
// which would indicate a missing orgId or similar templating bug.

test('no requests contain undefined or null in URL on cold load', async ({ page }) => {
  const invalidUrls: string[] = [];

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    if (url.includes('undefined') || url.includes('null')) {
      invalidUrls.push(url);
    }
    // Always continue; we only assert after navigation
    await route.continue();
  });

  // Clear any existing state by opening a fresh context page (Playwright provides a clean page)
  await page.goto('/');

  // Wait a short while for app init calls to complete
  await page.waitForTimeout(1500);

  if (invalidUrls.length > 0) {
    console.error('Found invalid request URLs:', invalidUrls);
  }

  expect(invalidUrls, 'No request URL should contain undefined or null').toHaveLength(0);
});
