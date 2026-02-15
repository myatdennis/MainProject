import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../utils/requestContext', () => ({
  __esModule: true,
  default: vi.fn().mockResolvedValue({
    'X-User-Id': 'test-user',
    'X-User-Role': 'member'
  })
}));
vi.mock('../../utils/apiClient', () => ({
  __esModule: true,
  default: vi.fn()
}));
import {
  listNotifications,
  addNotification,
  markNotificationRead,
  clearNotifications
} from '../notificationService';
import apiRequest from '../../utils/apiClient';

describe('notificationService', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    vi.clearAllMocks();
  });

  it('loads notifications with query filters applied', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: [
        { id: 'note-1', title: 'Update', organization_id: 'org-1', created_at: '2025-01-01T00:00:00.000Z' }
      ]
    });

    const notes = await listNotifications({ organizationId: 'org-1' });

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/notifications?org_id=org-1', {});
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ id: 'note-1', organizationId: 'org-1' });
  });

  it('creates notifications via POST', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: { id: 'note-2', title: 'Reminder', created_at: '2025-01-02T00:00:00.000Z' }
    });

    const created = await addNotification({ title: 'Reminder', body: 'Check progress', read: false });

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/notifications', {
      method: 'POST',
      body: {
        title: 'Reminder',
        body: 'Check progress',
        organization_id: undefined,
        userId: undefined,
        read: false
      }
    });
    expect(created).toMatchObject({ id: 'note-2', title: 'Reminder' });
  });

  it('marks notifications as read', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { id: 'note-3', title: 'Alert', read: true } });

    const updated = await markNotificationRead('note-3', true);

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/notifications/note-3/read', {
      method: 'POST',
      body: { read: true }
    });
    expect(updated).toMatchObject({ id: 'note-3', read: true });
  });

  it('clears notifications by deleting each record', async () => {
    vi
      .mocked(apiRequest)
      .mockResolvedValueOnce({ data: [{ id: 'note-4', title: 'Reminder', created_at: '2025-01-04T08:00:00.000Z' }] })
      .mockResolvedValueOnce(undefined);

    await clearNotifications();

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/admin/notifications', {});
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/admin/notifications/note-4', {
      method: 'DELETE',
      expectedStatus: [200, 204],
      rawResponse: true
    });
  });
});
