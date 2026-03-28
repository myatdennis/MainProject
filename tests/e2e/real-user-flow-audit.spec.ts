import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { getFrontendBaseUrl, getApiBaseUrl, waitForOk } from './helpers/env';

type DebugSnapshot = {
  pathname: string;
  adminCatalogState?: {
    phase?: string;
    adminLoadStatus?: string;
  };
  learnerCatalogState?: {
    status?: string;
  };
  courseCount?: number;
  courseIds?: string[];
};

const readDebugSnapshot = async (page: Page): Promise<DebugSnapshot | null> =>
  page.evaluate(() => {
    const api = (window as any).__HUDDLE_E2E_DEBUG__;
    if (!api?.getSnapshot) return null;
    return api.getSnapshot();
  });

const logFlowStep = async (page: Page, label: string) => {
  const snapshot = await readDebugSnapshot(page);
  const bodyText = ((await page.locator('body').textContent()) || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  const payload = {
    label,
    url: page.url(),
    pathname: snapshot?.pathname ?? new URL(page.url()).pathname,
    adminPhase: snapshot?.adminCatalogState?.phase ?? null,
    adminStatus: snapshot?.adminCatalogState?.adminLoadStatus ?? null,
    learnerStatus: snapshot?.learnerCatalogState?.status ?? null,
    courseCount: snapshot?.courseCount ?? null,
    courseIds: snapshot?.courseIds ?? [],
    visible: bodyText,
  };
  console.log('[FLOW STEP]', JSON.stringify(payload));
};

const attachLearnerBypass = async (context: BrowserContext) => {
  await context.addInitScript(() => {
    try {
      (window as any).__E2E_BYPASS = true;
    } catch {}
  });
};

const loginAsLearner = async (page: Page) => {
  const baseUrl = getFrontendBaseUrl();
  await page.goto(`${baseUrl}/lms/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email Address').fill('user@pacificcoast.edu');
  await page.getByLabel('Password').fill('user123');
  await logFlowStep(page, 'learner-login-form');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/lms/dashboard', { timeout: 30_000 });
};

test.describe('Real user flow audit', () => {
  test.setTimeout(180_000);

  test('admin and learner flows stay coherent under real navigation', async ({ page, context, browser }) => {
    const baseUrl = getFrontendBaseUrl();
    const apiBaseUrl = getApiBaseUrl();

    await waitForOk(page.request, `${apiBaseUrl}/api/health`);
    await waitForOk(page.request, `${baseUrl}/`);
    await attachLearnerBypass(context);

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await logFlowStep(page, 'admin-open-app');

    await loginAsAdmin(page);
    await logFlowStep(page, 'admin-login-complete');
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    await page.getByRole('link', { name: /^Courses$/ }).click();
    await page.waitForURL('**/admin/courses', { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /Course Management/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-test="admin-course-card"]').first()).toBeVisible({ timeout: 20_000 });
    await logFlowStep(page, 'admin-courses-list');

    const firstCourseTitle = ((await page.locator('[data-test="admin-course-card"]').first().textContent()) || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    console.log('[TRACE COMPONENT]', JSON.stringify({ route: '/admin/courses', firstCourseTitle }));

    await page.locator('[data-test="admin-course-card"]').first().click();
    await page.waitForSelector('[data-testid="admin-course-builder"]', { timeout: 20_000 });
    await logFlowStep(page, 'admin-course-builder-open');

    const courseTitleField = page.getByLabel('Course Title *');
    await expect(courseTitleField).toBeVisible({ timeout: 20_000 });
    const originalTitle = await courseTitleField.inputValue();
    const nextTitle = `${originalTitle} QA`;
    await courseTitleField.fill(nextTitle);
    await logFlowStep(page, 'admin-course-builder-edited');

    await page.locator('[data-save-button]').click();
    await expect(page.getByText('Saved!')).toBeVisible({ timeout: 20_000 });
    await logFlowStep(page, 'admin-course-builder-saved');

    await page.getByRole('button', { name: /Back to Courses/i }).click();
    await page.waitForURL('**/admin/courses', { timeout: 20_000 });
    await expect(page.locator('[data-test="admin-course-card"]').first()).toBeVisible({ timeout: 20_000 });
    await logFlowStep(page, 'admin-back-to-courses');

    await page.locator('[data-test="admin-course-card"]').first().click();
    await page.waitForSelector('[data-testid="admin-course-builder"]', { timeout: 20_000 });
    await page.getByRole('button', { name: /Assign Course/i }).click();
    await expect(page.getByRole('heading', { name: /Assign Course/i })).toBeVisible({ timeout: 20_000 });
    await logFlowStep(page, 'admin-assign-modal-open');
    await page.getByLabel(/Close course assignment modal/i).click().catch(async () => {
      await page.keyboard.press('Escape');
    });

    await page.getByRole('link', { name: /^Surveys$/ }).click();
    await page.waitForURL('**/admin/surveys', { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /DEI Survey Platform/i })).toBeVisible({ timeout: 20_000 });
    await logFlowStep(page, 'admin-surveys');

    await page.getByRole('link', { name: /^Users$/ }).click();
    await page.waitForURL('**/admin/users', { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible({ timeout: 20_000 });
    await logFlowStep(page, 'admin-users');

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/surveys/);
    await logFlowStep(page, 'admin-browser-back');

    await page.goForward({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/users/);
    await logFlowStep(page, 'admin-browser-forward');

    const learnerContext = await browser.newContext();
    const learnerPage = await learnerContext.newPage();
    learnerPage.on('console', (msg) => console.log(`[learner:${msg.type()}] ${msg.text()}`));
    learnerPage.on('pageerror', (err) => console.error('[learner:pageerror]', err.message));

    await loginAsLearner(learnerPage);
    await expect(learnerPage.getByRole('heading', { name: /Welcome back/i })).toBeVisible({ timeout: 20_000 });
    await logFlowStep(learnerPage, 'learner-dashboard');

    await learnerPage.reload({ waitUntil: 'domcontentloaded' });
    await expect(learnerPage).toHaveURL(/\/lms\/dashboard/);
    await expect(learnerPage.getByRole('heading', { name: /Welcome back/i })).toBeVisible({ timeout: 20_000 });
    await logFlowStep(learnerPage, 'learner-dashboard-refresh');

    await learnerPage.goto(`${baseUrl}/client/courses`, { waitUntil: 'domcontentloaded' });
    await expect(learnerPage.locator('[data-test="client-course-card"]').first()).toBeVisible({ timeout: 20_000 });
    await logFlowStep(learnerPage, 'learner-assigned-courses');

    const firstPrimary = learnerPage.locator('[data-test="client-course-primary"]').first();
    await firstPrimary.click();
    await learnerPage.waitForTimeout(2000);
    await logFlowStep(learnerPage, 'learner-course-open');

    const currentPath = new URL(learnerPage.url()).pathname;
    const lessonMatch = currentPath.match(/\/lesson\/([^/]+)$/) || currentPath.match(/\/lessons\/([^/]+)$/);
    if (lessonMatch) {
      await learnerPage.reload({ waitUntil: 'domcontentloaded' });
      await learnerPage.waitForTimeout(1500);
      await logFlowStep(learnerPage, 'learner-deep-link-refresh');
    }

    await learnerPage.goto(`${baseUrl}/client/dashboard`, { waitUntil: 'domcontentloaded' });
    await expect(learnerPage.getByRole('heading', { name: /Welcome back/i })).toBeVisible({ timeout: 20_000 });
    await logFlowStep(learnerPage, 'learner-return-dashboard');

    await learnerContext.close();
  });
});
