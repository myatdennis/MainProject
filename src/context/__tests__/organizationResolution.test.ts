import { describe, expect, it } from 'vitest';
import { dedupeStrings, deriveOrgContextSnapshot, normalizeMembershipStatusFlag, normalizeMemberships } from '../organizationResolution';

describe('organizationResolution', () => {
  it('dedupes non-empty strings', () => {
    expect(dedupeStrings(['org-1', 'org-1', ' ', null, 'org-2'])).toEqual(['org-1', 'org-2']);
  });

  it('normalizes memberships', () => {
    expect(normalizeMemberships([{ organization_id: 'org-1', role: 'admin' }])).toEqual([
      expect.objectContaining({ orgId: 'org-1', organizationId: 'org-1', role: 'admin' }),
    ]);
  });

  it('normalizes degraded membership state', () => {
    expect(normalizeMembershipStatusFlag('ready', true)).toBe('degraded');
  });

  it('derives a ready org snapshot when session and membership are ready', () => {
    expect(
      deriveOrgContextSnapshot({
        membershipStatus: 'ready',
        sessionStatus: 'authenticated',
        activeOrgId: 'org-1',
        lastActiveOrgId: null,
        user: { id: 'user-1', role: 'admin', organizationId: 'org-1' } as any,
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'ready',
        activeOrgId: 'org-1',
        orgId: 'org-1',
        userId: 'user-1',
      }),
    );
  });
});

