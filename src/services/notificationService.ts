import apiRequest from '../utils/apiClient';

export type Notification = {
  id: string;
  title: string;
  body?: string;
  type?: string;
  organizationId?: string | null;
  userId?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  readAt?: string | null;
  read?: boolean;
  payload?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  messageId?: string | null;
};

const devLogEnabled =
  typeof process !== 'undefined'
    ? process.env.NODE_ENV !== 'production'
    : Boolean((import.meta as any)?.env?.DEV);
const NOTIFICATION_CACHE_TTL_MS = 10_000;

type NotificationCacheEntry = {
  expiresAt: number;
  items: Notification[];
};

const learnerNotificationCache = new Map<string, NotificationCacheEntry>();
const learnerNotificationInflight = new Map<string, Promise<Notification[]>>();
const adminNotificationCache = new Map<string, { expiresAt: number; result: { notifications: Notification[]; notificationsDisabled: boolean } }>();
const adminNotificationInflight = new Map<
  string,
  Promise<{ notifications: Notification[]; notificationsDisabled: boolean }>
>();

const logNotificationFetch = (label: string, path: string) => {
  if (!devLogEnabled) return;
  console.debug(`[notifications.fetch:${label}]`, path);
};

const isSchemaMissingError = (error: unknown) => {
  const body = (error as any)?.body ?? (error as any)?.response?.body ?? null;
  const code = body && typeof (body as any).code === 'string' ? (body as any).code : null;
  return code === 'PGRST205';
};

const handleSchemaMissing = <T>(error: unknown, label: string, fallback: T) => {
  if (isSchemaMissingError(error)) {
    const body = (error as any)?.body ?? (error as any)?.response?.body ?? {};
    const status = (error as any)?.status ?? (error as any)?.response?.status ?? null;
    console.warn(`[notifications.disabled:${label}] treating notifications as disabled`, {
      status,
      code: (body as any).code ?? null,
    });
    return fallback;
  }
  throw error;
};

const apiFetch = async <T>(label: string, path: string, options: any = {}) => {
  logNotificationFetch(label, path);
  return apiRequest<T>(path, options);
};

const buildCacheKey = (prefix: string, params?: URLSearchParams) => {
  const suffix = params?.toString() ?? '';
  return `${prefix}:${suffix}`;
};

const invalidateNotificationCaches = () => {
  learnerNotificationCache.clear();
  learnerNotificationInflight.clear();
  adminNotificationCache.clear();
  adminNotificationInflight.clear();
};

const mapNotification = (record: any): Notification => ({
  id: record.id,
  title: record.title,
  body: record.body ?? undefined,
  type: record.type ?? 'announcement',
  organizationId: record.organizationId ?? record.organization_id ?? record.orgId ?? undefined,
  userId: record.userId ?? record.user_id ?? undefined,
  createdAt: record.createdAt ?? record.created_at ?? new Date().toISOString(),
  updatedAt: record.updatedAt ?? record.updated_at ?? null,
  readAt: record.readAt ?? record.read_at ?? null,
  read:
    typeof record.isRead === 'boolean'
      ? record.isRead
      : typeof record.is_read === 'boolean'
        ? record.is_read
        : record.read ?? Boolean(record.readAt ?? record.read_at),
  payload: record.payload ?? record.metadata ?? null,
  metadata: record.metadata ?? record.payload ?? null,
  messageId: record.messageId ?? record.message_id ?? null,
});

// helper removed: previously used to detect feature-flagged disabled notifications

export const listAdminNotificationsWithMeta = async (opts?: { organizationId?: string; userId?: string }) => {
  const params = new URLSearchParams();
  if (opts?.organizationId) params.set('org_id', opts.organizationId);
  if (opts?.userId) params.set('user_id', opts.userId);

  const path = `/api/admin/notifications${params.toString() ? `?${params.toString()}` : ''}`;
  const cacheKey = buildCacheKey('admin', params);
  const cached = adminNotificationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  const inflight = adminNotificationInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    try {
  const json = await apiFetch<any[]>('admin.list', path);
    if (devLogEnabled) {
      try {
        console.debug('[notifications.raw:admin.list]', { path, raw: json });
      } catch {
        // ignore logging failures
      }
    }
  const raw = (json as any)?.data ?? json;
    const srcArr = (Array.isArray(raw) ? raw : Array.isArray((raw as any)?.data) ? (raw as any).data : []) as any[];
    const items: Notification[] = (srcArr ?? []).map(mapNotification);

    const result = {
      notifications: items.sort((a: Notification, b: Notification) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      notificationsDisabled: false,
    };
    adminNotificationCache.set(cacheKey, {
      expiresAt: Date.now() + NOTIFICATION_CACHE_TTL_MS,
      result,
    });
    return result;
  } catch (error) {
    if (devLogEnabled) {
      try {
        console.warn('[notifications.error:admin.list] treating as disabled', { path, error });
      } catch {
        // ignore
      }
    }
    const fallback = handleSchemaMissing(error, 'admin.list', [] as Notification[]);
    const result = {
      notifications: fallback,
      notificationsDisabled: true,
    };
    adminNotificationCache.set(cacheKey, {
      expiresAt: Date.now() + NOTIFICATION_CACHE_TTL_MS,
      result,
    });
    return result;
  } finally {
    adminNotificationInflight.delete(cacheKey);
  }
  })();

  adminNotificationInflight.set(cacheKey, request);
  return request;
};

export const listNotifications = async (opts?: { organizationId?: string; userId?: string }) => {
  const { notifications } = await listAdminNotificationsWithMeta(opts);
  return notifications;
};

export const addNotification = async (notification: Omit<Notification, 'id' | 'createdAt'>) => {
  const json = await apiFetch<any>('admin.create', '/api/admin/notifications', {
    method: 'POST',
    body: {
      title: notification.title,
      body: notification.body,
      organization_id: notification.organizationId,
      userId: notification.userId,
      read: notification.read ?? false
    }
  });
  const raw = (json as any)?.data ?? json;
  invalidateNotificationCaches();
  return mapNotification(raw);
};

export const markNotificationRead = async (id: string, read = true) => {
  const json = await apiFetch<any>('admin.markRead', `/api/admin/notifications/${id}/read`, {
    method: 'POST',
    body: { read }
  });
  const raw = (json as any)?.data ?? json;

  if (!raw) {
    invalidateNotificationCaches();
    return mapNotification({
      id,
      title: 'Notification',
      created_at: new Date().toISOString(),
      read,
    });
  }

  invalidateNotificationCaches();
  return mapNotification(raw);
};

export const deleteNotification = async (id: string) => {
  await apiFetch<void>('admin.delete', `/api/admin/notifications/${id}`, {
    method: 'DELETE',
    expectedStatus: [200, 204],
    rawResponse: true
  });
  invalidateNotificationCaches();
};

export const clearNotifications = async (opts?: { organizationId?: string; userId?: string }) => {
  const existing = await listNotifications(opts);
  await Promise.all(existing.map((note: Notification) => deleteNotification(note.id)));
};

export const markLearnerNotificationsRead = async (ids: string[]) => {
  if (!ids || ids.length === 0) return [] as Notification[];
  return Promise.all(ids.map((id) =>
    markLearnerNotificationRead(id).catch(() => null),
  )).then((results) => results.filter(Boolean) as Notification[]);
};

const buildLearnerNotificationsPath = (opts?: { limit?: number; unreadOnly?: boolean }) => {
  const params = new URLSearchParams();
  if (opts?.limit && Number.isFinite(opts.limit)) {
    params.set('limit', String(opts.limit));
  }
  if (opts?.unreadOnly) {
    params.set('unread_only', 'true');
  }
  const qs = params.toString();
  return `/api/learner/notifications${qs ? `?${qs}` : ''}`;
};

export const listLearnerNotifications = async (opts?: { limit?: number; unreadOnly?: boolean }) => {
  const params = new URLSearchParams();
  if (opts?.limit && Number.isFinite(opts.limit)) {
    params.set('limit', String(opts.limit));
  }
  if (opts?.unreadOnly) {
    params.set('unread_only', 'true');
  }
  const cacheKey = buildCacheKey('learner', params);
  const cached = learnerNotificationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }
  const inflight = learnerNotificationInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }
  const path = buildLearnerNotificationsPath(opts);
  const request = (async () => {
    try {
      const json = await apiFetch<any[]>('learner.list', path);
      if (json && (json as any).notificationsDisabled) {
        learnerNotificationCache.set(cacheKey, {
          expiresAt: Date.now() + NOTIFICATION_CACHE_TTL_MS,
          items: [],
        });
        return [] as Notification[];
      }
      const raw = (json as any)?.data ?? json;
      const srcArr = (Array.isArray(raw) ? raw : Array.isArray((raw as any)?.data) ? (raw as any).data : []) as any[];
      const items = (srcArr ?? []).map(mapNotification);
      learnerNotificationCache.set(cacheKey, {
        expiresAt: Date.now() + NOTIFICATION_CACHE_TTL_MS,
        items,
      });
      return items;
    } catch (error) {
      const fallback = handleSchemaMissing(error, 'learner.list', [] as Notification[]);
      learnerNotificationCache.set(cacheKey, {
        expiresAt: Date.now() + NOTIFICATION_CACHE_TTL_MS,
        items: fallback,
      });
      return fallback;
    } finally {
      learnerNotificationInflight.delete(cacheKey);
    }
  })();

  learnerNotificationInflight.set(cacheKey, request);
  return request;
};

export const markLearnerNotificationRead = async (id: string) => {
  try {
    const json = await apiFetch<any>(
      'learner.markRead',
      `/api/learner/notifications/${id}/read`,
      {
        method: 'POST',
      },
    );
    if (json && (json as any).notificationsDisabled) {
      invalidateNotificationCaches();
      return mapNotification({ id, title: 'Notification', created_at: new Date().toISOString(), read: true });
    }
    const raw = (json as any)?.data ?? json;
    if (!raw) {
      invalidateNotificationCaches();
      return mapNotification({
        id,
        title: 'Notification',
        created_at: new Date().toISOString(),
        read: true,
      });
    }
    invalidateNotificationCaches();
    return mapNotification(raw);
  } catch (error) {
    return handleSchemaMissing(
      error,
      'learner.markRead',
      mapNotification({
        id,
        title: 'Notification',
        created_at: new Date().toISOString(),
        read: true,
      }),
    );
  }
};
export const deleteLearnerNotification = async (id: string) => {
  await apiFetch<void>('learner.delete', `/api/learner/notifications/${id}`, {
    method: 'DELETE',
    expectedStatus: [200, 204],
    rawResponse: true,
  });
  invalidateNotificationCaches();
};

export default {
  listNotifications,
  listAdminNotificationsWithMeta,
  addNotification,
  markNotificationRead,
  deleteNotification,
  clearNotifications,
  listLearnerNotifications,
  markLearnerNotificationRead,
  markLearnerNotificationsRead,
  deleteLearnerNotification,
};
