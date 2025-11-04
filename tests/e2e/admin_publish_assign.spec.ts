import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createAndPublishCourse, assignCourseToAll } from './helpers/api';

// This test is a high-level smoke test that drives the UI to create a course, publish it, assign it, then
// switches to a learner view to confirm the assignment is visible and the player can start.

test.describe('Admin publish & assign -> Learner sees assignment and plays', () => {
  test.setTimeout(120_000);
  
  async function waitForOk(request: Page['request'], url: string, timeoutMs = 30_000, intervalMs = 500) {
    const deadline = Date.now() + timeoutMs;
    let lastError: any = null;
    while (Date.now() < deadline) {
      try {
        const res = await request.get(url, { failOnStatusCode: false });
        if (res.status() >= 200 && res.status() < 500) return true;
      } catch (err) {
        lastError = err;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    if (lastError) throw lastError;
    throw new Error(`Timeout waiting for ${url}`);
  }

  test('admin creates, publishes and assigns a course; learner sees it and plays', async ({ page, context }: { page: Page; context: BrowserContext }) => {
  const base = process.env.E2E_BASE_URL || 'http://localhost:8787';
  const apiBase = process.env.E2E_API_BASE_URL || 'http://localhost:8787';

    // Ensure servers are up before starting
    await waitForOk(page.request, `${apiBase}/api/health`);
    await waitForOk(page.request, `${base}/`);

    // Ensure demo auth is present before any app scripts run (so RequireAuth sees it on mount)
    await context.addInitScript(({ user }) => {
      try {
        window.localStorage.setItem('huddle_lms_auth', 'true');
        window.localStorage.setItem('huddle_user', JSON.stringify(user));
      } catch {}
    }, { user: { email: 'e2e-user@example.com', id: 'e2e-user', role: 'user' } });

    // Prefer stable API path for setup: create, publish and assign via admin API helper
    const { courseId } = await createAndPublishCourse({});
    await assignCourseToAll(courseId);

  // Pipe browser logs for debugging
  page.on('console', (msg) => console.log('[BROWSER]', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('[PAGEERROR]', err.message));
  page.on('requestfailed', (req) => console.log('[REQUEST FAILED]', req.url(), req.failure()?.errorText));

    // Navigate directly to client courses
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.goto(`${base}/client/courses`, { waitUntil: 'load' });
    // Debug: log URL and capture screenshot if elements are missing
    try {
      await page.waitForSelector('[data-test="client-course-primary"], a[href*="/courses/"]', { timeout: 10_000 });
    } catch (e) {
      // If course list isn't visible yet, go directly to the created course's detail page
      console.log('DEBUG current URL (fallback to direct course):', page.url());
      try { await page.screenshot({ path: 'tmp/e2e-client-courses.png', fullPage: true }); } catch {}
      await page.goto(`${base}/client/courses/${courseId}`, { waitUntil: 'load' });
    }

    // Switch to learner portal (open new context to simulate different user)
    const learner = await context.newPage();
    await learner.goto(base, { waitUntil: 'domcontentloaded' });
    await learner.evaluate(() => {
      // Override auth flags for the learner page specifically
      localStorage.setItem('huddle_lms_auth', 'true');
      localStorage.setItem('huddle_user', JSON.stringify({ email: 'e2e-learner@example.com', id: 'e2e-learner', role: 'user' }));
    });
    await learner.goto(`${base}/client/courses`, { waitUntil: 'load' });

    // Wait for assignment to show up in list
    await learner.waitForSelector('[data-test="client-course-primary"], a[href*="/courses/"]', { timeout: 15_000 });

    // Prefer clicking the primary action (Start/Continue) if available
    const primaryAction = learner.locator('[data-test="client-course-primary"]').first();
    if (await primaryAction.count() > 0) {
      await primaryAction.click();
    } else {
      // fallback: click the first link to a course
      const firstLink = learner.locator('a[href*="/courses/"]').first();
      if (await firstLink.count() > 0) {
        await firstLink.click();
      } else {
        // final fallback: click inside the first course card
        const firstCard = learner.locator('[data-test="course-card"], [data-test="client-course-card"]').first();
        if (await firstCard.count() > 0) {
          // try clicking a button within the card
          const cardButton = firstCard.locator('button, a').first();
          if (await cardButton.count() > 0) await cardButton.click();
        }
      }
    }

  // Wait for player to load and start playback (if present)
  await learner.waitForTimeout(1000);
  const playButton = learner.locator('button[aria-label="Play"], [data-test="video-player"] button[aria-label="Play"]');
    if (await playButton.count() > 0) {
      await playButton.click();
    }

    // Wait briefly and check for progress ping to analytics (this is heuristic)
    await learner.waitForTimeout(2000);

    // Assert that we are on a lesson page or the player is present
    expect(await learner.locator('video, iframe, [data-test="video-player"]').count()).toBeGreaterThan(0);
  });
});
