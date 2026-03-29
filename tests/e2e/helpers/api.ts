/* Lightweight API helpers for E2E tests.
   These use the server-side admin header fallback (x-user-role: admin) so they can run against a local dev server.
   Ensure the dev server is running and accessible via E2E_BASE_URL or default http://localhost:5173
*/

import { getFrontendBaseUrl, getApiBaseUrl } from './env';

const FRONTEND_BASE = getFrontendBaseUrl();
// Allow tests to call the backend API directly; default to API server port used by webServer
const API_BASE = getApiBaseUrl();
const TEST_ORG_ID = 'demo-sandbox-org';

const buildUrl = (path: string) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

async function apiPost(path: string, body: any, extraHeaders?: Record<string, string>) {
  const url = buildUrl(path);
  // Debug: print outgoing request body so we can inspect what the test is sending
  try {
    // eslint-disable-next-line no-console
    console.log('[E2E apiPost] POST', url, JSON.stringify(body));
  } catch {}
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'admin',
      ...(extraHeaders || {})
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
  const description = overrides.description ?? 'Created by E2E test helper. This description is intentionally long to satisfy server validation for E2E tests.';

  const { data: created } = await apiPost('/api/admin/courses', {
    course: {
      title,
      description,
      organization_id: TEST_ORG_ID,
      organizationId: TEST_ORG_ID,
    },
    // Provide a minimal module + lesson so the frontend shows a player in E2E mode
    modules: [
      {
        title: 'Module 1',
         // Use 1-based order_index to satisfy server validation (must be greater than 0)
         order_index: 1,
        lessons: [
          {
            type: 'video',
            title: 'Lesson 1',
             // Use 1-based order_index for lessons as well
             order_index: 1,
            // Provide both `content` and `content_json` to match server canonicalization
            content: {
              videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
              videoSourceType: 'external'
            },
            content_json: {
              videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
              videoSourceType: 'external'
            ,
              videoAsset: {
                storagePath: 'e2e/elephants-dream.mp4',
                bucket: 'public',
                bytes: 1024,
                mimeType: 'video/mp4',
                checksum: 'e2e-checksum-abcdef',
                uploadedAt: new Date().toISOString(),
                source: 'e2e-helper'
              }
            }
          }
        ]
      }
    ]
  });

  const courseId = created?.id;
  if (!courseId) throw new Error('Failed to create course via API');

  // Publish
  await apiPost(`/api/admin/courses/${courseId}/publish`, {});
  await assignCourseToAll(courseId);

  return { courseId, course: created };
}

export async function assignCourseToAll(courseId: string) {
  // Tests run against an in-memory E2E store; provide a default org id for assignments.
  // Include several common shapes so the server's legacy normalization finds the org id.
  await apiPost(`/api/admin/courses/${courseId}/assign`, {
    // canonical top-level field
    organization_id: TEST_ORG_ID,
    // camelCase alias
    organizationId: TEST_ORG_ID,
    // legacy alias (kept for compatibility)
    orgId: TEST_ORG_ID,
    // also include a nested organization object (some clients send this)
    organization: {
      id: TEST_ORG_ID,
      organization_id: TEST_ORG_ID,
      organizationId: TEST_ORG_ID,
    },
  }, {
    // Also send header fallback; server looks for x-org-id/x-organization-id
    'x-org-id': TEST_ORG_ID,
    'x-organization-id': TEST_ORG_ID,
  });
}

export async function provisionUser(overrides: {
  email?: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
  membershipRole?: string;
} = {}) {
  const email = overrides.email ?? `e2e+${Date.now()}@example.com`;
  const firstName = overrides.firstName ?? 'E2E';
  const lastName = overrides.lastName ?? 'User';
  const organizationId = overrides.organizationId ?? TEST_ORG_ID;
  const membershipRole = overrides.membershipRole ?? 'member';

  const response = await apiPost('/api/admin/users', {
    organizationId,
    firstName,
    lastName,
    email,
    membershipRole,
  });

  return { email, organizationId, ...response };
}

export default { createAndPublishCourse, assignCourseToAll, provisionUser };
