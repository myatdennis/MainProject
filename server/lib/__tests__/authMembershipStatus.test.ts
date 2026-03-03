import { describe, it, expect } from 'vitest';
import { __testables } from '../../middleware/auth.js';

const { buildUserPayload } = __testables;

describe('auth membership status handling', () => {
  const adminUser = {
    id: 'user-admin',
    email: 'mya@the-huddle.co',
    app_metadata: {},
    user_metadata: {},
  };

  it('preserves admin role when membership lookup errored', () => {
    const payload = buildUserPayload(adminUser, [], { membershipStatus: 'error' });
    expect(payload.role).toBe('admin');
  });

  it('downgrades to learner when memberships missing without errors', () => {
    const payload = buildUserPayload(adminUser, [], { membershipStatus: 'ready' });
    expect(payload.role).toBe('learner');
  });
});
