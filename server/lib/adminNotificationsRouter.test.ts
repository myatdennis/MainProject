import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminNotificationsRouter } from '../routes/adminNotifications.js';

const createNotificationsSupabase = (state) => {
  const sortRows = (rows) =>
    rows.slice().sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const makeFilterChain = (rows, finalize) => {
    let filtered = rows.slice();
    let ranged = null;

    const chain = {
      eq(column, value) {
        filtered = filtered.filter((row) => row?.[column] === value);
        return chain;
      },
      or(expression) {
        const clauses = String(expression)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        filtered = filtered.filter((row) =>
          clauses.some((clause) => {
            const [left, right] = clause.split('.eq.');
            return left && row?.[left] === right;
          }),
        );
        return chain;
      },
      in(column, values) {
        filtered = filtered.filter((row) => values.includes(row?.[column]));
        return chain;
      },
      order() {
        filtered = sortRows(filtered);
        return chain;
      },
      range(from, to) {
        ranged = { from, to };
        return chain;
      },
      limit(limit) {
        ranged = { from: 0, to: limit - 1 };
        return chain;
      },
      then(resolve, reject) {
        try {
          const total = filtered.length;
          const rowsToReturn = ranged ? filtered.slice(ranged.from, ranged.to + 1) : filtered;
          resolve(finalize(clone(rowsToReturn), total));
        } catch (error) {
          reject?.(error);
        }
      },
      catch(reject) {
        return chain.then(() => undefined, reject);
      },
      maybeSingle: async () => ({ data: clone(filtered[0] ?? null), error: null }),
      select() {
        return chain;
      },
    };

    return chain;
  };

  const makeInsertChain = (table) => ({
    select: async () => {
      const inserted = Array.isArray(table.pendingInsert) ? table.pendingInsert : [table.pendingInsert];
      inserted.forEach((row) => state.notifications.push(clone(row)));
      table.pendingInsert = null;
      return { data: clone(inserted), error: null };
    },
  });

  const makeUpdateChain = (table, patch) => {
    let matchId = null;
    return {
      eq(column, value) {
        if (column === 'id') matchId = value;
        return {
          select: async () => {
            const updated = [];
            state.notifications = state.notifications.map((row) => {
              if (matchId && row.id !== matchId) return row;
              const next = { ...row, ...patch };
              updated.push(next);
              return next;
            });
            return { data: clone(updated), error: null };
          },
        };
      },
    };
  };

  const makeDeleteChain = () => {
    let matchId = null;
    return {
      eq(column, value) {
        if (column === 'id') matchId = value;
        return Promise.resolve().then(() => {
          state.notifications = state.notifications.filter((row) => row.id !== matchId);
          return { error: null };
        });
      },
    };
  };

  return {
    from(tableName) {
      if (tableName === 'notifications') {
        return {
          select: () =>
            makeFilterChain(state.notifications, (data, total) => ({
              data,
              error: null,
              count: total,
            })),
          insert(payload) {
            const rows = Array.isArray(payload) ? payload : [payload];
            const normalized = rows.map((row, index) => ({
              id: row.id || `notif-${state.notifications.length + index + 1}`,
              created_at: row.created_at || new Date().toISOString(),
              ...row,
            }));
            return makeInsertChain({ pendingInsert: normalized });
          },
          update(patch) {
            return makeUpdateChain(state.notifications, patch);
          },
          delete() {
            return makeDeleteChain();
          },
        };
      }

      if (tableName === 'organizations') {
        return {
          select: () =>
            makeFilterChain(state.organizations, (data) => ({
              data,
              error: null,
            })),
        };
      }

      if (tableName === 'user_profiles') {
        return {
          select: () =>
            makeFilterChain(state.userProfiles, (data) => ({
              data,
              error: null,
            })),
        };
      }

      throw new Error(`Unexpected table: ${tableName}`);
    },
  };
};

const createApp = () => {
  const state = {
    notifications: [
      {
        id: 'notif-1',
        title: 'Welcome',
        body: 'Body',
        organization_id: 'org-1',
        user_id: 'learner-1',
        read: false,
        dispatch_status: 'queued',
        channels: ['in_app'],
        metadata: {},
        scheduled_for: null,
        delivered_at: null,
        created_at: '2026-04-12T10:00:00.000Z',
      },
    ],
    organizations: [{ id: 'org-1', status: 'active', updated_at: '2026-04-12T10:00:00.000Z' }],
    userProfiles: [{ id: 'learner-2', updated_at: '2026-04-12T10:00:00.000Z' }],
  };

  const supabase = createNotificationsSupabase(state);
  const notificationService = {
    createNotification: vi.fn(async (payload) => {
      const record = {
        id: payload.id || `notif-${state.notifications.length + 1}`,
        title: payload.title,
        body: payload.body ?? null,
        organization_id: payload.organizationId ?? null,
        user_id: payload.userId ?? null,
        read: payload.read ?? false,
        dispatch_status: payload.scheduledFor ? 'pending' : 'queued',
        channels: payload.channels ?? ['in_app'],
        metadata: payload.metadata ?? {},
        scheduled_for: payload.scheduledFor ?? null,
        delivered_at: null,
        created_at: new Date().toISOString(),
      };
      state.notifications.push(record);
      return record;
    }),
    markNotificationRead: vi.fn(async (id, read) => {
      const found = state.notifications.find((row) => row.id === id);
      if (!found) return null;
      found.read = Boolean(read);
      return { ...found };
    }),
  };

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'notif-req-1';
    next();
  });

  app.use(
    '/api/admin/notifications',
    createAdminNotificationsRouter({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      supabase,
      notificationService,
      ENABLE_NOTIFICATIONS: true,
      isDemoOrTestMode: false,
      ensureSupabase: () => true,
      requireUserContext: () => ({
        userId: 'admin-1',
        userRole: 'admin',
        isPlatformAdmin: true,
        organizationIds: ['org-1'],
      }),
      requireOrgAccess: vi.fn(async (_req, _res, orgId) => (orgId === 'org-1' ? { orgId, role: 'admin' } : null)),
      normalizeOrgIdValue: (value) => (value ? String(value).trim() : null),
      parsePaginationParams: () => ({ page: 1, pageSize: 25, from: 0, to: 24 }),
      sanitizeIlike: (value) => value,
      mapNotificationRecord: (row) => row,
      buildDisabledNotificationsResponse: (page, pageSize, requestId) => ({
        ok: true,
        data: [],
        pagination: { page, pageSize, total: 0, hasMore: false },
        notificationsDisabled: true,
        requestId,
      }),
      isNotificationsTableMissingError: () => false,
      logNotificationsMissingTable: vi.fn(),
      parseFlag: (value) => value === true || value === 'true',
      coerceIdArray: (raw) => (Array.isArray(raw) ? raw : []),
    }),
  );

  return { app, state, notificationService };
};

describe('admin notifications router', () => {
  let server = null;
  let baseUrl = '';
  let state;
  let notificationService;

  beforeEach(async () => {
    const context = createApp();
    state = context.state;
    notificationService = context.notificationService;
    server = context.app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('lists notifications through the extracted admin route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/notifications?orgId=org-1`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.meta.pagination.total).toBe(1);
  });

  it('creates notifications through the extracted admin route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/notifications`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Launch update', body: 'Ready', organizationId: 'org-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.data.title).toBe('Launch update');
    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
  });

  it('broadcasts notifications through the extracted admin route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/notifications/broadcast`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Update', message: 'Body', organizationIds: ['org-1'], userIds: ['learner-2'] }),
    });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(payload.data).toHaveLength(2);
    expect(payload.meta.delivered).toBe(2);
  });

  it('marks notifications as read through the extracted admin route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/notifications/notif-1/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ read: true }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.read).toBe(true);
  });

  it('deletes notifications through the extracted admin route', async () => {
    const response = await fetch(`${baseUrl}/api/admin/notifications/notif-1`, { method: 'DELETE' });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(state.notifications.find((row) => row.id === 'notif-1')).toBeUndefined();
  });
});
