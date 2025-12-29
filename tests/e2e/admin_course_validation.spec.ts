import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin course modal validation', () => {
  test.setTimeout(90_000);

  test('prevents saving a course without a title', async ({ page }: { page: Page }) => {
    const { baseUrl } = await loginAsAdmin(page);

    await page.goto(`${baseUrl}/admin/courses`, { waitUntil: 'domcontentloaded' });
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
