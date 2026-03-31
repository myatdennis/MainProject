/**
 * Authentication Middleware
 * Server-side authentication and authorization
 */

import rateLimit from 'express-rate-limit';
import supabase, { supabaseAuthClient, supabaseEnv } from '../lib/supabaseClient.js';
import { getDatabaseConnectionInfo } from '../db.js';
import { extractTokenFromHeader, verifyAccessToken } from '../utils/jwt.js';
import { getActiveOrgFromRequest } from '../utils/authCookies.js';
import { getUserMemberships, getMembershipDiagnostics } from '../utils/memberships.js';
import { E2E_TEST_MODE, DEV_FALLBACK, demoAutoAuthEnabled, NODE_ENV } from '../config/runtimeFlags.js';
import { getPermissionsForRole, mergePermissions } from '../../shared/permissions/index.js';

// Verbose per-request auth diagnostics are only emitted in non-production environments
// to avoid flooding Railway logs with `membership_snapshot` / `resolved_org_context`
// on every authenticated request.
const AUTH_VERBOSE_LOGGING = NODE_ENV !== 'production' || process.env.AUTH_VERBOSE_LOGGING === 'true';

const normalizeEmail = (value = '') => value.trim().toLowerCase();
const PRIMARY_ADMIN_EMAIL = normalizeEmail(process.env.PRIMARY_ADMIN_EMAIL || 'mya@the-huddle.co');
const ADMIN_EMAIL_ALLOWLIST = new Set(
  [PRIMARY_ADMIN_EMAIL, ...(process.env.ADMIN_EMAILS || '').split(',')]
    .map((email) => normalizeEmail(email || ''))
    .filter(Boolean),
);
const STRICT_AUTH = String(process.env.STRICT_AUTH || 'false').toLowerCase() === 'true';
const MEMBERSHIP_CACHE_MS = Number(process.env.AUTH_MEMBERSHIP_CACHE_MS || 60_000);
const TOKEN_CACHE_LIMIT = Number(process.env.AUTH_TOKEN_CACHE_LIMIT || 5000);

const membershipCache = new Map();
const tokenCache = new Map();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const writableOrgRoles = new Set(['owner', 'admin', 'manager', 'editor']);
const databaseConnectionInfo = getDatabaseConnectionInfo();
const databaseHostForLogs =
  databaseConnectionInfo.host && databaseConnectionInfo.port
    ? `${databaseConnectionInfo.host}:${databaseConnectionInfo.port}`
    : databaseConnectionInfo.host || null;

const fetchUserProfileRole = async (userId) => {
  if (!userId || !supabase) {
    return { role: null, isAdmin: false };
  }
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('role, is_admin')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return {
      role: data?.role ? String(data.role).toLowerCase() : null,
      isAdmin: data?.is_admin === true,
    };
  } catch (error) {
    console.warn('[auth] Failed to fetch user profile role', {
      userId,
      error: error?.message || error,
    });
    return { role: null, isAdmin: false };
  }
};

const isAllowlistedAdminEmail = (email) => {
  if (!email) return false;
  return ADMIN_EMAIL_ALLOWLIST.has(normalizeEmail(email));
};

const syncUserProfileFlags = async (user) => {
  if (!supabase || !user?.id) {
    return;
  }
  const normalizedRole = user.role ? String(user.role).toLowerCase() : null;
  const normalizedPlatformRole = user.platformRole ? String(user.platformRole).toLowerCase() : null;
  const normalizedEmail = user.email ? normalizeEmail(user.email) : null;
  const isAdmin =
    normalizedRole === 'admin' ||
    normalizedPlatformRole === 'platform_admin' ||
    (normalizedEmail ? isAllowlistedAdminEmail(normalizedEmail) : false);

  try {
    await supabase
      .from('user_profiles')
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
          role: normalizedRole,
          is_admin: isAdmin,
        },
        { onConflict: 'id' }
      );
  } catch (error) {
    console.warn('[auth] Failed to sync user profile flags', {
      userId: user.id,
      error: error?.message || error,
    });
  }
};

const isCanonicalAdminEmail = (email) => {
  if (!email) return false;
  return normalizeEmail(email) === PRIMARY_ADMIN_EMAIL;
};

const derivePlatformRole = (user = {}) => {
  const metadataRole =
    user.app_metadata?.platform_role ||
    user.app_metadata?.role ||
    user.user_metadata?.platform_role ||
    user.user_metadata?.role ||
    null;

  if (metadataRole) {
    return String(metadataRole).toLowerCase();
  }

  if (isAllowlistedAdminEmail(user.email)) {
    return 'platform_admin';
  }

  return null;
};

const resolveUserRole = (user = {}, memberships = []) => {
  const email = normalizeEmail(user.email || '');
  if (email && isAllowlistedAdminEmail(email)) {
    return 'admin';
  }

  const platformRole = derivePlatformRole(user);
  if (platformRole === 'platform_admin' || platformRole === 'admin') {
    return 'admin';
  }

  const membershipRoles = memberships.map((m) => String(m.role || '').toLowerCase());
  if (membershipRoles.some((role) => writableOrgRoles.has(role))) {
    return 'admin';
  }

  return 'learner';
};

const isPlatformAdmin = (user = {}) => {
  if (!user || typeof user !== 'object') return false;
  const platformRole = derivePlatformRole(user);
  return String(platformRole).toLowerCase() === 'platform_admin' || Boolean(user.isPlatformAdmin);
};

export {
  normalizeEmail,
  PRIMARY_ADMIN_EMAIL,
  isCanonicalAdminEmail,
  isAllowlistedAdminEmail,
  resolveUserRole,
  isPlatformAdmin,
  syncUserProfileFlags,
};

// ============================================================================
// Authentication Middleware
// ============================================================================

const DEV_BYPASS_HOSTS = (process.env.DEV_FALLBACK_ALLOWED_HOSTS || 'localhost,127.0.0.1')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const DEMO_SANDBOX_ORG_ID =
  process.env.E2E_SANDBOX_ORG_ID ||
  process.env.DEMO_SANDBOX_ORG_ID ||
  process.env.DEFAULT_SANDBOX_ORG_ID ||
  'demo-sandbox-org';

const matchesAllowedDevHost = (host) => {
  if (!host) return false;
  const normalized = String(host).trim().toLowerCase();
  if (!normalized) return false;
  return DEV_BYPASS_HOSTS.some(
    (entry) =>
      normalized === entry ||
      normalized.endsWith(`.${entry}`) ||
      normalized.startsWith(`${entry}:`) ||
      normalized.includes(`${entry}:`) ||
      normalized.includes(entry)
  );
};

const isDevRequest = (req) => {
  if (!req) return false;

  const hostCandidates = [];
  const forwardedHost = req.headers?.['x-forwarded-host'];
  if (forwardedHost) {
    forwardedHost.split(',').forEach((value) => hostCandidates.push(value));
  }
  if (req.headers?.host) {
    hostCandidates.push(req.headers.host);
  }
  if (req.hostname) {
    hostCandidates.push(req.hostname);
  }

  const originHeader = req.headers?.origin;
  if (originHeader) {
    try {
      const parsedOrigin = new URL(originHeader);
      if (parsedOrigin.host) {
        hostCandidates.push(parsedOrigin.host);
      }
    } catch (_error) {
      // Ignore malformed origin headers
    }
  }

  if (hostCandidates.some((host) => matchesAllowedDevHost(host))) {
    return true;
  }

  const ipCandidates = [req.ip, req.connection?.remoteAddress, req.socket?.remoteAddress].filter(Boolean);
  if (ipCandidates.some((ip) => typeof ip === 'string' && (ip === '::1' || ip.startsWith('127.')))) {
    return true;
  }

  return false;
};

const allowDemoBypassForRequest = (req) => {
  if (E2E_TEST_MODE) {
    return true;
  }
  if (!demoAutoAuthEnabled) {
    return false;
  }
  if (!DEV_FALLBACK) {
    return false;
  }
  return isDevRequest(req);
};

const buildDemoAuthContextPayload = ({ role = 'learner' } = {}) => {
  const wantsAdmin = String(role || '').toLowerCase() === 'admin';
  const demoUser = wantsAdmin
    ? {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'mya@the-huddle.co',
        app_metadata: { platform_role: 'platform_admin' },
      }
    : {
        id: '00000000-0000-0000-0000-000000000002',
        email: 'user@pacificcoast.edu',
        app_metadata: {},
      };
  const memberships = [
    {
      orgId: DEMO_SANDBOX_ORG_ID,
      role: wantsAdmin ? 'owner' : 'learner',
      status: 'active',
      organizationName: 'Demo Sandbox Organization',
      organizationStatus: 'active',
    },
  ];
  const payload = buildUserPayload(demoUser, memberships, { membershipStatus: 'ready' });
  return {
    user: payload,
    memberships,
    membershipMap: buildMembershipMap(memberships),
    activeOrgId: memberships[0].orgId,
  };
};

const resolveDemoBypassRole = (req) => {
  const path = String(req?.originalUrl || req?.url || '').toLowerCase();
  const explicitRole = String(req?.headers?.['x-user-role'] || '').trim().toLowerCase();
  if (explicitRole === 'admin') {
    return 'admin';
  }
  if (path.startsWith('/api/admin')) {
    return 'admin';
  }
  return 'learner';
};

const buildJwtAuthContextPayload = (claims = {}) => {
  const organizationId = typeof claims.organizationId === 'string' && claims.organizationId.trim()
    ? claims.organizationId.trim()
    : null;
  const role = typeof claims.role === 'string' && claims.role.trim() ? claims.role.trim().toLowerCase() : 'learner';
  const platformRole =
    typeof claims.platformRole === 'string' && claims.platformRole.trim()
      ? claims.platformRole.trim().toLowerCase()
      : role === 'admin'
      ? 'platform_admin'
      : null;
  const user = {
    id: claims.userId,
    email: claims.email || '',
    app_metadata: platformRole ? { platform_role: platformRole } : {},
    user_metadata: {},
  };
  const memberships = organizationId
    ? [
        {
          orgId: organizationId,
          role: role === 'admin' ? 'owner' : role,
          status: 'active',
          organizationName: null,
          organizationStatus: 'active',
        },
      ]
    : [];
  const payload = buildUserPayload(user, memberships, { membershipStatus: 'ready' });
  return {
    user: payload,
    memberships,
    membershipMap: buildMembershipMap(memberships),
    activeOrgId: organizationId,
  };
};

const cacheGet = (store, key) => {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
};

const cacheSet = (store, key, value, ttlMs = MEMBERSHIP_CACHE_MS) => {
  if (!ttlMs || ttlMs <= 0) return;
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (store.size > TOKEN_CACHE_LIMIT) {
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }
};

export const invalidateMembershipCache = (userId) => {
  if (!userId) return;
  membershipCache.delete(`org-memberships:${userId}`);
};

export const mapMembershipRows = (rows = []) =>
  rows.map((row) => {
    const orgId = row.organization_id ?? null;
    return {
      orgId,
      organizationId: orgId,
      role: row.role || null,
      status: row.status || 'active',
      organizationName: row.organizationName ?? row.organization_name ?? row.org_name ?? null,
      organizationSlug: row.organizationSlug ?? row.organization_slug ?? null,
      organizationStatus: row.organizationStatus ?? row.organization_status ?? null,
      subscription: row.subscription ?? null,
      features: row.features ?? null,
      acceptedAt: row.acceptedAt ?? row.accepted_at ?? row.created_at ?? null,
      lastSeenAt: row.lastSeenAt ?? row.last_seen_at ?? null,
      createdAt: row.created_at ?? null,
    };
  });

const buildMembershipMap = (memberships = []) => {
  const map = new Map();
  memberships.forEach((membership) => {
    if (membership && membership.orgId) {
      map.set(membership.orgId, membership);
    }
  });
  return map;
};

const membershipDiagnosticsIndicateError = (diagnostics) =>
  Boolean(diagnostics && (diagnostics.severity === 'error' || diagnostics.code === 'membership_query_error'));

const deriveMembershipStatusLabel = (memberships = [], diagnostics = null) => {
  if (membershipDiagnosticsIndicateError(diagnostics)) {
    return 'error';
  }
  return 'ready';
};

const coerceUuid = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
};

const getRequestedOrgId = (req) => {
  if (!req) return null;
  const headerOrg = coerceUuid(req.headers?.['x-org-id']);
  const cookieOrg = getActiveOrgFromRequest(req);
  const candidates = [
    headerOrg,
    req.query?.orgId,
    req.query?.organizationId,
    req.body?.orgId,
    req.body?.organizationId,
    req.params?.orgId,
    req.params?.organizationId,
    cookieOrg,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }
  }

  return null;
};

const determineActiveOrgId = (req, memberships = []) => {
  const requested = getRequestedOrgId(req);
  if (requested) {
    const match = memberships.find((m) => m.orgId === requested && m.status === 'active');
    if (match) return requested;
  }

  const firstActive = memberships.find((m) => m.status === 'active');
  return firstActive?.orgId || null;
};

async function loadSupabaseUser(token) {
  if (!token || !supabaseAuthClient) return null;
  const cached = cacheGet(tokenCache, token);
  if (cached) return cached;

  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }
  cacheSet(tokenCache, token, data.user);
  return data.user;
}

async function loadMemberships(userId) {
  if (!userId) return [];
  const cacheKey = `org-memberships:${userId}`;
  const cached = cacheGet(membershipCache, cacheKey);
  if (cached) return cached;

  const rows = await getUserMemberships(userId, { logPrefix: '[auth-middleware]' });
  const diagnostics = getMembershipDiagnostics(rows);
  const mapped = mapMembershipRows(rows);
  if (diagnostics) {
    Object.defineProperty(mapped, '__diagnostics', {
      value: diagnostics,
      enumerable: false,
      configurable: true,
    });
  }
  cacheSet(membershipCache, cacheKey, mapped);
  return mapped;
}

const buildUserPayload = (user, memberships, { membershipStatus = 'ready' } = {}) => {
  const membershipDataTrusted = membershipStatus === 'ready';
  const trustedMemberships = membershipDataTrusted ? memberships : [];
  const organizationIds = trustedMemberships.filter((m) => m.status === 'active').map((m) => m.orgId);
  const platformRole = derivePlatformRole(user);
  let inferredRole = resolveUserRole(user, trustedMemberships);

  if (inferredRole === 'admin' && trustedMemberships.length === 0 && !platformRole) {
    if (!membershipDataTrusted) {
      console.warn('[auth] Preserving admin role despite unverified memberships', {
        userId: user?.id ?? null,
        email: user?.email ?? null,
        membershipCount: trustedMemberships.length,
        platformRole,
        membershipStatus,
      });
    } else {
      console.warn('[auth] Suppressing admin role due to missing memberships', {
        userId: user?.id ?? null,
        email: user?.email ?? null,
        membershipCount: trustedMemberships.length,
        platformRole,
        reason: 'no_memberships',
      });
      inferredRole = 'learner';
    }
  }

  const rolePermissions = getPermissionsForRole(inferredRole);
  const platformPermissions = platformRole ? getPermissionsForRole(platformRole) : new Set();
  const mergedPermissions = mergePermissions(rolePermissions, platformPermissions);
  const serializedPermissions = Array.from(mergedPermissions);

  return {
    id: user.id,
    userId: user.id,
    email: normalizeEmail(user.email || ''),
    role: inferredRole,
    platformRole,
    isPlatformAdmin: (platformRole === 'platform_admin') || isPlatformAdmin(user),
    organizationId: organizationIds[0] || null,
    organizationIds,
    memberships: trustedMemberships,
    permissions: serializedPermissions,
    appMetadata: user.app_metadata || {},
    userMetadata: user.user_metadata || {},
  };
};

export const __testables = {
  buildUserPayload,
  deriveMembershipStatusLabel,
};

const resolveAccessTokenFromRequest = (req) => {
  if (req.supabaseJwtToken) {
    return { token: req.supabaseJwtToken, source: 'supabase-jwt' };
  }
  const authorizationHeader = req.headers?.authorization;
  const headerToken = extractTokenFromHeader(authorizationHeader);
  if (headerToken) {
    return { token: headerToken, source: 'authorization' };
  }


  return { token: null, source: null };
};

export async function buildAuthContext(req, { optional = false } = {}) {
  const { token } = resolveAccessTokenFromRequest(req);
  const preValidatedUser = req.supabaseJwtUser || null;

  if (!token && allowDemoBypassForRequest(req)) {
    console.warn('[auth] Granting demo auto-auth bypass for request', {
      path: req.originalUrl || req.url,
      host: req.headers?.host,
      origin: req.headers?.origin,
    });
    const demo = buildDemoAuthContextPayload({ role: resolveDemoBypassRole(req) });
    return {
      user: demo.user,
      membershipsMap: demo.membershipMap,
      activeOrgId: demo.activeOrgId,
      membershipDiagnostics: null,
      membershipStatus: 'ready',
    };
  }

  if (!token) {
    if (optional) return null;
    throw new Error('missing_token');
  }

  const localJwtClaims = verifyAccessToken(token);
  if (localJwtClaims?.userId) {
    const jwtContext = buildJwtAuthContextPayload(localJwtClaims);
    return {
      user: jwtContext.user,
      membershipsMap: jwtContext.membershipMap,
      activeOrgId: jwtContext.activeOrgId,
      membershipDiagnostics: null,
      membershipStatus: 'ready',
      membershipCount: jwtContext.memberships.length,
      membershipDegraded: false,
    };
  }

  let supabaseUser = preValidatedUser;
  if (!supabaseUser) {
    if (!supabase) {
      if (allowDemoBypassForRequest(req)) {
        console.warn('[auth] Supabase unavailable; falling back to demo auto-auth context', {
          path: req.originalUrl || req.url,
          host: req.headers?.host,
          origin: req.headers?.origin,
          hadToken: Boolean(token),
        });
        const demo = buildDemoAuthContextPayload({ role: resolveDemoBypassRole(req) });
        return {
          user: demo.user,
          membershipsMap: demo.membershipMap,
          activeOrgId: demo.activeOrgId,
          membershipDiagnostics: null,
          membershipStatus: 'ready',
        };
      }
      if (optional && !STRICT_AUTH) return null;
      throw new Error('supabase_not_configured');
    }
    supabaseUser = await loadSupabaseUser(token);
  }
  if (!supabaseUser) {
    if (allowDemoBypassForRequest(req)) {
      console.warn('[auth] Token validation failed; falling back to demo auto-auth context', {
        path: req.originalUrl || req.url,
      });
      const demo = buildDemoAuthContextPayload({ role: resolveDemoBypassRole(req) });
      return {
        user: demo.user,
        membershipsMap: demo.membershipMap,
        activeOrgId: demo.activeOrgId,
        membershipDiagnostics: null,
        membershipStatus: 'ready',
      };
    }
    if (optional) return null;
    throw new Error('invalid_token');
  }

  const memberships = await loadMemberships(supabaseUser.id);
  const membershipDiagnostics =
    (memberships && memberships.__diagnostics && { ...memberships.__diagnostics }) || null;
  const schemaHealthStatus = req?.app?.locals?.schemaHealth?.membership?.status || 'unknown';
  let membershipStatus = deriveMembershipStatusLabel(memberships, membershipDiagnostics);
  if (schemaHealthStatus && schemaHealthStatus !== 'ok') {
    membershipStatus = 'degraded';
  } else if (membershipStatus === 'error') {
    membershipStatus = 'degraded';
  }
  const membershipsTrusted = membershipStatus === 'ready';
  const effectiveMembershipCount = membershipsTrusted ? memberships.length : null;
  const userPayload = buildUserPayload(supabaseUser, memberships, { membershipStatus });
  const membershipMap = membershipsTrusted ? buildMembershipMap(memberships) : new Map();
  const activeOrgId = membershipsTrusted ? determineActiveOrgId(req, memberships) : null;
  const membershipDegraded = membershipStatus !== 'ready';

  const requestedOrgId = getRequestedOrgId(req);
  const membershipOrgIds = membershipsTrusted ? memberships.map((m) => m.orgId).filter(Boolean) : [];
  const snapshot = {
    userId: supabaseUser.id,
    email: supabaseUser.email ?? null,
    membershipStatus,
    membershipCount: effectiveMembershipCount,
    activeOrgId,
    requestedOrgId,
    diagnostics: membershipDiagnostics ?? null,
  };
  const supabaseHost = supabaseEnv?.urlHost ?? null;
  if (AUTH_VERBOSE_LOGGING) {
    const membershipSummaryLine = [
      '[auth] membership_snapshot',
      `userId=${supabaseUser.id}`,
      `email=${supabaseUser.email ?? 'unknown'}`,
      `membershipStatus=${membershipStatus}`,
      `membershipCount=${effectiveMembershipCount ?? 'unknown'}`,
      `orgIds=[${membershipOrgIds.join(',')}]`,
      `requestedOrgId=${requestedOrgId ?? 'none'}`,
      `activeOrgId=${activeOrgId ?? 'none'}`,
      `supabaseHost=${supabaseHost ?? 'not-set'}`,
      `dbHost=${databaseHostForLogs ?? 'not-set'}`,
    ].join(' ');
    // Demote to debug in production — this fires on every authenticated request and
    // creates Railway log noise with no actionable signal when things are working.
    if (process.env.NODE_ENV !== 'production') {
      console.debug(membershipSummaryLine);
    }
  }

  return {
    user: userPayload,
    membershipsMap: membershipMap,
    activeOrgId,
    membershipDiagnostics,
    membershipStatus,
    membershipCount: effectiveMembershipCount,
    membershipDegraded,
  };
}

/**
 * Verify Supabase token and attach user to request
 */
export async function authenticate(req, res, next) {
  try {
    const context = await buildAuthContext(req);
    if (!context) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No valid session token',
      });
    }

    req.user = context.user;
    req.userId = context.user?.userId ?? context.user?.id ?? null;
    req.orgMemberships = context.membershipsMap;
    req.activeOrgId = context.activeOrgId;
    req.membershipDiagnostics = context.membershipDiagnostics || null;
    req.membershipStatus = context.membershipStatus || 'ready';
    req.membershipCount = context.membershipCount ?? null;
    req.membershipDegraded = Boolean(context.membershipDegraded);
    req.userPermissions = new Set(Array.isArray(context.user.permissions) ? context.user.permissions : []);
    return next();
  } catch (error) {
    if (error.message === 'supabase_not_configured') {
      console.error('[auth] Supabase credentials missing while STRICT_AUTH enabled');
      return res.status(503).json({
        error: 'auth_unavailable',
        message: 'Authentication service not configured',
      });
    }

    if (error.message === 'missing_token') {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No bearer token provided in the Authorization header',
      });
    }

    if (error.message === 'invalid_token') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is invalid or expired',
      });
    }

    console.error('[auth] Unexpected authentication error', error);
    return res.status(500).json({
      error: 'auth_error',
      message: 'Unable to authenticate request',
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuthenticate(req, res, next) {
  try {
    const context = await buildAuthContext(req, { optional: true });
    if (context) {
      req.user = context.user;
      req.orgMemberships = context.membershipsMap;
      req.activeOrgId = context.activeOrgId;
      req.membershipDiagnostics = context.membershipDiagnostics || null;
      req.membershipStatus = context.membershipStatus || 'ready';
      req.membershipCount = context.membershipCount ?? null;
      req.membershipDegraded = Boolean(context.membershipDegraded);
      req.userPermissions = new Set(Array.isArray(context.user.permissions) ? context.user.permissions : []);
    }
  } catch (error) {
    console.warn('[auth] optional auth failed:', error.message);
  }

  next();
}

export function resolveOrganizationContext(req, res, next) {
  const requestedOrgId = getRequestedOrgId(req);
  const activeOrgId = req.activeOrgId ?? null;
  const orgIds = Array.isArray(req.user?.organizationIds) ? req.user.organizationIds.filter(Boolean) : [];

  if (orgIds.length === 0 && req.orgMemberships instanceof Map) {
    orgIds.push(...Array.from(req.orgMemberships.keys()).filter(Boolean));
  }

  const resolvedOrgId = requestedOrgId || activeOrgId || (orgIds.length ? orgIds[0] : null);

  if (AUTH_VERBOSE_LOGGING) {
    console.info('[auth] resolved_org_context', {
      userId: req.user?.id ?? req.user?.userId ?? null,
      requestedOrgId: requestedOrgId ?? null,
      activeOrgId: activeOrgId ?? null,
      resolvedOrgId,
    });
  }

  if (!resolvedOrgId) {
    return res.status(400).json({
      error: 'organization_context_required',
      message: 'Organization context is required for this operation.',
    });
  }

  req.organizationId = resolvedOrgId;
  res.locals.organizationId = resolvedOrgId;
  req.requestedOrgId = requestedOrgId ?? null;
  req.resolvedOrgId = resolvedOrgId;

  return next();
}

// ============================================================================
// Authorization Middleware
// ============================================================================

/**
 * Require specific role(s)
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Must be logged in',
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
    }
    
    next();
  };
}

const hasWritableOrgRole = (membership) => {
  if (!membership) return false;
  return writableOrgRoles.has(String(membership.role || '').toLowerCase());
};

/**
 * Require platform admin role (global)
 */
export async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Must be logged in',
    });
  }

  const userId = req.user.userId || req.user.id || null;
  let resolvedRole = req.user.role ? String(req.user.role).toLowerCase() : null;
  let isPlatformAdmin = Boolean(req.user.isPlatformAdmin || req.user.platformRole === 'platform_admin');

  if (!isPlatformAdmin && userId) {
    const profileFlags = await fetchUserProfileRole(userId);
    if (profileFlags.role) {
      resolvedRole = profileFlags.role;
    }
    if (profileFlags.isAdmin || profileFlags.role === 'platform_admin') {
      isPlatformAdmin = true;
    }
  }

  const hasOrgAdminRole = Array.isArray(req.user.memberships)
    ? req.user.memberships.some((membership) => String(membership.role || '').toLowerCase() === 'admin')
    : false;

  if (isPlatformAdmin || hasOrgAdminRole) {
    if (resolvedRole) {
      req.user.role = resolvedRole;
    }
    if (isPlatformAdmin) {
      req.user.isPlatformAdmin = true;
      req.user.platformRole = 'platform_admin';
    }
    return next();
  }

  const deniedMeta = {
    userId: req.user.userId || req.user.id || null,
    email: req.user.email || null,
    platformRole: req.user.platformRole || null,
    resolvedRole: req.user.role || null,
    memberships: Array.isArray(req.user.memberships)
      ? req.user.memberships.map((m) => ({ orgId: m.orgId, role: m.role, status: m.status }))
      : [],
    path: req.originalUrl,
  };
  console.warn('[requireAdmin] Access denied', deniedMeta);

  return res.status(403).json({
    error: 'Forbidden',
    message: 'Platform admin access required',
  });
}

/**
 * Require specific permission(s)
 */
export function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Must be logged in',
      });
    }

    if (req.user.isPlatformAdmin) {
      return next();
    }

    if (!permissions || permissions.length === 0) {
      return next();
    }

    const permissionSet = req.userPermissions || new Set(req.user.permissions || []);
    const allowed = permissions.some((permission) => permissionSet.has(permission));
    if (!allowed) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient feature permissions',
        requiredPermissions: permissions,
      });
    }

    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Must be logged in',
    });
  }
  next();
}

export function requireOwnerOrAdmin(getUserId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const resourceUserId = getUserId(req);
    if (req.user.role === 'admin' || req.user.userId === resourceUserId) {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your own resources',
    });
  };
}

export function requireSameOrganizationOrAdmin(getOrganizationId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    if (req.user.isPlatformAdmin) {
      return next();
    }

    const resourceOrgId = getOrganizationId(req);
    if (!resourceOrgId) {
      return next();
    }

    const membership = req.orgMemberships?.get(resourceOrgId);
    if (membership && membership.status === 'active') {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access resources in your organization',
    });
  };
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many attempts',
    message: 'Too many login attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const RATE_LIMIT_BYPASS_PREFIXES = ['/auth', '/mfa', '/health', '/diagnostics'];
const RATE_LIMIT_BYPASS_EXACT = new Set(['/auth/csrf']);

const shouldBypassApiRateLimit = (req) => {
  if (!req) return false;
  const e2eMode = String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true';
  const devFallback = String(process.env.DEV_FALLBACK || '').toLowerCase() === 'true';
  if (e2eMode || devFallback) {
    return true;
  }
  if (req.method === 'OPTIONS') return true;
  const path = req.path || '';
  if (RATE_LIMIT_BYPASS_EXACT.has(path)) {
    return true;
  }
  return RATE_LIMIT_BYPASS_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 500,
  message: {
    error: 'Too many requests',
    message: 'Please slow down and try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldBypassApiRateLimit(req),
});

export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many requests for this operation.',
  },
});

export function securityHeaders(req, res, next) {
  res.setHeader('X-Frame-Options', process.env.X_FRAME_OPTIONS || 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    const allowedFrameSrc = process.env.ALLOWED_FRAME_SRC || 'https://www.youtube.com https://www.youtube-nocookie.com';
    const frameAncestors = process.env.FRAME_ANCESTORS || "'self'";
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' data:; " +
        "connect-src 'self' https:; " +
        `frame-src ${allowedFrameSrc}; ` +
        `child-src ${allowedFrameSrc}; ` +
        `frame-ancestors ${frameAncestors};`
    );
  }
  if (req.secure && process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

export function logAuthRequest(req, res, next) {
  if (req.user) {
    console.log(`[AUTH] ${req.method} ${req.path} - User: ${req.user.email} (${req.user.role})`);
  }
  next();
}

export function authErrorHandler(err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Authentication failed',
    });
  }
  next(err);
}
