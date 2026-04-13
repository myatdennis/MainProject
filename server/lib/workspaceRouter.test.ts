import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceRouter } from '../routes/workspace.js';

type WorkspaceRow = Record<string, any>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const createSupabaseStub = (seed?: {
  plans?: WorkspaceRow[];
  notes?: WorkspaceRow[];
  items?: WorkspaceRow[];
}) => {
  const tables: Record<string, WorkspaceRow[]> = {
    org_workspace_strategic_plans: clone(seed?.plans ?? []),
    org_workspace_session_notes: clone(seed?.notes ?? []),
    org_workspace_action_items: clone(seed?.items ?? []),
  };

  let idCounter = 1000;

  const builderFor = (tableName: string) => {
    const state = {
      operation: 'select',
      filters: [] as Array<{ column: string; value: any }>,
      insertPayload: null as WorkspaceRow | null,
      updatePayload: null as WorkspaceRow | null,
      orders: [] as Array<{ column: string; ascending: boolean }>,
      single: false,
    };

    const getRows = () => tables[tableName] ?? [];

    const applyFilters = (rows: WorkspaceRow[]) =>
      rows.filter((row) => state.filters.every((filter) => row[filter.column] === filter.value));

    const applyOrders = (rows: WorkspaceRow[]) => {
      const ordered = [...rows];
      for (const order of [...state.orders].reverse()) {
        ordered.sort((left, right) => {
          const leftValue = left[order.column];
          const rightValue = right[order.column];
          if (leftValue === rightValue) return 0;
          if (leftValue == null) return order.ascending ? 1 : -1;
          if (rightValue == null) return order.ascending ? -1 : 1;
          return order.ascending
            ? String(leftValue).localeCompare(String(rightValue))
            : String(rightValue).localeCompare(String(leftValue));
        });
      }
      return ordered;
    };

    const execute = () => {
      if (state.operation === 'insert') {
        const row = {
          id: `generated-${idCounter++}`,
          created_at: new Date('2026-04-10T00:00:00.000Z').toISOString(),
          updated_at: new Date('2026-04-10T00:00:00.000Z').toISOString(),
          ...state.insertPayload,
        };
        tables[tableName].push(row);
        return { data: [clone(row)], error: null };
      }

      if (state.operation === 'update') {
        const rows = applyFilters(getRows());
        for (const row of rows) {
          Object.assign(row, state.updatePayload, {
            updated_at: new Date('2026-04-10T12:00:00.000Z').toISOString(),
          });
        }
        return { data: clone(rows), error: null };
      }

      if (state.operation === 'delete') {
        const rows = getRows();
        const remaining = rows.filter((row) => !applyFilters([row]).length);
        tables[tableName] = remaining;
        return { data: [], error: null };
      }

      const rows = applyOrders(applyFilters(getRows()));
      if (state.single) {
        return { data: clone(rows[0] ?? null), error: null };
      }
      return { data: clone(rows), error: null };
    };

    const builder = {
      select() {
        if (state.operation !== 'insert' && state.operation !== 'update') {
          state.operation = 'select';
        }
        return builder;
      },
      eq(column: string, value: any) {
        state.filters.push({ column, value });
        return builder;
      },
      order(column: string, options?: { ascending?: boolean }) {
        state.orders.push({ column, ascending: options?.ascending !== false });
        return builder;
      },
      insert(payload: WorkspaceRow) {
        state.operation = 'insert';
        state.insertPayload = payload;
        return builder;
      },
      update(payload: WorkspaceRow) {
        state.operation = 'update';
        state.updatePayload = payload;
        return builder;
      },
      delete() {
        state.operation = 'delete';
        return builder;
      },
      maybeSingle() {
        state.single = true;
        return Promise.resolve(execute());
      },
      then(onFulfilled: (value: any) => any, onRejected?: (reason: any) => any) {
        return Promise.resolve(execute()).then(onFulfilled, onRejected);
      },
    };

    return builder;
  };

  return {
    from(tableName: string) {
      return builderFor(tableName);
    },
    dump() {
      return clone(tables);
    },
  };
};

const createApp = (options?: { denyOrgId?: string }) => {
  const supabase = createSupabaseStub({
    plans: [
      {
        id: 'plan-1',
        org_id: 'org-1',
        content: 'Plan A',
        created_at: '2026-04-09T10:00:00.000Z',
        created_by: 'admin-1',
        metadata: {},
      },
    ],
    notes: [
      {
        id: 'note-1',
        org_id: 'org-1',
        title: 'Kickoff',
        body: 'Started',
        note_date: '2026-04-08T10:00:00.000Z',
        tags: ['ops'],
        attachments: [],
        created_by: 'admin-1',
        created_at: '2026-04-08T10:00:00.000Z',
        updated_at: '2026-04-08T10:00:00.000Z',
      },
    ],
    items: [
      {
        id: 'item-1',
        org_id: 'org-1',
        title: 'Second',
        description: '',
        assignee: 'Sam',
        due_at: '2026-05-01T00:00:00.000Z',
        status: 'Not Started',
        metadata: {},
        created_at: '2026-04-08T10:00:00.000Z',
        updated_at: '2026-04-08T10:00:00.000Z',
      },
      {
        id: 'item-2',
        org_id: 'org-1',
        title: 'First',
        description: '',
        assignee: 'Pat',
        due_at: '2026-04-15T00:00:00.000Z',
        status: 'Not Started',
        metadata: {},
        created_at: '2026-04-08T10:00:00.000Z',
        updated_at: '2026-04-08T10:00:00.000Z',
      },
    ],
  });

  const logger = {
    info: vi.fn(),
    error: vi.fn(),
  };

  const requireOrgAccess = vi.fn(async (req, res, orgId, accessOptions = {}) => {
    if (orgId === options?.denyOrgId) {
      res.status(403).json({
        ok: false,
        code: 'org_access_denied',
        message: 'Access denied',
      });
      return null;
    }
    return {
      role: accessOptions.write ? 'admin' : 'viewer',
      orgId,
    };
  });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/orgs/:orgId/workspace',
    createWorkspaceRouter({
      supabase,
      logger,
      requireOrgAccess,
      ensureSupabase: () => true,
    }),
  );

  return {
    app,
    logger,
    requireOrgAccess,
    supabase,
  };
};

describe('workspace router', () => {
  let server: any = null;
  let baseUrl = '';
  let context: ReturnType<typeof createApp>;

  beforeEach(async () => {
    context = createApp();
    server = context.app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => server.close((error: Error | undefined) => (error ? reject(error) : resolve())));
    }
  });

  it('returns normalized workspace bundle data', async () => {
    const response = await fetch(`${baseUrl}/api/orgs/org-1/workspace`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.orgId).toBe('org-1');
    expect(payload.data.actionItems.map((item: any) => item.title)).toEqual(['First', 'Second']);
    expect(context.logger.info).toHaveBeenCalledWith(
      'workspace.bundle.response',
      expect.objectContaining({
        orgId: 'org-1',
        actionItemCount: 2,
      }),
    );
  });

  it('rejects invalid session note payloads with normalized errors', async () => {
    const response = await fetch(`${baseUrl}/api/orgs/org-1/workspace/session-notes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '   ' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      ok: false,
      code: 'title_required',
      message: 'title is required',
    });
  });

  it('creates action items through the repository boundary and returns the normalized envelope', async () => {
    const response = await fetch(`${baseUrl}/api/orgs/org-1/workspace/action-items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Follow up',
        assignee: 'Alex',
        dueDate: '2026-04-30T00:00:00.000Z',
        status: 'In Progress',
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.data.title).toBe('Follow up');
    expect(payload.data.status).toBe('In Progress');
    expect(context.supabase.dump().org_workspace_action_items).toHaveLength(3);
    expect(context.requireOrgAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'org-1',
      { write: true },
    );
  });

  it('enforces org access failures from the router boundary', async () => {
    const deniedContext = createApp({ denyOrgId: 'org-2' });
    const deniedServer = deniedContext.app.listen(0);
    await new Promise<void>((resolve) => deniedServer.once('listening', resolve));
    const address = deniedServer.address();
    const deniedUrl = `http://127.0.0.1:${address.port}`;

    try {
      const response = await fetch(`${deniedUrl}/api/orgs/org-2/workspace/access`);
      const payload = await response.json();
      expect(response.status).toBe(403);
      expect(payload).toEqual({
        ok: false,
        code: 'org_access_denied',
        message: 'Access denied',
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        deniedServer.close((error: Error | undefined) => (error ? reject(error) : resolve())),
      );
    }
  });
});
