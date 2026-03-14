import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

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
    await expect(page.getByRole('heading', { name: /track impact across/i })).toBeVisible({ timeout: 20000 });

    for (const item of NAV_ITEMS) {
      // Try to find a link or button with the label
      const link = page.getByRole('link', { name: new RegExp(item.label, 'i') }).first();
      const button = page.getByRole('button', { name: new RegExp(item.label, 'i') }).first();

      // Prefer clicking link, fallback to button
      const clickable = (await link.count()) > 0 ? link : button;

      await clickable.click();

      // If the org selector modal appears, it should have heading 'Choose an organization'
      const modalHeading = page.getByRole('heading', { name: /choose an organization/i });
      if ((await modalHeading.count()) > 0) {
        await expect(modalHeading).toBeVisible();
        // Close modal to continue
        const close = page.getByRole('button', { name: /close/i }).first();
        if ((await close.count()) > 0) await close.click();
        // Also try the "Open Organizations" link; navigate back to dashboard
        await page.goto(`${env.baseUrl}/admin/dashboard`);
        continue;
      }

      // Otherwise expect the URL to include the target route (or at least the tail)
      await page.waitForLoadState('domcontentloaded');
      const url = page.url();
      expect(url).toContain(item.route);

      // Return to dashboard for the next iteration
      await page.goto(`${env.baseUrl}/admin/dashboard`);
      await expect(page.getByRole('heading', { name: /track impact across/i })).toBeVisible({ timeout: 10000 });
    }
  });
});
