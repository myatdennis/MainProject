import { describe, expect, it } from 'vitest';
import { normalizeSessionResponsePayload } from '../sessionBootstrap';

describe('sessionBootstrap', () => {
  it('normalizes top-level session payloads', () => {
    const payload = normalizeSessionResponsePayload({
      user: { id: 'user-1', email: 'admin@the-huddle.co', role: 'admin' },
      accessToken: 'access',
      refreshToken: 'refresh',
      memberships: [{ organization_id: 'org-1' }],
      membershipDegraded: true,
    });

    expect(payload).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user-1', role: 'admin', isPlatformAdmin: true }),
        accessToken: 'access',
        refreshToken: 'refresh',
        membershipStatus: 'degraded',
      }),
    );
  });
});

