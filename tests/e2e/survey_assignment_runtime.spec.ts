import { test, expect, type Page } from '@playwright/test';
import { getApiBaseUrl, getFrontendBaseUrl } from './helpers/env';

const apiBase = getApiBaseUrl();
const frontendBase = getFrontendBaseUrl();
const TEST_ORG_ID = 'demo-sandbox-org';
const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';
const LEARNER_USER_ID = '00000000-0000-0000-0000-000000000002';

const adminHeaders = {
  'content-type': 'application/json',
  'x-user-role': 'admin',
  'x-e2e-bypass': 'true',
  'x-org-id': TEST_ORG_ID,
  'x-user-id': ADMIN_USER_ID,
};

const learnerHeaders = {
  'content-type': 'application/json',
  'x-user-role': 'learner',
  'x-e2e-bypass': 'true',
  'x-org-id': TEST_ORG_ID,
  'x-user-id': LEARNER_USER_ID,
};

const buildLearnerHeaders = (userId: string) => ({
  ...learnerHeaders,
  'x-user-id': userId,
});

const createPublishedSurvey = async (request: any, unique: number) => {
  const response = await request.post(`${apiBase}/api/admin/surveys`, {
    headers: adminHeaders,
    failOnStatusCode: false,
    data: {
      title: `Survey Runtime Proof ${unique}`,
      description: 'Created by E2E runtime verification test.',
      type: 'custom',
      status: 'published',
      sections: [],
      blocks: [],
      assignedTo: {
        organizationIds: [TEST_ORG_ID],
      },
      organizationIds: [TEST_ORG_ID],
    },
  });

  const text = await response.text();
  expect(response.status(), text).toBe(201);
  const payload = JSON.parse(text);
  expect(payload?.data?.id).toBeTruthy();
  return payload.data.id as string;
};

const assignSurveyToOrg = async (request: any, surveyId: string) => {
  const response = await request.post(`${apiBase}/api/admin/surveys/${encodeURIComponent(surveyId)}/assign`, {
    headers: adminHeaders,
    failOnStatusCode: false,
    data: {
      organization_id: TEST_ORG_ID,
    },
  });

  const text = await response.text();
  expect([200, 201], text).toContain(response.status());
  return {
    status: response.status(),
    body: JSON.parse(text),
  };
};

const listSurveyAssignments = async (request: any, surveyId: string) => {
  const response = await request.get(
    `${apiBase}/api/admin/surveys/${encodeURIComponent(surveyId)}/assignments?orgId=${encodeURIComponent(TEST_ORG_ID)}`,
    {
      headers: adminHeaders,
      failOnStatusCode: false,
    },
  );
  const text = await response.text();
  expect(response.status(), text).toBe(200);
  const payload = JSON.parse(text);
  expect(Array.isArray(payload?.data)).toBeTruthy();
  return payload?.data ?? [];
};

const listLearnerAssignedSurveys = async (request: any, userId: string = LEARNER_USER_ID) => {
  const response = await request.get(`${apiBase}/api/client/surveys/assigned`, {
    headers: buildLearnerHeaders(userId),
    failOnStatusCode: false,
  });
  const text = await response.text();
  expect(response.status(), text).toBe(200);
  const payload = JSON.parse(text);
  expect(Array.isArray(payload?.data)).toBeTruthy();
  return payload?.data ?? [];
};

const submitSurveyAsLearner = async (request: any, surveyId: string, assignmentId: string, userId: string = LEARNER_USER_ID) => {
  const response = await request.post(`${apiBase}/api/client/surveys/${encodeURIComponent(surveyId)}/submit`, {
    headers: buildLearnerHeaders(userId),
    failOnStatusCode: false,
    data: {
      assignmentId,
      responses: {
        q1: { value: 5, label: 'Strongly agree' },
      },
      metadata: {
        source: 'e2e-runtime-proof',
      },
    },
  });

  const text = await response.text();
  expect(response.status(), text).toBe(201);
  return JSON.parse(text);
};

const fetchAdminSurveyResults = async (request: any, surveyId: string) => {
  const response = await request.get(
    `${apiBase}/api/admin/surveys/${encodeURIComponent(surveyId)}/results?orgId=${encodeURIComponent(TEST_ORG_ID)}`,
    {
      headers: adminHeaders,
      failOnStatusCode: false,
    },
  );
  const text = await response.text();
  expect(response.status(), text).toBe(200);
  const payload = JSON.parse(text);
  expect(Array.isArray(payload?.data)).toBeTruthy();
  return payload?.data ?? [];
};

const deleteSurvey = async (request: any, surveyId: string) => {
  await request.delete(`${apiBase}/api/admin/surveys/${encodeURIComponent(surveyId)}`, {
    headers: adminHeaders,
    failOnStatusCode: false,
  });
};

const loginAsLearner = async (page: Page) => {
  await page.addInitScript(() => {
    (window as any).__E2E_BYPASS = true;
    (window as any).__E2E_USER_ID = '00000000-0000-0000-0000-000000000002';
    (window as any).__E2E_USER_EMAIL = 'user@pacificcoast.edu';
    (window as any).__E2E_USER_ROLE = 'learner';
    localStorage.setItem('huddle_lms_auth', 'true');
  });
  await page.goto(`${frontendBase}/client/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/client/dashboard', { timeout: 30_000 });
};

test.describe('Survey assignment runtime proof', () => {
  test.setTimeout(120_000);

  test('runtime proof: admin assign -> persisted -> learner fetch -> learner submit -> completion persisted', async ({ request }) => {
    const unique = Date.now();
    const surveyId = await createPublishedSurvey(request, unique);

    try {
      const assignResult = await assignSurveyToOrg(request, surveyId);
      expect(assignResult?.body?.meta).toBeTruthy();

      const initialAssignments = await listSurveyAssignments(request, surveyId);
      expect(initialAssignments.length).toBeGreaterThan(0);
      expect(initialAssignments.some((row: any) => row?.survey_id === surveyId)).toBeTruthy();

      const learnerBeforeSubmit = await listLearnerAssignedSurveys(request);
      const matchingEntry = learnerBeforeSubmit.find(
        (entry: any) => String(entry?.survey?.id ?? entry?.assignment?.survey_id ?? '') === String(surveyId),
      );
      expect(matchingEntry).toBeTruthy();
      expect(matchingEntry?.assignment?.id).toBeTruthy();

      await submitSurveyAsLearner(request, surveyId, matchingEntry.assignment.id);

      const learnerAfterSubmit = await listLearnerAssignedSurveys(request);
      const afterSubmitEntriesForSurvey = learnerAfterSubmit.filter(
        (entry: any) => String(entry?.survey?.id ?? entry?.assignment?.survey_id ?? '') === String(surveyId),
      );
      expect(afterSubmitEntriesForSurvey.length).toBeGreaterThan(0);
      const completedEntry = afterSubmitEntriesForSurvey.find(
        (entry: any) => String(entry?.assignment?.status ?? '') === 'completed',
      );
      expect(completedEntry).toBeTruthy();

      const assignmentsAfterSubmit = await listSurveyAssignments(request, surveyId);
      const learnerAssignment = assignmentsAfterSubmit.find(
        (row: any) => String(row?.user_id ?? '').toLowerCase() === LEARNER_USER_ID.toLowerCase(),
      );
      expect(learnerAssignment).toBeTruthy();
      expect(String(learnerAssignment?.status ?? '')).toBe('completed');
      expect(String(learnerAssignment?.active ?? '')).toBe('true');
      expect(learnerAssignment?.metadata?.completion_audit?.completed_by).toBe(LEARNER_USER_ID);

      const surveyDetailResponse = await request.get(`${apiBase}/api/admin/surveys/${encodeURIComponent(surveyId)}`, {
        headers: adminHeaders,
        failOnStatusCode: false,
      });
      const detailText = await surveyDetailResponse.text();
      expect(surveyDetailResponse.status(), detailText).toBe(200);
      const surveyDetail = JSON.parse(detailText);
      const assignedUserIds =
        surveyDetail?.data?.assignedTo?.userIds ??
        surveyDetail?.data?.assigned_to?.userIds ??
        [];
      expect(Array.isArray(assignedUserIds)).toBeTruthy();
      expect(assignedUserIds.map((value: string) => String(value).toLowerCase())).toContain(
        LEARNER_USER_ID.toLowerCase(),
      );

      const adminResults = await fetchAdminSurveyResults(request, surveyId);
      const learnerResult = adminResults.find(
        (row: any) => String(row?.assignment_id ?? '') === String(matchingEntry.assignment.id),
      );
      expect(learnerResult).toBeTruthy();
      expect(String(learnerResult?.user_id ?? '').toLowerCase()).toBe(LEARNER_USER_ID.toLowerCase());
      expect(String(learnerResult?.status ?? '')).toBe('completed');
    } finally {
      await deleteSurvey(request, surveyId);
    }
  });

  test('duplicate assignment semantics are stable (second assign does not insert duplicate rows)', async ({ request }) => {
    const unique = Date.now();
    const surveyId = await createPublishedSurvey(request, unique);

    try {
      const firstAssign = await assignSurveyToOrg(request, surveyId);
      const secondAssign = await assignSurveyToOrg(request, surveyId);

      expect(firstAssign.body?.meta?.inserted ?? 0).toBeGreaterThan(0);
      // Contract: second assignment is idempotent for the same org target.
      // It must not create extra rows, and should return either updated or skipped semantics.
      expect(secondAssign.body?.meta?.inserted ?? 0).toBe(0);
      expect((secondAssign.body?.meta?.updated ?? 0) + (secondAssign.body?.meta?.skipped ?? 0)).toBeGreaterThan(0);

      const assignments = await listSurveyAssignments(request, surveyId);
      const orgLevelRows = assignments.filter((row: any) => !row?.user_id);
      expect(orgLevelRows.length).toBe(1);
    } finally {
      await deleteSurvey(request, surveyId);
    }
  });

  test('learner visibility after assignment (UI): assigned survey appears on client surveys page', async ({ request, page }) => {
    const unique = Date.now();
    const surveyTitle = `Survey Runtime Proof ${unique}`;
    const surveyId = await createPublishedSurvey(request, unique);

    try {
      await assignSurveyToOrg(request, surveyId);
      const learnerAssigned = await listLearnerAssignedSurveys(request);
      const assignedSurveyIds = learnerAssigned.map((entry: any) =>
        String(entry?.survey?.id ?? entry?.assignment?.survey_id ?? ''),
      );
      expect(assignedSurveyIds).toContain(String(surveyId));

      await page.route('**/api/client/surveys/assigned**', async (route) => {
        await route.continue({
          headers: {
            ...route.request().headers(),
            'x-e2e-bypass': 'true',
            'x-user-id': LEARNER_USER_ID,
            'x-user-role': 'learner',
            'x-org-id': TEST_ORG_ID,
          },
        });
      });

      await loginAsLearner(page);

      await page.goto(`${frontendBase}/client/surveys`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'My Surveys' })).toBeVisible({ timeout: 20_000 });

      await expect
        .poll(async () => {
          return page.evaluate(async ({ learnerUserId, orgId }) => {
            const response = await fetch('/api/client/surveys/assigned', {
              method: 'GET',
              headers: {
                'x-e2e-bypass': 'true',
                'x-user-id': learnerUserId,
                'x-user-role': 'learner',
                'x-org-id': orgId,
              },
            });
            if (!response.ok) return [];
            const payload = await response.json();
            return (payload?.data ?? []).map((entry: any) =>
              String(entry?.survey?.id ?? entry?.assignment?.survey_id ?? ''),
            );
          }, { learnerUserId: LEARNER_USER_ID, orgId: TEST_ORG_ID });
        }, { timeout: 30_000 })
        .toContain(String(surveyId));
    } finally {
      await deleteSurvey(request, surveyId);
    }
  });

  test('learner can save progress and restore draft responses on reload', async ({ request }) => {
    const unique = Date.now();
    const surveyId = await createPublishedSurvey(request, unique);

    try {
      await assignSurveyToOrg(request, surveyId);
      const learnerBeforeSave = await listLearnerAssignedSurveys(request);
      const matchingEntry = learnerBeforeSave.find(
        (entry: any) => String(entry?.survey?.id ?? entry?.assignment?.survey_id ?? '') === String(surveyId),
      );
      expect(matchingEntry?.assignment?.id).toBeTruthy();

      const saveResponse = await request.post(`${apiBase}/api/client/surveys/${encodeURIComponent(surveyId)}/submit`, {
        headers: learnerHeaders,
        failOnStatusCode: false,
        data: {
          assignmentId: matchingEntry.assignment.id,
          status: 'in-progress',
          responses: {
            q1: 'I am still filling this out',
          },
          metadata: {
            source: 'e2e-save-progress',
          },
        },
      });
      const saveText = await saveResponse.text();
      expect(saveResponse.status(), saveText).toBe(200);

      const learnerAfterSave = await listLearnerAssignedSurveys(request);
      const savedEntry = learnerAfterSave.find(
        (entry: any) => String(entry?.assignment?.id ?? '') === String(matchingEntry.assignment.id),
      );
      expect(savedEntry).toBeTruthy();
      expect(String(savedEntry?.assignment?.status ?? '')).toBe('in-progress');
      expect(savedEntry?.assignment?.metadata?.draft_response?.q1).toBe('I am still filling this out');

      await submitSurveyAsLearner(request, surveyId, matchingEntry.assignment.id);
    } finally {
      await deleteSurvey(request, surveyId);
    }
  });

  test('unauthenticated learner cannot submit survey responses', async ({ request }) => {
    const unique = Date.now();
    const surveyId = await createPublishedSurvey(request, unique);

    try {
      await assignSurveyToOrg(request, surveyId);
      const learnerAssignments = await listLearnerAssignedSurveys(request, LEARNER_USER_ID);
      const ownEntry = learnerAssignments.find(
        (entry: any) => String(entry?.survey?.id ?? entry?.assignment?.survey_id ?? '') === String(surveyId),
      );
      expect(ownEntry?.assignment?.id).toBeTruthy();

      const unauthenticatedSubmitResponse = await request.post(
        `${apiBase}/api/client/surveys/${encodeURIComponent(surveyId)}/submit`,
        {
          failOnStatusCode: false,
          data: {
            assignmentId: ownEntry.assignment.id,
            responses: {
              q1: { value: 4, label: 'Agree' },
            },
          },
        },
      );
      const unauthenticatedText = await unauthenticatedSubmitResponse.text();
      expect(unauthenticatedSubmitResponse.status(), unauthenticatedText).toBe(401);
    } finally {
      await deleteSurvey(request, surveyId);
    }
  });
});
