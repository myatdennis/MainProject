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

  const error = new Error(`Organization context is required for ${surface}.`);
  (error as Error & { code?: string }).code = 'org_id_required';
  throw error;
};

export const appendAdminOrgIdQuery = (path: string): string => {
  // No-op for compatibility: frontend should not append orgId query params.
  return path;
};
