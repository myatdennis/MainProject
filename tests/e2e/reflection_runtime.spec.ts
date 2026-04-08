import { test, expect, type Page } from '@playwright/test';
import { getApiBaseUrl, getFrontendBaseUrl } from './helpers/env';

const apiBase = getApiBaseUrl();
const frontendBase = getFrontendBaseUrl();
const TEST_ORG_ID = 'demo-sandbox-org';
const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';
const LEARNER_USER_ID = '00000000-0000-0000-0000-000000000002';

const adminHeaders = {
  'content-type': 'application/json',
  'x-user-role': 'admin',
  'x-e2e-bypass': 'true',
  'x-org-id': TEST_ORG_ID,
  'x-user-id': ADMIN_USER_ID,
};

const learnerHeaders = {
  'content-type': 'application/json',
  'x-user-role': 'member',
  'x-e2e-bypass': 'true',
  'x-org-id': TEST_ORG_ID,
  'x-user-id': LEARNER_USER_ID,
};

const loginAsLearner = async (page: Page) => {
  await page.addInitScript(() => {
    (window as any).__E2E_BYPASS = true;
    (window as any).__E2E_USER_ID = '00000000-0000-0000-0000-000000000002';
    (window as any).__E2E_USER_EMAIL = 'user@pacificcoast.edu';
    (window as any).__E2E_USER_ROLE = 'learner';
    localStorage.setItem('huddle_lms_auth', 'true');
  });
  await page.goto(`${frontendBase}/client/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/client/dashboard', { timeout: 30_000 });
};

const attachLearnerApiHeaders = async (page: Page) => {
  await page.route('**/api/**', async (route) => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        'x-e2e-bypass': 'true',
        'x-user-id': LEARNER_USER_ID,
        'x-user-role': 'member',
        'x-org-id': TEST_ORG_ID,
      },
    });
  });
};

const createPublishedReflectionCourse = async (request: any, unique: number) => {
  const reflectionLessonSeedId = `lesson-reflection-${unique}`;
  const nextLessonSeedId = `lesson-next-${unique}`;
  const moduleId = `module-${unique}`;
  const slug = `reflection-runtime-${unique}`;

  const basePayload = {
    course: {
      title: `Reflection Runtime ${unique}`,
      slug,
      status: 'draft',
      organization_id: TEST_ORG_ID,
      organizationId: TEST_ORG_ID,
    },
    modules: [
      {
        id: moduleId,
        title: 'Reflection Module',
        description: 'Runtime proof module',
        order_index: 1,
        lessons: [
          {
            id: reflectionLessonSeedId,
            title: 'Guided Reflection',
            type: 'reflection',
            order_index: 1,
            content: {
              type: 'reflection',
              prompt: 'What changed for you in this lesson?',
              introText: 'Take a short pause before you respond.',
              collectResponse: true,
            },
            content_json: {
              type: 'reflection',
              prompt: 'What changed for you in this lesson?',
              introText: 'Take a short pause before you respond.',
              collectResponse: true,
            },
          },
          {
            id: nextLessonSeedId,
            title: 'Next Step',
            type: 'text',
            order_index: 2,
            content: {
              type: 'text',
              textContent: '<p>Next lesson content</p>',
            },
            content_json: {
              type: 'text',
              textContent: '<p>Next lesson content</p>',
            },
          },
        ],
      },
    ],
  };

  const createResponse = await request.post(`${apiBase}/api/admin/courses`, {
    headers: adminHeaders,
    failOnStatusCode: false,
    data: basePayload,
  });
  const createText = await createResponse.text();
  expect([200, 201], createText).toContain(createResponse.status());
  const createBody = JSON.parse(createText);
  const courseId = createBody?.data?.id;
  expect(courseId).toBeTruthy();

  const publishResponse = await request.put(`${apiBase}/api/admin/courses/${encodeURIComponent(courseId)}`, {
    headers: adminHeaders,
    failOnStatusCode: false,
    data: {
      ...basePayload,
      course: {
        ...basePayload.course,
        id: courseId,
        status: 'published',
      },
    },
  });
  const publishText = await publishResponse.text();
  expect([200, 201], publishText).toContain(publishResponse.status());

  const assignResponse = await request.post(`${apiBase}/api/admin/courses/${encodeURIComponent(courseId)}/assign`, {
    headers: adminHeaders,
    failOnStatusCode: false,
    data: {
      assignedTo: {
        userIds: [LEARNER_USER_ID],
      },
      status: 'assigned',
    },
  });
  const assignText = await assignResponse.text();
  expect([200, 201], assignText).toContain(assignResponse.status());

  const detailResponse = await request.get(`${apiBase}/api/admin/courses/${encodeURIComponent(courseId)}`, {
    headers: adminHeaders,
    failOnStatusCode: false,
  });
  const detailText = await detailResponse.text();
  expect(detailResponse.status(), detailText).toBe(200);
  const detailBody = JSON.parse(detailText);
  const persistedCourse = detailBody?.data ?? null;
  const persistedModules = Array.isArray(persistedCourse?.modules) ? persistedCourse.modules : [];
  const persistedLessons = persistedModules.flatMap((module: any) => (Array.isArray(module?.lessons) ? module.lessons : []));
  const reflectionLessonId =
    String(
      persistedLessons.find((lesson: any) => String(lesson?.title ?? '') === 'Guided Reflection')?.id ??
      reflectionLessonSeedId,
    );
  const nextLessonId =
    String(
      persistedLessons.find((lesson: any) => String(lesson?.title ?? '') === 'Next Step')?.id ??
      nextLessonSeedId,
    );
  const persistedSlug = String(persistedCourse?.slug ?? slug);

  return { courseId: String(courseId), courseSlug: persistedSlug, reflectionLessonId, nextLessonId };
};

const fetchLearnerReflection = async (request: any, courseId: string, lessonId: string) => {
  const response = await request.get(
    `${apiBase}/api/learner/lessons/${encodeURIComponent(lessonId)}/reflection?courseId=${encodeURIComponent(courseId)}`,
    {
      headers: learnerHeaders,
      failOnStatusCode: false,
    },
  );
  const text = await response.text();
  expect(response.status(), text).toBe(200);
  return JSON.parse(text)?.data;
};

const fetchLearnerCourses = async (request: any) => {
  const response = await request.get(`${apiBase}/api/client/courses?assigned=true`, {
    headers: learnerHeaders,
    failOnStatusCode: false,
  });
  const text = await response.text();
  expect(response.status(), text).toBe(200);
  return JSON.parse(text)?.data ?? [];
};

const deleteCourse = async (request: any, courseId: string) => {
  try {
    await request.delete(`${apiBase}/api/admin/courses/${encodeURIComponent(courseId)}`, {
      headers: adminHeaders,
      failOnStatusCode: false,
    });
  } catch (error) {
    console.warn('[reflection_runtime] course cleanup failed', {
      courseId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const openClientCourseCatalog = async (page: Page, courseTitle: string) => {
  await page.goto(`${frontendBase}/client/courses`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(courseTitle)).toBeVisible({ timeout: 20_000 });
};

test.describe('Reflection runtime proof', () => {
  test.setTimeout(120_000);

  test('learner draft autosaves and restores on refresh', async ({ request, page }) => {
    const unique = Date.now();
    const { courseId, courseSlug, reflectionLessonId } = await createPublishedReflectionCourse(request, unique);

    try {
      const learnerCourses = await fetchLearnerCourses(request);
      expect(learnerCourses.some((course: any) => String(course?.id ?? '') === courseId)).toBe(true);

      await attachLearnerApiHeaders(page);
      await loginAsLearner(page);
      await openClientCourseCatalog(page, `Reflection Runtime ${unique}`);

      await page.goto(`${frontendBase}/client/courses/${courseSlug}/lessons/${reflectionLessonId}`, {
        waitUntil: 'domcontentloaded',
      });

      await expect(page.getByRole('button', { name: /begin reflection/i })).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: /begin reflection/i }).click();
      await page.getByRole('button', { name: /take a moment to think/i }).click();

      const input = page.getByPlaceholder('Write your initial thoughts here…');
      await input.fill('I need to slow down and listen more carefully.');
      await expect
        .poll(async () => {
          const savedReflection = await fetchLearnerReflection(request, courseId, reflectionLessonId);
          return String(savedReflection?.responseText ?? '');
        }, { timeout: 15_000 })
        .toContain('I need to slow down and listen more carefully.');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('textarea')).toHaveValue('I need to slow down and listen more carefully.', { timeout: 20_000 });

      const savedReflection = await fetchLearnerReflection(request, courseId, reflectionLessonId);
      expect(String(savedReflection?.responseText ?? '')).toContain('I need to slow down and listen more carefully.');
      expect(String(savedReflection?.status ?? '')).toBe('draft');
    } finally {
      await deleteCourse(request, courseId);
    }
  });

  test('learner submit persists reflection and advances to the next lesson', async ({ request, page }) => {
    const unique = Date.now() + 1;
    const { courseId, courseSlug, reflectionLessonId, nextLessonId } = await createPublishedReflectionCourse(request, unique);

    try {
      const learnerCourses = await fetchLearnerCourses(request);
      expect(learnerCourses.some((course: any) => String(course?.id ?? '') === courseId)).toBe(true);

      await attachLearnerApiHeaders(page);
      await loginAsLearner(page);
      await openClientCourseCatalog(page, `Reflection Runtime ${unique}`);

      await page.goto(`${frontendBase}/client/courses/${courseSlug}/lessons/${reflectionLessonId}`, {
        waitUntil: 'domcontentloaded',
      });

      await expect(page.getByRole('button', { name: /begin reflection/i })).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: /begin reflection/i }).click();
      await page.getByRole('button', { name: /take a moment to think/i }).click();
      await page.getByPlaceholder('Write your initial thoughts here…').fill('I will pause before reacting.');
      await page.getByRole('button', { name: /^continue$/i }).click();
      await page.getByRole('button', { name: /^continue$/i }).click();
      await page.getByRole('button', { name: /^continue$/i }).click();
      await page.getByRole('button', { name: /^continue$/i }).click();
      const submitResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes(`/api/learner/lessons/${reflectionLessonId}/reflection`),
        { timeout: 20_000 },
      );
      await page.getByRole('button', { name: /submit reflection/i }).click();
      const submitResponse = await submitResponsePromise;
      const submitBody = await submitResponse.text();
      expect(submitResponse.status(), submitBody).toBeLessThan(300);

      await page.waitForURL(`**/client/courses/${courseSlug}/lessons/${nextLessonId}`, { timeout: 20_000 });
      await expect(page.getByText('Next lesson content')).toBeVisible({ timeout: 20_000 });

      const submittedReflection = await fetchLearnerReflection(request, courseId, reflectionLessonId);
      expect(String(submittedReflection?.responseText ?? '')).toContain('I will pause before reacting.');
      expect(String(submittedReflection?.status ?? '')).toBe('submitted');

      await page.goto(`${frontendBase}/client/courses/${courseSlug}/lessons/${reflectionLessonId}`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByRole('heading', { name: 'Reflection Saved' })).toBeVisible({ timeout: 20_000 });
    } finally {
      await deleteCourse(request, courseId);
    }
  });
});
