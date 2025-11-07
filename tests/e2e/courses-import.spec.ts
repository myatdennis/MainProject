import { test, expect } from '@playwright/test';

test.describe('Courses import UI', () => {
  test.setTimeout(120_000);

  test('JSON upload → summary → import → appears in Admin list', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:5174';

    // Login via Admin UI (demo credentials are pre-filled)
    await page.goto(`${base}/admin/login`);
    await expect(page.getByRole('heading', { name: /secure access/i })).toBeVisible();
    await page.getByRole('button', { name: /access admin portal/i }).click();
    await page.waitForURL(/\/admin\/dashboard/);

    // Navigate to Import page
    await page.goto(`${base}/admin/courses/import`);
    await expect(page.locator('h1:text("Import Courses")')).toBeVisible();

    // Prepare a tiny JSON file in-memory
    const title = `E2E Import Course ${Date.now()}`;
    const payload = {
      courses: [
        {
          title,
          slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          description: 'Created via e2e import test',
          status: 'draft',
          modules: [
            { title: 'Module 1', order: 1, lessons: [ { type: 'text', title: 'Intro', order: 1 } ] }
          ]
        }
      ]
    };

    const buffer = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');

    // The file input is hidden, but setInputFiles still works
  const fileChooser = page.locator('input[type="file"]');
    await fileChooser.setInputFiles({ name: 'e2e-import.json', mimeType: 'application/json', buffer });

    // Summary should show our course title and action badge
    await expect(page.locator('table >> text=' + title)).toBeVisible();

    // Click Import
    const importBtn = page.getByRole('button', { name: /import courses/i });
    await importBtn.click();

    // Navigates back to Admin list and shows the imported course
    await page.waitForURL(/\/admin\/courses$/);
    await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 15000 });
  });
});
