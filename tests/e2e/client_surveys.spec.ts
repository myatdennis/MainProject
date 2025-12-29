import { test, expect, type Page } from '@playwright/test';
import { getFrontendBaseUrl, getApiBaseUrl } from './helpers/env';

const loginAsLearner = async (page: Page) => {
  const base = getFrontendBaseUrl();
  await page.goto(`${base}/lms/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email Address').fill('user@pacificcoast.edu');
  await page.getByLabel('Password').fill('user123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/lms/dashboard', { timeout: 30_000 });
  await page.evaluate(() => {
    localStorage.setItem('huddle_lms_auth', 'true');
    localStorage.setItem('huddle_user', JSON.stringify({ email: 'user@pacificcoast.edu', id: 'learner-surveys', role: 'user', activeOrgId: 'org-huddle' }));
    localStorage.setItem('huddle_active_org', 'org-huddle');
  });
};

test.describe('Client survey entry points', () => {
  test.setTimeout(90_000);

  test('shows empty state for surveys and links back to dashboard', async ({ page }) => {
    const base = getFrontendBaseUrl();
    await loginAsLearner(page);

    await page.goto(`${base}/client/surveys`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'My Surveys' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('You don’t have any surveys yet. Check back later.')).toBeVisible();

    await page.getByRole('link', { name: '← Back to dashboard' }).click();
    await expect(page).toHaveURL(/\/client\/dashboard/);
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible({ timeout: 20_000 });
  });

  test('client surveys API returns published records for orgs', async ({ request }) => {
    const apiBase = getApiBaseUrl();
    const healthResponse = await request.get(`${apiBase}/api/health`);
    expect(healthResponse.ok()).toBeTruthy();
    const response = await request.get(`${apiBase}/api/client/surveys?status=published`, {
      headers: {
        'x-user-role': 'admin',
      },
    });

    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(Array.isArray(payload.data)).toBeTruthy();
    const titles = (payload.data as Array<{ title?: string }>).map((record) => record.title ?? '');
    expect(titles.some((title) => /pulse/i.test(title))).toBeTruthy();
  });
});
