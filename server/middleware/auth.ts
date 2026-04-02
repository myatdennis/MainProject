// MOVED: server/middleware/auth.ts archived to server/ts-archive/middleware/auth.ts
// This file is intentionally a placeholder in /server to avoid compilation errors while runtime uses auth.js

export declare function isPlatformAdmin(user?: any): boolean;
export declare function isOrgAdministrator(user?: any, orgId?: string | null): boolean;
export declare function hasOrgAdminRole(role?: string | null): boolean;
export declare function canManageOrganization(actor?: any, targetOrgId?: string | null): boolean;
export declare function canManageUser(actor?: any, targetUser?: any): boolean;
export declare function canAssignAcrossOrganizations(actor?: any, targetOrgId?: string | null, courseOrgId?: string | null): boolean;
export declare function getRequestedOrgId(req: any): string | null;
export declare function syncUserProfileFlags(user?: any): Promise<void>;
export declare function requireAdmin(req: any, res: any, next: any): Promise<void>;
export declare function requirePlatformAdmin(req: any, res: any, next: any): Promise<void>;
export declare function requireOrgAdmin(req: any, res: any, next: any): Promise<void>;
export declare function requireAuth(req: any, res: any, next: any): void;
export declare function requirePermission(...permissions: string[]): void;
export declare function requireRole(...allowedRoles: string[]): void;
export declare function requireOwnerOrAdmin(getUserId: (req: any) => string): void;
export declare function requireSameOrganizationOrAdmin(getOrganizationId: (req: any) => string): void;
export declare function authenticate(req: any, res: any, next: any): Promise<void>;
export declare function optionalAuthenticate(req: any, res: any, next: any): Promise<void>;
export declare function resolveOrganizationContext(req: any, res: any, next: any): void;
export declare const __testables: {
  buildUserPayload: any;
  deriveMembershipStatusLabel: any;
};
