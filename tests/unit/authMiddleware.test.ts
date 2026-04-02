import { describe, it, expect, vi } from 'vitest';
import {
  isPlatformAdmin,
  isOrgAdministrator,
  requirePlatformAdmin,
  requireOrgAdmin,
  canManageOrganization,
  canAssignAcrossOrganizations,
} from '../../server/middleware/auth';

describe('Auth middleware helpers', () => {
  it('recognizes platform admin users', () => {
    expect(isPlatformAdmin({ platformRole: 'platform_admin' })).toBe(true);
    expect(isPlatformAdmin({ isPlatformAdmin: true })).toBe(true);
    expect(isPlatformAdmin({ role: 'admin', app_metadata: { platform_role: 'platform_admin' } })).toBe(true);
    expect(isPlatformAdmin({ role: 'learner' })).toBe(false);
  });

  it('recognizes org administrators by membership', () => {
    const user = {
      memberships: [
        { orgId: 'org-1', role: 'manager' },
        { orgId: 'org-2', role: 'member' },
      ],
    };
    expect(isOrgAdministrator(user, 'org-1')).toBe(true);
    expect(isOrgAdministrator(user, 'org-2')).toBe(false);
    expect(isOrgAdministrator(user)).toBe(true);
  });

  it('canManageOrganization with org admin or platform admin', () => {
    const platformUser = { isPlatformAdmin: true };
    expect(canManageOrganization(platformUser, 'org-1')).toBe(true);

    const orgAdminUser = { memberships: [{ orgId: 'org-1', role: 'admin' }] };
    expect(canManageOrganization(orgAdminUser, 'org-1')).toBe(true);
    expect(canManageOrganization(orgAdminUser, 'org-2')).toBe(false);
  });

  it('canAssignAcrossOrganizations enforces source and target org identity', () => {
    const platformUser = { isPlatformAdmin: true };
    expect(canAssignAcrossOrganizations(platformUser, 'org-1', 'org-2')).toBe(true);

    const orgAdmin = { memberships: [{ orgId: 'org-1', role: 'owner' }] };
    expect(canAssignAcrossOrganizations(orgAdmin, 'org-1', 'org-1')).toBe(true);
    expect(canAssignAcrossOrganizations(orgAdmin, 'org-1', 'org-2')).toBe(false);
  });

  it('requirePlatformAdmin calls next for platform admin', async () => {
    const req = { user: { isPlatformAdmin: true } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requirePlatformAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requirePlatformAdmin denies non-platform admin', async () => {
    const req = { user: { role: 'admin' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requirePlatformAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden', message: 'Platform admin access required' });
  });

  it('requireOrgAdmin allows org admin for target org', async () => {
    const req = { user: { memberships: [{ orgId: 'org-1', role: 'owner' }] }, params: { orgId: 'org-1' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requireOrgAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireOrgAdmin rejects lacking org admin role', async () => {
    const req = { user: { memberships: [{ orgId: 'org-1', role: 'member' }] }, params: { orgId: 'org-1' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requireOrgAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'org_admin_required', message: 'Organizational admin access required' });
  });
});
