import express from 'express';
import { requireAdmin, type AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { findUserById, toPublicUser } from '../data/mockUsers.js';
import {
  listOrganizationsForUser,
  createOrganization,
  listUserMemberships,
  getActiveOrgForUser,
  listOrganizationMembers,
  upsertOrganization,
  assertOrgAccess,
} from '../data/mockOrganizations.js';
import { requireOrgContext, resolveRequestedOrgId, type OrgScopedRequest } from '../middleware/orgContext.js';

const router = express.Router();

router.get('/me', requireAdmin, (req: AuthenticatedRequest, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'not_authenticated' });
  }
  const internalUser = findUserById(userId);
  if (!internalUser) {
    return res.status(404).json({ error: 'user_not_found' });
  }

  const publicUser = toPublicUser(internalUser);
  const memberships = listUserMemberships(publicUser.id);
  const organizationIds = memberships.map((membership) => membership.orgId);
  const activeOrgId = getActiveOrgForUser(publicUser.id);

  res.json({
    user: {
      ...publicUser,
      activeOrgId,
      organizationIds,
      isPlatformAdmin: true,
      platformRole: 'platform_admin',
    },
    memberships,
    organizationIds,
    activeOrgId,
    access: {
      allowed: true,
      via: 'role',
      reason: null,
    },
  });
});

router.get('/organizations', requireAdmin, requireOrgContext, (req: OrgScopedRequest, res) => {
  const userId = req.user!.userId;
  const requestedOrgId = resolveRequestedOrgId(req) ?? req.orgContext?.orgId ?? null;
  const organizations = listOrganizationsForUser(userId, { orgId: requestedOrgId });
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || organizations.length || 1;

  res.json({
    data: organizations,
    pagination: {
      page,
      pageSize,
      total: organizations.length,
      hasMore: false,
    },
    progress: {},
  });
});

router.post('/organizations', requireAdmin, (req: AuthenticatedRequest, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    return res.status(400).json({ error: 'validation_failed', message: 'name is required' });
  }
  const slug = typeof req.body?.slug === 'string' ? req.body.slug : undefined;
  const status = typeof req.body?.status === 'string' ? (req.body.status as any) : 'active';
  const subscription = typeof req.body?.subscription === 'string' ? req.body.subscription : undefined;

  const result = createOrganization(
    {
      name,
      slug,
      status,
      subscription,
      timezone: typeof req.body?.timezone === 'string' ? req.body.timezone : undefined,
      features: typeof req.body?.features === 'object' ? req.body.features : undefined,
    },
    req.user?.userId,
  );

  res.status(201).json({ data: result.organization });
});

router.get('/organizations/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const userId = req.user?.userId;
  const orgId = req.params.id;
  if (!userId) {
    return res.status(401).json({ error: 'not_authenticated' });
  }
  const access = assertOrgAccess(userId, orgId);
  if (!access) {
    return res.status(403).json({ error: 'org_access_denied' });
  }
  res.json({ data: access.organization });
});

router.put('/organizations/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const orgId = req.params.id;
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'not_authenticated' });
  }
  const access = assertOrgAccess(userId, orgId);
  if (!access) {
    return res.status(403).json({ error: 'org_access_denied' });
  }
  const updated = upsertOrganization(orgId, req.body ?? {});
  if (!updated) {
    return res.status(404).json({ error: 'org_not_found' });
  }
  res.json({ data: updated });
});

router.delete('/organizations/:id', requireAdmin, (_req, res) => {
  return res.status(501).json({
    error: 'not_implemented',
    message: 'Organization deletion is disabled in this environment.',
  });
});

router.get('/organizations/:orgId/members', requireAdmin, (req: AuthenticatedRequest, res) => {
  const userId = req.user?.userId;
  const { orgId } = req.params;
  if (!userId) {
    return res.status(401).json({ error: 'not_authenticated' });
  }
  const access = assertOrgAccess(userId, orgId);
  if (!access) {
    return res.status(403).json({ error: 'org_access_denied' });
  }
  const members = listOrganizationMembers(access.organization.id);
  res.json({ data: members });
});

router.post('/organizations/:orgId/members', requireAdmin, (_req, res) => {
  res.status(501).json({
    error: 'not_implemented',
    message: 'Member invitations are not available in this environment.',
  });
});

router.patch('/organizations/:orgId/members/:memberId', requireAdmin, (_req, res) => {
  res.status(501).json({
    error: 'not_implemented',
    message: 'Membership updates are not available in this environment.',
  });
});

router.delete('/organizations/:orgId/members/:memberId', requireAdmin, (_req, res) => {
  res.status(501).json({
    error: 'not_implemented',
    message: 'Membership removal is not available in this environment.',
  });
});

export default router;
