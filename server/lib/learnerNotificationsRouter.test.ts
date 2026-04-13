import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLearnerNotificationsRouter } from '../routes/learnerNotifications.js';

const createNotificationsSupabase = (state) => ({
  from(table) {
    if (table !== 'notifications') throw new Error(`Unexpected table ${table}`);
    return {
      select() {
        let rows = state.notifications.slice();
        const chain = {
          eq(column, value) {
            rows = rows.filter((row) => row?.[column] === value);
            return chain;
          },
          in(column, values) {
            rows = rows.filter((row) => values.includes(row?.[column]));
            return chain;
          },
          is(column, value) {
            rows = rows.filter((row) => (value === null ? row?.[column] == null : row?.[column] === value));
            return chain;
          },
          order() {
            return chain;
          },
          limit(limit) {
            rows = rows.slice(0, limit);
            return chain;
          },
          maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
          then(resolve, reject) {
            Promise.resolve({ data: rows, error: null }).then(resolve, reject);
          },
          catch(reject) {
            return Promise.resolve({ data: rows, error: null }).catch(reject);
          },
        };
        return chain;
      },
      delete() {
        return {
          eq(_column, value) {
            state.notifications = state.notifications.filter((row) => row.id !== value);
            return Promise.resolve({ error: null });
          },
        };
      },
    };
  },
});

const createApp = () => {
  const state = {
    notifications: [
      {
        id: 'note-1',
        title: 'Personal',
        body: 'Body',
        user_id: 'learner-1',
        organization_id: 'org-1',
        read: false,
        created_at: '2026-04-12T10:00:00.000Z',
      },
      {
        id: 'note-2',
        title: 'Org',
        body: 'Body',
        user_id: null,
        organization_id: 'org-1',
        read: false,
        created_at: '2026-04-12T09:00:00.000Z',
      },
    ],
  };

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'learner-note-req';
    next();
  });

  const notificationService = {
    markNotificationRead: vi.fn(async (id) => {
      const row = state.notifications.find((note) => note.id === id);
      if (!row) return null;
      row.read = true;
      return { ...row };
    }),
  };
  const broadcastToTopic = vi.fn();

  app.use(
    '/api/learner/notifications',
    createLearnerNotificationsRouter({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      supabase: createNotificationsSupabase(state),
      notificationService,
      broadcastToTopic,
      ENABLE_NOTIFICATIONS: true,
      isDemoOrTestMode: false,
      ensureSupabase: () => true,
      requireUserContext: () => ({ userId: 'learner-1', organizationIds: ['org-1'] }),
      requireOrgAccess: vi.fn(async (_req, _res, orgId) => (orgId === 'org-1' ? { orgId } : null)),
      normalizeOrgIdValue: (value) => (value ? String(value).trim() : null),
      clampNumber: (value, min, max) => Math.max(min, Math.min(max, value)),
      runNotificationQuery: async (factory) => {
        const { data } = await factory('*');
        return data || [];
      },
      mapNotificationRecord: (row) => row,
      isNotificationsTableMissingError: () => false,
      logNotificationsMissingTable: vi.fn(),
      isMissingColumnError: () => false,
    }),
  );

  return { app, state, notificationService, broadcastToTopic };
};

describe('learner notifications router', () => {
  let server = null;
  let baseUrl = '';
  let state;
  let notificationService;
  let broadcastToTopic;

  beforeEach(async () => {
    const context = createApp();
    state = context.state;
    notificationService = context.notificationService;
    broadcastToTopic = context.broadcastToTopic;
    server = context.app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('lists learner notifications through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/learner/notifications`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data).toHaveLength(2);
  });

  it('marks learner notifications as read through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/learner/notifications/note-1/read`, { method: 'POST' });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.read).toBe(true);
    expect(notificationService.markNotificationRead).toHaveBeenCalledWith('note-1', true);
  });

  it('deletes learner notifications through the extracted route', async () => {
    const response = await fetch(`${baseUrl}/api/learner/notifications/note-1`, { method: 'DELETE' });

    expect(response.status).toBe(204);
    expect(state.notifications.find((row) => row.id === 'note-1')).toBeUndefined();
    expect(broadcastToTopic).toHaveBeenCalled();
  });
});
