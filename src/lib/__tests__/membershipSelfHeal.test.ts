import { describe, it, expect, beforeEach } from 'vitest';
import { createMembershipSelfHealTracker } from '../membershipSelfHeal';

describe('MembershipSelfHealTracker', () => {
  let tracker: ReturnType<typeof createMembershipSelfHealTracker>;

  beforeEach(() => {
    tracker = createMembershipSelfHealTracker();
  });

  it('prevents duplicate attempts for the same user/org', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
    const orgId = 'org-abc';

    expect(tracker.shouldAttempt(userId, orgId)).toBe(true);
    expect(tracker.shouldAttempt(userId, orgId)).toBe(false);
  });

  it('allows attempts for different orgs or users', () => {
    expect(tracker.shouldAttempt('user-1', 'org-1')).toBe(true);
    expect(tracker.shouldAttempt('user-1', 'org-2')).toBe(true);
    expect(tracker.shouldAttempt('user-2', 'org-1')).toBe(true);
  });
});
