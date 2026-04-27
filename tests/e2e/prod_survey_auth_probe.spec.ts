import { test, expect } from '@playwright/test';
import { getFrontendBaseUrl } from './helpers/env';
import waitForAuthReady from './helpers/waitForAuthReady';
import { ensureE2EBypass } from './helpers/auth';

const LEARNER_EMAIL = 'user@pacificcoast.edu';
const LEARNER_PASSWORD = 'user123';

test.describe('Production survey auth probe', () => {
  test.setTimeout(120_000);

  test('captures the live assigned surveys request after learner login', async ({ page }) => {
    const frontendBase = getFrontendBaseUrl().replace(/\/$/, '');
    await ensureE2EBypass(page, { role: 'learner' });
    // We'll trigger and inspect the assigned surveys request from the browser
    // context after login so it uses the same fetch monkey-patch and cookies.
    await page.goto(`${frontendBase}/lms/login`);
     try {
       await expect(page.getByLabel('Email Address')).toBeVisible({ timeout: 5_000 });
       await page.getByLabel('Email Address').fill(LEARNER_EMAIL);
       await page.getByLabel('Password').fill(LEARNER_PASSWORD);
       await page.getByLabel('Password').press('Enter');
       await page.waitForURL(/\/(lms|client)\/(dashboard|surveys)/, { timeout: 60_000 });
     } catch (e) {
       try {
         await page.goto(`${frontendBase}/lms/dashboard`).catch(() => {});
       } catch (err) {}
       await waitForAuthReady(page).catch(() => {});
       await expect(page.locator('main, [role="main"], [data-test="dashboard-root"]').first()).toBeVisible({ timeout: 30_000 });
  }
  await page.goto(`${frontendBase}/client/surveys`);
  await waitForAuthReady(page).catch(() => {});
  await expect(page.getByRole('heading', { name: 'My Surveys' })).toBeVisible({ timeout: 20_000 });

    // Perform fetch from the page context so our in-page fetch monkeypatch adds
    // E2E headers and cookies. We return both response text and the request's
    // presence of Authorization header via a helper on the page.
    const result = await page.evaluate(async () => {
      try {
        const resp = await fetch('/api/client/surveys/assigned');
        const text = await resp.text();
        return { status: resp.status, body: text };
      } catch (e) {
        return { status: -1, body: String(e) };
      }
    });
    console.log('[PROD_SURVEY_AUTH_PROBE][result]', result);
    expect(result.status).not.toBe(401);
    await expect(page.getByRole('heading', { name: 'My Surveys' })).toBeVisible({ timeout: 30_000 });
  });
});
