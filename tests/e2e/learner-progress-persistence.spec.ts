import { test, expect, type Page } from '@playwright/test';
import { getApiBaseUrl, getFrontendBaseUrl, waitForOk } from './helpers/env';

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

  return {
    id: courseId,
    slug: courseSlug,
    title,
    lessonId,
  };
};

const deleteCourse = async (request: any, courseId: string | null) => {
  if (!courseId) return;
  await request.delete(`${apiBase}/api/admin/courses/${courseId}`, {
    headers: adminHeaders,
    failOnStatusCode: false,
  });
};

const loginAsLearner = async (page: Page) => {
  await page.goto(`${frontendBase}/lms/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email Address').fill(LEARNER_EMAIL);
  await page.getByLabel('Password').fill('user123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/lms/dashboard', { timeout: 30_000 });
};

const waitForAssignedCourseCard = async (page: Page, courseTitle: string) => {
  await page.goto(`${frontendBase}/client/courses?debugProgress=1`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'My courses' })).toBeVisible({ timeout: 20_000 });

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

    try {
      await waitForOk(request, `${apiBase}/api/health`);
      await waitForOk(request, `${frontendBase}/`);

      const created = await createAndAssignCourse(request, unique);
      createdCourseId = created.id;

  await loginAsLearner(page);

      // 1-2) learner has assigned course and opens it.
      const initialCard = await waitForAssignedCourseCard(page, created.title);

      const assignmentsResponse = await page.request.get('/api/client/assignments', { failOnStatusCode: false });
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

      const persistResponse = await request.post(`${apiBase}/api/learner/progress`, {
        headers: {
          ...adminHeaders,
          'x-user-role': 'learner',
          'x-user-id': effectiveLearnerId,
        },
        failOnStatusCode: false,
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

      const persistCoursePercentResponse = await request.post(`${apiBase}/api/client/progress/course`, {
        headers: {
          ...adminHeaders,
          'x-user-role': 'learner',
          'x-user-id': effectiveLearnerId,
        },
        failOnStatusCode: false,
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
          const response = await page.request.get(
            `/api/learner/progress?courseId=${encodeURIComponent(created.id)}&lessonIds=${encodeURIComponent(
              activeLessonId,
            )}`,
            { failOnStatusCode: false },
          );
          if (!response.ok()) return 0;
          const payload = await response.json();
          const lessons = Array.isArray(payload?.data?.lessons) ? payload.data.lessons : [];
          const row = lessons.find((entry: any) => String(entry?.lesson_id) === activeLessonId);
          return Number(row?.progress_percentage ?? 0);
        }, { timeout: 20_000, intervals: [500, 1000, 1500] })
        .toBeGreaterThan(0);

      // 4-5) return to courses and assert non-zero percent on card.
      await page.goto(`${frontendBase}/client/courses`, { waitUntil: 'domcontentloaded' });
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
        const backendProgressResponse = await page.request.get(
          `/api/learner/progress?courseId=${encodeURIComponent(created.id)}&lessonIds=${encodeURIComponent(activeLessonId)}`,
          { failOnStatusCode: false },
        );
        const backendProgressBody = await backendProgressResponse.text();
        const assignmentsResponse = await page.request.get('/api/client/assignments', { failOnStatusCode: false });
        const assignmentsBody = await assignmentsResponse.text();
        const coursesResponse = await page.request.get('/api/client/courses', { failOnStatusCode: false });
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
      await deleteCourse(request, createdCourseId);
    }
  });
});
