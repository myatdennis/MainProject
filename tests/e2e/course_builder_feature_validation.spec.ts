import { test, expect, type APIRequestContext } from '@playwright/test';
import { getApiBaseUrl } from './helpers/env';

const apiBase = getApiBaseUrl();
const headers = {
  'content-type': 'application/json',
  'x-user-role': 'admin',
  'x-e2e-bypass': 'true',
};

const createDraftCourseWithLesson = async (
  request: APIRequestContext,
  lesson: Record<string, unknown>,
  options: { expectedStatus?: number } = {},
) => {
  const expectedStatus = options.expectedStatus ?? 201;
  const createRes = await request.post(`${apiBase}/api/admin/courses`, {
    failOnStatusCode: false,
    headers,
    data: {
      course: {
        title: `Feature Validation Course ${Date.now()}`,
        description: 'Feature validation E2E payload to verify publish guardrails.',
        organization_id: 'demo-sandbox-org',
      },
      modules: [
        {
          title: 'Module 1',
          order_index: 1,
          lessons: [
            {
              title: 'Lesson 1',
              order_index: 1,
              ...lesson,
            },
          ],
        },
      ],
      idempotency_key: `course.save:feature:${Date.now()}`,
      action: 'course.save',
    },
  });

  const createBody = await createRes.text();
  expect(createRes.status(), createBody).toBe(expectedStatus);
  if (expectedStatus >= 400) {
    return { status: createRes.status(), body: createBody, data: null };
  }
  const json = JSON.parse(createBody);
  return { status: createRes.status(), body: createBody, data: json?.data };
};

test.describe('Course Builder publish feature validation', () => {
  test('rejects course upsert payload when action does not match save contract', async ({ request }) => {
    const createRes = await request.post(`${apiBase}/api/admin/courses`, {
      failOnStatusCode: false,
      headers,
      data: {
        course: {
          title: `Invalid Action Upsert ${Date.now()}`,
          description: 'E2E contract guardrail for save action metadata.',
          organization_id: 'demo-sandbox-org',
        },
        modules: [],
        idempotency_key: `course.save:invalid-action:${Date.now()}`,
        action: 'course.publish',
      },
    });

    const createBody = await createRes.text();
    expect(createRes.status(), createBody).toBe(400);
    expect(createBody).toMatch(/invalid_upsert_payload|action/i);
  });

  test('allows publish for external video lessons with playable URL', async ({ request }) => {
    const draftResponse = await createDraftCourseWithLesson(request, {
      type: 'video',
      content_json: {
        videoSourceType: 'external',
        videoProvider: 'youtube',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    });

    const draft = draftResponse.data;
    expect(draft?.id).toBeTruthy();
    const version = typeof draft?.version === 'number' ? draft.version : 1;

    const publishRes = await request.post(`${apiBase}/api/admin/courses/${draft.id}/publish`, {
      failOnStatusCode: false,
      headers,
      data: { version, action: 'course.publish' },
    });

    expect(publishRes.status(), await publishRes.text()).toBe(200);
  });

  test('rejects malformed quiz payload before publish when no valid correct answer is provided', async ({ request }) => {
    const createResponse = await createDraftCourseWithLesson(
      request,
      {
      type: 'quiz',
      content_json: {
        questions: [
          {
            prompt: 'Question without a valid answer key',
            options: ['Option A', 'Option B'],
          },
        ],
      },
      },
      { expectedStatus: 422 },
    );

    expect(createResponse.status).toBe(422);
    expect(createResponse.body).toMatch(/quiz|correct answer|lesson\.quiz\.invalid/i);
  });

  test('allows publish when reflection lesson includes a learner-facing prompt', async ({ request }) => {
    const draftResponse = await createDraftCourseWithLesson(request, {
      type: 'reflection',
      content_json: {
        reflectionPrompt: 'What did you learn from this module?'
      },
    });

    const draft = draftResponse.data;
    expect(draft?.id).toBeTruthy();
    const version = typeof draft?.version === 'number' ? draft.version : 1;

    const publishRes = await request.post(`${apiBase}/api/admin/courses/${draft.id}/publish`, {
      failOnStatusCode: false,
      headers,
      data: { version, action: 'course.publish' },
    });

    expect(publishRes.status(), await publishRes.text()).toBe(200);
  });

  test('rejects publish payload when action does not match publish contract', async ({ request }) => {
    const draftResponse = await createDraftCourseWithLesson(request, {
      type: 'text',
      content_json: {
        textContent: 'A publishable text lesson',
      },
    });

    const draft = draftResponse.data;
    expect(draft?.id).toBeTruthy();
    const version = typeof draft?.version === 'number' ? draft.version : 1;

    const publishRes = await request.post(`${apiBase}/api/admin/courses/${draft.id}/publish`, {
      failOnStatusCode: false,
      headers,
      data: { version, action: 'course.save' },
    });

    const publishBody = await publishRes.text();
    expect(publishRes.status(), publishBody).toBe(400);
    expect(publishBody).toMatch(/invalid_publish_payload|action/i);
  });
});
