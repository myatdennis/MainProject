import { test, expect, APIRequestContext } from '@playwright/test';
import { createAndPublishCourse } from './helpers/api';

const getApiBase = () => process.env.E2E_API_BASE_URL || 'http://localhost:8787';

const getClientCourses = async (request: APIRequestContext) => {
  const res = await request.get(`${getApiBase()}/api/client/courses`, { failOnStatusCode: false });
  if (!res.ok()) {
    throw new Error(`Failed to fetch client courses: ${res.status()}`);
  }
  return res.json();
};

test.describe('Admin → Client course sync', () => {
  test('published admin course is readable via client catalog API', async ({ request }) => {
    const title = `E2E Sync Course ${Date.now()}`;

    const { courseId } = await createAndPublishCourse({ title });
    expect(courseId).toBeTruthy();

    const body = await getClientCourses(request);
    const list = Array.isArray(body?.data) ? body.data : [];
    const match = list.find((course: any) => course?.id === courseId || course?.title === title);

    expect(match, 'Client catalog should include the published admin course').toBeTruthy();
    expect(match?.status).toBe('published');

    // Cleanup best-effort to keep the demo store tidy
    await request.delete(`${getApiBase()}/api/admin/courses/${courseId}`, {
      headers: { 'x-user-role': 'admin' },
    });
  });
});
