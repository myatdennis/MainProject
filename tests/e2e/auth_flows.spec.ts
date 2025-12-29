import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { getFrontendBaseUrl } from './helpers/env';

test.describe('Portal authentication flows', () => {
  test.setTimeout(90_000);

  test('admin and LMS demo users can sign in', async ({ page }: { page: Page }) => {
  const { baseUrl } = await loginAsAdmin(page);
    const base = baseUrl ?? getFrontendBaseUrl();

    // Reset session storage/cookies before LMS login
    await page.context().clearCookies();
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    // LMS login flow
    await page.goto(`${base}/lms/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#email', 'user@pacificcoast.edu');
    await page.fill('#password', 'user123');
    await page.click('[data-test="lms-sign-in"]');
    await page.waitForURL('**/lms/dashboard', { timeout: 20_000 });

    const learningPathHeading = page.getByText('Your Learning Path');
    if (await learningPathHeading.count()) {
      await expect(learningPathHeading).toBeVisible({ timeout: 20_000 });
    } else {
      await expect(
        page.getByRole('heading', { name: 'Connect Supabase to enable the learner portal' })
      ).toBeVisible({ timeout: 20_000 });
    }
  });
});
