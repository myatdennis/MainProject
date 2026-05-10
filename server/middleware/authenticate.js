import cookieParser from 'cookie-parser';
import { finalizeUser } from '../lib/finalizeUser.js';
import { supabaseAuthClient, createSupabaseClientForToken, setRequestSupabaseClient } from '../lib/supabaseClient.js';
import { verifySupabaseToken } from './supabaseJwt.js';

const isDev = process.env.NODE_ENV !== 'production';
const e2eModeEnabled = String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true';

const normalizeMemberships = (claims = {}) => {
  const appMetadata = claims.app_metadata && typeof claims.app_metadata === 'object' ? claims.app_metadata : {};
  const rawMemberships = Array.isArray(appMetadata.memberships)
    ? appMetadata.memberships
    : Array.isArray(claims.memberships)
      ? claims.memberships
      : [];

  return rawMemberships
    .map((membership) => {
      if (!membership || typeof membership !== 'object') return null;
      const organizationId =
        membership.organization_id ??
        membership.organizationId ??
        membership.orgId ??
        membership.org_id ??
        null;
      if (!organizationId) return null;
      return {
        ...membership,
        organization_id: String(organizationId),
        organizationId: String(organizationId),
        orgId: String(organizationId),
        role: membership.role || claims.role || 'member',
        status: membership.status || 'active',
      };
    })
    .filter(Boolean);
};

const buildE2ELocalUserFromClaims = (claims = {}) => {
  const appMetadata = claims.app_metadata && typeof claims.app_metadata === 'object' ? claims.app_metadata : {};
  const platformRole = appMetadata.platform_role || claims.platform_role || claims.platformRole || null;
  const memberships = normalizeMemberships(claims);
  const organizationIds = memberships.map((membership) => membership.organization_id);
  return {
    id: claims.sub || claims.userId || claims.user_id || null,
    userId: claims.sub || claims.userId || claims.user_id || null,
    email: claims.email || claims.user_email || '',
    role: claims.role || appMetadata.role || 'member',
    platformRole,
    isPlatformAdmin: String(platformRole || '').toLowerCase() === 'platform_admin',
    organizationIds,
    memberships,
    app_metadata: appMetadata,
    user_metadata: claims.user_metadata || {},
  };
};

const mergeE2EClaimsIntoSupabaseUser = async (token, user) => {
  if (!isDev || !e2eModeEnabled || !token) return user;
  try {
    const claims = await verifySupabaseToken(token);
    const claimUserId = claims.sub || claims.userId || claims.user_id || null;
    if (claimUserId && user?.id && String(claimUserId) !== String(user.id)) {
      return user;
    }
    const appMetadata = {
      ...(user?.app_metadata || {}),
      ...(claims.app_metadata && typeof claims.app_metadata === 'object' ? claims.app_metadata : {}),
    };
    const userMetadata = {
      ...(user?.user_metadata || {}),
      ...(claims.user_metadata && typeof claims.user_metadata === 'object' ? claims.user_metadata : {}),
    };
    return {
      ...user,
      id: user?.id || claimUserId,
      email: user?.email || claims.email || claims.user_email || '',
      role: claims.role || user?.role,
      app_metadata: appMetadata,
      user_metadata: userMetadata,
    };
  } catch (error) {
    console.warn('[AUTH LOCAL JWT CLAIM MERGE FAILED]', {
      reason: error?.message || String(error),
    });
    return user;
  }
};

export async function authenticate(req, res, next) {
  try {
    if (isDev) {
      console.log('[AUTH START]', {
        hasAuthHeader: !!req.headers.authorization,
        hasCookie: !!req.cookies,
      });
      console.log('[AUTH CHECK]', {
        hasHeader: !!req.headers.authorization,
        hasCookie: !!req.cookies,
      });
    }

    // CRITICAL:
    // This middleware MUST NOT overwrite an existing req.user.
    // req.user may be set upstream (e.g., E2E bypass or future integrations).
    if (req.user) {
      if (isDev) {
        console.log('[AUTH RESULT]', {
          hasUser: true,
          userId: req.user?.id || req.user?.userId || null,
          preserved: true,
        });
      }
      return next();
    }

    const headerToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const cookieToken = (req.cookies?.access_token ?? req.cookies?.['sb-access-token'] ?? '').trim();
    const token = headerToken || cookieToken || '';
    if (isDev) {
      console.log('[AUTH SOURCE]', {
        hasBearer: Boolean(headerToken),
        hasCookie: Boolean(cookieToken),
        selected: headerToken ? 'bearer' : cookieToken ? 'cookie' : 'none',
      });
    }

    if (!token) {
      console.warn('[AUTH MISSING TOKEN]', {
        path: req.originalUrl || req.url || null,
        hasHeader: !!req.headers.authorization,
      });
      if (isDev) {
        console.log('[AUTH RESULT]', {
          hasUser: false,
          userId: null,
        });
      }
      return next(); // DO NOT set req.user = null
    }

    // Prefer the centralized auth client. It may be unavailable in some test modes.
    const authClient = supabaseAuthClient || null;
    let data = null;
    let error = null;
    if (authClient && typeof authClient.auth?.getUser === 'function') {
      const result = await authClient.auth.getUser(token);
      data = result?.data || null;
      error = result?.error || null;
    } else {
      // Fallback: if centralized auth client is not configured, attempt to
      // create a per-request client for token introspection.
      try {
        const probe = createSupabaseClientForToken(token);
        if (probe && typeof probe.auth?.getUser === 'function') {
          const result = await probe.auth.getUser(token);
          data = result?.data || null;
          error = result?.error || null;
        }
      } catch (e) {
        error = e;
      }
    }

    if (error || !data?.user) {
      if (isDev && e2eModeEnabled) {
        try {
          const claims = await verifySupabaseToken(token);
          const localUser = buildE2ELocalUserFromClaims(claims);
          if (localUser.userId) {
            req.user = finalizeUser(localUser);
            req.userId = localUser.userId;
            req.orgMemberships = new Map(
              localUser.memberships.map((membership) => [membership.organization_id, membership]),
            );
            req.activeOrgId = localUser.organizationIds.length === 1 ? localUser.organizationIds[0] : null;
            if (isDev) {
              console.warn('[AUTH LOCAL JWT FALLBACK]', {
                userId: req.userId,
                membershipCount: localUser.memberships.length,
                platformRole: localUser.platformRole || null,
              });
            }
            return next();
          }
        } catch (fallbackError) {
          console.warn('[AUTH LOCAL JWT FALLBACK FAILED]', {
            reason: fallbackError?.message || String(fallbackError),
            path: req.originalUrl || req.url || null,
          });
        }
      }
      console.warn('[AUTH INVALID TOKEN]', {
        reason: error?.message || 'supabase_user_missing',
        path: req.originalUrl || req.url || null,
      });
      if (isDev) {
        console.log('[AUTH RESULT]', {
          hasUser: false,
          userId: null,
        });
      }
      return next(); // DO NOT clear req.user
    }

    const user = await mergeE2EClaimsIntoSupabaseUser(token, data.user);
    const memberships = normalizeMemberships({
      role: user.app_metadata?.role || user.role,
      app_metadata: user.app_metadata || {},
    });
    const organizationIds = memberships.map((membership) => membership.organization_id);

    // Bind a per-request supabase client (with Authorization header) so
    // downstream handlers use the user's JWT for RLS-bound reads.
    try {
      const perReqClient = createSupabaseClientForToken(token);
      if (perReqClient) setRequestSupabaseClient(perReqClient);
    } catch (e) {
      // non-fatal; continue without binding
      console.warn('[AUTH] failed to bind per-request supabase client', e?.message || e);
    }

    req.user = finalizeUser({
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.app_metadata?.role || 'user',
      platformRole: user.app_metadata?.platform_role || null,
      isPlatformAdmin: user.app_metadata?.platform_role === 'platform_admin',
      organizationIds,
      memberships,
      app_metadata: user.app_metadata || {},
      user_metadata: user.user_metadata || {},
    });
    req.userId = user.id;
    req.orgMemberships = new Map(
      memberships.map((membership) => [membership.organization_id, membership]),
    );
    req.activeOrgId = organizationIds.length === 1 ? organizationIds[0] : null;

    if (isDev) {
      console.log('[AUTH TOKEN]', {
        hasUser: !!req.user,
        userId: req.user?.id,
      });
      console.log('[AUTH RESULT]', {
        hasUser: !!req.user,
        userId: req.user?.id || req.user?.userId || null,
      });
      console.log('[AUTH SUCCESS]', req.user?.id || req.user?.userId || null);
    }

    // req.user finalization (freeze) is handled by finalizeUser

    return next();

  } catch (err) {
    console.error('[AUTH ERROR]', {
      reason: err?.message || String(err),
      path: req.originalUrl || req.url || null,
    });
    if (isDev) {
      console.log('[AUTH RESULT]', {
        hasUser: false,
        userId: null,
      });
    }
    return next();
  }
}
