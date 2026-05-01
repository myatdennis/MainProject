import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminSurveyAssignmentsRouter } from '../routes/adminSurveyAssignments.js';

const createApp = (options?: { denyOrg?: boolean }) => {
  const e2eStore = {
    assignments: [],
  };
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'req-assign';
    next();
  });
  app.use(
    '/api/admin/surveys',
    createAdminSurveyAssignmentsRouter({
      supabase: null,
      sql: null,
      logger,
      e2eStore,
      shouldUseAssignmentWriteFallback: () => true,
      isDemoOrTestMode: true,
      surveyAssignmentType: 'survey',
      detectAssignmentsUserIdUuidColumnAvailability: vi.fn(async () => false),
      getAssignmentsOrgColumnName: vi.fn(async () => 'organization_id'),
      fetchOrgMembersWithProfiles: vi.fn(async () => []),
      coerceOrgIdentifierToUuid: vi.fn(async (_req, value) => value),
      InvalidOrgIdentifierError: class InvalidOrgIdentifierError extends Error {},
      isUuid: vi.fn(() => false),
      refreshSurveyAssignmentAggregates: vi.fn(async () => undefined),
      notifyAssignmentRecipients: vi.fn(async () => undefined),
      logSurveyAssignmentEvent: vi.fn(),
      createEmptyAssignedTo: () => ({ organizationIds: [], userIds: [] }),
      updateDemoSurveyAssignments: vi.fn(),
      isInfrastructureUnavailableError: vi.fn(() => false),
      ensureSupabase: () => true,
      ensureAdminSurveySchemaOrRespond: vi.fn(async () => true),
      loadSurveyWithAssignments: vi.fn(async (id) => ({ id })),
      rememberSurveyIdentifierAlias: vi.fn(),
      normalizeLegacyOrgInput: (body) => body,
      normalizeAssignmentUserIds: (raw = []) => ({
        normalizedUserIds: Array.isArray(raw) ? raw.map(String) : [],
        invalidTargetIds: [],
      }),
      deriveSurveyAssignmentOrgScope: vi.fn(() => ({ ok: true, organizationIds: ['org-1'] })),
      requireUserContext: vi.fn(() => ({
        userId: 'admin-1',
        isPlatformAdmin: false,
        organizationIds: ['org-1'],
        memberships: [{ organization_id: 'org-1', role: 'admin' }],
      })),
      normalizeOrgIdValue: (value) => (value ? String(value).trim() : null),
      pickOrgId: (...values) => values.find((value) => value != null),
      resolveSurveyIdentifierToCanonicalId: vi.fn(async (value) => value),
      clampNumber: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),
      surveyAssignmentSelect: '*',
      requireOrgAccess: vi.fn(async (_req, res, orgId) => {
        if (options?.denyOrg || orgId !== 'org-1') {
          if (res && !res.headersSent) {
            res.status(403).json({ ok: false, error: 'org_access_denied', code: 'org_access_denied', message: 'Access denied' });
          }
          return null;
        }
        return { role: 'admin', orgId };
      }),
    }),
  );

  return { app, e2eStore };
};

describe('admin survey assignments router', () => {
  let server: any = null;
  let baseUrl = '';

  beforeEach(async () => {
    const context = createApp();
    server = context.app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((error: Error | undefined) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('assigns a survey in fallback mode and returns normalized success meta', async () => {
    const response = await fetch(`${baseUrl}/api/admin/surveys/survey-1/assign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationIds: ['org-1'] }),
    });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.meta).toMatchObject({
      inserted: 1,
      updated: 0,
    });
    expect(payload.data[0]).toMatchObject({
      survey_id: 'survey-1',
      organization_id: 'org-1',
      assignment_type: 'survey',
    });
  });

  it('returns normalized org access denial', async () => {
    const deniedContext = createApp({ denyOrg: true });
    const deniedServer = deniedContext.app.listen(0);
    await new Promise<void>((resolve) => deniedServer.once('listening', resolve));
    const deniedUrl = `http://127.0.0.1:${deniedServer.address().port}`;

    try {
      const response = await fetch(`${deniedUrl}/api/admin/surveys/survey-1/assign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationIds: ['org-1'] }),
      });
      const payload = await response.json();
      expect(response.status).toBe(403);
      expect(payload).toMatchObject({
        ok: false,
        error: 'org_access_denied',
        code: 'org_access_denied',
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        deniedServer.close((error: Error | undefined) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('lists assignments for a survey via the extracted router', async () => {
    const createResponse = await fetch(`${baseUrl}/api/admin/surveys/survey-1/assign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationIds: ['org-1'] }),
    });
    expect(createResponse.status).toBe(201);

    const listResponse = await fetch(`${baseUrl}/api/admin/surveys/survey-1/assignments?orgId=org-1`);
    const payload = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.meta).toMatchObject({ count: 1 });
  });

  it('deletes an assignment via the extracted router', async () => {
    const createResponse = await fetch(`${baseUrl}/api/admin/surveys/survey-1/assign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationIds: ['org-1'] }),
    });
    const createdPayload = await createResponse.json();
    const assignmentId = createdPayload.data[0].id;

    const deleteResponse = await fetch(`${baseUrl}/api/admin/surveys/survey-1/assignments/${assignmentId}`, {
      method: 'DELETE',
    });
    const deletePayload = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deletePayload).toMatchObject({
      ok: true,
      data: { deleted: true, id: assignmentId },
    });
  });
});
