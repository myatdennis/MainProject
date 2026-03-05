import { test, expect, type APIRequestContext } from '@playwright/test';
import { createAndPublishCourse } from './helpers/api';
import { getApiBaseUrl } from './helpers/env';

const getClientCatalog = async (request: APIRequestContext) => {
  const res = await request.get(`${getApiBaseUrl()}/api/client/courses`, { failOnStatusCode: true });
  return res.json();
};

const getClientCourseDetail = async (request: APIRequestContext, slug: string) => {
  const res = await request.get(`${getApiBaseUrl()}/api/client/courses/${slug}`, { failOnStatusCode: true });
  return res.json();
};

test.describe('Course lifecycle (create → save → publish → client access)', () => {
  test('published admin course appears in client catalog and detail view', async ({ request }) => {
    const title = `Lifecycle Course ${Date.now()}`;
    const { courseId, course } = await createAndPublishCourse({ title });
    expect(courseId).toBeTruthy();

    const catalogBody = await getClientCatalog(request);
    const catalogList = Array.isArray(catalogBody?.data) ? catalogBody.data : [];
    const catalogMatch = catalogList.find((entry: any) => entry?.id === courseId || entry?.title === title);

    expect(catalogMatch, 'Client catalog should include published course').toBeTruthy();
    expect(catalogMatch?.status).toBe('published');

    const slug = catalogMatch?.slug ?? course?.slug;
    expect(slug, 'Published course should expose a slug for detail lookups').toBeTruthy();

    const detailBody = await getClientCourseDetail(request, slug);
    const detailCourse = detailBody?.data ?? null;

    expect(detailCourse, 'Client course detail response should include course data').toBeTruthy();
    expect(detailCourse?.id).toBe(courseId);
    expect(Array.isArray(detailCourse?.modules) && detailCourse.modules.length).toBeGreaterThan(0);
    expect(Array.isArray(detailCourse?.modules?.[0]?.lessons) && detailCourse.modules[0].lessons.length).toBeGreaterThan(0);

    // best-effort cleanup
    await request.delete(`${getApiBaseUrl()}/api/admin/courses/${courseId}`, {
      headers: { 'x-user-role': 'admin' },
    });
  });
});
