import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listUsersByOrg } from '../adminUsers';

const apiClientMock = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  default: (...args: any[]) => apiClientMock(...args),
}));

describe('adminUsers DAL', () => {
  beforeEach(() => {
    apiClientMock.mockReset();
  });

  it('accepts already-unwrapped user lists', async () => {
    apiClientMock.mockResolvedValueOnce([
      {
        id: 'membership-1',
        user_id: 'user-1',
        organization_id: 'org-1',
        email: 'user@example.com',
        name: 'Ada Lovelace',
        role: 'member',
      },
    ]);

    const users = await listUsersByOrg('org-1');

    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      membershipId: 'membership-1',
      userId: 'user-1',
      orgId: 'org-1',
      email: 'user@example.com',
    });
  });
});
