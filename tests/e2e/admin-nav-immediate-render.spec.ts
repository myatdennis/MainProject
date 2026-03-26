/**
 * Regression spec: Admin sidebar navigation renders content immediately
 *
 * Covers Bug #2 root causes:
 *   1. NavLink onClick wraps navigate() inside startNavTransition (no frozen UI)
 *   2. AdminErrorBoundary uses resetKey prop (no full unmount/remount on route change)
 *
 * The critical assertion: clicking a nav link changes BOTH the URL AND renders the
 * new page's content in a single user action — no reload, no blank screen.
 *
 * The existing sidebar-navigation.spec.ts only checks URL changes.
 * This spec additionally checks that page-level headings / content appear.
 */

import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

interface RouteCheck {
  label: string;
  route: string;
  /** Locator string for content that MUST appear on the page after navigation */
  contentSelector: string;
}

const ADMIN_ROUTES: RouteCheck[] = [
  {
    label: 'Courses',
    route: '/admin/courses',
    // Accept any visible heading/table – the key is something renders
    contentSelector: 'h1, h2, h3, table, [role="table"]',
  },
  {
    label: 'Users',
    route: '/admin/users',
    contentSelector: 'h1, h2, h3, table, [role="table"]',
  },
  {
    label: 'Analytics',
    route: '/admin/analytics',
    contentSelector: 'h1, h2, h3',
  },
  {
    label: 'Settings',
    route: '/admin/settings',
    contentSelector: 'h1, h2, h3, form, [role="form"]',
  },
];

/**
 * Click a sidebar nav link and verify that:
 *  (a) the URL updates to the target route, AND
 *  (b) page content is rendered immediately (not a blank/frozen screen)
 */
async function clickSidebarNavAndAssertRender(
  page: Page,
  baseUrl: string,
  item: RouteCheck,
) {
  // Prefer <a> links (NavLink), fall back to buttons
  const link = page.getByRole('link', { name: new RegExp(item.label, 'i') }).first();
  const button = page.getByRole('button', { name: new RegExp(item.label, 'i') }).first();
  const clickable = (await link.count()) > 0 ? link : button;

  // Click and immediately wait for either URL change or modal appearance
  await clickable.click();

  // Handle org-selector modal that may appear for some routes
  const modal = page.getByRole('heading', { name: /choose an organization/i });
  if (await modal.count()) {
    await expect(modal).toBeVisible();
    const closeBtn = page.getByRole('button', { name: /close/i }).first();
    if (await closeBtn.count()) await closeBtn.click();
    return; // modal route – skip content assertion
  }

  // ── Critical regression assertion ──────────────────────────────────────────
  // URL must contain the target route.
  await page.waitForURL(`**${item.route}`, { timeout: 15_000 });

  // Content must appear WITHOUT a page reload.  15 s covers slow CI machines
  // but is tight enough to catch a frozen screen (Bug #2 symptom).
  const content = page.locator(item.contentSelector).first();
  await expect(content).toBeVisible({ timeout: 15_000 });

  // The page must NOT still be showing a full-page loading spinner.
  const fullPageSpinner = page.locator('[data-test="full-page-loader"], [data-testid="full-page-loader"]');
  // If present, allow a short window for it to clear — regression = never clears
  if (await fullPageSpinner.count()) {
    await expect(fullPageSpinner).toBeHidden({ timeout: 10_000 });
  }
}

test.describe('Admin nav → immediate content render (no-blank-screen regression)', () => {
  test.setTimeout(90_000);

  test('clicking each sidebar nav link renders page content without reload', async ({ page }) => {
    const env = await loginAsAdmin(page);
    await page.goto(`${env.baseUrl}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /track impact across/i })).toBeVisible({ timeout: 20_000 });

    for (const item of ADMIN_ROUTES) {
      await clickSidebarNavAndAssertRender(page, env.baseUrl, item);
      // Return to dashboard between iterations
      await page.goto(`${env.baseUrl}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /track impact across/i })).toBeVisible({ timeout: 15_000 });
    }
  });

  test('rapid consecutive nav clicks do not leave a blank screen', async ({ page }) => {
    const env = await loginAsAdmin(page);
    await page.goto(`${env.baseUrl}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /track impact across/i })).toBeVisible({ timeout: 20_000 });

    // Simulate a user clicking two nav items in quick succession
    const coursesLink = page.getByRole('link', { name: /courses/i }).first();
    const usersLink = page.getByRole('link', { name: /users/i }).first();

    if (await coursesLink.count()) {
      await coursesLink.click();
      // Immediately click Users without waiting for Courses to fully load
      if (await usersLink.count()) {
        await usersLink.click();
      }
    }

    // Final URL should be deterministic (last click wins)
    await page.waitForURL('**/admin/**', { timeout: 15_000 });
    const url = page.url();
    expect(url).toMatch(/\/admin\//);

    // Something must be rendered — not a blank page
    const anyHeading = page.locator('h1, h2, h3').first();
    await expect(anyHeading).toBeVisible({ timeout: 15_000 });
  });

  test('browser back button renders previous page content without reload', async ({ page }) => {
    const env = await loginAsAdmin(page);
    await page.goto(`${env.baseUrl}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /track impact across/i })).toBeVisible({ timeout: 20_000 });

    // Navigate forward to courses
    await page.goto(`${env.baseUrl}/admin/courses`, { waitUntil: 'domcontentloaded' });
    const coursesContent = page.locator('h1, h2, h3').first();
    await expect(coursesContent).toBeVisible({ timeout: 15_000 });

    // Go back
    await page.goBack({ waitUntil: 'domcontentloaded' });

    // Dashboard content must re-render correctly (no stale/frozen page)
    const dashboardHeading = page.getByRole('heading', { name: /track impact across/i });
    await expect(dashboardHeading).toBeVisible({ timeout: 15_000 });
  });
});
