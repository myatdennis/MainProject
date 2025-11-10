import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('../../utils/requestContext', () => ({
    __esModule: true,
    default: vi.fn().mockResolvedValue({
        'X-User-Id': 'test-user',
        'X-User-Role': 'member'
    })
}));
import { listNotifications, addNotification, markNotificationRead, clearNotifications } from '../notificationService';
const originalFetch = global.fetch;
describe('notificationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        global.fetch = originalFetch;
    });
    it('loads notifications with query filters applied', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
                data: [
                    { id: 'note-1', title: 'Update', org_id: 'org-1', created_at: '2025-01-01T00:00:00.000Z' }
                ]
            })
        });
        global.fetch = fetchMock;
        const notes = await listNotifications({ orgId: 'org-1' });
        const [requestUrl, requestInit] = fetchMock.mock.calls[0];
        expect(requestUrl).toContain('/api/admin/notifications?org_id=org-1');
        const headers = requestInit.headers;
        expect(headers.get('X-User-Id')).toBe('test-user');
        expect(headers.get('X-User-Role')).toBe('member');
        expect(notes).toHaveLength(1);
        expect(notes[0]).toMatchObject({ id: 'note-1', orgId: 'org-1' });
    });
    it('creates notifications via POST', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 201,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
                data: { id: 'note-2', title: 'Reminder', created_at: '2025-01-02T00:00:00.000Z' }
            })
        });
        global.fetch = fetchMock;
        const created = await addNotification({ title: 'Reminder', body: 'Check progress', read: false });
        const [requestUrl, requestInit] = fetchMock.mock.calls[0];
        expect(requestUrl).toContain('/api/admin/notifications');
        expect(requestInit.method).toBe('POST');
        expect(requestInit.body).toBe(JSON.stringify({ title: 'Reminder', body: 'Check progress', orgId: undefined, userId: undefined, read: false }));
        const headers = requestInit.headers;
        expect(headers.get('X-User-Id')).toBe('test-user');
        expect(headers.get('X-User-Role')).toBe('member');
        expect(created).toMatchObject({ id: 'note-2', title: 'Reminder' });
    });
    it('marks notifications as read', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ data: { id: 'note-3', title: 'Alert', read: true } })
        });
        global.fetch = fetchMock;
        const updated = await markNotificationRead('note-3', true);
        const [requestUrl, requestInit] = fetchMock.mock.calls[0];
        expect(requestUrl).toContain('/api/admin/notifications/note-3/read');
        expect(requestInit.method).toBe('POST');
        expect(requestInit.body).toBe(JSON.stringify({ read: true }));
        const headers = requestInit.headers;
        expect(headers.get('X-User-Id')).toBe('test-user');
        expect(headers.get('X-User-Role')).toBe('member');
        expect(updated).toMatchObject({ id: 'note-3', read: true });
    });
    it('clears notifications by deleting each record', async () => {
        const fetchMock = vi
            .fn()
            // listNotifications
            .mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ data: [{ id: 'note-4', title: 'Reminder', created_at: '2025-01-04T08:00:00.000Z' }] })
        })
            // deleteNotification
            .mockResolvedValueOnce({
            ok: true,
            status: 204,
            headers: new Headers()
        });
        global.fetch = fetchMock;
        await clearNotifications();
        const [listUrl, listInit] = fetchMock.mock.calls[0];
        expect(listUrl).toContain('/api/admin/notifications');
        const listHeaders = listInit.headers;
        expect(listHeaders.get('X-User-Id')).toBe('test-user');
        expect(listHeaders.get('X-User-Role')).toBe('member');
        const [deleteUrl, deleteInit] = fetchMock.mock.calls[1];
        expect(deleteUrl).toContain('/api/admin/notifications/note-4');
        expect(deleteInit.method).toBe('DELETE');
        const deleteHeaders = deleteInit.headers;
        expect(deleteHeaders.get('X-User-Id')).toBe('test-user');
        expect(deleteHeaders.get('X-User-Role')).toBe('member');
    });
});
