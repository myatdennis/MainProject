import { test, expect } from '@playwright/test';

test('admin survey import flow (paste JSON)', async ({ page }) => {
  await page.goto('http://localhost:5173/admin/surveys/import');

  // Paste a minimal survey JSON
  const sample = JSON.stringify({
    id: 'test-survey-1',
    title: 'Imported Survey',
    description: 'A survey imported via test',
    type: 'custom',
    status: 'draft'
  });

  await page.fill('textarea', sample);
  await page.click('text=Parse JSON');

  // Expect preview to show the title
  await expect(page.locator('text=Imported Survey')).toBeVisible();

  // Click Save All
  await page.click('text=Save All');

  // Expect success message
  await expect(page.locator('text=Surveys imported successfully')).toBeVisible();
});
