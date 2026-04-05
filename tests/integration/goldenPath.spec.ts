import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  startTestServer,
  stopTestServer,
  createAdminAuthHeaders,
  createMemberAuthHeaders,
  TestServerHandle,
} from './utils/server.ts';

const asJson = (headers: Record<string, string> = {}) => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...headers,
});

const adminHeaders = async () => ({
  ...asJson(await createAdminAuthHeaders()),
  'x-user-id': 'integration-admin',
  'x-user-role': 'admin',
});

const learnerHeaders = async (userId: string, email: string) => ({
  // Pass userId so the JWT sub matches the userId used for progress/assignment lookups
  ...asJson(await createMemberAuthHeaders({ userId, email })),
  'x-user-id': userId,
  'x-user-role': 'member',
});

describe('Admin/learner golden path', () => {
  let server: TestServerHandle | null = null;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(server);
    server = null;
  });

  it('allows create → publish → assign → learner progress', async () => {
    const slug = `golden-${randomUUID()}`;
    const moduleId = randomUUID();
    const lessonId = randomUUID();

    const createRes = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: await adminHeaders(),
      body: JSON.stringify({
        course: {
          title: `Golden Path ${slug}`,
          slug,
          status: 'draft',
        },
        modules: [
          {
            id: moduleId,
            title: 'Welcome Module',
            description: 'Demo module',
            lessons: [
              {
                id: lessonId,
                title: 'Kickoff',
                type: 'text',
                content_json: { type: 'text', body: { blocks: [{ type: 'paragraph', data: { text: 'Hello' } }] } },
              },
            ],
          },
        ],
      }),
    });
    expect([200, 201]).toContain(createRes.status);
    const created = await createRes.json();
    const courseId = created?.data?.id;
    expect(courseId).toBeTruthy();

    const updateRes = await server!.fetch(`/api/admin/courses/${courseId}`, {
      method: 'PUT',
      headers: await adminHeaders(),
      body: JSON.stringify({
        course: {
          id: courseId,
          title: `Golden Path ${slug}`,
          slug,
          status: 'published',
        },
        modules: [
          {
            id: moduleId,
            title: 'Welcome Module',
            description: 'Demo module',
            lessons: [
              {
                id: lessonId,
                title: 'Kickoff',
                type: 'text',
                content_json: { type: 'text', body: { blocks: [{ type: 'paragraph', data: { text: 'Hello' } }] } },
              },
            ],
          },
        ],
      }),
    });
    expect([200, 201]).toContain(updateRes.status);

    const learnerId = randomUUID();
    const assignRes = await server!.fetch(`/api/admin/courses/${courseId}/assign`, {
      method: 'POST',
      headers: await adminHeaders(),
      body: JSON.stringify({
        assignedTo: { userIds: [learnerId] },
        status: 'assigned',
      }),
    });
    expect(assignRes.status).toBe(200);

    const assignmentsRes = await server!.fetch(`/api/admin/courses/${courseId}/assignments`, {
      headers: await adminHeaders(),
    });
    expect(assignmentsRes.status).toBe(200);

    const learnerHeadersResolved = await learnerHeaders(learnerId, `learner+${slug}@example.com`);
    const clientAssignments = await server!.fetch('/api/client/assignments', {
      headers: learnerHeadersResolved,
    });
    expect(clientAssignments.status).toBe(200);

    const progressPayload = {
      userId: learnerId,
      courseId,
      course: {
        status: 'in-progress',
        percent: 50,
        updated_at: new Date().toISOString(),
      },
      lessons: [
        {
          lessonId,
          lesson_id: lessonId,
          status: 'completed',
          percent: 100,
          completed_at: new Date().toISOString(),
        },
      ],
    };
    const progressRes = await server!.fetch('/api/learner/progress', {
      method: 'POST',
      headers: learnerHeadersResolved,
      body: JSON.stringify(progressPayload),
    });
    // 200 (sync) or 202 (accepted/async) are both valid success responses
    expect([200, 202]).toContain(progressRes.status);

    // Retrieve the lesson-level progress that was just submitted.
    // The GET /api/learner/progress endpoint requires lessonIds query param.
    const progressList = await server!.fetch(
      `/api/learner/progress?lessonIds=${encodeURIComponent(lessonId)}&userId=${encodeURIComponent(learnerId)}`,
      { headers: learnerHeadersResolved },
    );
    expect(progressList.status).toBe(200);
    const progressJson = await progressList.json();
    // Response is { data: { lessons: [...] } } — verify at least one lesson record is present
    const lessons: any[] = progressJson?.data?.lessons ?? progressJson?.data ?? [];
    expect(Array.isArray(lessons)).toBe(true);
    const lessonProgress = lessons.find((row: any) => row.lesson_id === lessonId || row.lessonId === lessonId);
    expect(lessonProgress).toBeTruthy();

    // Admin should also be able to retrieve learner progress for reporting views.
    const adminProgressList = await server!.fetch(
      `/api/learner/progress?lessonIds=${encodeURIComponent(lessonId)}&userId=${encodeURIComponent(learnerId)}`,
      { headers: await adminHeaders() },
    );
    expect(adminProgressList.status).toBe(200);
    const adminProgressJson = await adminProgressList.json();
    const adminLessons: any[] = adminProgressJson?.data?.lessons ?? adminProgressJson?.data ?? [];
    expect(Array.isArray(adminLessons)).toBe(true);
    const adminLessonProgress = adminLessons.find((row: any) => row.lesson_id === lessonId || row.lessonId === lessonId);
    expect(adminLessonProgress).toBeTruthy();
  }, 60000);
});
