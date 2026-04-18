import { test, expect } from '@playwright/test';

const FRONTEND_BASE = process.env.E2E_BASE_URL || 'https://the-huddle.co';
test('probe deployed learner surveys request once', async ({ page }) => {
  let matchedUrl: string | null = null;
  let matchedStatus: number | null = null;
  let matchedBody: string | null = null;

  const targetResponse = page.waitForResponse(async (response) => {
    const url = response.url();
    if (!url.includes('/api/client/surveys/assigned')) {
      return false;
    }
    matchedUrl = url;
    matchedStatus = response.status();
    try {
      matchedBody = await response.text();
    } catch {
      matchedBody = '<unable-to-read-body>';
    }
    return true;
  }, { timeout: 45_000 });

  await page.goto(`${FRONTEND_BASE}/client/surveys`, { waitUntil: 'domcontentloaded' });
  const fetchResult = await page.evaluate(async () => {
    const response = await fetch('/api/client/surveys/assigned', {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
    const body = await response.text();
    return {
      url: response.url,
      status: response.status,
      body,
    };
  });

  await targetResponse;

  console.log('[PROD_SURVEY_PROBE_RESULT]', JSON.stringify({
    url: fetchResult.url ?? matchedUrl,
    status: fetchResult.status ?? matchedStatus,
    body: fetchResult.body ?? matchedBody,
  }));

  expect(matchedUrl).toBeTruthy();
  expect(matchedStatus).not.toBeNull();
});
