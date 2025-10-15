import { test, expect } from '@playwright/test';

test.describe('Surveys import smoke', () => {
	test('loads admin surveys import placeholder', async ({ page }) => {
		// Use the default vite preview port used locally
		const base = process.env.TEST_BASE_URL || 'http://localhost:5173';
		await page.goto(`${base}/admin/surveys/import`);
		await expect(page).toHaveTitle(/Admin/);
		await expect(page.locator('text=Import Surveys')).toBeVisible();
	});
});

