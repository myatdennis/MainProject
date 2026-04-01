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
    const learnerId = '00000000-0000-0000-0000-000000000002';
    const learnerEmail = 'neal.hagberg@example.com';

    const adminHeaders = await createAdminAuthHeaders({ email: 'mya@the-huddle.co' });
    const adminRequestHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...adminHeaders,
      'x-user-id': 'integration-admin',
      'x-user-role': 'admin',
    };

    // Create a course via admin API
    const createCourse = await server!.fetch('/api/admin/courses', {
      method: 'POST',
      headers: adminRequestHeaders,
      body: JSON.stringify({
        course: {
          id: courseId,
          title: 'Neal Assignment Test',
          slug: courseId,
          status: 'published',
        },
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
      }),
    });
    expect([200, 201]).toContain(createCourse.status);

    // Assign to Neal and old-style user for compatibility check
    const assignmentRes = await server!.fetch(`/api/admin/courses/${courseId}/assign`, {
      method: 'POST',
      headers: adminRequestHeaders,
      body: JSON.stringify({
        organization_id: 'demo-sandbox-org',
        user_ids: [learnerId, 'legacy-user'],
        status: 'assigned',
      }),
    });
    expect([200, 201]).toContain(assignmentRes.status);

    const assignmentJson = await assignmentRes.json();
    // console.log('[debug] assignment response', assignmentJson);
    expect(assignmentJson?.data?.length).toBeGreaterThan(0);

    const learnerHeadersResolved = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(await createMemberAuthHeaders({ email: learnerEmail })),
      'x-user-id': learnerId,
      'x-user-role': 'member',
    };

    const clientAssignments = await server!.fetch('/api/client/assignments', {
      headers: learnerHeadersResolved,
    });
    expect(clientAssignments.status).toBe(200);
    const assignmentsJson = await clientAssignments.json();
    // console.log('[debug] client assignments response', assignmentsJson);
    expect(Array.isArray(assignmentsJson?.data)).toBe(true);
    const assignedCourses = (assignmentsJson.data || []).map((a: any) => a.course_id || a.courseId);
    expect(assignedCourses).toContain(courseId);
    expect(new Set(assignedCourses).size).toBe(assignedCourses.length); // no duplicates

    const clientCourses = await server!.fetch('/api/client/courses?assigned=true', {
      headers: learnerHeadersResolved,
    });
    expect(clientCourses.status).toBe(200);
    const coursesJson = await clientCourses.json();
    const courseIds = (coursesJson?.data || []).map((c: any) => c.id || c.course_id);
    expect(courseIds).toContain(courseId);

    // Check persistence after refresh call (re-query once more)
    const refreshAssignments = await server!.fetch('/api/client/assignments', {
      headers: learnerHeadersResolved,
    });
    expect(refreshAssignments.status).toBe(200);
    const refreshJson = await refreshAssignments.json();
    const refreshCourseIds = (refreshJson?.data || []).map((a: any) => a.course_id || a.courseId);
    expect(refreshCourseIds).toContain(courseId);

    // Admin check: fetch assignments for the course to ensure they were persisted
    const adminCourseAssignments = await server!.fetch(`/api/admin/courses/${courseId}/assignments?orgId=demo-sandbox-org`, {
      headers: adminRequestHeaders,
    });
    expect(adminCourseAssignments.status).toBe(200);
    const adminAssignmentsJson = await adminCourseAssignments.json();
    // console.log('[debug] admin assignments response', adminAssignmentsJson);
    const adminAssignedCourses = (adminAssignmentsJson.data || []).map((a: any) => a.course_id || a.courseId);
    expect(adminAssignedCourses).toContain(courseId);
  });
});
