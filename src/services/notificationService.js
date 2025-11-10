import apiRequest from '../utils/apiClient';
const apiFetch = async (path, options = {}) => apiRequest(path, options);
const mapNotification = (record) => ({
    id: record.id,
    title: record.title,
    body: record.body ?? undefined,
    orgId: record.orgId ?? record.org_id ?? undefined,
    userId: record.userId ?? record.user_id ?? undefined,
    createdAt: record.createdAt ?? record.created_at ?? new Date().toISOString(),
    read: record.read ?? false
});
export const listNotifications = async (opts) => {
    const params = new URLSearchParams();
    if (opts?.orgId)
        params.set('org_id', opts.orgId);
    if (opts?.userId)
        params.set('user_id', opts.userId);
    const path = `/api/admin/notifications${params.toString() ? `?${params.toString()}` : ''}`;
    const json = await apiFetch(path);
    const items = (json.data ?? []).map(mapNotification);
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};
export const addNotification = async (notification) => {
    const json = await apiFetch('/api/admin/notifications', {
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
export const markNotificationRead = async (id, read = true) => {
    const json = await apiFetch(`/api/admin/notifications/${id}/read`, {
        method: 'POST',
        body: JSON.stringify({ read })
    });
    return mapNotification(json.data);
};
export const deleteNotification = async (id) => {
    await apiFetch(`/api/admin/notifications/${id}`, {
        method: 'DELETE',
        expectedStatus: [200, 204],
        rawResponse: true
    });
};
export const clearNotifications = async (opts) => {
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
