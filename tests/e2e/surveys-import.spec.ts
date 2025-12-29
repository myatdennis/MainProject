import { test, expect } from '@playwright/test';
import { getFrontendBaseUrl } from './helpers/env';

test.describe('Surveys import smoke', () => {
	test('loads admin surveys import placeholder', async ({ page, context }) => {
		// Use E2E_BASE_URL (Vite dev) for consistency across CI and local
		const base = process.env.E2E_BASE_URL || process.env.TEST_BASE_URL || getFrontendBaseUrl();

		// Seed admin auth before app scripts run so guarded routes allow access
			await context.addInitScript(({ user }) => {
			try {
					window.localStorage.setItem('huddle_lms_auth', 'true');
					window.localStorage.setItem('huddle_admin_auth', 'true');
				window.localStorage.setItem('huddle_user', JSON.stringify(user));
			} catch {}
		}, { user: { email: 'e2e-admin@example.com', id: 'e2e-admin', role: 'admin' } });

		await page.goto(`${base}/admin/surveys/import`);
		await expect(page).toHaveTitle(/Admin/);
		await expect(page.locator('text=Import Surveys')).toBeVisible();
	});
});

