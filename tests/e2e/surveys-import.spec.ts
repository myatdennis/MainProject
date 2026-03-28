import { test, expect } from '@playwright/test';
import { getFrontendBaseUrl } from './helpers/env';
import { loginAsAdmin } from './helpers/auth';

test.describe('Surveys import smoke', () => {
  test('loads admin surveys import placeholder', async ({ page }) => {
    const { baseUrl } = await loginAsAdmin(page);
    const base = process.env.E2E_BASE_URL || process.env.TEST_BASE_URL || baseUrl || getFrontendBaseUrl();

    await page.goto(`${base}/admin/surveys/import`);
    await expect(page).toHaveTitle(/Admin/);
    await expect(page.locator('text=Import Surveys')).toBeVisible();
  });
});
