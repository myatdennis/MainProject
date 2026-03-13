#!/usr/bin/env node

/**
 * Smoke test script for end-to-end organization onboarding.
 *
 * Requirements:
 *  - API_BASE_URL: base URL for the admin API (default http://localhost:8888)
 *  - ADMIN_BEARER_TOKEN or ADMIN_SESSION_COOKIE for authenticated admin requests
 *  - Optional COURSE_ID / SURVEY_ID to assign existing content
 *
 * Example:
 *   ADMIN_BEARER_TOKEN="..." COURSE_ID="course-123" SURVEY_ID="survey-456" node scripts/org_onboarding_smoke.mjs
 */

import crypto from 'node:crypto';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8888';
const ADMIN_TOKEN = process.env.ADMIN_BEARER_TOKEN || '';
const ADMIN_COOKIE = process.env.ADMIN_SESSION_COOKIE || '';
const COURSE_ID = process.env.COURSE_ID || process.env.ORG_SMOKE_COURSE_ID || '';
const SURVEY_ID = process.env.SURVEY_ID || process.env.ORG_SMOKE_SURVEY_ID || '';

if (!ADMIN_TOKEN && !ADMIN_COOKIE) {
  console.error(
    'Missing credentials. Set ADMIN_BEARER_TOKEN or ADMIN_SESSION_COOKIE to exercise admin endpoints.',
  );
  process.exit(1);
}

const adminHeaders = {
  'content-type': 'application/json',
};
if (ADMIN_TOKEN) adminHeaders.Authorization = `Bearer ${ADMIN_TOKEN}`;
if (ADMIN_COOKIE) adminHeaders.Cookie = ADMIN_COOKIE;

async function api(path, init = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...adminHeaders,
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText} :: ${body}`);
  }
  return response.json();
}

async function publicApi(path, init = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText} :: ${body}`);
  }
  return response.json();
}

async function assignCourse(orgId) {
  if (!COURSE_ID) return null;
  await api(`/api/admin/courses/${COURSE_ID}/assign`, {
    method: 'POST',
    body: JSON.stringify({
      organization_id: orgId,
      metadata: { source: 'smoke_test', label: 'org_onboarding_smoke' },
    }),
  });
  return COURSE_ID;
}

async function assignSurvey(orgId) {
  if (!SURVEY_ID) return null;
  await api(`/api/admin/surveys/${SURVEY_ID}/assign`, {
    method: 'POST',
    body: JSON.stringify({
      organization_id: orgId,
      metadata: { source: 'smoke_test', label: 'org_onboarding_smoke' },
    }),
  });
  return SURVEY_ID;
}

async function createOrg() {
  const stamp = crypto.randomBytes(3).toString('hex');
  const name = `Smoke Org ${stamp}`;
  const contactEmail = `org-smoke+${stamp}@example.com`;
  const ownerEmail = `owner-smoke+${stamp}@example.com`;
  const payload = {
    name,
    type: 'Technology Company',
    contactPerson: 'Smoke Owner',
    contactEmail,
    subscription: 'Standard',
    status: 'active',
    ownerEmail,
    owner: {
      email: ownerEmail,
      name: 'Smoke Owner',
    },
  };
  const { data } = await api('/api/admin/organizations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data;
}

async function createInvite(orgId, targetEmail) {
  const response = await api(`/api/admin/organizations/${orgId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ email: targetEmail, role: 'manager', sendEmail: false }),
  });
  const list = await api(`/api/admin/organizations/${orgId}/invites`);
  const invite = (list?.data || []).find((entry) => entry.id === response?.data?.id) || response?.data;
  if (!invite?.token) {
    throw new Error('Invite token unavailable; cannot continue smoke test.');
  }
  return invite;
}

async function acceptInvite(invitePayload, password = `SmokePwd!${Date.now()}`) {
  const { id, token } = invitePayload;
  const preview = await publicApi(`/api/invite/${token}`);
  if (!preview?.data) {
    throw new Error('Unable to load invite preview');
  }
  await publicApi(`/api/invite/${token}/accept`, {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Smoke Tester',
      password,
    }),
  });
  return { inviteId: id, password };
}

async function main() {
  console.log('🚀 Starting organization onboarding smoke...');
  const org = await createOrg();
  console.log(`✅ Created organization ${org?.name} (${org?.id})`);

  await assignCourse(org.id);
  await assignSurvey(org.id);

  const learnerEmail = `learner-smoke+${crypto.randomBytes(3).toString('hex')}@example.com`;
  const invite = await createInvite(org.id, learnerEmail);
  console.log(`✅ Created invite ${invite.id} for ${learnerEmail}`);

  const acceptance = await acceptInvite(invite);
  console.log(`✅ Accepted invite ${acceptance.inviteId} with temp password ${acceptance.password}`);

  const profile = await api(`/api/admin/organizations/${org.id}`);
  const courseCount = profile?.data?.assignments?.courses?.assignmentCount ?? profile?.data?.metrics?.coursesAssigned ?? 0;
  const surveyCount = profile?.data?.assignments?.surveys?.assignmentCount ?? profile?.data?.metrics?.surveysAssigned ?? 0;
  console.log(`📊 Assignment summary — courses: ${courseCount}, surveys: ${surveyCount}`);

  console.log('✅ Smoke run complete. Review organization profile for resource sharing and notifications.');
}

main().catch((error) => {
  console.error('Smoke run failed:', error);
  process.exit(1);
});
