import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { getFrontendBaseUrl } from './helpers/env';

const gotoAdminSurveys = async (page: Page) => {
  const base = getFrontendBaseUrl();
  await page.goto(`${base}/admin/surveys`, { waitUntil: 'networkidle' });
};

test.describe('Admin survey operations', () => {
  test.setTimeout(120_000);

  test('lists seeded surveys and supports filtering/refreshing', async ({ page }) => {
    await loginAsAdmin(page);
    await gotoAdminSurveys(page);

    await expect(page.getByRole('heading', { name: 'DEI Survey Platform' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('survey-queue-status')).toBeVisible();

    const seededCardHeading = page.getByRole('heading', { name: /2025 dei pulse check/i });
    await expect(seededCardHeading).toBeVisible({ timeout: 20_000 });

    const searchInput = page.getByPlaceholder('Search surveys...');
    await searchInput.fill('pulse');
    await expect(seededCardHeading).toBeVisible();

    await searchInput.fill('no-matching-survey');
    await expect(page.getByText('No surveys found')).toBeVisible({ timeout: 10_000 });

    const resetFiltersButton = page.getByRole('button', { name: 'Reset filters' });
    await resetFiltersButton.click();
    await expect(seededCardHeading).toBeVisible({ timeout: 10_000 });

    const refreshButton = page.getByRole('button', { name: /refresh/i }).first();
    await refreshButton.click();
    await expect(refreshButton).toHaveText(/refreshing…/i, { timeout: 5_000 });
    await expect(refreshButton).toHaveText(/^refresh$/i, { timeout: 10_000 });
  });

  test('opens assign modal and saves selected organizations', async ({ page }) => {
    await loginAsAdmin(page);
    await gotoAdminSurveys(page);

    const surveyCard = page.getByTestId('survey-card-pulse-2025');
    await expect(surveyCard).toBeVisible({ timeout: 20_000 });

    const assignButton = page.getByTestId('survey-assign-pulse-2025');
    await assignButton.click();

    const modalHeading = page.getByRole('heading', { name: /assign survey to organizations/i });
    await expect(modalHeading).toBeVisible({ timeout: 10_000 });

    const selectOrg = async (label: string) => {
      const checkbox = page.getByLabel(label);
      if (!(await checkbox.isChecked())) {
        await checkbox.check();
      }
    };

    await selectOrg('Pacific Coast University');
    await selectOrg('Mountain View High School');

    const saveButton = page.getByRole('button', { name: /save assignment/i });
    await saveButton.click();
    await expect(saveButton).toHaveText(/saving…/i, { timeout: 5_000 });
    await expect(modalHeading).toBeHidden({ timeout: 10_000 });

    await expect(surveyCard.getByText('Pacific Coast University')).toBeVisible({ timeout: 10_000 });
    await expect(surveyCard.getByText('Mountain View High School')).toBeVisible({ timeout: 10_000 });
  });
});
