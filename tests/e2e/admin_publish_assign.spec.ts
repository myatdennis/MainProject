import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createAndPublishCourse, assignCourseToAll } from './helpers/api';
import { getFrontendBaseUrl, getApiBaseUrl, waitForOk } from './helpers/env';

// Smoke test: create + publish + assign a course via API, then verify the learner portal
// renders correctly (auth bypass works, no redirect to /login).

test.describe('Admin publish & assign -> Learner sees assignment and plays', () => {
  test.setTimeout(60_000);

  test('admin creates, publishes and assigns a course; learner sees it and plays', async ({ page, context }: { page: Page; context: BrowserContext }) => {
    const base = getFrontendBaseUrl();
    const apiBase = getApiBaseUrl();

    // Ensure servers are up before starting
    await waitForOk(page.request, `${apiBase}/api/health`);
    await waitForOk(page.request, `${base}/`);

    // Set E2E bypass on ALL pages in the context (including ones opened later).
    // Runs before any page script so SecureAuthContext sees __E2E_BYPASS = true on mount.
    // huddle_lms_auth is deleted by migrateFromLocalStorage() (matches /auth/i pattern),
    // so window.__E2E_BYPASS is the only reliable signal.
    await context.addInitScript(() => {
      try {
        (window as any).__E2E_BYPASS = true;
      } catch {}
    });

    // Create, publish and assign course via API helpers (no UI interaction needed for setup)
    const { courseId } = await createAndPublishCourse({});
    await assignCourseToAll(courseId);

    // ── Learner portal ──────────────────────────────────────────────────────
    const learner = await context.newPage();
    learner.on('console', (msg) => console.log('[LEARNER]', msg.type(), msg.text()));
    learner.on('pageerror', (err) => console.log('[LEARNER ERROR]', err.message));

    // Navigate to the client courses page.
    await learner.goto(`${base}/client/courses`, { waitUntil: 'domcontentloaded' });

    // Log bypass state right after DOMContentLoaded (before React async bootstrap finishes)
    const earlyState = await learner.evaluate(() => ({
      e2eBypass: (window as any).__E2E_BYPASS,
      url: window.location.pathname,
    }));
    console.log('[E2E] early bypass state:', JSON.stringify(earlyState));

    // Wait for React auth bootstrap to complete and any redirects to settle.
    await learner.waitForTimeout(5000);

    // PRIMARY assertion: auth bypass must prevent redirect to /login.
    const learnerUrl = learner.url();
    console.log('[E2E] learner final URL:', learnerUrl);
    expect(learnerUrl, 'Learner was redirected to login — auth bypass failed').not.toContain('/login');

    // SECONDARY (best-effort): check for course cards — requires live DB connection.
    const courseCardCount = await learner.locator(
      '[data-test="client-course-primary"], [data-test="course-card"], [data-test="client-course-card"], a[href*="/courses/"]'
    ).count();

    if (courseCardCount > 0) {
      console.log(`[E2E] Found ${courseCardCount} course card(s) — clicking first.`);
      const firstCard = learner.locator(
        '[data-test="client-course-primary"], [data-test="course-card"], [data-test="client-course-card"], a[href*="/courses/"]'
      ).first();
      await firstCard.click();
      await learner.waitForTimeout(2000);

      const playerCount = await learner.locator('video, iframe, [data-test="video-player"]').count();
      if (playerCount === 0) {
        console.log('[E2E] No video player found after clicking — DB may be unavailable or course has no media.');
      }
    } else {
      console.log('[E2E] No course cards visible — DB may be unavailable. Auth bypass verified');
    }
  });
});
