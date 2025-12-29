import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { getFrontendBaseUrl } from './helpers/env';

test.describe('Survey queue status offline/online transitions', () => {
  test.setTimeout(120_000);

  test('reflects offline + recovery states inside learner previews', async ({ page, context }) => {
    const { baseUrl } = await loginAsAdmin(page);
    const base = baseUrl ?? getFrontendBaseUrl();

    await page.goto(`${base}/admin/course-builder/new`, { waitUntil: 'domcontentloaded' });
    const previewStatus = page.locator('[data-testid="survey-preview-queue-status"]');
    await expect(previewStatus).toBeVisible({ timeout: 30_000 });

    const assertOfflineCopy = async (locator: ReturnType<Page['locator']>, timeout = 5_000) => {
      await expect(locator).toContainText(/offline mode/i, { timeout });
    };

    try {
      await context.setOffline(true);
      await assertOfflineCopy(previewStatus);

      await context.setOffline(false);
      await expect(previewStatus).not.toContainText(/offline mode/i, { timeout: 10_000 });

      await page.getByRole('button', { name: 'Detach' }).click();
      const livePreviewStatus = page.locator('[data-testid="live-preview-queue-status"]');
      await expect(livePreviewStatus).toBeVisible({ timeout: 10_000 });

      await context.setOffline(true);
      await assertOfflineCopy(livePreviewStatus);

      await context.setOffline(false);
      await expect(livePreviewStatus).not.toContainText(/offline mode/i, { timeout: 10_000 });

      await page.getByRole('button', { name: /close preview/i }).click({ timeout: 5_000 }).catch(async () => {
        await page.click('button[title="Close Preview"]', { timeout: 5_000 }).catch(() => {});
      });
    } finally {
      await context.setOffline(false).catch(() => {});
    }
  });
});
