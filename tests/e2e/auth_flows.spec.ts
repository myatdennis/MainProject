import { test, expect, Page } from '@playwright/test';

const waitForOk = async (request: Page['request'], url: string, timeoutMs = 30_000, intervalMs = 500) => {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await request.get(url, { failOnStatusCode: false });
      if (res.status() >= 200 && res.status() < 500) {
        return;
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  if (lastError) {
    throw lastError;
  }
  throw new Error(`Timeout waiting for ${url}`);
};

test.describe('Portal authentication flows', () => {
  test.setTimeout(90_000);

  test('admin and LMS demo users can sign in', async ({ page }: { page: Page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:5174';
    const apiBase = process.env.E2E_API_BASE_URL || 'http://localhost:8787';

    await waitForOk(page.request, `${apiBase}/api/health`);
    await waitForOk(page.request, `${base}/`);

    // Admin login flow
    await page.goto(`${base}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#email', 'admin@thehuddleco.com');
    await page.fill('#password', 'admin123');
    await page.click('button:has-text("Access Admin Portal")');
    await page.waitForURL('**/admin/dashboard', { timeout: 20_000 });
  await expect(page.getByText('Executive Overview')).toBeVisible({ timeout: 20_000 });

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
