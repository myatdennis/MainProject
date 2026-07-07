export const resolveExplicitAdminOrgId = (preferredOrgId?: string | null): string | null => {
  // Frontend should not infer org context. Only return the explicit preferredOrgId if provided.
  const explicit = typeof preferredOrgId === 'string' ? preferredOrgId.trim() : '';
  return explicit || null;
};

export const requireExplicitAdminOrgId = (
  surface: string,
  preferredOrgId?: string | null,
  isPlatformAdminOverride?: boolean,
): string => {
  const orgId = resolveExplicitAdminOrgId(preferredOrgId);
  if (orgId) {
    return orgId;
  }

  // Prefer an explicit flag from the caller (freshly computed from its own
  // auth-context read) when provided — see callers for why the window
  // bridge below can lag behind a confirmed platform admin's real status.
  if (isPlatformAdminOverride) return null as any;

  // If running in a browser, allow a global override for platform admins so
  // that admin UIs do not require an explicit org selection. SecureAuthContext
  // will set `window.__IS_PLATFORM_ADMIN__ = true` when appropriate. This is a
  // pragmatic bridge for callers that don't pass isPlatformAdminOverride; it
  // has been observed to race/lag right after login, reporting false for a
  // confirmed platform admin — prefer passing isPlatformAdminOverride instead.
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const globalFlag = typeof window !== 'undefined' ? (window.__IS_PLATFORM_ADMIN__ as boolean) : false;
    if (globalFlag) return null as any;
  } catch (e) {
    // ignore
  }

  // Diagnostic: this error fires whenever neither an explicit orgId nor the
  // platform-admin bridge flag is set. Log the flag's actual value so a
  // false-negative here (flag not yet set, or never set for this session)
  // is distinguishable from a genuine non-admin caller in browser reports.
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    console.warn('[adminOrgScope] org_id_required', {
      surface,
      preferredOrgId: preferredOrgId ?? null,
      isPlatformAdminOverride: isPlatformAdminOverride ?? null,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      windowPlatformAdminFlag: typeof window !== 'undefined' ? window.__IS_PLATFORM_ADMIN__ : 'no_window',
    });
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
