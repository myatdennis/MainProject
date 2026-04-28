export const resolveExplicitAdminOrgId = (preferredOrgId?: string | null): string | null => {
  // Frontend should not infer org context. Only return the explicit preferredOrgId if provided.
  const explicit = typeof preferredOrgId === 'string' ? preferredOrgId.trim() : '';
  return explicit || null;
};

export const requireExplicitAdminOrgId = (surface: string, preferredOrgId?: string | null): string => {
  const orgId = resolveExplicitAdminOrgId(preferredOrgId);
  if (orgId) {
    return orgId;
  }

  // If running in a browser, allow a global override for platform admins so
  // that admin UIs do not require an explicit org selection. SecureAuthContext
  // will set `window.__IS_PLATFORM_ADMIN__ = true` when appropriate.
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const globalFlag = typeof window !== 'undefined' ? (window.__IS_PLATFORM_ADMIN__ as boolean) : false;
    if (globalFlag) return null as any;
  } catch (e) {
    // ignore
  }

  const error = new Error(`Organization context is required for ${surface}.`);
  (error as Error & { code?: string }).code = 'org_id_required';
  throw error;
};

export const appendAdminOrgIdQuery = (path: string): string => {
  // No-op for compatibility: frontend should not append orgId query params.
  return path;
};
