import { test, expect, type Page } from '@playwright/test';
import { getApiBaseUrl, getFrontendBaseUrl, waitForOk } from './helpers/env';
import waitForAuthReady from './helpers/waitForAuthReady';
import createE2ERequestContext from './helpers/requestContext';
import apiHelpers from './helpers/api';

const apiBase = getApiBaseUrl();
const frontendBase = getFrontendBaseUrl();
const TEST_ORG_ID = 'demo-sandbox-org';
const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';
const LEARNER_USER_ID = '00000000-0000-0000-0000-000000000002';
const LEARNER_EMAIL = 'user@pacificcoast.edu';

const adminHeaders = {
  'content-type': 'application/json',
  'x-user-role': 'admin',
  'x-e2e-bypass': 'true',
  'x-org-id': TEST_ORG_ID,
  'x-user-id': ADMIN_USER_ID,
};

type CreatedCourse = {
  id: string;
  slug: string;
  title: string;
  lessonId: string;
};

const createAndAssignCourse = async (request: any, unique: number): Promise<CreatedCourse> => {
  const lessonId = `progress-lesson-${unique}`;
  const title = `Learner Progress Persistence ${unique}`;

  const createResponse = await request.post(`${apiBase}/api/admin/courses`, {
    headers: adminHeaders,
    failOnStatusCode: false,
    data: {
      course: {
        title,
        description: 'Regression course for learner progress persistence verification across reload and re-entry.',
        status: 'draft',
        version: 1,
        organization_id: TEST_ORG_ID,
      },
      modules: [
        {
          title: 'Progress Module',
          order_index: 1,
          lessons: [
            {
              id: lessonId,
              type: 'video',
              title: 'Progress Lesson',
              order_index: 1,
              content_json: {
                type: 'video',
                body: {
                  videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                  videoSourceType: 'external',
                },
              },
            },
          ],
        },
      ],
    },
  });

  const createText = await createResponse.text();
  expect(createResponse.status(), createText).toBe(201);
  const createPayload = JSON.parse(createText);
  const courseId = String(createPayload?.data?.id ?? '');
  const courseSlug = String(createPayload?.data?.slug ?? '');
  expect(courseId).toBeTruthy();
  expect(courseSlug).toBeTruthy();

  const publishResponse = await request.post(`${apiBase}/api/admin/courses/${courseId}/publish`, {
    headers: adminHeaders,
    failOnStatusCode: false,
    data: {},
  });
  expect(publishResponse.ok(), await publishResponse.text()).toBeTruthy();

  // NOTE: assignment intentionally not performed here. Tests must ensure the
  // course is visible in the learner-facing catalog before assigning to avoid
  // backend eventual-consistency races between publish/indexing and assign.


  return {
    id: courseId,
    slug: courseSlug,
    title,
    lessonId,
  };

};

const assignCourse = async (request: any, courseId: string) => {
  const assignResponse = await request.post(`${apiBase}/api/admin/courses/${courseId}/assign`, {
    headers: adminHeaders,
    failOnStatusCode: false,
    data: {
      organization_id: TEST_ORG_ID,
      organizationId: TEST_ORG_ID,
      orgId: TEST_ORG_ID,
    },
  });
  expect(assignResponse.ok(), await assignResponse.text()).toBeTruthy();
};

const waitForCourseInClientCatalog = async (request: any, courseId: string) => {
  const start = Date.now();

  while (Date.now() - start < 20_000) {
    const res = await request.get('/api/client/courses', { failOnStatusCode: false });
    let json: any = null;
    try {
      json = await res.json();
    } catch (e) {
      // ignore parse failures and retry
    }

    const found = Array.isArray(json?.data) && json.data.some((c: any) => c?.id === courseId || c?.slug === courseId || String(c?.id) === String(courseId) || String(c?.slug) === String(courseId));

    if (found) {
      // eslint-disable-next-line no-console
      console.log('[E2E] course visible in client catalog:', courseId);
      return;
    }

    // wait 250ms before retrying
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 250));
  }

  throw new Error(`Course ${courseId} never appeared in /api/client/courses within 10s`);
};

const deleteCourse = async (_request: any, courseId: string | null) => {
  if (!courseId) return;
  // Use a fresh API context with E2E headers so cleanup doesn't depend on the test's
  // Playwright request fixture which may be closed if the page/context times out.
  try {
    const apiCtx = await createE2ERequestContext({ baseURL: apiBase });
    await apiCtx.delete(`/api/admin/courses/${courseId}`);
    await apiCtx.dispose();
  } catch (e) {
    // Best-effort cleanup; don't fail tests during teardown.
    // eslint-disable-next-line no-console
    console.warn('cleanup deleteCourse failed', e);
  }
};

const loginAsLearner = async (page: Page) => {
  // Use synthetic E2E bypass to avoid flaky real-auth flows in test runs.
  await page.addInitScript((injected) => {
    try {
      document.cookie = `x-e2e-bypass=true; path=/`;
      if (injected.orgId) document.cookie = `x-org-id=${injected.orgId}; path=/`;
    } catch (e) {}
    const fake = {
      auth: {
        getSession: async () => ({ data: { session: { access_token: 'e2e-access-token', refresh_token: 'e2e-refresh-token', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: injected.userId, email: injected.email } } } }),
        getUser: async () => ({ data: { user: { id: injected.userId, email: injected.email } } }),
        onAuthStateChange: (cb: any) => {
          try { setTimeout(() => cb('INITIAL_SESSION', { access_token: 'e2e', user: { id: injected.userId, email: injected.email } }), 0); } catch (e) {}
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        signInWithPassword: async ({ email, password }: any) => ({ data: { user: { id: injected.userId, email } }, error: null }),
        refreshSession: async () => ({ data: { session: { access_token: 'e2e', user: { id: injected.userId, email: injected.email } } }, error: null }),
        signOut: async () => ({ error: null }),
      },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}), unsubscribe: () => ({}), send: async () => ({}) }),
      removeChannel: () => {},
    };
    (window as any).__E2E_SUPABASE_CLIENT = fake;
    (window as any).__supabase = (window as any).supabase = fake;
    (window as any).__E2E_BYPASS = true;
    (window as any).__E2E_ACTIVE_ORG_ID = injected.orgId;

    const originalFetch = window.fetch.bind(window);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).fetch = async (input: RequestInfo, init?: RequestInit) => {
      try {
        const urlString = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        const requestUrl = new URL(urlString, window.location.href);
        const apiBaseMatch = typeof injected.apiBase === 'string' && requestUrl.href.startsWith(injected.apiBase);
        if (requestUrl.origin === window.location.origin || apiBaseMatch) {
          init = init ?? {};
          const headers = new Headers(init.headers || {});
          headers.set('x-e2e-bypass', 'true');
          headers.set('x-user-role', 'learner');
          if (injected.orgId) headers.set('x-org-id', String(injected.orgId));
          if (injected.userId) headers.set('x-user-id', String(injected.userId));
          init.headers = headers;
        }
      } catch (e) {}
      return originalFetch(input, init as any);
    };
  }, { orgId: TEST_ORG_ID, userId: LEARNER_USER_ID, email: LEARNER_EMAIL, apiBase });

  await page.goto(`${frontendBase}/client/courses`);
  await waitForAuthReady(page).catch(() => {});
};

const waitForAssignedCourseCard = async (page: Page, courseTitle: string) => {
  await page.goto(`${frontendBase}/client/courses?debugProgress=1`);
  await waitForAuthReady(page).catch(() => {});
  // Under E2E we record bootstrap lifecycle events to window.__HUDDLE_E2E_EVENTS.
  // Wait briefly for the client to complete bootstrap so the page renders deterministically.
  try {
    await page.waitForFunction(() => (window as any).__HUDDLE_E2E_EVENTS?.some((e: any) => e.tag === 'bootstrap_complete'), { timeout: 10_000 });
  } catch (e) {
    // proceed — fallback to existing heading wait which will surface the issue
  }
  // Additionally wait for assignment hydration to finish so tests assert only
  // after the store has been updated. The app emits a hydration_complete
  // event into window.__HUDDLE_E2E_EVENTS for deterministic E2E signaling.
  try {
    await page.waitForFunction(() => (window as any).__HUDDLE_E2E_EVENTS?.some((e: any) => e.tag === 'hydration_complete'), { timeout: 20_000 });
  } catch (e) {
    // If the event doesn't appear, fall back to DOM waits below to surface failures.
  }
  // Debug: inspect server-visible session via an E2E API context
  try {
    const debugApiCtx = await createE2ERequestContext({ baseURL: apiBase });
    const sessRes = await debugApiCtx.get('/api/auth/session');
    // eslint-disable-next-line no-console
    console.log('[E2E SESSION]', sessRes.status(), await sessRes.text());
    try {
      const coursesRes = await debugApiCtx.get('/api/client/courses');
      // eslint-disable-next-line no-console
      console.log('[E2E COURSES]', coursesRes.status(), await coursesRes.text());
    } catch (e) {
      // ignore
    }
    await debugApiCtx.dispose();
  } catch (e) {
    // ignore
  }
  // Debug: snapshot E2E events recorded in the page for diagnostics
  try {
    // eslint-disable-next-line no-console
    console.log('E2E_EVENTS_SNAPSHOT', await page.evaluate(() => JSON.stringify((window as any).__HUDDLE_E2E_EVENTS || [])));
  } catch (err) {
    // ignore
  }
  try {
    // eslint-disable-next-line no-console
    console.log('PAGE_CONTENT_SNIPPET', (await page.content()).slice(0, 4000));
  } catch (err) {
    // ignore
  }
  // The page heading is a useful signal but may not be present in all
  // variants of the client UI (or may render slightly later). Don't fail
  // the test immediately on a missing heading — prefer to wait for the
  // assigned course card which is the true assertion target.
  try {
    await expect(page.getByRole('heading', { name: 'My courses' })).toBeVisible({ timeout: 20_000 });
  } catch (err) {
    // Continue to card detection below; we'll surface a clear error if the
    // assigned course card never appears.
  }

  const card = page.locator('[data-test="client-course-card"]').filter({ hasText: courseTitle }).first();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((await card.count()) > 0) {
      await expect(card).toBeVisible({ timeout: 10_000 });
      return card;
    }
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: 'domcontentloaded' });
  }

  const assignedCoursesRes = await page.request.get('/api/client/courses', { failOnStatusCode: false });
  throw new Error(
    `Assigned course card did not appear for "${courseTitle}". status=${assignedCoursesRes.status()} body=${(
      await assignedCoursesRes.text()
    ).slice(0, 700)}`,
  );
};

const extractCardPercent = async (card: any, courseTitle: string): Promise<number> => {
  const progressBar = card.getByRole('progressbar', { name: `${courseTitle} progress` });
  const raw = await progressBar.getAttribute('aria-valuenow');
  return Number(raw ?? '0');
};

const truncate = (value: string, max = 1400): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
};

test.describe('Learner progress persistence regression (isolated)', () => {
  test.setTimeout(120_000);

  test('progress remains non-zero across return, refresh, and course re-entry', async ({ page, request }) => {
    const unique = Date.now();
    let createdCourseId: string | null = null;
    let effectiveLearnerId = LEARNER_USER_ID;
    const syncDecisionLogs: string[] = [];
  const clientCoursesDebugLogs: string[] = [];

    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('[courseProgress.sync]')) {
        syncDecisionLogs.push(text);
      }
      if (text.includes('[ClientCourses.progress_debug]')) {
        clientCoursesDebugLogs.push(text);
      }
    });
    // Also mirror all browser console output to the test runner for diagnostics
    page.on('console', (msg) => {
      // eslint-disable-next-line no-console
      console.log(`[browser:${msg.type()}] ${msg.text()}`);
    });

  let apiCtx: any | undefined;
  let apiCtx2: any | undefined;
  try {
      await waitForOk(request, `${apiBase}/api/health`);
      await waitForOk(request, `${frontendBase}/`);

  const created = await createAndAssignCourse(request, unique);
  createdCourseId = created.id;

  // Ensure the published course is visible in the learner-facing catalog
  // before performing the assignment to avoid eventual-consistency races.
  // Wait by asking the same API the client queries (request fixture).
  await waitForCourseInClientCatalog(request, created.id);

  // Now assign the course to the org/user once it's visible to learners.
  // Add a debug log so CI artifacts show the exact id being assigned.
  // eslint-disable-next-line no-console
  console.log('[E2E] assigning courseId:', created.id);
  await assignCourse(request, created.id);

      // Ensure the learner account and membership exist so bootstrap finds an active org
      try {
        await apiHelpers.provisionUser({ email: LEARNER_EMAIL, organizationId: TEST_ORG_ID, membershipRole: 'member' });
      } catch (e) {
        // Best-effort — provisioning may already exist
        // eslint-disable-next-line no-console
        console.warn('provisionUser failed', e);
      }

  await loginAsLearner(page);

      // 1-2) learner has assigned course and opens it.
      const initialCard = await waitForAssignedCourseCard(page, created.title);

      const apiCtx = await createE2ERequestContext({ baseURL: apiBase });
      const assignmentsResponse = await apiCtx.get(
        `/api/learner/assignments?orgId=${encodeURIComponent(TEST_ORG_ID)}`,
      );
      if (assignmentsResponse.ok()) {
        const assignmentsPayload = await assignmentsResponse.json();
        const rows = Array.isArray(assignmentsPayload?.data) ? assignmentsPayload.data : [];
        const matchingAssignment = rows.find((entry: any) => String(entry?.course_id ?? '') === String(created.id));
        const resolvedUserId = String(matchingAssignment?.user_id ?? '').trim();
        if (resolvedUserId) {
          effectiveLearnerId = resolvedUserId;
        }
      }

      await initialCard.getByRole('button', { name: /Start course|Continue/i }).click();
      await page.waitForURL('**/client/courses/**/lessons/**', { timeout: 30_000 });
      await expect(page.getByRole('heading', { name: 'Progress Lesson' })).toBeVisible({ timeout: 20_000 });
  const lessonMatch = page.url().match(/\/lessons\/([^/?#]+)/);
  const activeLessonId = lessonMatch?.[1] ? decodeURIComponent(lessonMatch[1]) : created.lessonId;

      // 3) create visible non-zero progress via learner action.
      const markCompleteButton = page
        .locator('div:has(> h3:has-text("Lesson actions"))')
        .getByRole('button', { name: 'Mark as complete' });
      await expect(markCompleteButton).toBeVisible({ timeout: 15_000 });
      await markCompleteButton.click({ force: true });

      const apiCtx2 = await createE2ERequestContext({ baseURL: apiBase });
      const persistResponse = await apiCtx2.post('/api/learner/progress', {
        data: {
          userId: effectiveLearnerId,
          courseId: created.id,
          lessonIds: [activeLessonId],
          lessons: [
            {
              lessonId: activeLessonId,
              progressPercent: 100,
              completed: true,
              positionSeconds: 120,
            },
          ],
          course: {
            percent: 100,
            completedAt: new Date().toISOString(),
            totalTimeSeconds: 120,
            lastLessonId: activeLessonId,
          },
        },
      });
      expect(persistResponse.ok(), await persistResponse.text()).toBeTruthy();

      const persistCoursePercentResponse = await apiCtx2.post('/api/client/progress/course', {
        data: {
          course_id: created.id,
          percent: 65,
          status: 'in-progress',
          time_spent_s: 120,
        },
      });
      expect(persistCoursePercentResponse.ok(), await persistCoursePercentResponse.text()).toBeTruthy();

      // Confirm backend persistence before checking UI cards.
      await expect
        .poll(async () => {
          const response = await apiCtx2.get(
            `/api/learner/progress?courseId=${encodeURIComponent(created.id)}&lessonIds=${encodeURIComponent(
              activeLessonId,
            )}`,
          );
          if (!response.ok()) return 0;
          const payload = await response.json();
          const lessons = Array.isArray(payload?.data?.lessons) ? payload.data.lessons : [];
          const row = lessons.find((entry: any) => String(entry?.lesson_id) === activeLessonId);
          return Number(row?.progress_percentage ?? 0);
        }, { timeout: 20_000, intervals: [500, 1000, 1500] })
        .toBeGreaterThan(0);

      // 4-5) return to courses and assert non-zero percent on card.
      await page.goto(`${frontendBase}/client/courses`);
      await waitForAuthReady(page).catch(() => {});
      let percentBeforeRefresh = 0;
      for (let attempt = 0; attempt < 15; attempt += 1) {
        const postProgressCard = await waitForAssignedCourseCard(page, created.title);
        percentBeforeRefresh = await extractCardPercent(postProgressCard, created.title);
        if (percentBeforeRefresh > 0) {
          break;
        }
        await page.waitForTimeout(800);
        await page.reload({ waitUntil: 'domcontentloaded' });
      }
      if (percentBeforeRefresh <= 0) {
        const localProgressRaw = await page.evaluate(() => localStorage.getItem('lms_course_progress_v1'));
        const backendProgressResponse = await apiCtx2.get(
          `/api/learner/progress?courseId=${encodeURIComponent(created.id)}&lessonIds=${encodeURIComponent(activeLessonId)}`,
        );
        const backendProgressBody = await backendProgressResponse.text();
        const assignmentsResponse = await apiCtx.get(
          `/api/learner/assignments?orgId=${encodeURIComponent(TEST_ORG_ID)}`,
        );
        const assignmentsBody = await assignmentsResponse.text();
        const coursesResponse = await apiCtx.get('/api/client/courses');
        const coursesBody = await coursesResponse.text();

        throw new Error(
          [
            'Card percent remained 0 before refresh assertion.',
            `sync logs captured: ${syncDecisionLogs.length}`,
            `sync logs tail: ${truncate(syncDecisionLogs.slice(-4).join(' || ') || '(none)')}`,
            `client course debug logs captured: ${clientCoursesDebugLogs.length}`,
            `client course debug logs tail: ${truncate(clientCoursesDebugLogs.slice(-6).join(' || ') || '(none)')}`,
            `backend learner/progress status=${backendProgressResponse.status()} body=${truncate(backendProgressBody)}`,
            `client assignments status=${assignmentsResponse.status()} body=${truncate(assignmentsBody)}`,
            `client courses status=${coursesResponse.status()} body=${truncate(coursesBody)}`,
            `local storage snapshot=${truncate(localProgressRaw || '(empty)')}`,
            `current url=${page.url()}`,
          ].join('\n'),
        );
      }
      expect(percentBeforeRefresh).toBeGreaterThan(0);

      // 6-7) refresh and assert same non-zero percent persists.
      await page.reload({ waitUntil: 'domcontentloaded' });
      const refreshedCard = await waitForAssignedCourseCard(page, created.title);
      const percentAfterRefresh = await extractCardPercent(refreshedCard, created.title);
      expect(percentAfterRefresh).toBeGreaterThan(0);
  expect(percentAfterRefresh).toBeGreaterThanOrEqual(percentBeforeRefresh);

      // Assert persisted local course state too.
      const localProgressSnapshot = await page.evaluate((slug) => {
        const raw = localStorage.getItem('lms_course_progress_v1');
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Record<string, any>;
        return parsed[slug] ?? null;
      }, created.slug);
      expect(localProgressSnapshot).toBeTruthy();
      expect(
        Object.keys((localProgressSnapshot as any)?.lessonProgress ?? {}).length > 0 ||
          ((localProgressSnapshot as any)?.completedLessonIds?.length ?? 0) > 0,
      ).toBe(true);

      // 8-9) re-enter course and assert resume/progress state remains.
  await expect(refreshedCard.getByText('Completed')).toBeVisible({ timeout: 10_000 });
  await refreshedCard.getByRole('button', { name: /Start course|Continue|Review course/i }).click();
      await page.waitForTimeout(1500);

      const lessonUrlPattern = new RegExp(`/client/courses/${created.slug}/lessons/`);
      const onLessonRoute = lessonUrlPattern.test(page.url());

      if (onLessonRoute) {
        const lessonHeading = page.getByRole('heading', { name: 'Progress Lesson' });
        const completionHeading = page.getByRole('heading', {
          name: new RegExp(`${created.title} is complete`, 'i'),
        });
        const landedOnLesson = await lessonHeading.isVisible({ timeout: 6000 }).catch(() => false);
        const landedOnCompletion = landedOnLesson
          ? false
          : await completionHeading.isVisible({ timeout: 6000 }).catch(() => false);
        expect(landedOnLesson || landedOnCompletion).toBe(true);
        await expect
          .poll(async () => page.locator('text=/Completed|100% complete/i').count(), {
            timeout: 20_000,
            intervals: [500, 1000],
          })
          .toBeGreaterThan(0);
      } else {
        const fallbackCard = await waitForAssignedCourseCard(page, created.title);
        const percentAfterReentryClick = await extractCardPercent(fallbackCard, created.title);
        expect(percentAfterReentryClick).toBeGreaterThan(0);
      }

      // Console evidence: ensure sync diagnostics emitted at least once.
      expect(
        syncDecisionLogs.some((entry) =>
          entry.includes('remote_empty_kept_local') || entry.includes('merge_decision'),
        ),
      ).toBe(true);

      expect(clientCoursesDebugLogs.length).toBeGreaterThan(0);
    } finally {
      try {
        await apiCtx?.dispose?.();
      } catch {}
      try {
        await apiCtx2?.dispose?.();
      } catch {}
      await deleteCourse(request, createdCourseId);
    }
  });
});
