import { describe, expect, it } from 'vitest';
import { buildUserSessionFromPayload, resolveSessionStatePayload } from '../sessionState';
import type { SessionResponsePayload } from '../sessionBootstrap';

describe('sessionState', () => {
  it('preserves cached memberships when payload is degraded', () => {
    const payload: SessionResponsePayload = {
      user: { id: 'user-1', email: 'learner@the-huddle.co' },
      memberships: [],
      membershipStatus: 'degraded',
      membershipDegraded: true,
      organizationIds: [],
    };

    const resolved = resolveSessionStatePayload({
      payload,
      membershipCache: [
        {
          orgId: 'org-cached',
          organizationId: 'org-cached',
          role: 'learner',
          status: 'active',
        },
      ],
      organizationIdsSnapshot: ['org-cached'],
    });

    expect(resolved.membershipState).toBe('degraded');
    expect(resolved.resolvedMemberships).toHaveLength(1);
    expect(resolved.organizationIds).toEqual(['org-cached']);
  });

  it('resolves requested org selection deterministically', () => {
    const payload: SessionResponsePayload = {
      user: { id: 'user-1', email: 'multi@the-huddle.co' },
      memberships: [
        { organization_id: 'org-1', role: 'learner', status: 'active' },
        { organization_id: 'org-2', role: 'admin', status: 'active' },
      ],
      membershipStatus: 'ready',
      organizationIds: ['org-1', 'org-2'],
    };

    const resolved = resolveSessionStatePayload({
      payload,
      requestedOrgId: 'org-2',
      lastActiveOrgId: 'org-1',
    });

    const session = buildUserSessionFromPayload({
      payload,
      organizationIds: resolved.organizationIds,
      memberships: resolved.resolvedMemberships,
      activeOrgId: resolved.activeOrgId,
      activeOrgSource: resolved.activeOrgSource,
    });

    expect(resolved.activeOrgId).toBe('org-2');
    expect(resolved.activeOrgSource).toBe('requested_hint');
    expect(session.activeOrgId).toBe('org-2');
    expect(session.organizationId).toBe('org-2');
  });
});
