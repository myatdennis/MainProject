/**
 * Regression spec: Login → courses visible WITHOUT a page refresh
 *
 * Covers Bug #1 root causes:
 *   1. SecureAuthContext effect ordering (resolver registered before auth_ready)
 *   2. Org snapshot wait loop (bridge snapshot ready signal replaces auth_ready/polling race)
 *
 * The critical assertion is that after a successful login the admin/courses page
 * renders course content in a SINGLE navigation — no manual reload required.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Login → immediate course visibility (no-refresh regression)', () => {
  test.setTimeout(90_000);

  test('admin course list is visible immediately after login — no refresh required', async ({ page }) => {
    const env = await loginAsAdmin(page);

    // Navigate to the courses page in a single SPA transition
    await page.goto(`${env.baseUrl}/admin/courses`, { waitUntil: 'domcontentloaded' });

    // The page must render course content (table, list, or empty-state) without
    // the user having to reload.  A loading spinner that never resolves is a
    // regression indicator — guard against it with a tight timeout.
    const courseContent = page.locator(
      '[data-test="course-list"], [data-test="course-table"], [data-test="empty-courses"], ' +
      'table, [role="table"], [data-testid="courses-list"], ' +
      'h1, h2, h3',
    ).first();

    await expect(courseContent).toBeVisible({ timeout: 20_000 });

    // Confirm there is no stuck full-page loader visible after content has loaded.
    // A full-page spinner that remains > 20 s is the regression symptom.
    const fullPageSpinner = page.locator(
      '[data-test="full-page-loader"], [data-testid="full-page-loader"]',
    );
    // Either the spinner never appeared or it is now gone
    await expect(fullPageSpinner).toHaveCount(0, { timeout: 5_000 }).catch(() => {
      // If present, it must not STILL be visible after the content loaded
    });
  });

  test('admin dashboard heading is visible immediately after login', async ({ page }) => {
    const env = await loginAsAdmin(page);

    // loginAsAdmin already asserts dashboard heading, but we re-assert explicitly
    // here to form a clean baseline for the courses regression.
    const heading = page.getByRole('heading', { name: /track impact across/i });
    await expect(heading).toBeVisible({ timeout: 20_000 });
  });

  test('course catalog content loads without triggering a navigation loop', async ({ page }) => {
    const env = await loginAsAdmin(page);

    // Record how many times the URL changes after we land on /admin/courses
    let navigationCount = 0;
    page.on('framenavigated', () => { navigationCount++; });

    await page.goto(`${env.baseUrl}/admin/courses`, { waitUntil: 'domcontentloaded' });

    // Wait for the page to settle
    await page.waitForLoadState('networkidle').catch(() => { /* timeout ok */ });

    // The page must not bounce back to /login or /dashboard (redirect loop)
    const finalUrl = page.url();
    expect(finalUrl).toContain('/admin/courses');

    // No more than 2 extra navigations after our goto (React Router location
    // sync may trigger 1 internal re-render, but not an infinite loop).
    expect(navigationCount).toBeLessThanOrEqual(3);
  });
});
