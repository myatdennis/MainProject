import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildAuthHeaders,
  createAdminAuthHeaders,
  startTestServer,
  stopTestServer,
  type TestServerHandle,
} from './utils/server.ts';

const DEMO_ORG_ID = 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8';
const ALT_ORG_ID = '3f48d198-c3dd-4afb-b443-6257c8046d2f';
const LEARNER_ID = '00000000-0000-0000-0000-000000000003';

describe('Survey lifecycle contract', () => {
  let server: TestServerHandle | null = null;
  let platformAdminHeaders: Record<string, string> = {};
  let orgAdminHeaders: Record<string, string> = {};
  let learnerHeaders: Record<string, string> = {};

  beforeAll(async () => {
    server = await startTestServer();
    platformAdminHeaders = await createAdminAuthHeaders({ email: 'mya@the-huddle.co' });
    orgAdminHeaders = await buildAuthHeaders({
      email: 'survey-org-admin@local',
      role: 'admin',
      platformRole: null,
      organization_ids: [DEMO_ORG_ID],
      app_metadata: {
        memberships: [{ orgId: DEMO_ORG_ID, role: 'admin', status: 'active' }],
      },
    } as any);
    learnerHeaders = await buildAuthHeaders({
      userId: LEARNER_ID,
      email: 'survey-learner@local',
      role: 'member',
      platformRole: null,
      organization_ids: [DEMO_ORG_ID],
      app_metadata: {
        memberships: [{ orgId: DEMO_ORG_ID, role: 'member', status: 'active' }],
      },
    } as any);
  });

  afterAll(async () => {
    await stopTestServer(server);
    server = null;
  });

  const parseJson = async (res: Response) => res.json().catch(() => ({}));

  const createSurvey = async (headers: Record<string, string>, status: 'draft' | 'published' = 'draft') => {
    const response = await server!.fetch('/api/admin/surveys', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        title: `Lifecycle Survey ${Date.now()}`,
        description: 'Survey lifecycle integration proof.',
        type: 'custom',
        status,
        sections: [
          {
            id: 'section-1',
            title: 'Section 1',
            order: 1,
            questions: [
              {
                id: 'q1',
                type: 'text',
                title: 'How did this feel?',
                required: true,
                order: 1,
              },
            ],
          },
        ],
        blocks: [],
        assignedTo: {
          organizationIds: [DEMO_ORG_ID],
        },
        organizationIds: [DEMO_ORG_ID],
      }),
    });
    const body = await parseJson(response as any);
    expect(response.status, JSON.stringify(body)).toBe(201);
    expect(body?.data?.id).toBeTruthy();
    return body.data.id as string;
  };

  const deleteSurvey = async (surveyId: string) => {
    await server!.fetch(`/api/admin/surveys/${encodeURIComponent(surveyId)}`, {
      method: 'DELETE',
      headers: platformAdminHeaders,
    });
  };

  it('creates a draft survey and publishes it successfully', async () => {
    const surveyId = await createSurvey(orgAdminHeaders, 'draft');

    try {
      const updateRes = await server!.fetch(`/api/admin/surveys/${encodeURIComponent(surveyId)}`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...orgAdminHeaders,
        },
        body: JSON.stringify({ status: 'published' }),
      });
      const updateBody = await parseJson(updateRes as any);
      expect(updateRes.status).toBe(200);
      expect(updateBody?.data?.status).toBe('published');
    } finally {
      await deleteSurvey(surveyId);
    }
  });

  it('returns explicit 4xx errors for ambiguous learner org scope and unauthorized assignment scope', async () => {
    const surveyId = await createSurvey(platformAdminHeaders, 'published');

    try {
      const ambiguousLearnerHeaders = await buildAuthHeaders({
        email: 'survey-multi-org-learner@local',
        role: 'member',
        platformRole: null,
        organization_ids: [DEMO_ORG_ID, ALT_ORG_ID],
        app_metadata: {
          memberships: [
            { orgId: DEMO_ORG_ID, role: 'member', status: 'active' },
            { orgId: ALT_ORG_ID, role: 'member', status: 'active' },
          ],
        },
      } as any);

      const ambiguousRes = await server!.fetch('/api/client/surveys/assigned', {
        headers: {
          Accept: 'application/json',
          ...ambiguousLearnerHeaders,
        },
      });
      const ambiguousBody = await parseJson(ambiguousRes as any);
      expect(ambiguousRes.status).toBe(400);
      expect(ambiguousBody).toMatchObject({
        error: 'explicit_org_selection_required',
      });

      const forbiddenRes = await server!.fetch(`/api/admin/surveys/${encodeURIComponent(surveyId)}/assign`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...orgAdminHeaders,
        },
        body: JSON.stringify({
          organizationIds: [ALT_ORG_ID],
        }),
      });
      const forbiddenBody = await parseJson(forbiddenRes as any);
      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenBody).toMatchObject({
        error: 'org_access_denied',
      });
    } finally {
      await deleteSurvey(surveyId);
    }
  });

  it('persists assignment, learner submission, and admin results end to end', async () => {
    const surveyId = await createSurvey(orgAdminHeaders, 'published');

    try {
      const assignRes = await server!.fetch(`/api/admin/surveys/${encodeURIComponent(surveyId)}/assign`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...orgAdminHeaders,
        },
        body: JSON.stringify({
          organizationIds: [DEMO_ORG_ID],
        }),
      });
      const assignBody = await parseJson(assignRes as any);
      expect([200, 201]).toContain(assignRes.status);
      expect(Array.isArray(assignBody?.data)).toBe(true);

      const learnerAssignedRes = await server!.fetch('/api/client/surveys/assigned', {
        headers: {
          Accept: 'application/json',
          'x-organization-id': DEMO_ORG_ID,
          ...learnerHeaders,
        },
      });
      const learnerAssignedBody = await parseJson(learnerAssignedRes as any);
      expect(learnerAssignedRes.status).toBe(200);
      const assignedEntry = (learnerAssignedBody?.data ?? []).find(
        (entry: any) => String(entry?.survey?.id ?? entry?.assignment?.survey_id ?? '') === String(surveyId),
      );
      expect(assignedEntry?.assignment?.id).toBeTruthy();

      const submitRes = await server!.fetch(`/api/client/surveys/${encodeURIComponent(surveyId)}/submit`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-organization-id': DEMO_ORG_ID,
          ...learnerHeaders,
        },
        body: JSON.stringify({
          assignmentId: assignedEntry.assignment.id,
          responses: {
            q1: 'Supported and clear.',
          },
        }),
      });
      const submitBody = await parseJson(submitRes as any);
      expect(submitRes.status, JSON.stringify(submitBody)).toBe(201);

      const resultsRes = await server!.fetch(
        `/api/admin/surveys/${encodeURIComponent(surveyId)}/results?orgId=${encodeURIComponent(DEMO_ORG_ID)}`,
        {
          headers: {
            Accept: 'application/json',
            ...orgAdminHeaders,
          },
        },
      );
      const resultsBody = await parseJson(resultsRes as any);
      expect(resultsRes.status).toBe(200);
      const learnerRow = (resultsBody?.data ?? []).find(
        (row: any) => String(row?.assignment_id ?? '') === String(assignedEntry.assignment.id),
      );
      expect(learnerRow).toBeTruthy();
      expect(String(learnerRow?.status ?? '')).toBe('completed');
    } finally {
      await deleteSurvey(surveyId);
    }
  });
});
