import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import waitForAuthReady from './helpers/waitForAuthReady';

const NAV_ITEMS = [
  { label: 'Dashboard', route: '/admin/dashboard' },
  { label: 'Users', route: '/admin/users' },
  { label: 'Organizations', route: '/admin/organizations' },
  { label: 'Courses', route: '/admin/courses' },
  { label: 'Analytics', route: '/admin/analytics' },
  { label: 'Settings', route: '/admin/settings' },
];

test.describe('Admin sidebar navigation', () => {
  test('sidebar links navigate or open org selector modal', async ({ page, baseURL }) => {
    const env = await loginAsAdmin(page);

  // Ensure we're on the dashboard first
  await page.goto(`${env.baseUrl}/admin/dashboard`);
  await waitForAuthReady(page).catch(() => {});
  await expect(page.locator('main, [role="main"], [data-test="dashboard-root"]').first()).toBeVisible({ timeout: 20000 });

    for (const item of NAV_ITEMS) {
      // Try to find a link or button with the label
      const link = page.getByRole('link', { name: new RegExp(item.label, 'i') }).first();
      const button = page.getByRole('button', { name: new RegExp(item.label, 'i') }).first();

      // Prefer clicking link, fallback to button
      const clickable = (await link.count()) > 0 ? link : button;

      await clickable.click();

      // If an org-selector modal appears, handle it and continue
      const modalHeading = page.getByRole('heading', { name: /choose an organization/i });
      if ((await modalHeading.count()) > 0) {
        await expect(modalHeading).toBeVisible();
        const close = page.getByRole('button', { name: /close/i }).first();
        if ((await close.count()) > 0) await close.click();
  await page.goto(`${env.baseUrl}/admin/dashboard`);
  await waitForAuthReady(page).catch(() => {});
  await expect(page.locator('main, [role="main"], [data-test="dashboard-root"]').first()).toBeVisible({ timeout: 10000 });
        continue;
      }

  // Otherwise verify the page rendered content and URL updated
  await waitForAuthReady(page).catch(() => {});
  const selector = (item as any).contentSelector || 'h1, h2, h3, main, [role="main"]';
  await expect(page.locator(selector).first()).toBeVisible({ timeout: 15_000 });
      expect(page.url()).toContain(item.route);

      // Return to dashboard for the next iteration
  await page.goto(`${env.baseUrl}/admin/dashboard`);
  await waitForAuthReady(page).catch(() => {});
  await expect(page.locator('main, [role="main"], [data-test="dashboard-root"]').first()).toBeVisible({ timeout: 10_000 });
    }
  });
});
