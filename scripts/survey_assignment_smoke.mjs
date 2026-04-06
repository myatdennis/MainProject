#!/usr/bin/env node

/**
 * Survey assignment runtime smoke test.
 *
 * Supports two auth modes:
 * 1) E2E bypass mode (recommended for local reproducibility, no guessed credentials)
 *    - set SMOKE_USE_E2E_BYPASS=true
 * 2) Bearer-token mode (real authenticated sessions)
 *    - set SMOKE_ADMIN_BEARER_TOKEN and SMOKE_LEARNER_BEARER_TOKEN
 */

const API_BASE = (process.env.SURVEY_SMOKE_API_BASE_URL || process.env.E2E_API_BASE_URL || 'http://127.0.0.1:8888').replace(/\/$/, '');
const ORG_ID = process.env.SURVEY_SMOKE_ORG_ID || 'demo-sandbox-org';
const ADMIN_USER_ID = process.env.SURVEY_SMOKE_ADMIN_USER_ID || '00000000-0000-0000-0000-000000000001';
const LEARNER_USER_ID = process.env.SURVEY_SMOKE_LEARNER_USER_ID || '00000000-0000-0000-0000-000000000002';

const useBypass = String(process.env.SMOKE_USE_E2E_BYPASS || '').toLowerCase() === 'true';
const adminBearer = process.env.SMOKE_ADMIN_BEARER_TOKEN || '';
const learnerBearer = process.env.SMOKE_LEARNER_BEARER_TOKEN || '';
const expectDbBacked = String(process.env.SMOKE_EXPECT_DB_BACKED || '').toLowerCase() === 'true';

const hasBearerMode = Boolean(adminBearer && learnerBearer);

if (!useBypass && !hasBearerMode) {
  console.error('[survey-smoke] Missing auth mode. Use one of:');
  console.error('  - SMOKE_USE_E2E_BYPASS=true');
  console.error('  - SMOKE_ADMIN_BEARER_TOKEN + SMOKE_LEARNER_BEARER_TOKEN');
  process.exit(1);
}

if (expectDbBacked && useBypass) {
  console.error('[survey-smoke] SMOKE_EXPECT_DB_BACKED=true cannot be used with SMOKE_USE_E2E_BYPASS=true.');
  console.error('[survey-smoke] Use bearer-token mode against a DB-backed server for real persistence proof.');
  process.exit(1);
}

const unique = Date.now();
const surveyTitle = `Survey Smoke ${unique}`;

const csrfState = {
  admin: { token: null, cookie: null },
  learner: { token: null, cookie: null },
};

const mergeSetCookie = (existingCookie, response) => {
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  if (!Array.isArray(setCookies) || setCookies.length === 0) {
    return existingCookie || null;
  }
  const cookieMap = new Map();
  const existingParts = String(existingCookie || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  existingParts.forEach((pair) => {
    const [name, ...rest] = pair.split('=');
    if (!name || rest.length === 0) return;
    cookieMap.set(name.trim(), `${name.trim()}=${rest.join('=').trim()}`);
  });
  setCookies.forEach((entry) => {
    const [pair] = String(entry || '').split(';');
    const [name, ...rest] = pair.split('=');
    if (!name || rest.length === 0) return;
    cookieMap.set(name.trim(), `${name.trim()}=${rest.join('=').trim()}`);
  });
  return Array.from(cookieMap.values()).join('; ');
};

const readCookieValue = (cookieHeader, name) => {
  const pairs = String(cookieHeader || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const pair of pairs) {
    const [key, ...rest] = pair.split('=');
    if (!key || rest.length === 0) continue;
    if (key.trim() === name) return rest.join('=').trim();
  }
  return null;
};

const buildHeaders = ({ actor = 'admin', json = false } = {}) => {
  const headers = {};
  if (json) headers['content-type'] = 'application/json';

  if (useBypass) {
    headers['x-e2e-bypass'] = 'true';
    headers['x-org-id'] = ORG_ID;
    if (actor === 'admin') {
      headers['x-user-role'] = 'admin';
      headers['x-user-id'] = ADMIN_USER_ID;
    } else {
      headers['x-user-role'] = 'learner';
      headers['x-user-id'] = LEARNER_USER_ID;
    }
    return headers;
  }

  if (actor === 'admin') {
    headers.authorization = `Bearer ${adminBearer}`;
  } else {
    headers.authorization = `Bearer ${learnerBearer}`;
  }
  headers['x-org-id'] = ORG_ID;
  const actorCsrf = csrfState[actor];
  if (actorCsrf?.token) {
    headers['x-csrf-token'] = actorCsrf.token;
  }
  if (actorCsrf?.cookie) {
    headers.cookie = actorCsrf.cookie;
  }
  return headers;
};

const primeCsrfForActor = async (actor = 'admin') => {
  if (useBypass) return;
  const response = await fetch(`${API_BASE}/api/auth/csrf`, {
    method: 'GET',
    headers: buildHeaders({ actor, json: false }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`csrf bootstrap failed (${response.status}): ${text}`);
  }
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  const cookie = mergeSetCookie(csrfState[actor]?.cookie || null, response);
  const cookieToken = readCookieValue(cookie, 'csrf_token');
  const token = cookieToken || parsed?.csrfToken || parsed?.data?.csrfToken || parsed?.token || null;
  if (!token) {
    throw new Error(`csrf bootstrap missing token: ${text}`);
  }
  csrfState[actor] = { token, cookie };
};

const requestJson = async (path, { method = 'GET', body, actor = 'admin' } = {}) => {
  const upperMethod = String(method || 'GET').toUpperCase();
  if (!useBypass && !['GET', 'HEAD', 'OPTIONS'].includes(upperMethod)) {
    await primeCsrfForActor(actor);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: buildHeaders({ actor, json: body !== undefined }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!useBypass && csrfState[actor]) {
    csrfState[actor].cookie = mergeSetCookie(csrfState[actor].cookie, response);
  }

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    data: parsed,
    raw: text,
  };
};

const requireOk = (result, label, acceptedStatuses = [200, 201]) => {
  if (!acceptedStatuses.includes(result.status)) {
    throw new Error(`${label} failed (${result.status}): ${result.raw}`);
  }
  return result;
};

const run = async () => {
  let surveyId = null;

  try {
    const verificationMode = expectDbBacked
      ? 'real-db-backed'
      : useBypass
      ? 'fallback-e2e'
      : 'bearer-token';
    console.log('[survey-smoke] verification mode:', verificationMode);
    console.log('[survey-smoke] auth mode:', useBypass ? 'e2e-bypass' : 'bearer-token');
    console.log('[survey-smoke] api base:', API_BASE);

    const health = await requestJson('/api/health', { actor: 'admin' });
    requireOk(health, 'health', [200]);
    const runtimeMode = health?.data?.runtime?.mode ?? null;
    const assignmentPersistenceMode = health?.data?.runtime?.surveyAssignmentPersistence ?? null;
    if (runtimeMode || assignmentPersistenceMode) {
      console.log('[survey-smoke] server runtime:', {
        mode: runtimeMode,
        surveyAssignmentPersistence: assignmentPersistenceMode,
      });
    }

    if (expectDbBacked && runtimeMode && runtimeMode !== 'db-backed') {
      throw new Error(
        `server is not DB-backed (runtime.mode=${runtimeMode}). Start without fallback flags for real persistence verification.`,
      );
    }
    if (expectDbBacked && assignmentPersistenceMode && assignmentPersistenceMode !== 'real') {
      throw new Error(
        `survey assignment persistence is not real (runtime.surveyAssignmentPersistence=${assignmentPersistenceMode}).`,
      );
    }

    const create = await requestJson('/api/admin/surveys', {
      method: 'POST',
      actor: 'admin',
      body: {
        title: surveyTitle,
        description: 'Created by survey assignment smoke script',
        status: 'published',
        type: 'custom',
        sections: [],
        blocks: [],
        assignedTo: {
          organizationIds: [ORG_ID],
        },
        organizationIds: [ORG_ID],
      },
    });
    requireOk(create, 'create survey', [201]);
    surveyId = create?.data?.data?.id;
    if (!surveyId) {
      throw new Error(`create survey returned no id: ${create.raw}`);
    }

    const assign1 = await requestJson(`/api/admin/surveys/${encodeURIComponent(surveyId)}/assign`, {
      method: 'POST',
      actor: 'admin',
      body: {
        organization_id: ORG_ID,
        userIds: [LEARNER_USER_ID],
      },
    });
    requireOk(assign1, 'assign survey first time', [200, 201]);

    const assign2 = await requestJson(`/api/admin/surveys/${encodeURIComponent(surveyId)}/assign`, {
      method: 'POST',
      actor: 'admin',
      body: {
        organization_id: ORG_ID,
        userIds: [LEARNER_USER_ID],
      },
    });
    requireOk(assign2, 'assign survey duplicate', [200, 201]);

    const adminAssignments = await requestJson(
      `/api/admin/surveys/${encodeURIComponent(surveyId)}/assignments?orgId=${encodeURIComponent(ORG_ID)}`,
      { actor: 'admin' },
    );
    requireOk(adminAssignments, 'list admin survey assignments', [200]);

    const learnerAssignedBefore = await requestJson('/api/client/surveys/assigned', { actor: 'learner' });
    requireOk(learnerAssignedBefore, 'learner assigned surveys (before submit)', [200]);

    const learnerEntry = (learnerAssignedBefore?.data?.data || []).find(
      (entry) => String(entry?.survey?.id ?? entry?.assignment?.survey_id ?? '') === String(surveyId),
    );
    if (!learnerEntry?.assignment?.id) {
      throw new Error(`learner did not receive assignment for survey ${surveyId}`);
    }

    const submit = await requestJson(`/api/client/surveys/${encodeURIComponent(surveyId)}/submit`, {
      method: 'POST',
      actor: 'learner',
      body: {
        assignmentId: learnerEntry.assignment.id,
        responses: {
          q1: { value: 5, label: 'Strongly agree' },
        },
        metadata: {
          source: 'survey-assignment-smoke',
        },
      },
    });
    requireOk(submit, 'learner submit survey', [201]);

    const learnerAssignedAfter = await requestJson('/api/client/surveys/assigned', { actor: 'learner' });
    requireOk(learnerAssignedAfter, 'learner assigned surveys (after submit)', [200]);
    const afterEntry = (learnerAssignedAfter?.data?.data || []).find(
      (entry) => String(entry?.survey?.id ?? entry?.assignment?.survey_id ?? '') === String(surveyId),
    );
    if (!afterEntry) {
      throw new Error('submitted survey not found in learner assigned listing after submit');
    }

    const assignmentsAfterSubmit = await requestJson(
      `/api/admin/surveys/${encodeURIComponent(surveyId)}/assignments?orgId=${encodeURIComponent(ORG_ID)}`,
      { actor: 'admin' },
    );
    requireOk(assignmentsAfterSubmit, 'admin assignments after learner submit', [200]);
    const learnerRow = (assignmentsAfterSubmit?.data?.data || []).find(
      (row) => String(row?.user_id ?? '').toLowerCase() === LEARNER_USER_ID.toLowerCase(),
    );
    if (!learnerRow) {
      throw new Error('learner assignment row missing after submit');
    }
    if (String(learnerRow?.status ?? '') !== 'completed') {
      throw new Error(`learner assignment expected completed, got ${String(learnerRow?.status ?? '')}`);
    }

    console.log('[survey-smoke] PASS', {
      surveyId,
      duplicateMeta: assign2?.data?.meta ?? null,
      learnerStatus: afterEntry?.assignment?.status ?? null,
    });
  } finally {
    if (surveyId) {
      await requestJson(`/api/admin/surveys/${encodeURIComponent(surveyId)}`, {
        method: 'DELETE',
        actor: 'admin',
      });
    }
  }
};

run().catch((error) => {
  console.error('[survey-smoke] FAIL', error?.message || error);
  process.exit(1);
});
