import { describe, it, expect } from 'vitest';
import { mergeMembershipWithProfile, normalizeMembershipStatus, isMembershipActive, resolveMembershipStatusUpdate } from '../membershipUtils.js';

describe('membershipUtils', () => {
  it('prefers membership organization_id over stale profile organization_id', () => {
    const membership = {
      user_id: 'user-1',
      organization_id: 'org-current',
      role: 'admin',
      status: 'active',
    };
    const profile = {
      id: 'user-1',
      organization_id: 'org-old',
      active_organization_id: 'org-old',
      role: 'member',
      email: 'user@example.com',
    };

    const member = mergeMembershipWithProfile(membership, profile, 'status');
    expect(member.organization_id).toBe('org-current');
    expect(member.user.organization_id).toBe('org-current');
    expect(member.role).toBe('admin');
    expect(member.user.role).toBe('admin');
    expect(member.status).toBe('active');
    expect(member.user.is_active).toBe(true);
  });

  it('normalizes is_active status column to active/inactive', () => {
    const membership = { user_id: 'user-2', org_id: 'org-2', role: 'member', is_active: false };
    const member = mergeMembershipWithProfile(membership, { id: 'user-2', email: 'user2@example.com' }, 'is_active');

    expect(member.status).toBe('inactive');
    expect(member.is_active).toBe(false);
    expect(member.user.is_active).toBe(false);
  });

  it('normalizes status+is_active drift to always keep status authoritative', () => {
    const drifted = resolveMembershipStatusUpdate({ status: 'inactive', is_active: true });
    expect(drifted.status).toBe('inactive');
    expect(drifted.is_active).toBe(false);
    // Ensure endpoint-level health check logic sees this as inactive.
    expect(isMembershipActive(drifted, 'status')).toBe(false);
  });

  it('normalizeMembershipStatus returns unknown when status missing', () => {
    expect(normalizeMembershipStatus({}, 'status')).toBe('unknown');
  });

  it('isMembershipActive returns boolean based on membership row', () => {
    expect(isMembershipActive({ status: 'active' }, 'status')).toBe(true);
    expect(isMembershipActive({ status: 'inactive' }, 'status')).toBe(false);
    expect(isMembershipActive({ is_active: true }, 'is_active')).toBe(true);
    expect(isMembershipActive({ is_active: false }, 'is_active')).toBe(false);
  });
});
