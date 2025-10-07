import { test, expect } from '@playwright/test';

const ports = [5175, 5176, 5177, 5178, 5179, 5180];

async function findBaseUrl(page) {
  for (const p of ports) {
    try {
      const res = await page.request.get(`http://localhost:${p}/`);
      if (res.ok()) return `http://localhost:${p}`;
    } catch (e) {
      // continue
    }
  }
  throw new Error('Dev server not found on expected ports');
}

test('admin can import survey via paste', async ({ page }) => {
  const baseUrl = await findBaseUrl(page);
  await page.goto(`${baseUrl}/admin/login`);
  await page.fill('#email', 'admin@thehuddleco.com');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Admin Dashboard', { timeout: 10000 });

  await page.goto(`${baseUrl}/admin/surveys/import`);
  const sample = JSON.stringify({ id: 'test-spec-1', title: 'Spec Survey', description: 'Imported via spec', type: 'custom', status: 'draft' });
  await page.fill('textarea', sample);
  await page.click('text=Parse JSON');
  await expect(page.locator('text=Spec Survey')).toBeVisible({ timeout: 5000 });
  await page.click('text=Save All');
  await expect(page.locator('text=Surveys imported successfully')).toBeVisible({ timeout: 5000 });
});
