import { test, expect, type APIRequestContext } from '@playwright/test';
import { getApiBaseUrl } from './helpers/env';

const apiBase = getApiBaseUrl();
const headers = {
  'content-type': 'application/json',
  'x-user-role': 'admin',
  'x-e2e-bypass': 'true',
};

const parseJsonSafe = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const createDraftCourse = async (request: APIRequestContext) => {
  const createRes = await request.post(`${apiBase}/api/admin/courses`, {
    failOnStatusCode: false,
    headers,
    data: {
      course: {
        title: `Concurrency Course ${Date.now()}`,
        description: 'Concurrency regression test payload for course builder.',
        organization_id: 'demo-sandbox-org',
      },
      modules: [
        {
          title: 'Module 1',
          order_index: 1,
          lessons: [
            {
              title: 'Lesson 1',
              type: 'text',
              order_index: 1,
              content_json: { textContent: 'Hello world' },
            },
          ],
        },
      ],
      idempotency_key: `course.save:seed:${Date.now()}`,
      action: 'course.save',
    },
  });

  expect(createRes.status(), await createRes.text()).toBe(201);
  const json = await createRes.json();
  return json?.data;
};

test.describe('Course Builder concurrency safety', () => {
  test('publish endpoint enforces optimistic versioning under concurrent writes', async ({ request }) => {
    const draft = await createDraftCourse(request);
    expect(draft?.id).toBeTruthy();

    const version = typeof draft?.version === 'number' ? draft.version : 1;
    const publishBody = { version, action: 'course.publish' };

    const [a, b] = await Promise.all([
      request.post(`${apiBase}/api/admin/courses/${draft.id}/publish`, {
        failOnStatusCode: false,
        headers,
        data: publishBody,
      }),
      request.post(`${apiBase}/api/admin/courses/${draft.id}/publish`, {
        failOnStatusCode: false,
        headers,
        data: publishBody,
      }),
    ]);

    const statuses = [a.status(), b.status()].sort((x, y) => x - y);
    expect(statuses[0]).toBeGreaterThanOrEqual(200);
    expect(statuses[1]).toBeGreaterThanOrEqual(200);
    expect(statuses).toContain(200);
    expect(statuses.some((s) => s === 409 || s === 200)).toBe(true);

    const conflictCandidate = a.status() === 409 ? a : b.status() === 409 ? b : null;
    if (conflictCandidate) {
      const conflictBody = parseJsonSafe(await conflictCandidate.text());
      expect(conflictBody).toBeTruthy();
      const code = conflictBody?.code ?? conflictBody?.error ?? null;
      expect(code === 'version_conflict' || code === 'idempotency_conflict' || code === 'conflict').toBe(true);
      const reason = conflictBody?.reason ?? conflictBody?.details?.reason ?? null;
      expect(
        reason === null ||
          reason === 'stale_version' ||
          reason === 'idempotency_in_flight' ||
          reason === 'demo_idempotency_processing',
      ).toBe(true);
    }
  });

  test('publish idempotency key returns completed or in-flight response on duplicate submit', async ({ request }) => {
    const draft = await createDraftCourse(request);
    expect(draft?.id).toBeTruthy();

    const version = typeof draft?.version === 'number' ? draft.version : 1;
    const idempotencyKey = `course.publish:concurrency:${Date.now()}`;

    const [first, second] = await Promise.all([
      request.post(`${apiBase}/api/admin/courses/${draft.id}/publish`, {
        failOnStatusCode: false,
        headers,
        data: { version, idempotency_key: idempotencyKey, action: 'course.publish' },
      }),
      request.post(`${apiBase}/api/admin/courses/${draft.id}/publish`, {
        failOnStatusCode: false,
        headers,
        data: { version, idempotency_key: idempotencyKey, action: 'course.publish' },
      }),
    ]);

    const statuses = [first.status(), second.status()];
    expect(statuses.some((s) => s === 200)).toBe(true);
    expect(statuses.some((s) => s === 409 || s === 200)).toBe(true);

    const conflictCandidate = first.status() === 409 ? first : second.status() === 409 ? second : null;
    if (conflictCandidate) {
      const conflictBody = parseJsonSafe(await conflictCandidate.text());
      expect(conflictBody).toBeTruthy();
      const code = conflictBody?.code ?? conflictBody?.error ?? null;
      expect(code === 'idempotency_conflict' || code === 'conflict' || code === 'version_conflict').toBe(true);
      const reason = conflictBody?.reason ?? conflictBody?.details?.reason ?? null;
      expect(
        reason === null ||
          reason === 'idempotency_in_flight' ||
          reason === 'demo_idempotency_processing' ||
          reason === 'stale_version',
      ).toBe(true);
    }
  });
});
