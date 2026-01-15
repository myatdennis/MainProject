import apiRequest, { type ApiRequestOptions } from '../utils/apiClient';

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
  messageId?: string | null;
};

const apiFetch = async <T>(path: string, options: ApiRequestOptions = {}) =>
  apiRequest<T>(path, options);

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
  payload: record.payload ?? null,
  messageId: record.messageId ?? record.message_id ?? null,
});

export const listNotifications = async (opts?: { organizationId?: string; userId?: string }) => {
  const params = new URLSearchParams();
  if (opts?.organizationId) params.set('org_id', opts.organizationId);
  if (opts?.userId) params.set('user_id', opts.userId);

  const path = `/api/admin/notifications${params.toString() ? `?${params.toString()}` : ''}`;

  const json = await apiFetch<{ data: any[] }>(path);
  const items = (json.data ?? []).map(mapNotification);

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const addNotification = async (notification: Omit<Notification, 'id' | 'createdAt'>) => {
  const json = await apiFetch<{ data: any }>('/api/admin/notifications', {
    method: 'POST',
    body: JSON.stringify({
      title: notification.title,
      body: notification.body,
      organization_id: notification.organizationId,
      userId: notification.userId,
      read: notification.read ?? false
    })
  });

  return mapNotification(json.data);
};

export const markNotificationRead = async (id: string, read = true) => {
  const json = await apiFetch<{ data: any }>(`/api/admin/notifications/${id}/read`, {
    method: 'POST',
    body: JSON.stringify({ read })
  });

  return mapNotification(json.data);
};

export const deleteNotification = async (id: string) => {
  await apiFetch<void>(`/api/admin/notifications/${id}`, {
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
  const json = await apiFetch<{ data: any[] }>(buildLearnerNotificationsPath(opts));
  return (json.data ?? []).map(mapNotification);
};

export const markLearnerNotificationRead = async (id: string) => {
  const json = await apiFetch<{ data: any }>(`/api/learner/notifications/${id}/read`, {
    method: 'POST',
  });
  return mapNotification(json.data);
};

export const markLearnerNotificationsRead = async (ids: string[]) => {
  if (!ids?.length) return [] as Notification[];
  return Promise.all(ids.map((id) => markLearnerNotificationRead(id).catch(() => null))).then((results) =>
    results.filter(Boolean) as Notification[]
  );
};

export default {
  listNotifications,
  addNotification,
  markNotificationRead,
  deleteNotification,
  clearNotifications,
  listLearnerNotifications,
  markLearnerNotificationRead,
  markLearnerNotificationsRead
};
