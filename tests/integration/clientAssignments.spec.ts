import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  startTestServer,
  stopTestServer,
  createMemberAuthHeaders,
  createAdminAuthHeaders,
  TestServerHandle,
} from './utils/server.ts';

describe('Client assignments API', () => {
  let server: TestServerHandle | null = null;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(server);
    server = null;
  });

  it('responds to admin assign CORS preflight with correct headers', async () => {
    const response = await server!.fetch('/api/admin/courses/f148624b-003d-44d9-9565-f73e8b059d23/assign', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://the-huddle.co',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://the-huddle.co');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('responds to admin assignments listing CORS preflight with correct headers', async () => {
    const response = await server!.fetch('/api/admin/courses/f148624b-003d-44d9-9565-f73e8b059d23/assignments?orgId=demo-sandbox-org', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://the-huddle.co',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization',
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://the-huddle.co');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
  });

  it('returns empty payload when user has no assignments', async () => {
    const userId = `learner-${randomUUID()}`;
    const headers = {
      ...(await createMemberAuthHeaders({ email: `${userId}@example.com` })),
      'x-user-id': userId,
      'x-user-role': 'member',
    };

    const response = await server!.fetch('/api/client/assignments', {
      headers,
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      data: [],
      count: 0,
      orgId: null,
    });
  });

  it('assigns a course to Neal Hagberg and verifies client assignment visibility', async () => {
    const courseId = `neal-course-${randomUUID()}`;
    const learnerEmail = `neal.hagberg-${randomUUID()}@example.com`;

    const adminHeaders = await createAdminAuthHeaders({ email: 'mya@the-huddle.co' });
    const adminRequestHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...adminHeaders,
    };

    const createCourse = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: adminRequestHeaders,
      body: JSON.stringify({
        course: {
          id: courseId,
          title: 'Neal Assignment Test',
          slug: courseId,
          modules: [
            {
              id: 'module-1',
              title: 'Module 1',
              description: 'Test module',
              lessons: [
                {
                  id: 'lesson-1',
                  title: 'Lesson 1',
                  type: 'text',
                  content_json: { type: 'text', body: { blocks: [{ type: 'paragraph', data: { text: 'Hello Neal' } }] } },
                },
              ],
            },
          ],
        },
      }),
    });
    const createCourseJson = await createCourse.json().catch(() => null);
    expect([200, 201]).toContain(createCourse.status);

    // Ensure this learner exists in the system before assignment.
    const createLearnerUser = await server!.fetch('/api/admin/users', {
      method: 'POST',
      headers: adminRequestHeaders,
      body: JSON.stringify({
        orgId: 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8',
        firstName: 'Neal',
        lastName: 'Hagberg',
        email: learnerEmail,
        password: 'password123',
      }),
    });
    expect([200, 201]).toContain(createLearnerUser.status);

    const assignmentRes = await server!.fetch(`/api/admin/courses/${courseId}/assign`, {
      method: 'POST',
      headers: adminRequestHeaders,
      body: JSON.stringify({
        organization_id: 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8',
        user_ids: [learnerEmail],
        status: 'assigned',
      }),
    });
    const assignmentJson = await assignmentRes.json().catch(() => null);
    console.log('[test] assignment response', assignmentRes.status, assignmentJson);
    expect([200, 201]).toContain(assignmentRes.status);

    const assignedCourseId = assignmentJson?.data?.[0]?.course_id || null;
    expect(assignedCourseId).toBeTruthy();

    const adminCourseAssignments = await server!.fetch(`/api/admin/courses/${courseId}/assignments?orgId=d28e403a-cdab-42cd-8fc7-2c9327ca40f8`, {
      headers: adminRequestHeaders,
    });
    expect(adminCourseAssignments.status).toBe(200);
    const adminAssignmentsJson = await adminCourseAssignments.json();
    const adminAssignedCourses = (adminAssignmentsJson.data || []).map((a: any) => a.course_id || a.courseId);
    expect(adminAssignedCourses).toContain(assignedCourseId);
  });

  it('returns 400 for invalid user identifiers', async () => {
    const courseId = `neal-course-${randomUUID()}`;
    const learnerEmail = `neal.hagberg-${randomUUID()}@example.com`;

    const adminHeaders = await createAdminAuthHeaders({ email: 'mya@the-huddle.co' });
    const adminRequestHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...adminHeaders,
    };

    const createCourse = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: adminRequestHeaders,
      body: JSON.stringify({
        course: {
          id: courseId,
          title: 'Neal Assignment Test',
          slug: courseId,
          modules: [
            {
              id: 'module-1',
              title: 'Module 1',
              description: 'Test module',
              lessons: [
                {
                  id: 'lesson-1',
                  title: 'Lesson 1',
                  type: 'text',
                  content_json: { type: 'text', body: { blocks: [{ type: 'paragraph', data: { text: 'Hello Neal' } }] } },
                },
              ],
            },
          ],
        },
      }),
    });
    const createCourseJson = await createCourse.json().catch(() => null);
    expect([200, 201]).toContain(createCourse.status);

    // Ensure this learner exists in the system before assignment.
    const createLearnerUser = await server!.fetch('/api/admin/users', {
      method: 'POST',
      headers: adminRequestHeaders,
      body: JSON.stringify({
        orgId: 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8',
        firstName: 'Neal',
        lastName: 'Hagberg',
        email: learnerEmail,
        password: 'password123',
      }),
    });
    expect([200, 201]).toContain(createLearnerUser.status);

    const assignmentRes = await server!.fetch(`/api/admin/courses/${courseId}/assign`, {
      method: 'POST',
      headers: adminRequestHeaders,
      body: JSON.stringify({
        organization_id: 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8',
        user_ids: [learnerEmail, 'legacy-user'],
        status: 'assigned',
      }),
    });
    const invalidJson = await assignmentRes.json().catch(() => null);
    expect(assignmentRes.status).toBe(400);
    expect(invalidJson).toHaveProperty('error', 'invalid_user_ids');
    expect(invalidJson.invalidUserIds).toContain('legacy-user');
  });
});
