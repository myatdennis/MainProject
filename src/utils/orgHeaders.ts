import { getActiveOrgPreference, getUserSession } from '../lib/secureStorage';
import isUuid from './isUuid';

/**
 * Resolve the most relevant organization id for the current browser context.
 * Prefers the persisted active org preference, then the session payload.
 */
export const resolveActiveOrgId = (): string | null => {
  try {
    const preference = getActiveOrgPreference();
    if (preference && isUuid(preference)) {
      return preference;
    }
    const session = getUserSession();
    const candidate = session?.activeOrgId || session?.organizationId || null;
    if (candidate && isUuid(candidate)) {
      return candidate;
    }
    const orgIds = Array.isArray((session as any)?.organizationIds) ? ((session as any).organizationIds as unknown[]) : null;
    if (orgIds && orgIds.length === 1) {
      const only = typeof orgIds[0] === 'string' ? orgIds[0] : null;
      return only && isUuid(only) ? only : null;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Build analytics/org-aware headers when an org id is available.
 */
export const buildOrgHeaders = (explicitOrgId?: string | null): Record<string, string> | undefined => {
  const candidate = explicitOrgId?.trim() || resolveActiveOrgId() || '';
  if (candidate && isUuid(candidate)) {
    return { 'X-Org-Id': candidate };
  }
  return undefined;
};
