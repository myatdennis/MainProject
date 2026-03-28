import { test, expect } from '@playwright/test';
import { getFrontendBaseUrl, getApiBaseUrl, waitForOk } from './helpers/env';

test.describe('Learner login redirect', () => {
  test('demo learner reaches dashboard, survives refresh, and sees courses', async ({ page }) => {
    const baseUrl = getFrontendBaseUrl();
    const apiBaseUrl = getApiBaseUrl();

    page.on('console', (msg) => console.log(`[learner:${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => console.error('[learner:pageerror]', err.message));

    await waitForOk(page.request, `${apiBaseUrl}/api/health`);
    await page.goto(`${baseUrl}/lms/login`, { waitUntil: 'domcontentloaded' });

    await page.getByLabel('Email Address').fill('user@pacificcoast.edu');
    await page.getByLabel('Password').fill('user123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL('**/lms/dashboard', { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /Your Learning Path/i })).toBeVisible({ timeout: 20_000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/lms\/dashboard/);
    await expect(page.getByRole('heading', { name: /Your Learning Path/i })).toBeVisible({ timeout: 20_000 });

    await page.goto(`${baseUrl}/client/courses`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-test="client-course-card"]').first()).toBeVisible({ timeout: 20_000 });
  });
});
