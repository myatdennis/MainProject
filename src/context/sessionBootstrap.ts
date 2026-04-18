import {
  getAccessToken,
  getRefreshToken,
  type UserSession,
} from '../lib/secureStorage';
import { getSupabase, AUTH_STORAGE_MODE } from '../lib/supabaseClient';
import { normalizeMembershipStatusFlag } from './organizationResolution';

export interface SessionResponsePayload {
  user?: Record<string, any> | null;
  memberships?: Array<Record<string, any>>;
  organizationIds?: string[];
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  refreshExpiresAt?: number | null;
  activeOrgId?: string | null;
  role?: string | null;
  platformRole?: string | null;
  isPlatformAdmin?: boolean;
  mfaRequired?: boolean;
  authenticatedOnly?: boolean;
  membershipStatus?: 'ready' | 'degraded' | 'error' | 'unknown';
  membershipDegraded?: boolean;
  membershipCount?: number | null;
  schemaHealth?: Record<string, any> | null;
}

export type SupabaseSessionLike = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number | null;
  refresh_expires_at?: number | null;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number | null;
  refreshExpiresAt?: number | null;
  user?: Record<string, any> | null;
  role?: string | null;
  platform_role?: string | null;
  platformRole?: string | null;
  isPlatformAdmin?: boolean;
};

export const coerceString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

export const coerceNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const isSupabaseSessionLike = (value: unknown): value is SupabaseSessionLike => {
  if (!value || typeof value !== 'object') return false;
  return 'access_token' in value || 'accessToken' in value || 'refresh_token' in value || 'refreshToken' in value;
};

export const readSupabaseSessionTokens = async (
  options: { refreshIfMissing?: boolean } = {},
): Promise<{ accessToken: string | null; refreshToken: string | null }> => {
  let accessToken = getAccessToken() ?? null;
  let refreshToken = getRefreshToken() ?? null;
  const authStorageMode = (() => {
    try {
      return AUTH_STORAGE_MODE;
    } catch {
      return 'unknown';
    }
  })();

  if (import.meta.env?.DEV) {
    console.info('[SecureAuth] boot', {
      storageMode: authStorageMode,
      hasAccessToken: Boolean(accessToken),
      hasRefreshToken: Boolean(refreshToken),
      refreshIfMissing: options.refreshIfMissing !== false,
    });
  }

  if (options.refreshIfMissing !== false && (!accessToken || !refreshToken)) {
    try {
      const supabase = getSupabase();
      const sessionResult = await supabase?.auth?.getSession();
      const supabaseSession = sessionResult?.data?.session as SupabaseSessionLike | null;
      if (supabaseSession) {
        accessToken = accessToken || supabaseSession.access_token || supabaseSession.accessToken || null;
        refreshToken = refreshToken || supabaseSession.refresh_token || supabaseSession.refreshToken || null;
      }
    } catch (sessionError) {
      console.warn('[SecureAuth] readSupabaseSessionTokens fallback failed', sessionError);
    }
  }

  return { accessToken, refreshToken };
};

export const normalizeSessionResponsePayload = (payload: unknown): SessionResponsePayload | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const source = payload as Record<string, any>;
  const sessionContainer = source.session && typeof source.session === 'object' ? source.session : null;
  const supabaseSession: SupabaseSessionLike | null = isSupabaseSessionLike(sessionContainer)
    ? (sessionContainer as SupabaseSessionLike)
    : isSupabaseSessionLike(source.session?.session)
      ? (source.session.session as SupabaseSessionLike)
      : isSupabaseSessionLike(source)
        ? (source as SupabaseSessionLike)
        : null;

  const rawUser = (sessionContainer && sessionContainer.user) || source.user || supabaseSession?.user || null;
  if (!rawUser) {
    return null;
  }

  const derivedRole =
    source.role ?? sessionContainer?.role ?? rawUser.role ?? rawUser.platformRole ?? rawUser.platform_role ?? null;
  const derivedPlatformRole =
    source.platformRole ??
    sessionContainer?.platformRole ??
    sessionContainer?.platform_role ??
    rawUser.platformRole ??
    rawUser.platform_role ??
    null;

  const normalizedUser: UserSession & Record<string, any> = { ...rawUser };
  if (derivedRole && !normalizedUser.role) {
    normalizedUser.role = derivedRole;
  }
  if (derivedPlatformRole && !normalizedUser.platformRole) {
    normalizedUser.platformRole = derivedPlatformRole;
  }

  const accessToken =
    source.accessToken ??
    sessionContainer?.accessToken ??
    sessionContainer?.access_token ??
    supabaseSession?.access_token ??
    supabaseSession?.accessToken ??
    null;
  const refreshToken =
    source.refreshToken ??
    sessionContainer?.refreshToken ??
    sessionContainer?.refresh_token ??
    supabaseSession?.refresh_token ??
    supabaseSession?.refreshToken ??
    null;

  const expiresAt =
    source.expiresAt ??
    sessionContainer?.expiresAt ??
    sessionContainer?.expires_at ??
    coerceNumber(supabaseSession?.expires_at ?? supabaseSession?.expiresAt);
  const refreshExpiresAt =
    source.refreshExpiresAt ??
    sessionContainer?.refreshExpiresAt ??
    sessionContainer?.refresh_expires_at ??
    coerceNumber(supabaseSession?.refresh_expires_at ?? supabaseSession?.refreshExpiresAt);

  const derivedIsPlatformAdminSource =
    source.isPlatformAdmin ?? sessionContainer?.isPlatformAdmin ?? supabaseSession?.isPlatformAdmin ?? normalizedUser.isPlatformAdmin;
  const derivedIsPlatformAdmin =
    typeof derivedIsPlatformAdminSource === 'boolean'
      ? derivedIsPlatformAdminSource
      : Boolean(
          coerceString(derivedRole)?.toLowerCase() === 'admin' ||
          coerceString(derivedPlatformRole) === 'platform_admin',
        );

  if (derivedIsPlatformAdmin) {
    normalizedUser.isPlatformAdmin = true;
  }

  const normalized: SessionResponsePayload = {
    user: normalizedUser,
    memberships: source.memberships ?? sessionContainer?.memberships ?? undefined,
    organizationIds: source.organizationIds ?? sessionContainer?.organizationIds ?? undefined,
    accessToken: accessToken ?? null,
    refreshToken: refreshToken ?? null,
    expiresAt: expiresAt ?? null,
    refreshExpiresAt: refreshExpiresAt ?? null,
    activeOrgId: source.activeOrgId ?? sessionContainer?.activeOrgId ?? normalizedUser.organizationId ?? null,
    role: derivedRole ?? normalizedUser.role ?? null,
    platformRole: derivedPlatformRole ?? normalizedUser.platformRole ?? null,
    isPlatformAdmin: derivedIsPlatformAdmin,
    mfaRequired: source.mfaRequired ?? sessionContainer?.mfaRequired ?? false,
    membershipStatus: source.membershipStatus ?? sessionContainer?.membershipStatus ?? undefined,
    membershipDegraded: source.membershipDegraded ?? sessionContainer?.membershipDegraded ?? undefined,
    membershipCount:
      typeof source.membershipCount === 'number'
        ? source.membershipCount
        : typeof sessionContainer?.membershipCount === 'number'
          ? (sessionContainer.membershipCount as number)
          : Array.isArray(source.memberships ?? sessionContainer?.memberships)
            ? (source.memberships ?? sessionContainer?.memberships)?.length ?? null
            : null,
    schemaHealth: source.schemaHealth ?? sessionContainer?.schemaHealth ?? null,
  };

  const normalizedMembershipStatus = normalizeMembershipStatusFlag(
    normalized.membershipStatus,
    normalized.membershipDegraded,
  );
  normalized.membershipStatus = normalizedMembershipStatus;
  normalized.membershipDegraded = normalizedMembershipStatus !== 'ready';
  if (normalized.membershipCount == null && Array.isArray(normalized.memberships)) {
    normalized.membershipCount = normalized.memberships.length;
  }

  return normalized;
};

export const isE2EBootstrapBypassEnabled = (): boolean => {
  const isNotProduction = import.meta.env.DEV || import.meta.env.MODE !== 'production';
  if (typeof window === 'undefined') {
    return false;
  }
  const hasWindowOverride = Boolean((window as any).__E2E_SUPABASE_CLIENT);
  const hasE2EBypassFlag = Boolean((window as any).__E2E_BYPASS === true);
  const clientE2EFlag = Boolean(
    (import.meta as any).env?.E2E_TEST_MODE === 'true' || (import.meta as any).env?.DEV_FALLBACK === 'true',
  );
  const hasLocalStorageBypass =
    isNotProduction &&
    (hasE2EBypassFlag || hasWindowOverride) &&
    (() => {
      try {
        return window.localStorage.getItem('huddle_lms_auth') === 'true';
      } catch {
        return false;
      }
    })();

  return hasWindowOverride || clientE2EFlag || hasE2EBypassFlag || hasLocalStorageBypass;
};

export const buildE2EBootstrapPayload = (): {
  payload: SessionResponsePayload;
  authState: { admin: boolean; lms: boolean; client: boolean };
} => {
  const e2eUserId =
    typeof window !== 'undefined' && typeof (window as any).__E2E_USER_ID === 'string'
      ? (window as any).__E2E_USER_ID
      : '00000000-0000-0000-0000-000000000001';
  const e2eEmail =
    typeof window !== 'undefined' && typeof (window as any).__E2E_USER_EMAIL === 'string'
      ? (window as any).__E2E_USER_EMAIL
      : 'mya@the-huddle.co';
  const e2eRoleRaw =
    typeof window !== 'undefined' && typeof (window as any).__E2E_USER_ROLE === 'string'
      ? String((window as any).__E2E_USER_ROLE)
      : 'admin';
  const e2eActiveOrgId =
    typeof window !== 'undefined' && typeof (window as any).__E2E_ACTIVE_ORG_ID === 'string'
      ? String((window as any).__E2E_ACTIVE_ORG_ID)
      : 'demo-sandbox-org';
  const e2eRole = e2eRoleRaw.trim().toLowerCase();
  const isE2EAdmin = e2eRole === 'admin' || e2eRole === 'owner' || e2eRole === 'platform_admin';

  return {
    payload: {
      user: { id: e2eUserId, email: e2eEmail } as any,
      memberships: [
        {
          orgId: e2eActiveOrgId,
          role: isE2EAdmin ? 'admin' : e2eRole || 'learner',
          status: 'active',
          organizationName: 'Demo Sandbox Org',
        } as any,
      ],
      organizationIds: [e2eActiveOrgId],
      accessToken: 'e2e-access-token',
      refreshToken: 'e2e-refresh-token',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      isPlatformAdmin: isE2EAdmin,
      platformRole: isE2EAdmin ? 'admin' : null,
    },
    authState: {
      admin: true,
      lms: true,
      client: true,
    },
  };
};
