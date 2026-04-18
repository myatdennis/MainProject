import { test, expect } from '@playwright/test';
import { getFrontendBaseUrl } from './helpers/env';

const LEARNER_EMAIL = 'user@pacificcoast.edu';
const LEARNER_PASSWORD = 'user123';

test.describe('Production survey auth probe', () => {
  test.setTimeout(120_000);

  test('captures the live assigned surveys request after learner login', async ({ page }) => {
    const frontendBase = getFrontendBaseUrl().replace(/\/$/, '');
    const surveyRequestPromise = page.waitForResponse(
      (response) => response.url().includes('/api/client/surveys/assigned'),
      { timeout: 60_000 },
    );

    await page.goto(`${frontendBase}/lms/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email Address').fill(LEARNER_EMAIL);
    await page.getByLabel('Password').fill(LEARNER_PASSWORD);
    await page.getByLabel('Password').press('Enter');

    await page.waitForURL(/\/(lms|client)\/(dashboard|surveys)/, { timeout: 60_000 });
    await page.goto(`${frontendBase}/client/surveys`, { waitUntil: 'domcontentloaded' });

    const surveyResponse = await surveyRequestPromise;
    const surveyRequest = surveyResponse.request();
    const responseBody = await surveyResponse.text();
    const requestHeaders = await surveyRequest.allHeaders();
    const result = {
      url: surveyRequest.url(),
      status: surveyResponse.status(),
      hasAuthorizationHeader: Boolean(requestHeaders.authorization),
      authorizationHeaderPrefix: requestHeaders.authorization?.slice(0, 12) ?? null,
      responseBody,
    };

    console.log('[PROD_SURVEY_AUTH_PROBE]', JSON.stringify(result));

    expect(requestHeaders.authorization).toMatch(/^Bearer\s+/);
    expect(surveyResponse.status()).not.toBe(401);
    await expect(page.getByRole('heading', { name: 'My Surveys' })).toBeVisible({ timeout: 30_000 });
  });
});
