import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  startTestServer,
  stopTestServer,
  createAdminAuthHeaders,
  TestServerHandle,
} from './utils/server.ts';

const TEST_ORG_ID = process.env.TEST_ORGANIZATION_ID || 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8';

const asJson = (headers: Record<string, string> = {}) => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...headers,
});

const adminHeaders = async () => ({
  ...asJson(await createAdminAuthHeaders()),
  'x-user-id': 'integration-admin',
  'x-user-role': 'admin',
  'x-org-id': TEST_ORG_ID,
});

describe('Admin course save validation', () => {
  let server: TestServerHandle | null = null;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(server);
    server = null;
  });

  it('saves a published course with an in-progress quiz lesson without payload validation failure', async () => {
    const slug = `save-incomplete-quiz-${randomUUID()}`;
    const moduleId = randomUUID();
    const lessonId = randomUUID();

    const response = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: await adminHeaders(),
      body: JSON.stringify({
        course: {
          title: `Incomplete Quiz Save ${slug}`,
          slug,
          description: 'Regression test for published-course save payload validation.',
          status: 'published',
          organization_id: TEST_ORG_ID,
        },
        modules: [
          {
            id: moduleId,
            title: 'Module 1',
            order_index: 1,
            lessons: [
              {
                id: lessonId,
                title: 'Quiz Lesson (In Progress)',
                type: 'quiz',
                order_index: 1,
                content_json: {
                  type: 'quiz',
                  body: {
                    quizQuestions: [
                      {
                        id: randomUUID(),
                        prompt: 'Draft question',
                        options: [
                          { id: 'a', text: 'Option A', correct: true },
                          { id: 'b', text: 'Option B', correct: false },
                        ],
                        correctAnswer: 'a',
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      }),
    });

    const body = await response.json();
    expect([200, 201]).toContain(response.status);
    expect(body?.code).not.toBe('validation_failed');
    expect(body?.data?.id).toBeTruthy();
  }, 60000);

  it('allows draft autosave payloads with incomplete quiz content without returning validation_failed', async () => {
    const slug = `autosave-incomplete-quiz-${randomUUID()}`;

    const response = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: await adminHeaders(),
      body: JSON.stringify({
        action: 'course.auto-save',
        course: {
          title: `Autosave Incomplete Quiz ${slug}`,
          slug,
          description: 'Regression test for autosave payload tolerance.',
          status: 'draft',
          organization_id: TEST_ORG_ID,
        },
        modules: [
          {
            title: 'Draft Module',
            order_index: 1,
            lessons: [
              {
                title: 'Quiz Lesson Draft',
                type: 'quiz',
                order_index: 1,
                content_json: {},
              },
            ],
          },
        ],
      }),
    });

    const body = await response.json();
    expect([200, 201]).toContain(response.status);
    expect(body?.code).not.toBe('validation_failed');
    expect(body?.data?.id).toBeTruthy();
  }, 60000);

  it('auto-normalizes duplicate/missing/random lesson order_index values and never returns lesson.order.duplicate', async () => {
    const slug = `lesson-order-normalize-${randomUUID()}`;

    const response = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: await adminHeaders(),
      body: JSON.stringify({
        action: 'course.save',
        course: {
          title: `Lesson Order Normalize ${slug}`,
          slug,
          description: 'Regression test for deterministic lesson order normalization.',
          status: 'draft',
          organization_id: TEST_ORG_ID,
        },
        modules: [
          {
            title: 'Ordering Module',
            order_index: 1,
            lessons: [
              { title: 'Lesson A', type: 'text', order_index: 10, content_json: { body: { textContent: 'A' } } },
              { title: 'Lesson B', type: 'text', order_index: 10, content_json: { body: { textContent: 'B' } } },
              { title: 'Lesson C', type: 'text', content_json: { body: { textContent: 'C' } } },
            ],
          },
        ],
      }),
    });

    const body = await response.json();
    expect([200, 201]).toContain(response.status);
    expect(body?.code).not.toBe('validation_failed');
    expect(JSON.stringify(body)).not.toContain('lesson.order.duplicate');
    expect(body?.data?.id).toBeTruthy();
  }, 60000);
});
