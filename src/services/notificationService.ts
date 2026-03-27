import apiRequest, { ApiError } from '../utils/apiClient';

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

const logNotificationFetch = (label: string, path: string) => {
  if (!devLogEnabled) return;
  console.debug(`[notifications.fetch:${label}]`, path);
};

const isSchemaMissingError = (error: unknown) => {
  if (!(error instanceof ApiError)) return false;
  const body = (error.body ?? {}) as Record<string, any>;
  const code = typeof body.code === 'string' ? body.code : null;
  return code === 'PGRST205';
};

const handleSchemaMissing = <T>(error: unknown, label: string, fallback: T) => {
  if (isSchemaMissingError(error)) {
    const apiError = error as ApiError;
    const body = (apiError.body ?? {}) as Record<string, any>;
    console.warn(`[notifications.disabled:${label}] treating notifications as disabled`, {
      status: apiError.status,
      code: body.code ?? null,
    });
    return fallback;
  }
  throw error;
};

const apiFetch = async <T>(label: string, path: string, options: any = {}) => {
  logNotificationFetch(label, path);
  return apiRequest<T>(path, options);
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

type AdminNotificationResponse = {
  ok?: boolean;
  data?: any[];
  notificationsDisabled?: boolean;
};

export const listAdminNotificationsWithMeta = async (opts?: { organizationId?: string; userId?: string }) => {
  const params = new URLSearchParams();
  if (opts?.organizationId) params.set('org_id', opts.organizationId);
  if (opts?.userId) params.set('user_id', opts.userId);

  const path = `/api/admin/notifications${params.toString() ? `?${params.toString()}` : ''}`;

  try {
    const json = await apiFetch<AdminNotificationResponse>('admin.list', path);
    if (devLogEnabled) {
      try {
        console.debug('[notifications.raw:admin.list]', { path, raw: json });
      } catch {
        // ignore logging failures
      }
    }
    const items = (json?.data ?? []).map(mapNotification);

    return {
      notifications: items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      notificationsDisabled: Boolean(json?.notificationsDisabled),
    };
  } catch (error) {
    if (devLogEnabled) {
      try {
        console.warn('[notifications.error:admin.list] treating as disabled', { path, error });
      } catch {
        // ignore
      }
    }
    const fallback = handleSchemaMissing(error, 'admin.list', [] as Notification[]);
    return {
      notifications: fallback,
      notificationsDisabled: true,
    };
  }
};

export const listNotifications = async (opts?: { organizationId?: string; userId?: string }) => {
  const { notifications } = await listAdminNotificationsWithMeta(opts);
  return notifications;
};

export const addNotification = async (notification: Omit<Notification, 'id' | 'createdAt'>) => {
  const json = await apiFetch<{ data: any }>('admin.create', '/api/admin/notifications', {
    method: 'POST',
    body: {
      title: notification.title,
      body: notification.body,
      organization_id: notification.organizationId,
      userId: notification.userId,
      read: notification.read ?? false
    }
  });

  return mapNotification(json.data);
};

export const markNotificationRead = async (id: string, read = true) => {
  const json = await apiFetch<{ data: any }>('admin.markRead', `/api/admin/notifications/${id}/read`, {
    method: 'POST',
    body: { read }
  });

  return mapNotification(json.data);
};

export const deleteNotification = async (id: string) => {
  await apiFetch<void>('admin.delete', `/api/admin/notifications/${id}`, {
    method: 'DELETE',
    expectedStatus: [200, 204],
    rawResponse: true
  });
};

export const clearNotifications = async (opts?: { organizationId?: string; userId?: string }) => {
  const existing = await listNotifications(opts);
  await Promise.all(existing.map(note => deleteNotification(note.id)));
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
  const path = buildLearnerNotificationsPath(opts);
  try {
    const json = await apiFetch<{ data: any[] }>('learner.list', path);
    return (json.data ?? []).map(mapNotification);
  } catch (error) {
    return handleSchemaMissing(error, 'learner.list', [] as Notification[]);
  }
};

export const markLearnerNotificationRead = async (id: string) => {
  try {
    const json = await apiFetch<{ data: any }>(
      'learner.markRead',
      `/api/learner/notifications/${id}/read`,
      {
        method: 'POST',
      },
    );
    return mapNotification(json.data);
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

export const markLearnerNotificationsRead = async (ids: string[]) => {
  if (!ids?.length) return [] as Notification[];
  return Promise.all(ids.map((id) => markLearnerNotificationRead(id).catch(() => null))).then((results) =>
    results.filter(Boolean) as Notification[]
  );
};

export const deleteLearnerNotification = async (id: string) => {
  await apiFetch<void>('learner.delete', `/api/learner/notifications/${id}`, {
    method: 'DELETE',
    expectedStatus: [200, 204],
    rawResponse: true,
  });
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
