import { describe, it, expect } from 'vitest';
import { __testables } from '../../middleware/auth.js';

const { buildUserPayload } = __testables;

describe('auth membership status handling', () => {
  const allowlistedAdminUser = {
    id: 'user-admin',
    email: 'mya@the-huddle.co',
    app_metadata: {},
    user_metadata: {},
  };

  const regularUser = {
    id: 'user-learner',
    email: 'not-allowlisted@example.com',
    app_metadata: {},
    user_metadata: {},
  };

  it('preserves admin role when membership lookup errored', () => {
    const payload = buildUserPayload(allowlistedAdminUser, [], { membershipStatus: 'error' });
    expect(payload.role).toBe('admin');
  });

  it('downgrades to learner when memberships missing without errors', () => {
    const payload = buildUserPayload(regularUser, [], { membershipStatus: 'ready' });
    expect(payload.role).toBe('learner');
  });
});
