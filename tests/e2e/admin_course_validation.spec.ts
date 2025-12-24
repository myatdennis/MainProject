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

test.describe('Admin course modal validation', () => {
  test.setTimeout(90_000);

  test('prevents saving a course without a title', async ({ page }: { page: Page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:5174';
    const apiBase = process.env.E2E_API_BASE_URL || 'http://localhost:8787';

    await waitForOk(page.request, `${apiBase}/api/health`);
    await waitForOk(page.request, `${base}/`);

  await page.goto(`${base}/admin/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#email', { timeout: 20_000 });
  await page.fill('#email', 'admin@thehuddleco.com');
  await page.fill('#password', 'admin123');
    await page.click('button:has-text("Access Admin Portal")');
    await page.waitForURL('**/admin/dashboard', { timeout: 20_000 });

    await page.goto(`${base}/admin/courses`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-test="admin-new-course"]', { timeout: 20_000 });

    // Stub window.alert so we can capture validation copy without relying on browser dialogs
    await page.evaluate(() => {
      (window as any).__lastAlertMessage = null;
      window.alert = (message: string) => {
        (window as any).__lastAlertMessage = message;
      };
    });

    const courseCards = page.locator('[data-test="admin-course-card"]');
    const initialCount = await courseCards.count();

    await page.click('[data-test="admin-new-course"]');
    await page.waitForSelector('[data-test="course-modal-title"]');

    await page.click('[data-test="course-modal-save"]');

    const alertMessage = await page.evaluate(() => (window as any).__lastAlertMessage as string | null);
    expect(alertMessage).toBeTruthy();
    expect(alertMessage).toContain('Course title is required');

    await page.click('[data-test="course-modal-cancel"]');

    await expect(courseCards).toHaveCount(initialCount);
  });
});
