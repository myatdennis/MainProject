import { beforeEach, describe, expect, it, vi } from 'vitest';
import inviteService from '../inviteService';

const apiClientMock = vi.fn();

vi.mock('../../utils/apiClient', () => ({
  default: (...args: any[]) => apiClientMock(...args),
}));

describe('inviteService', () => {
  beforeEach(() => {
    apiClientMock.mockReset();
  });

  it('accepts already-unwrapped invite previews', async () => {
    apiClientMock.mockResolvedValueOnce({
      id: 'invite-1',
      orgId: 'org-1',
      orgName: 'The Huddle',
      email: 'learner@example.com',
      role: 'member',
      status: 'pending',
      expiresAt: '2026-04-20T00:00:00.000Z',
      requiresAccount: true,
    });

    const invite = await inviteService.getInvite('invite-token');

    expect(invite).toMatchObject({
      id: 'invite-1',
      orgId: 'org-1',
      email: 'learner@example.com',
    });
  });

  it('accepts already-unwrapped invite acceptance payloads', async () => {
    apiClientMock.mockResolvedValueOnce({
      status: 'accepted',
      orgId: 'org-1',
      orgName: 'The Huddle',
      email: 'learner@example.com',
      loginUrl: '/login',
    });

    const response = await inviteService.acceptInvite('invite-token', { password: 'password123' });

    expect(response).toMatchObject({
      status: 'accepted',
      orgId: 'org-1',
      loginUrl: '/login',
    });
  });
});
