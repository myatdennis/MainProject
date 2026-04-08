import { test, expect, type Page } from '@playwright/test';
import { getFrontendBaseUrl, getApiBaseUrl } from './helpers/env';

const TEST_ORG_ID = 'demo-sandbox-org';

const loginAsLearner = async (page: Page) => {
  const base = getFrontendBaseUrl();
  await page.addInitScript(() => {
    (window as any).__E2E_BYPASS = true;
    localStorage.setItem('huddle_lms_auth', 'true');
  });
  await page.goto(`${base}/client/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/client/dashboard', { timeout: 30_000 });
};

test.describe('Client survey entry points', () => {
  test.setTimeout(90_000);

  test('loads surveys page and links back to dashboard', async ({ page }) => {
    const base = getFrontendBaseUrl();
    await loginAsLearner(page);

    await page.goto(`${base}/client/surveys`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'My Surveys' })).toBeVisible({ timeout: 20_000 });

  await page.goto(`${base}/client/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/client\/dashboard/);
    await expect(page.getByRole('button', { name: /Go to full learning hub/i })).toBeVisible({ timeout: 20_000 });
  });

  test('client surveys API returns published records for orgs', async ({ request }) => {
    const apiBase = getApiBaseUrl();
    const healthResponse = await request.get(`${apiBase}/api/health`);
    expect(healthResponse.ok()).toBeTruthy();
    const response = await request.get(
      `${apiBase}/api/client/surveys?status=published&orgId=${encodeURIComponent(TEST_ORG_ID)}`,
      {
      headers: {
        'x-user-role': 'admin',
        'x-org-id': TEST_ORG_ID,
      },
      }
    );

    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(Array.isArray(payload.data)).toBeTruthy();
    const titles = (payload.data as Array<{ title?: string }>).map((record) => record.title ?? '');
    expect(titles.some((title) => /pulse/i.test(title))).toBeTruthy();
  });
});
