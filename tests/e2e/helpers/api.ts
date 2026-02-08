/* Lightweight API helpers for E2E tests.
   These use the server-side admin header fallback (x-user-role: admin) so they can run against a local dev server.
   Ensure the dev server is running and accessible via E2E_BASE_URL or default http://localhost:5173
*/

import { getFrontendBaseUrl, getApiBaseUrl } from './env';

const FRONTEND_BASE = getFrontendBaseUrl();
// Allow tests to call the backend API directly; default to API server port used by webServer
const API_BASE = getApiBaseUrl();

const buildUrl = (path: string) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

async function apiPost(path: string, body: any) {
  const url = buildUrl(path);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'admin'
    },
    credentials: 'include',
    body: JSON.stringify(body || {})
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API POST ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function createAndPublishCourse(overrides: { title?: string; description?: string } = {}) {
  const title = overrides.title ?? `E2E Course ${Date.now()}`;
  const description = overrides.description ?? 'Created by E2E test helper';

  const { data: created } = await apiPost('/api/admin/courses', {
    course: {
      title,
      description
    },
    // Provide a minimal module + lesson so the frontend shows a player in E2E mode
    modules: [
      {
        title: 'Module 1',
        order_index: 0,
        lessons: [
          {
            type: 'video',
            title: 'Lesson 1',
            order_index: 0,
            content_json: { src: 'https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4' }
          }
        ]
      }
    ]
  });

  const courseId = created?.id;
  if (!courseId) throw new Error('Failed to create course via API');

  // Publish
  await apiPost(`/api/admin/courses/${courseId}/publish`, {});

  return { courseId, course: created };
}

export async function assignCourseToAll(courseId: string) {
  // Tests run against an in-memory E2E store; provide a default org id for assignments
  await apiPost(`/api/admin/courses/${courseId}/assign`, { organization_id: 'e2e-org' });
}

export default { createAndPublishCourse, assignCourseToAll };
