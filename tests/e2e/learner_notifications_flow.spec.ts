import { test, expect } from '@playwright/test';
import { getApiBaseUrl, getFrontendBaseUrl, waitForOk } from './helpers/env';

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

    await page.goto(`${frontendBase}/lms/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email Address').fill('user@pacificcoast.edu');
    await page.getByLabel('Password').fill('user123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/lms/dashboard', { timeout: 30_000 });

    await page.goto(`${frontendBase}/client/courses`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Notifications')).toBeVisible({ timeout: 20_000 });

    if (notificationsDisabled || !notificationId) {
      const learnerList = await page.request.get('/api/learner/notifications', { failOnStatusCode: false });
      expect(learnerList.status()).toBeLessThan(500);

      await page.getByLabel('Notifications').click();
      await expect(page.getByText('No notifications yet.')).toBeVisible({ timeout: 10_000 });
      return;
    }

    let visibleInLearnerApi = false;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const response = await page.request.get('/api/learner/notifications', { failOnStatusCode: false });
      if (response.ok()) {
        const payload = await response.json();
        const records = Array.isArray(payload?.data) ? payload.data : [];
        if (records.some((entry: any) => entry?.id === notificationId)) {
          visibleInLearnerApi = true;
          break;
        }
      }
      await page.waitForTimeout(400);
    }
    expect(visibleInLearnerApi).toBe(true);

    await page.getByLabel('Notifications').click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 20_000 });

    await page.getByText(title).click();

    let unreadCleared = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const unreadResponse = await page.request.get('/api/learner/notifications?unread_only=true', {
        failOnStatusCode: false,
      });
      if (unreadResponse.ok()) {
        const unreadPayload = await unreadResponse.json();
        const unreadRecords = Array.isArray(unreadPayload?.data) ? unreadPayload.data : [];
        if (!unreadRecords.some((entry: any) => entry?.id === notificationId)) {
          unreadCleared = true;
          break;
        }
      }
      await page.waitForTimeout(400);
    }

    expect(unreadCleared).toBe(true);
  });
});
