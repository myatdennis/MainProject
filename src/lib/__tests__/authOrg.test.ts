import { describe, it, expect } from 'vitest';
import { resolvePreferredOrgId, type MembershipLike } from '../authOrg';

const buildMembership = (overrides: Partial<MembershipLike>): MembershipLike => ({
  orgId: 'org-default',
  status: 'active',
  acceptedAt: '2024-01-01T00:00:00Z',
  createdAt: '2023-01-01T00:00:00Z',
  ...overrides,
});

describe('resolvePreferredOrgId', () => {
  it('prefers requested org when membership matches', () => {
    const memberships = [
      buildMembership({ orgId: 'org-1', acceptedAt: '2024-01-05T00:00:00Z' }),
      buildMembership({ orgId: 'org-2', acceptedAt: '2025-01-01T00:00:00Z' }),
    ];

    const result = resolvePreferredOrgId({
      memberships,
      requestedOrgId: 'org-1',
      lastActiveOrgId: 'org-2',
    });

    expect(result.activeOrgId).toBe('org-1');
    expect(result.hasActiveMembership).toBe(true);
    expect(result.source).toBe('requested');
  });

  it('falls back to last active org when requested is invalid', () => {
    const memberships = [
      buildMembership({ orgId: 'org-5', acceptedAt: '2022-01-01T00:00:00Z' }),
      buildMembership({ orgId: 'org-6', acceptedAt: '2023-01-01T00:00:00Z' }),
    ];

    const result = resolvePreferredOrgId({
      memberships,
      requestedOrgId: 'org-missing',
      lastActiveOrgId: 'org-6',
    });

    expect(result.activeOrgId).toBe('org-6');
    expect(result.source).toBe('lastActive');
  });

  it('falls back to most recently accepted membership when no hints provided', () => {
    const memberships = [
      buildMembership({ orgId: 'legacy', acceptedAt: '2020-01-01T00:00:00Z' }),
      buildMembership({ orgId: 'newest', acceptedAt: '2026-02-02T00:00:00Z' }),
    ];

    const result = resolvePreferredOrgId({
      memberships,
      requestedOrgId: null,
      lastActiveOrgId: null,
    });

    expect(result.activeOrgId).toBe('newest');
    expect(result.source).toBe('membership');
  });

  it('falls back to accessible org list when no active memberships exist', () => {
    const memberships: MembershipLike[] = [
      buildMembership({ orgId: 'inactive-1', status: 'invited' }),
      buildMembership({ orgId: null }),
    ];

    const result = resolvePreferredOrgId({
      memberships,
      requestedOrgId: null,
      lastActiveOrgId: null,
      fallbackOrgIds: ['org-abc', 'org-def'],
    });

    expect(result.activeOrgId).toBe('org-abc');
    expect(result.source).toBe('membership');
    expect(result.hasActiveMembership).toBe(false);
  });

  it('treats ready/member statuses as active memberships', () => {
    const memberships: MembershipLike[] = [
      buildMembership({ orgId: 'org-ready', status: 'ready' }),
      buildMembership({ orgId: 'org-member', status: 'member' }),
    ];

    const result = resolvePreferredOrgId({
      memberships,
      requestedOrgId: null,
      lastActiveOrgId: null,
    });

    expect(result.activeOrgId).toBe('org-ready');
    expect(result.hasActiveMembership).toBe(true);
  });
});
