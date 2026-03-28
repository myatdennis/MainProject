import { describe, it, expect } from 'vitest';
import { isPlatformAdminActor, canInviteToOrg } from '../adminAuthz.js';

describe('adminAuthz', () => {
  it('identifies platform admin from actor flags', () => {
    expect(isPlatformAdminActor({ isPlatformAdmin: true })).toBe(true);
    expect(isPlatformAdminActor({ platformRole: 'platform_admin' })).toBe(true);
    expect(isPlatformAdminActor({ role: 'admin' })).toBe(true);
    expect(isPlatformAdminActor({ userRole: 'admin' })).toBe(true);
    expect(isPlatformAdminActor({ role: 'member' })).toBe(false);
  });

  it('allows invite when inviter is org member', async () => {
    const allowed = await canInviteToOrg({
      orgId: 'org-1',
      inviterId: 'user-1',
      actor: { role: 'member' },
      isUserActiveOrganizationMember: async () => true,
    });
    expect(allowed).toBe(true);
  });

  it('denies invite when inviter is not org member and not global admin', async () => {
    const allowed = await canInviteToOrg({
      orgId: 'org-1',
      inviterId: 'user-1',
      actor: { role: 'member' },
      isUserActiveOrganizationMember: async () => false,
    });
    expect(allowed).toBe(false);
  });

  it('allows invite when inviter is global admin', async () => {
    const allowed = await canInviteToOrg({
      orgId: 'org-1',
      inviterId: 'user-1',
      actor: { role: 'admin' },
      isUserActiveOrganizationMember: async () => false,
    });
    expect(allowed).toBe(true);
  });
});
