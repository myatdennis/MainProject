import { afterEach, describe, expect, it, vi } from 'vitest';

describe('notificationService request dedupe', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('collapses concurrent learner notification reads into one API request', async () => {
    const apiRequestMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'note-1',
          title: 'New assignment',
          type: 'announcement',
          created_at: '2026-04-17T00:00:00.000Z',
        },
      ],
    });

    vi.doMock('../../utils/apiClient', () => ({
      __esModule: true,
      default: apiRequestMock,
    }));
    vi.doMock('../../lib/secureStorage', () => ({
      getUserSession: () => ({ id: 'user-1', email: 'user@example.com' }),
    }));

    const { listLearnerNotifications } = await import('../notificationService');

    const [first, second] = await Promise.all([
      listLearnerNotifications(),
      listLearnerNotifications(),
    ]);

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first[0]?.id).toBe('note-1');
  });
});
