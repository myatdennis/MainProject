import { describe, it, expect } from 'vitest';
import { isPlatformAdminActor, canInviteToOrg, canModifyUser, canAssignAcrossOrganizations } from '../adminAuthz.js';

describe('adminAuthz', () => {
  it('identifies platform admin from actor flags', () => {
    expect(isPlatformAdminActor({ isPlatformAdmin: true })).toBe(true);
    expect(isPlatformAdminActor({ platformRole: 'platform_admin' })).toBe(true);
    expect(isPlatformAdminActor({ role: 'admin' })).toBe(false);
    expect(isPlatformAdminActor({ userRole: 'admin' })).toBe(false);
    expect(isPlatformAdminActor({ role: 'member' })).toBe(false);
  });

  it('allows invite when inviter is global platform admin', async () => {
    const allowed = await canInviteToOrg({
      orgId: 'org-1',
      inviterId: 'user-1',
      actor: { platformRole: 'platform_admin' },
      isUserActiveOrganizationMember: async () => false,
    });
    expect(allowed).toBe(true);
  });

  it('denies invite when inviter is org admin but not global platform admin', async () => {
    const allowed = await canInviteToOrg({
      orgId: 'org-1',
      inviterId: 'user-1',
      actor: { role: 'admin' },
      isUserActiveOrganizationMember: async () => false,
    });
    expect(allowed).toBe(false);
  });

  it('allows invite when inviter is org member with membership', async () => {
    const allowed = await canInviteToOrg({
      orgId: 'org-1',
      inviterId: 'user-1',
      actor: { role: 'member' },
      isUserActiveOrganizationMember: async () => true,
    });
    expect(allowed).toBe(true);
  });

  it('allows update for org admin on same org targets', () => {
    const actor = {
      memberships: [{ orgId: 'org-1', role: 'admin' }],
    };
    const targetUser = { organization_id: 'org-1' };
    expect(canModifyUser(actor, targetUser)).toBe(true);
  });

  it('denies update for org admin on different org targets', () => {
    const actor = {
      memberships: [{ orgId: 'org-1', role: 'admin' }],
    };
    const targetUser = { organization_id: 'org-2' };
    expect(canModifyUser(actor, targetUser)).toBe(false);
  });

  it('allows assign across orgs for platform admin', () => {
    const actor = { platformRole: 'platform_admin' };
    expect(canAssignAcrossOrganizations(actor, 'org-1', 'org-2')).toBe(true);
  });

  it('denies assign across different orgs for org admin', () => {
    const actor = { memberships: [{ orgId: 'org-1', role: 'admin' }] };
    expect(canAssignAcrossOrganizations(actor, 'org-1', 'org-2')).toBe(false);
  });
});
