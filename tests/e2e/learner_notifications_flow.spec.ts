import { test, expect } from '@playwright/test';
import { getApiBaseUrl, getFrontendBaseUrl, waitForOk } from './helpers/env';
import waitForAuthReady from './helpers/waitForAuthReady';
import { ensureE2EBypass } from './helpers/auth';
import createE2ERequestContext from './helpers/requestContext';

const apiBase = getApiBaseUrl();
const frontendBase = getFrontendBaseUrl();
const TEST_ORG_ID = 'demo-sandbox-org';

const adminHeaders = {
  'content-type': 'application/json',
  'x-user-role': 'admin',
  'x-e2e-bypass': 'true',
  'x-org-id': TEST_ORG_ID,
};

test.describe('learner notifications end-to-end', () => {
  test.setTimeout(120_000);

  test('admin notification appears for learner and can be marked read', async ({ page, request }) => {
    await waitForOk(request, `${apiBase}/api/health`);
    await waitForOk(request, `${frontendBase}/`);

    const title = `E2E learner notification ${Date.now()}`;

    const createResponse = await request.post(`${apiBase}/api/admin/notifications`, {
      headers: adminHeaders,
      failOnStatusCode: false,
      data: {
        title,
        body: 'This notification validates end-to-end delivery.',
        organizationId: TEST_ORG_ID,
      },
    });

    expect(createResponse.ok(), await createResponse.text()).toBeTruthy();
    const createPayload = await createResponse.json();
  const notificationsDisabled = Boolean(createPayload?.notificationsDisabled);
    const notificationId = createPayload?.data?.id as string | undefined;

  await ensureE2EBypass(page, { role: 'learner' });
  await page.goto(`${frontendBase}/lms/login`);
  try {
    await expect(page.getByLabel('Email Address')).toBeVisible({ timeout: 5_000 });
    await page.getByLabel('Email Address').fill('user@pacificcoast.edu');
    await page.getByLabel('Password').fill('user123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/lms/dashboard', { timeout: 30_000 });
  } catch (e) {
    try {
      await page.goto(`${frontendBase}/lms/dashboard`);
      await waitForAuthReady(page).catch(() => {});
      await expect(page.locator('main, [role="main"], [data-test="dashboard-root"]').first()).toBeVisible({ timeout: 30_000 });
    } catch (err) {}
  }

  await page.goto(`${frontendBase}/client/courses`);
  await waitForAuthReady(page).catch(() => {});
  await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Notifications')).toBeVisible({ timeout: 20_000 });

    if (notificationsDisabled || !notificationId) {
      const apiCtx = await createE2ERequestContext({ baseURL: apiBase });
      const learnerList = await apiCtx.get('/api/learner/notifications');
      await apiCtx.dispose();
      expect(learnerList.status()).toBeLessThan(500);

      await page.getByLabel('Notifications').click();
      await expect(page.getByText('No notifications yet.')).toBeVisible({ timeout: 10_000 });
      return;
    }

    const apiCtx = await createE2ERequestContext({ baseURL: apiBase });
    let visibleInLearnerApi = false;
    // Poll the learner API deterministically until the notification appears
    await expect.poll(async () => {
      const response = await apiCtx.get('/api/learner/notifications');
      if (!response.ok()) return false;
      const payload = await response.json();
      const records = Array.isArray(payload?.data) ? payload.data : [];
      return records.some((entry: any) => entry?.id === notificationId);
  }, { timeout: 30_000, intervals: [500, 500] }).toBeTruthy();
    await apiCtx.dispose();
    expect(visibleInLearnerApi).toBe(true);

    await page.getByLabel('Notifications').click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 20_000 });

    await page.getByText(title).click();

    let unreadCleared = false;
    const apiCtx2 = await createE2ERequestContext({ baseURL: apiBase });
    await expect.poll(async () => {
      const unreadResponse = await apiCtx2.get('/api/learner/notifications?unread_only=true');
      if (!unreadResponse.ok()) return false;
      const unreadPayload = await unreadResponse.json();
      const unreadRecords = Array.isArray(unreadPayload?.data) ? unreadPayload.data : [];
      return !unreadRecords.some((entry: any) => entry?.id === notificationId);
  }, { timeout: 20_000, intervals: [500, 500] }).toBeTruthy();
    await apiCtx2.dispose();

    expect(unreadCleared).toBe(true);
  });
});
