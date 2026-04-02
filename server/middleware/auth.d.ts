import type { Request, Response, NextFunction } from 'express';

type UserMembership = {
  orgId?: string;
  organizationId?: string;
  organization_id?: string;
  role?: string;
};

type UserContext = {
  id?: string;
  userId?: string;
  email?: string;
  role?: string;
  platformRole?: string;
  isPlatformAdmin?: boolean;
  memberships?: UserMembership[];
  permissions?: string[];
};

export const PRIMARY_ADMIN_EMAIL: string;
export function normalizeEmail(value?: string): string;
export function isCanonicalAdminEmail(email?: string): boolean;
export function isAllowlistedAdminEmail(email?: string): boolean;
export function resolveUserRole(user?: UserContext, memberships?: UserMembership[]): string;
export function isPlatformAdmin(user?: UserContext): boolean;
export function isOrgAdministrator(user?: UserContext, orgId?: string | null): boolean;
export function hasOrgAdminRole(role?: string | null): boolean;
export function canManageOrganization(actor?: UserContext, targetOrgId?: string | null): boolean;
export function canManageUser(actor?: UserContext, targetUser?: UserContext): boolean;
export function canAssignAcrossOrganizations(actor?: UserContext, targetOrgId?: string | null, courseOrgId?: string | null): boolean;
export function getRequestedOrgId(req: Request): string | null;
export function syncUserProfileFlags(user: UserContext): Promise<void>;

export function authenticate(req: Request, res: Response, next: NextFunction): Promise<void>;
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void>;
export function resolveOrganizationContext(req: Request, res: Response, next: NextFunction): void;
export function requireRole(...allowedRoles: string[]): void;
export function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void>;
export function requirePermission(...permissions: string[]): void;
export function requireAuth(req: Request, res: Response, next: NextFunction): void;
export function requireOwnerOrAdmin(getUserId: (req: Request) => string): void;
export function requireSameOrganizationOrAdmin(getOrganizationId: (req: Request) => string): void;
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): Promise<void>;
export function requireOrgAdmin(req: Request, res: Response, next: NextFunction): Promise<void>;

export const authLimiter: any;
