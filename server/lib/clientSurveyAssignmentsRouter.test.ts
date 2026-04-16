import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientSurveyAssignmentsRouter } from '../routes/clientSurveyAssignments.js';

const createApp = (options?: {
  context?: any;
  isDemoOrTestMode?: boolean;
  supabase?: any;
  buildClientSurveyAssignmentSelect?: any;
  explicitSelectionRequired?: boolean;
  runTimedQuery?: any;
  ensureSurveyAssignmentsForUserFromOrgScope?: any;
  loadSurveyRecordsByAssignmentIds?: any;
  isSupabaseTransientError?: any;
  getAssignmentsOrgColumnName?: any;
}) => {
  const e2eStore = {
    assignments: [
      {
        id: 'org-assignment-1',
        survey_id: 'survey-1',
        organization_id: 'org-1',
        user_id: null,
        assignment_type: 'survey',
        status: 'assigned',
        active: true,
        metadata: {},
      },
    ],
    surveys: new Map([
      [
        'survey-1',
        {
          id: 'survey-1',
          title: 'Culture Survey',
        },
      ],
    ]),
  };

  const persistE2EStore = vi.fn();
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const requireUserContext = vi.fn(() =>
    options?.context ?? {
      userId: 'learner-1',
      organizationIds: ['org-1'],
      isPlatformAdmin: false,
    },
  );
  const resolveOrgScopeFromRequest = vi.fn(() => ({
    orgId: 'org-1',
    requiresExplicitSelection: Boolean(options?.explicitSelectionRequired),
  }));

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).requestId = 'req-1';
    next();
  });
  app.use(
    '/api/client/surveys',
    createClientSurveyAssignmentsRouter({
      logger,
      supabase: options?.supabase ?? null,
      e2eStore,
      persistE2EStore,
      isDemoOrTestMode: options?.isDemoOrTestMode ?? true,
        buildClientSurveyAssignmentSelect: options?.buildClientSurveyAssignmentSelect ?? undefined,
      surveyAssignmentType: 'survey',
      ensureSurveyAssignmentsForUserFromOrgScope: options?.ensureSurveyAssignmentsForUserFromOrgScope ?? vi.fn(async () => undefined),
      detectAssignmentsUserIdUuidColumnAvailability: vi.fn(async () => false),
      getAssignmentsOrgColumnName: options?.getAssignmentsOrgColumnName ?? vi.fn(async () => 'organization_id'),
      isUuid: vi.fn(() => false),
      runTimedQuery: options?.runTimedQuery ?? vi.fn(async (_label, fn) => fn()),
      surveyAssignmentSelect: '*',
      isSupabaseTransientError: options?.isSupabaseTransientError ?? vi.fn(() => false),
      loadSurveyRecordsByAssignmentIds: options?.loadSurveyRecordsByAssignmentIds ?? vi.fn(async () => ({
        surveyMap: new Map(),
        requestedCount: 0,
        resolvedIdCount: 0,
        rawRowCount: 0,
      })),
      requireUserContext,
      resolveOrgScopeFromRequest,
    }),
  );

  return {
    app,
    e2eStore,
    logger,
    persistE2EStore,
  };
};

describe('client survey assignments router', () => {
  let server: any = null;
  let baseUrl = '';

  beforeEach(async () => {
    const context = createApp();
    server = context.app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((error: Error | undefined) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('returns assigned surveys in the normalized envelope with top-level meta', async () => {
    const response = await fetch(`${baseUrl}/api/client/surveys/assigned`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data[0].assignment.user_id).toBe('learner-1');
    expect(payload.data[0].survey.title).toBe('Culture Survey');
    expect(payload.meta).toEqual({
      hydrationPending: false,
      orgId: 'org-1',
    });
  });

  it('rejects ambiguous org scope with a normalized error envelope', async () => {
    const context = createApp({ explicitSelectionRequired: true });
    const deniedServer = context.app.listen(0);
    await new Promise<void>((resolve) => deniedServer.once('listening', resolve));
    const deniedUrl = `http://127.0.0.1:${(deniedServer.address() as any).port}`;

    try {
      const response = await fetch(`${deniedUrl}/api/client/surveys/assigned`);
      const payload = await response.json();
      expect(response.status).toBe(400);
      expect(payload).toMatchObject({
        ok: false,
        code: 'explicit_org_selection_required',
        message: 'Select an organization to load assigned surveys.',
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        deniedServer.close((error: Error | undefined) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('returns a normalized database-unavailable error outside demo mode', async () => {
    const context = createApp({ isDemoOrTestMode: false, supabase: null });
    const unavailableServer = context.app.listen(0);
    await new Promise<void>((resolve) => unavailableServer.once('listening', resolve));
    const unavailableUrl = `http://127.0.0.1:${(unavailableServer.address() as any).port}`;

    try {
      const response = await fetch(`${unavailableUrl}/api/client/surveys/assigned`);
      const payload = await response.json();
      expect(response.status).toBe(503);
      expect(payload).toMatchObject({
        ok: false,
        code: 'database_unavailable',
        message: 'Assigned surveys are unavailable because the database is not configured.',
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        unavailableServer.close((error: Error | undefined) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('returns hydrationPending when Supabase assigned survey load times out', async () => {
    const timedQuery = vi.fn(async (label, fn) => {
      if (label === 'survey.assigned.load_assignments') {
        const err = new Error('timeout') as any;
        err.code = 'SUPABASE_TIMEOUT';
        throw err;
      }
      return fn();
    });

    const context = createApp({
      isDemoOrTestMode: false,
      supabase: {},
      runTimedQuery: timedQuery,
      ensureSurveyAssignmentsForUserFromOrgScope: vi.fn(async () => undefined),
      isSupabaseTransientError: vi.fn((error: any) => String(error?.code) === 'SUPABASE_TIMEOUT'),
    });
    const timeoutServer = context.app.listen(0);
    await new Promise<void>((resolve) => timeoutServer.once('listening', resolve));
    const timeoutUrl = `http://127.0.0.1:${(timeoutServer.address() as any).port}`;

    try {
      const response = await fetch(`${timeoutUrl}/api/client/surveys/assigned`);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.ok).toBe(true);
      expect(Array.isArray(payload.data)).toBe(true);
      expect(payload.data).toHaveLength(0);
      expect(payload.meta).toEqual({ hydrationPending: true, orgId: 'org-1' });
    } finally {
      await new Promise<void>((resolve, reject) =>
        timeoutServer.close((error: Error | undefined) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('uses a schema-safe assignment select when assignments use organization_id', async () => {
    const selectCalls: string[] = [];
    const createBuilder = () => {
      const builder: any = {
        select(columns: string) {
          selectCalls.push(columns);
          return builder;
        },
        eq() {
          return builder;
        },
        in() {
          return builder;
        },
        then(resolve: (value: any) => any) {
          return Promise.resolve(resolve({ data: [], error: null }));
        },
      };
      return builder;
    };
    const supabase = {
      from(table: string) {
        expect(table).toBe('assignments');
        return createBuilder();
      },
    };

    const context = createApp({
      isDemoOrTestMode: false,
      supabase,
      ensureSurveyAssignmentsForUserFromOrgScope: vi.fn(async () => undefined),
      getAssignmentsOrgColumnName: vi.fn(async () => 'organization_id'),
    });
    const schemaSafeServer = context.app.listen(0);
    await new Promise<void>((resolve) => schemaSafeServer.once('listening', resolve));
    const schemaSafeUrl = `http://127.0.0.1:${(schemaSafeServer.address() as any).port}`;

    try {
      const response = await fetch(`${schemaSafeUrl}/api/client/surveys/assigned`);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.ok).toBe(true);
      expect(selectCalls.some((columns) => columns.includes('organization_id'))).toBe(true);
      expect(selectCalls.some((columns) => columns.includes('org_id'))).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) =>
        schemaSafeServer.close((error: Error | undefined) => (error ? reject(error) : resolve())),
      );
    }
  });
});
