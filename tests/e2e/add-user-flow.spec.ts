import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { provisionUser } from './helpers/api';

test.describe('Add User → Users page visibility', () => {
  test.setTimeout(90_000);

  test('admin-provisioned learner appears on Users page immediately', async ({ page }) => {
    const env = await loginAsAdmin(page);
    const email = `e2e.user.${Date.now()}@example.com`;

  const response = await provisionUser({ email });
  expect(response.setupLink).toBeTruthy();

    await page.goto(`${env.baseUrl}/admin/users`, { waitUntil: 'domcontentloaded' });

    const searchInput = page.locator('input[placeholder="Search users..."]');
    await searchInput.waitFor({ state: 'visible', timeout: 15_000 });
    await searchInput.fill(email);

    await expect(page.getByText(email)).toBeVisible({ timeout: 20_000 });
  });

  test('re-provisioning an existing user reports existingAccount and stays visible', async ({ page }) => {
    const env = await loginAsAdmin(page);
    const email = `e2e.existing.${Date.now()}@example.com`;

  const firstResponse = await provisionUser({ email });
  expect(firstResponse.created).toBe(true);

  const secondResponse = await provisionUser({ email });
  expect(secondResponse.existingAccount).toBe(true);

    await page.goto(`${env.baseUrl}/admin/users`, { waitUntil: 'domcontentloaded' });
    const searchInput = page.locator('input[placeholder="Search users..."]');
    await searchInput.waitFor({ state: 'visible', timeout: 15_000 });
    await searchInput.fill(email);

    await expect(page.getByText(email)).toBeVisible({ timeout: 20_000 });
  });
});
