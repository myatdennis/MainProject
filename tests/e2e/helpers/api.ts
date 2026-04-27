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
  // Lightweight test-side normalization to reduce brittle contract mismatches.
  // This helps when older tests send unwrapped course objects or use orgId aliases.
  try {
    if (path === '/api/admin/courses' && body) {
      // If callers passed an unwrapped course (top-level keys like title/slug/modules),
      // wrap it into { course: <body> } so server sees the expected shape.
      const looksLikeCourse = typeof body.title === 'string' || typeof body.slug === 'string' || Array.isArray(body.modules) || typeof body.status === 'string';
      if (looksLikeCourse && !body.course) {
        body = { course: body };
      }
      // Ensure canonical organization_id exists when any org alias is present.
      if (body.course) {
        body.course.organization_id = body.course.organization_id ?? body.course.organizationId ?? body.course.orgId ?? null;
      }
    }
    if (path === '/api/admin/surveys' && body) {
      // Canonicalize assigned organization fields
      body.assignedTo = body.assignedTo ?? body.assigned_to ?? body.assignedTo;
      body.organizationIds = body.organizationIds ?? body.organization_ids ?? body.organizationId ? [body.organizationId] : body.organizationIds ?? [];
    }
    if (path === '/api/client/progress/batch' && body && Array.isArray(body.events)) {
      // Normalize event field names to server-expected camelCase or snake_case where possible
      body.events = body.events.map((ev: any) => ({
        type: ev.type,
        userId: ev.userId ?? ev.user_id ?? ev.user,
        courseId: ev.courseId ?? ev.course_id ?? ev.courseId,
        lessonId: ev.lessonId ?? ev.lesson_id ?? ev.lessonId,
        percent: ev.percent ?? ev.progress ?? null,
        position: ev.position ?? ev.pos ?? null,
        clientEventId: ev.clientEventId ?? ev.client_event_id ?? ev.clientId ?? null,
        timestamp: ev.timestamp ?? Date.now(),
        // keep other fields intact
        ...ev,
      }));
    }
  } catch (err) {
    // ignore normalization errors; we'll send the original body
  }
  // Debug: print outgoing request body so we can inspect what the test is sending
  try {
    console.log('[E2E apiPost] POST', url, JSON.stringify(body));
  } catch {}
  // In E2E mode we prefer using the explicit x-e2e-bypass / x-user-role headers
  // so the server can synthesize a demo session. Avoid sending a spurious
  // Authorization header with an invalid token which can cause the server to
  // attempt token validation and sometimes reject the request before the
  // demo-bypass path is considered.
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-role': 'admin',
    'x-e2e-bypass': 'true',
    'x-org-id': TEST_ORG_ID,
    ...(extraHeaders || {}),
  };

  let res: Response | null = null;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        credentials: 'include',
        body: JSON.stringify(body || {})
      });
      break;
    } catch (error) {
      lastError = error;
      if (attempt >= 3) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
    }
  }

  if (!res) {
    throw new Error(`API POST ${path} failed before receiving a response: ${String(lastError)}`);
  }

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

  // Normalize server response shapes: some server wrappers place metadata
  // under a `meta` object while older endpoints returned top-level keys.
  const normalized = Object.assign({}, response);
  if (!normalized.setupLink && normalized.meta?.setupLink) normalized.setupLink = normalized.meta.setupLink;
  if (normalized.created === undefined && normalized.meta?.created !== undefined) normalized.created = normalized.meta.created;
  if (normalized.existingAccount === undefined && normalized.meta?.existingAccount !== undefined)
    normalized.existingAccount = normalized.meta.existingAccount;
  if (normalized.membershipCreated === undefined && normalized.meta?.membershipCreated !== undefined)
    normalized.membershipCreated = normalized.meta.membershipCreated;
  if (normalized.emailSent === undefined && normalized.meta?.emailSent !== undefined) normalized.emailSent = normalized.meta.emailSent;
  if (normalized.emailStatus === undefined && normalized.meta?.emailStatus !== undefined) normalized.emailStatus = normalized.meta.emailStatus;

  return { email, organizationId, ...normalized };
}

export default { createAndPublishCourse, assignCourseToAll, provisionUser };
