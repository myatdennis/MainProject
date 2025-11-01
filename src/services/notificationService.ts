import apiRequest, { type ApiRequestOptions } from '../utils/apiClient';

export type Notification = {
  id: string;
  title: string;
  body?: string;
  orgId?: string;
  userId?: string;
  createdAt: string;
  read?: boolean;
};

const apiFetch = async <T>(path: string, options: ApiRequestOptions = {}) =>
  apiRequest<T>(path, options);

const mapNotification = (record: any): Notification => ({
  id: record.id,
  title: record.title,
  body: record.body ?? undefined,
  orgId: record.orgId ?? record.org_id ?? undefined,
  userId: record.userId ?? record.user_id ?? undefined,
  createdAt: record.createdAt ?? record.created_at ?? new Date().toISOString(),
  read: record.read ?? false
});

export const listNotifications = async (opts?: { orgId?: string; userId?: string }) => {
  const params = new URLSearchParams();
  if (opts?.orgId) params.set('org_id', opts.orgId);
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
      orgId: notification.orgId,
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

export const clearNotifications = async (opts?: { orgId?: string; userId?: string }) => {
  const existing = await listNotifications(opts);
  await Promise.all(existing.map(note => deleteNotification(note.id)));
};

export default {
  listNotifications,
  addNotification,
  markNotificationRead,
  deleteNotification,
  clearNotifications
};
