import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from './authMiddleware.js';
import {
  assertOrgAccess,
  type OrgMembershipPayload,
  type OrganizationRecord,
} from '../data/mockOrganizations.js';

const ORG_HEADER_KEYS = ['x-org-id', 'x-organization-id', 'x_org_id', 'x_organization_id'];

const normalizeOrgId = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
};

const readHeaderOrg = (req: Request): string | null => {
  for (const key of ORG_HEADER_KEYS) {
    const candidate = req.headers[key];
    if (typeof candidate === 'string') {
      const normalized = normalizeOrgId(candidate);
      if (normalized) {
        return normalized;
      }
    }
  }
  return null;
};

const readQueryOrg = (req: Request): string | null => {
  const query = (req.query ?? {}) as Record<string, unknown>;
  return normalizeOrgId(query.orgId || query.organizationId);
};

const readBodyOrg = (req: Request): string | null => {
  if (!req.body || typeof req.body !== 'object') {
    return null;
  }
  const body = req.body as Record<string, unknown>;
  return normalizeOrgId(body.orgId || body.organizationId);
};

export const resolveRequestedOrgId = (req: Request): string | null => {
  return readHeaderOrg(req) || readQueryOrg(req) || readBodyOrg(req);
};

export type OrgContext = {
  orgId: string;
  membership: OrgMembershipPayload;
  organization: OrganizationRecord;
};

export type OrgScopedRequest = AuthenticatedRequest & {
  orgContext?: OrgContext;
};

export const requireOrgContext = (req: OrgScopedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'not_authenticated', message: 'Sign in to access this resource.' });
  }
  const requestedOrgId = resolveRequestedOrgId(req);
  if (!requestedOrgId) {
    return res.status(400).json({
      error: 'org_required',
      message: 'Include X-Org-Id header or orgId query parameter for tenant-scoped endpoints.',
    });
  }
  const access = assertOrgAccess(userId, requestedOrgId);
  if (!access) {
    return res.status(403).json({
      error: 'org_access_denied',
      message: `You do not have access to organization ${requestedOrgId}.`,
    });
  }
  req.orgContext = {
    orgId: access.organization.id,
    organization: access.organization,
    membership: access.membership,
  };
  res.setHeader('X-Org-Resolved', access.organization.id);
  next();
};
