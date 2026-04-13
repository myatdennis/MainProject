/**
 * Authentication Middleware
 * Server-side authentication and authorization
 */

import rateLimit from 'express-rate-limit';
import supabase, { supabaseAuthClient, supabaseEnv } from '../lib/supabaseClient.js';
import { getDatabaseConnectionInfo } from '../db.js';
import { extractTokenFromHeader, verifyAccessToken } from '../utils/jwt.js';
import { getActiveOrgFromRequest, getAccessTokenFromRequest } from '../utils/authCookies.js';
import { getUserMemberships, getMembershipDiagnostics } from '../utils/memberships.js';
import { isDemoMode, isDevMode, isTestMode, isProduction, demoAutoAuthEnabled, NODE_ENV } from '../config/runtimeFlags.js';
import { getPermissionsForRole, mergePermissions } from '../../shared/permissions/index.js';
import jwt from 'jsonwebtoken';

// Verbose per-request auth diagnostics are only emitted in non-production environments
// to avoid flooding Railway logs with `membership_snapshot` / `resolved_org_context`
// on every authenticated request.
const AUTH_VERBOSE_LOGGING = NODE_ENV !== 'production' || process.env.AUTH_VERBOSE_LOGGING === 'true';
const AUTH_DEBUG = process.env.AUTH_DEBUG === 'true';
const SHOULD_LOG_PII = NODE_ENV !== 'production' && AUTH_DEBUG;

const authLog = (level, event, detail = {}, { allowPII = false } = {}) => {
  const logger = console[level] || console.log;
  const payload = allowPII && SHOULD_LOG_PII ? detail : detail;
  logger(`[auth] ${event}`, payload);
};

const normalizeEmail = (value = '') => value.trim().toLowerCase();
const PRIMARY_ADMIN_EMAIL = normalizeEmail(process.env.PRIMARY_ADMIN_EMAIL || 'mya@the-huddle.co');
const ADMIN_EMAIL_ALLOWLIST = new Set(
  [PRIMARY_ADMIN_EMAIL, ...(process.env.ADMIN_EMAILS || '').split(',')]
    .map((email) => normalizeEmail(email || ''))
    .filter(Boolean),
);
const STRICT_AUTH = String(process.env.STRICT_AUTH || 'false').toLowerCase() === 'true';
// PRODUCTION NOTE: membershipCache and tokenCache are in-process Maps.
// In a multi-instance deployment (e.g. Railway), cache invalidation via
// invalidateMembershipCache() only clears the local instance's cache.
// TTL is reduced to 5s to minimize stale-role windows; role/membership changes
// are also actively invalidated so the effective window is near-zero on single-instance.
// TODO: Replace with Redis/distributed cache before scaling past 2 instances.
const MEMBERSHIP_CACHE_MS = Number(process.env.AUTH_MEMBERSHIP_CACHE_MS || 5_000);
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
    authLog('warn', 'fetch_user_profile_role_failed', {
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

// Supabase system roles that must never be written to user_profiles.role.
// The 'authenticated' role is a built-in Postgres/Supabase JWT role — not an app role.
const SUPABASE_SYSTEM_ROLES = new Set(['authenticated', 'anon', 'service_role', 'postgres', 'supabase_admin']);
// App roles that should never be downgraded by a sync operation.
const ELEVATED_APP_ROLES = new Set(['admin', 'platform_admin']);

const syncUserProfileFlags = async (user) => {
  if (!supabase || !user?.id) {
    return;
  }
  const rawRole = user.role ? String(user.role).toLowerCase() : null;
  const normalizedPlatformRole = user.platformRole ? String(user.platformRole).toLowerCase() : null;
  const normalizedEmail = user.email ? normalizeEmail(user.email) : null;

  // Determine is_admin from all available signals — email allowlist is the authoritative source.
  const isAdmin =
    rawRole === 'admin' ||
    normalizedPlatformRole === 'platform_admin' ||
    (normalizedEmail ? isAllowlistedAdminEmail(normalizedEmail) : false);

  // Derive the app-level role to sync.
  // If the incoming role is a Supabase system role (e.g. 'authenticated'), DO NOT overwrite
  // the existing app role — use the allowlist / platformRole to derive the correct app role.
  let appRole = rawRole;
  if (!rawRole || SUPABASE_SYSTEM_ROLES.has(rawRole)) {
    if (normalizedPlatformRole === 'platform_admin' || isAdmin) {
      appRole = 'admin';
    } else {
      // Don't write anything for the role field — leave existing DB value intact.
      appRole = null;
    }
  }

  try {
    // Build the upsert payload. Only include `role` if we have a meaningful app role to write.
    const payload = {
      id: user.id,
      email: user.email ?? null,
      is_admin: isAdmin,
    };
    if (appRole) {
      payload.role = appRole;
    }

    if (appRole && ELEVATED_APP_ROLES.has(appRole)) {
      // For elevated roles, use .update() to avoid accidentally creating a new row
      // with a wrong role on conflict. We only want to SET is_admin and email, not role,
      // unless we're explicitly elevating.
      await supabase
        .from('user_profiles')
        .update({ email: user.email ?? null, is_admin: isAdmin, role: appRole })
        .eq('id', user.id);
    } else {
      await supabase
        .from('user_profiles')
        .upsert(payload, { onConflict: 'id' });
    }
  } catch (error) {
    authLog('warn', 'sync_user_profile_flags_failed', {
      userId: user.id,
      error: error?.message || error,
    });
  }
};

const isCanonicalAdminEmail = (email) => {
  if (!email) return false;
  return normalizeEmail(email) === PRIMARY_ADMIN_EMAIL;
};

const ORG_ADMIN_ROLES = new Set(['owner', 'admin', 'manager']);

const hasOrgAdminRole = (role) => {
  if (!role) return false;
  return ORG_ADMIN_ROLES.has(String(role).toLowerCase());
};

const normalizeTokenMemberships = (user = {}) => {
  const raw = user?.app_metadata?.memberships;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const orgId = entry.orgId ?? entry.organizationId ?? entry.organization_id ?? entry.org_id ?? null;
      if (!orgId) return null;
      const role = entry.role ?? entry.userRole ?? null;
      const statusRaw = entry.status ?? entry.membershipStatus ?? null;
      const normalizedStatus = typeof statusRaw === 'string' ? statusRaw.toLowerCase() : statusRaw === true ? 'active' : null;
      return {
        orgId: String(orgId),
        role: role ? String(role).toLowerCase() : null,
        status: normalizedStatus || 'active',
      };
    })
    .filter(Boolean);
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

export function isPlatformAdmin(user = {}) {
  if (!user || typeof user !== 'object') return false;

  const normalizedEmail = normalizeEmail(user.email || '');
  if (isAllowlistedAdminEmail(normalizedEmail)) {
    return true;
  }

  const explicitPlatformRole = user.platformRole || null;
  const platformRole = (derivePlatformRole(user) || String(explicitPlatformRole || '').toLowerCase()).toLowerCase();

  return platformRole === 'platform_admin' || Boolean(user.isPlatformAdmin);
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

export function isOrgAdministrator(user = {}, orgId = null) {
  if (isPlatformAdmin(user)) return true;
  const memberships = Array.isArray(user.memberships) ? user.memberships : [];
  if (orgId) {
    const membership = memberships.find((m) => pickOrgId(m.orgId, m.organizationId, m.organization_id) === orgId);
    return membership ? hasOrgAdminRole(membership.role) : false;
  }
  return memberships.some((membership) => hasOrgAdminRole(membership.role));
};

export function canManageOrganization(actor = {}, targetOrgId = null) {
  if (isPlatformAdmin(actor)) return true;
  if (!targetOrgId) return false;
  return isOrgAdministrator(actor, targetOrgId);
};

export function canAssignAcrossOrganizations(actor = {}, targetOrgId = null, courseOrgId = null) {
  if (isPlatformAdmin(actor)) return true;
  if (!targetOrgId || !courseOrgId) return false;
  if (String(targetOrgId) !== String(courseOrgId)) return false;
  return isOrgAdministrator(actor, targetOrgId);
};

const canManageUser = (actor = {}, targetUser = {}) => {
  if (isPlatformAdmin(actor)) return true;
  const targetOrgs = new Set(
    (Array.isArray(targetUser.memberships) ? targetUser.memberships : [])
      .filter((membership) => membership.organizationId || membership.organization_id || membership.orgId)
      .map((membership) => pickOrgId(membership.orgId, membership.organizationId, membership.organization_id))
      .filter(Boolean),
  );

  const actorOrgs = new Set(
    (Array.isArray(actor.memberships) ? actor.memberships : [])
      .filter((membership) => membership.role && hasOrgAdminRole(membership.role))
      .map((membership) => pickOrgId(membership.orgId, membership.organizationId, membership.organization_id))
      .filter(Boolean),
  );

  for (const orgId of targetOrgs) {
    if (actorOrgs.has(orgId)) return true;
  }
  return false;
};

export {
  normalizeEmail,
  PRIMARY_ADMIN_EMAIL,
  isCanonicalAdminEmail,
  isAllowlistedAdminEmail,
  resolveUserRole,
  hasOrgAdminRole,
  canManageUser,
  getRequestedOrgId,
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
  const explicitBypassSignal =
    String(req?.headers?.['x-e2e-bypass'] || '').trim().toLowerCase() === 'true' ||
    String(req?.headers?.['x-user-role'] || '').trim().length > 0;

  if (isTestMode || String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true') {
    return explicitBypassSignal;
  }

  if (!isDemoMode) {
    return false;
  }

  if (!demoAutoAuthEnabled) {
    return false;
  }

  if (isProduction) {
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
  if (isProduction) {
    return 'learner';
  }
  // Require an explicit header — never derive admin from the URL path alone.
  // Callers must send `x-user-role: admin` to receive admin context.
  const explicitRole = String(req?.headers?.['x-user-role'] || '').trim().toLowerCase();
  if (explicitRole === 'admin') {
    return 'admin';
  }
  return 'learner';
};

const buildJwtAuthContextPayload = (claims = {}) => {
  const orgIdsRaw =
    claims.organizationIds ??
    claims.organization_ids ??
    claims.organization_id ??
    claims.organizationId ??
    claims.orgId ??
    claims.org_id ??
    null;
  const orgIds = Array.isArray(orgIdsRaw)
    ? orgIdsRaw.map((value) => String(value || '').trim()).filter(Boolean)
    : typeof orgIdsRaw === 'string' && orgIdsRaw.trim()
      ? [orgIdsRaw.trim()]
      : [];
  const organizationId =
    typeof claims.organizationId === 'string' && claims.organizationId.trim()
      ? claims.organizationId.trim()
      : orgIds.length === 1
        ? String(orgIds[0]).trim()
        : null;
  const role = typeof claims.role === 'string' && claims.role.trim() ? claims.role.trim().toLowerCase() : 'learner';
  const platformRoleRaw =
    claims.platformRole ??
    claims.platform_role ??
    (claims.app_metadata && typeof claims.app_metadata === 'object' ? claims.app_metadata.platform_role : null) ??
    (claims.appMetadata && typeof claims.appMetadata === 'object' ? claims.appMetadata.platform_role : null) ??
    null;
  const platformRole =
    typeof platformRoleRaw === 'string' && platformRoleRaw.trim()
      ? platformRoleRaw.trim().toLowerCase()
      : null;
  const user = {
    id: claims.userId,
    email: claims.email || '',
    app_metadata: {
      ...(platformRole ? { platform_role: platformRole } : {}),
      ...(claims.app_metadata && typeof claims.app_metadata === 'object' ? claims.app_metadata : {}),
      ...(claims.appMetadata && typeof claims.appMetadata === 'object' ? claims.appMetadata : {}),
      ...(Array.isArray(claims.memberships) ? { memberships: claims.memberships } : {}),
    },
    user_metadata: {},
  };
  const explicitMemberships = normalizeJwtMembershipList(
    claims.memberships ?? user.app_metadata?.memberships ?? [],
  );
  const orgIdMemberships =
    explicitMemberships.length > 0
      ? explicitMemberships
      : orgIds.length > 0
        ? orgIds.map((orgId) => ({
            orgId: String(orgId).trim(),
            role: role === 'admin' ? 'owner' : role,
            status: 'active',
            organizationName: null,
            organizationStatus: 'active',
          }))
        : organizationId
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
  const memberships = orgIdMemberships.filter((m) => m.orgId);
  const payload = buildUserPayload(user, memberships, { membershipStatus: 'ready' });
  return {
    user: payload,
    memberships,
    membershipMap: buildMembershipMap(memberships),
    activeOrgId: memberships.length === 1 ? memberships[0].orgId : organizationId,
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

export const invalidateMembershipCache = (userId, { orgId } = {}) => {
  if (userId) {
    membershipCache.delete(`org-memberships:${userId}`);
  }
  // When a role or membership changes for an org, purge all cached entries for
  // that org's members so no user retains a stale role beyond TTL.
  if (orgId) {
    for (const [key, entry] of membershipCache.entries()) {
      const memberships = entry?.value;
      if (Array.isArray(memberships) && memberships.some((m) => m.orgId === orgId || m.organizationId === orgId)) {
        membershipCache.delete(key);
      }
    }
  }
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

const normalizeOrgId = (orgId) => {
  if (!orgId && orgId !== 0) return null;
  const post = String(orgId).trim().toLowerCase();
  return post || null;
};

const pickOrgId = (...candidates) => {
  for (const candidate of candidates) {
    const normalized = normalizeOrgId(candidate);
    if (normalized) return normalized;
  }
  return null;
};

const getRequestedOrgId = (req) => {
  if (!req) return null;
  const headerOrg = process.env.NODE_ENV !== 'production' ? normalizeOrgId(req.headers?.['x-org-id']) : null;
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

  const activeMemberships = memberships.filter((m) => m.status === 'active');
  if (activeMemberships.length === 1) {
    return activeMemberships[0].orgId || null;
  }
  // In non-production, keep a convenience fallback so local admin/dev flows
  // don't require explicit org selection for every request.
  if (process.env.NODE_ENV !== 'production') {
    return activeMemberships[0]?.orgId || null;
  }
  // Production: no implicit "first org" selection when the user belongs to
  // multiple orgs — require explicit selection via cookie/query/body.
  return null;
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
  let trustedMemberships = membershipDataTrusted ? memberships : [];
  // In dev/test environments, allow tests and local flows to supply memberships via the JWT
  // (stored in Supabase app_metadata) when the DB membership view is unavailable or empty.
  if (!isProduction && trustedMemberships.length === 0) {
    const tokenMemberships = normalizeTokenMemberships(user);
    if (tokenMemberships.length > 0) {
      trustedMemberships = tokenMemberships;
      if (AUTH_VERBOSE_LOGGING) {
        authLog('info', 'memberships_sourced_from_token_metadata', {
          userId: user?.id ?? null,
          membershipCount: tokenMemberships.length,
        });
      }
    }
  }
  const organizationIds = trustedMemberships.filter((m) => m.status === 'active').map((m) => m.orgId);
  const platformRole = derivePlatformRole(user);
  let inferredRole = resolveUserRole(user, trustedMemberships);

  // Platform admins should always have at least admin privileges.
  if (isPlatformAdmin(user) && inferredRole !== 'admin') {
    inferredRole = 'admin';
  }

  if (inferredRole === 'admin' && trustedMemberships.length === 0 && !platformRole) {
    if (!membershipDataTrusted) {
      authLog('warn', 'preserving_admin_role_unverified_memberships', {
        userId: user?.id ?? null,
        membershipCount: trustedMemberships.length,
        platformRole,
        membershipStatus,
      });
    } else {
      authLog('warn', 'suppressing_admin_role_missing_memberships', {
        userId: user?.id ?? null,
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

  if (AUTH_VERBOSE_LOGGING) {
    authLog('info', 'build_user_payload', {
      userId: user?.id ?? null,
      platformRole,
      inferredRole,
      isPlatformAdmin: (platformRole === 'platform_admin') || isPlatformAdmin(user),
      activeOrgIds: organizationIds,
      membershipCount: trustedMemberships.length,
    });
  }

  return {
    id: user.id,
    userId: user.id,
    email: normalizeEmail(user.email || ''),
    role: inferredRole,
    platformRole,
    isPlatformAdmin: (platformRole === 'platform_admin') || isPlatformAdmin(user),
    organizationId: organizationIds.length === 1 ? organizationIds[0] : null,
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

const SUPABASE_JWT_SECRET = (process.env.SUPABASE_JWT_SECRET || '').trim();
const SUPABASE_JWT_AUDIENCE = 'authenticated';
const SUPABASE_JWT_ISSUER = (() => {
  try {
    const rawSupabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
    return rawSupabaseUrl ? `${rawSupabaseUrl}/auth/v1` : null;
  } catch {
    return null;
  }
})();

const verifySupabaseJwtToken = (token) => {
  if (!token || !SUPABASE_JWT_SECRET || !SUPABASE_JWT_ISSUER) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: SUPABASE_JWT_ISSUER,
      audience: SUPABASE_JWT_AUDIENCE,
      clockTolerance: 5,
    });
    return decoded;
  } catch (error) {
    return null;
  }
};

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());

const normalizeJwtMembershipList = (raw = []) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const orgId = entry.orgId ?? entry.organizationId ?? entry.organization_id ?? entry.org_id ?? null;
      if (!orgId) return null;
      const role = entry.role ?? entry.userRole ?? entry.user_role ?? null;
      const statusRaw = entry.status ?? entry.membershipStatus ?? entry.membership_status ?? null;
      const normalizedStatus =
        typeof statusRaw === 'string'
          ? statusRaw.toLowerCase()
          : statusRaw === true
            ? 'active'
            : null;
      return {
        orgId: String(orgId),
        role: role ? String(role).toLowerCase() : 'member',
        status: normalizedStatus || 'active',
        organizationName: null,
        organizationStatus: 'active',
      };
    })
    .filter(Boolean);
};

const normalizeSupabaseClaimsToJwtClaims = (claims = {}) => {
  const appMetadata = claims.app_metadata || claims.appMetadata || {};
  const platformRole = appMetadata.platform_role || claims.platform_role || claims.platformRole || null;
  const role = claims.role || appMetadata.role || (platformRole === 'platform_admin' ? 'admin' : null) || 'learner';
  const organizationId = claims.organizationId || appMetadata.organizationId || null;
  const organizationIdsRaw = claims.organization_ids ?? claims.organizationIds ?? appMetadata.organization_ids ?? appMetadata.organizationIds ?? null;
  const organizationIds = Array.isArray(organizationIdsRaw)
    ? organizationIdsRaw.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const memberships = normalizeJwtMembershipList(
    appMetadata.memberships ?? claims.memberships ?? claims.membership ?? null,
  );
  let userId = claims.sub || claims.userId || null;

  if (userId && !isUuid(String(userId).trim())) {
    logger.warn('[auth] invalid_user_id_format', { userId });
    if (isTestMode) {
      userId = null;
    }
  }

  if (!userId && isTestMode) {
    // In a well-configured test environment, userId must always be a valid UUID.
    // Do not inject non-production user IDs to avoid masking issues.
    logger.warn('[auth] missing_test_user_id', { claims });
    userId = null;
  }

  return {
    userId,
    email: claims.email || claims.user_email || null,
    role,
    platformRole,
    organizationId: organizationId ?? (organizationIds.length === 1 ? organizationIds[0] : null),
    organizationIds,
    memberships,
  };
};

const resolveAccessTokenFromRequest = (req) => {
  if (req.supabaseJwtToken) {
    return req.supabaseJwtToken;
  }
  const authorizationHeader = req.headers?.authorization;
  const headerToken = extractTokenFromHeader(authorizationHeader);
  if (headerToken) {
    return headerToken;
  }
  const cookieToken = getAccessTokenFromRequest(req);
  if (cookieToken) {
    return cookieToken;
  }
  return null;
};

export async function buildAuthContext(req, { optional = false } = {}) {
  const token = resolveAccessTokenFromRequest(req);
  const preValidatedUser = req.supabaseJwtUser || null;
  if (AUTH_DEBUG) {
    authLog('info', 'buildAuthContext_start', {
      path: req.originalUrl || req.url,
      method: req.method,
      tokenProvided: Boolean(token),
      supabaseJwtUser: !!req.supabaseJwtUser,
      userId: preValidatedUser?.id ?? null,
      userRole: preValidatedUser?.role ?? null,
      platformRole: preValidatedUser?.platformRole ?? null,
      isPlatformAdmin: preValidatedUser?.isPlatformAdmin ?? null,
      requestedOrgId: getRequestedOrgId(req),
    });
  }

  if (!token && allowDemoBypassForRequest(req)) {
    authLog('warn', 'granting_demo_auto_auth_bypass', {
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
    const supabaseJwtClaims = verifySupabaseJwtToken(token);
    if (supabaseJwtClaims?.sub) {
      const normalizedClaims = normalizeSupabaseClaimsToJwtClaims(supabaseJwtClaims);
      const jwtContext = buildJwtAuthContextPayload(normalizedClaims);
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

    if (!supabase) {
      if (allowDemoBypassForRequest(req)) {
        authLog('warn', 'supabase_unavailable_demo_auto_auth_bypass', {
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
      authLog('warn', 'token_validation_failed_demo_auto_auth_bypass', {
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
    if (optional && !STRICT_AUTH) return null;
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
  const membershipDegraded = membershipStatus !== 'ready';
  const userPayload = buildUserPayload(supabaseUser, memberships, { membershipStatus });
  const membershipMap = membershipsTrusted ? buildMembershipMap(memberships) : new Map();
  let activeOrgId = membershipsTrusted ? determineActiveOrgId(req, memberships) : null;
  if (!activeOrgId && isPlatformAdmin(userPayload)) {
    const requestedOrg = getRequestedOrgId(req);
    if (requestedOrg) {
      activeOrgId = requestedOrg;
      authLog('info', 'resolved_org_for_platform_admin', {
        userId: supabaseUser?.id ?? null,
        requestedOrg,
        activeOrgId,
      });
    }
  }
  const requestedOrgId = getRequestedOrgId(req);
  const membershipOrgIds = membershipsTrusted ? memberships.map((m) => m.orgId).filter(Boolean) : [];
  const snapshot = {
    userId: supabaseUser.id,
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
    if (req?.authBypassed) {
      return next();
    }
    const token = resolveAccessTokenFromRequest(req);
    const explicitE2EHeader =
      String(req?.headers?.['x-e2e-bypass'] || '').trim().toLowerCase() === 'true' ||
      String(req?.headers?.['x-user-role'] || '').trim().length > 0;
    if (!token && (isTestMode || String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true') && explicitE2EHeader) {
      const demo = buildDemoAuthContextPayload({ role: resolveDemoBypassRole(req) });
      req.user = demo.user;
      req.userId = demo.user?.userId ?? demo.user?.id ?? null;
      req.orgMemberships = demo.membershipMap;
      req.activeOrgId = demo.activeOrgId;
      req.membershipDiagnostics = null;
      req.membershipStatus = 'ready';
      req.membershipCount = Array.isArray(demo.memberships) ? demo.memberships.length : 1;
      req.membershipDegraded = false;
      req.userPermissions = new Set(Array.isArray(demo.user?.permissions) ? demo.user.permissions : []);
      return next();
    }
    authLog('info', 'authenticate_start', {
      path: req.originalUrl || req.url,
      method: req.method,
      tokenProvided: Boolean(token),
      supabaseJwtUser: !!req.supabaseJwtUser,
      requestedOrgId: getRequestedOrgId(req),
    });
    const context = await buildAuthContext(req);
    authLog('info', 'buildAuthContext_result', {
      userId: context?.user?.userId ?? null,
      userRole: context?.user?.role ?? null,
      platformRole: context?.user?.platformRole ?? null,
      isPlatformAdmin: context?.user?.isPlatformAdmin ?? null,
      membershipStatus: context?.membershipStatus ?? null,
      membershipCount: context?.membershipCount ?? null,
      activeOrgId: context?.activeOrgId ?? null,
      requestedOrgId: getRequestedOrgId(req),
    });
    if (!context) {
      authLog('warn', 'authenticate_failed_no_context');
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No valid session token',
      });
    }

    req.user = context.user ?? null;
    req.userId = context.user?.userId ?? context.user?.id ?? null;
    req.orgMemberships = context.membershipsMap;
    req.activeOrgId = context.activeOrgId;
    req.membershipDiagnostics = context.membershipDiagnostics || null;
    req.membershipStatus = context.membershipStatus || 'ready';
    req.membershipCount = context.membershipCount ?? null;
    req.membershipDegraded = Boolean(context.membershipDegraded);
    req.userPermissions = new Set(Array.isArray(context.user.permissions) ? context.user.permissions : []);
    authLog('info', 'authenticate_success', {
      userId: req.userId,
      userRole: req.user?.role || null,
      platformRole: req.user?.platformRole || null,
      isPlatformAdmin: req.user?.isPlatformAdmin,
      membershipCount: req.membershipCount,
      activeOrgId: req.activeOrgId,
      requestedOrgId: getRequestedOrgId(req),
    });
    return next();
  } catch (error) {
    authLog('error', 'unexpected_authentication_error', {
      message: error?.message || String(error),
      stack: error?.stack ?? null,
    });
    if (error.message === 'supabase_not_configured') {
      authLog('error', 'supabase_credentials_missing_strict_auth');
      return res.status(503).json({
        error: 'auth_unavailable',
        message: 'Authentication service not configured',
      });
    }

    if (error.message === 'missing_token') {
      const explicitBypassSignal =
        String(req?.headers?.['x-e2e-bypass'] || '').trim().toLowerCase() === 'true' ||
        String(req?.headers?.['x-user-role'] || '').trim().length > 0;
      if (!isProduction && explicitBypassSignal) {
        const demo = buildDemoAuthContextPayload({ role: resolveDemoBypassRole(req) });
        req.user = demo.user;
        req.userId = demo.user?.userId ?? demo.user?.id ?? null;
        req.orgMemberships = demo.membershipMap;
        req.activeOrgId = demo.activeOrgId;
        req.membershipDiagnostics = null;
        req.membershipStatus = 'ready';
        req.membershipCount = Array.isArray(demo.memberships) ? demo.memberships.length : 1;
        req.membershipDegraded = false;
        req.userPermissions = new Set(Array.isArray(demo.user?.permissions) ? demo.user.permissions : []);
        return next();
      }
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

    return res.status(500).json({
      error: 'auth_error',
      message: 'Unable to authenticate request',
    });
  }
}

export async function requireAdmin(req, res, next) {
  if (!req.user) {
    console.warn('[requireAdmin] missing req.user');
    return res.status(401).json({ error: 'Authentication required', message: 'Must be logged in' });
  }

  console.log('[requireAdmin] context', { userId: req.user.userId, role: req.user.role, platformRole: req.user.platformRole, isPlatformAdmin: req.user.isPlatformAdmin });

  const userId = req.user.userId || req.user.id || null;
  let isPlatformAdminRole = isPlatformAdmin(req.user);

  if (isPlatformAdminRole) {
    console.info('[admin-auth] platform_admin_access_check', {
      userId,
      email: req.user.email || null,
      platformRole: req.user.platformRole || null,
      resolvedRole: req.user.role || null,
      reason: 'platform_admin_granted',
    });
  }

  if (!isPlatformAdminRole && userId) {
    const profileFlags = await fetchUserProfileRole(userId);
    if (profileFlags.isAdmin || profileFlags.role === 'platform_admin') {
      isPlatformAdminRole = true;
      console.info('[admin-auth] platform_admin_access_check', {
        userId,
        profileRole: profileFlags.role,
        profileIsAdmin: profileFlags.isAdmin,
        reason: 'platform_admin_via_profile',
      });
    }
  }

  if (!isPlatformAdminRole) {
    console.warn('[admin-auth] deny_reason', {
      userId,
      email: req.user.email || null,
      role: req.user.role || null,
      platformRole: req.user.platformRole || null,
      isPlatformAdmin: req.user.isPlatformAdmin,
      reason: 'not_platform_admin',
    });
    return res.status(403).json({ error: 'Forbidden', message: 'Platform admin access required' });
  }

  req.user.isPlatformAdmin = true;
  req.user.platformRole = 'platform_admin';
  return next();
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

export async function requirePlatformAdmin(req, res, next) {
  return requireAdmin(req, res, next);
}

export async function requireOrgAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required', message: 'Must be logged in' });
  }

  if (isPlatformAdmin(req.user)) {
    return next();
  }

  const orgId =
    req.params?.orgId ||
    req.body?.organizationId ||
    req.body?.organization_id ||
    req.query?.orgId ||
    req.query?.organizationId ||
    req.query?.organization_id ||
    req.activeOrgId ||
    null;

  if (!orgId) {
    return res.status(400).json({ error: 'organization_id_required', message: 'Organization context is required' });
  }

  let resolvedOrgId = String(orgId).trim();
  let membership = null;

  if (req.orgMemberships instanceof Map) {
    membership = req.orgMemberships.get(resolvedOrgId);
  }

  if (!membership && Array.isArray(req.user.memberships)) {
    membership = req.user.memberships.find((m) => pickOrgId(m.orgId, m.organizationId, m.organization_id) === resolvedOrgId);
  }

  if (!membership && req.user.userId && supabase) {
    try {
      const rows = await getUserMemberships(req.user.userId, { logPrefix: 'requireOrgAdmin' });
      membership = Array.isArray(rows)
        ? rows.find((m) => pickOrgId(m.orgId, m.organizationId, m.organization_id) === resolvedOrgId)
        : null;
    } catch (error) {
      console.error('[requireOrgAdmin] membership lookup failed', error);
      return res.status(500).json({ error: 'Unable to verify organization membership' });
    }
  }

  if (!membership || !hasOrgAdminRole(membership.role)) {
    return res.status(403).json({ error: 'org_admin_required', message: 'Organizational admin access required' });
  }

  next();
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

// Allow explicit test IPs to bypass rate limiting (e.g. CI loopback), but never
// bypass globally for demo/dev mode — that would leave staging unprotected.
const RATE_LIMIT_BYPASS_TEST_IPS = new Set(
  (process.env.RATE_LIMIT_BYPASS_IPS || '').split(',').map((s) => s.trim()).filter(Boolean),
);
const RATE_LIMIT_LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);
const API_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX || (isProduction ? 500 : 5000));

const shouldBypassApiRateLimit = (req) => {
  if (!req) return false;
  const bypassHeader = String(req.headers?.['x-e2e-bypass'] || '')
    .trim()
    .toLowerCase();
  if (isTestMode || bypassHeader === 'true' || bypassHeader === '1' || bypassHeader === 'yes') {
    return true;
  }
  if (req.method === 'OPTIONS') return true;
  const path = req.path || '';
  if (RATE_LIMIT_BYPASS_EXACT.has(path)) {
    return true;
  }
  if (RATE_LIMIT_BYPASS_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return true;
  }
  // Only bypass for explicitly allowlisted test IPs (e.g. 127.0.0.1 in CI).
  const clientIp = String(req.ip || req.connection?.remoteAddress || '').trim();
  if (!isProduction && RATE_LIMIT_LOOPBACK_IPS.has(clientIp)) {
    return true;
  }
  if (RATE_LIMIT_BYPASS_TEST_IPS.size > 0 && RATE_LIMIT_BYPASS_TEST_IPS.has(clientIp)) {
    return true;
  }
  return false;
};

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: API_LIMIT_MAX,
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
  // Avoid logging PII (emails) and auth surface traffic in production.
  if (req.user && process.env.NODE_ENV !== 'production') {
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

export async function optionalAuthenticate(req, res, next) {
  // Always provide a safe user context for downstream handlers.
  req.user = null;
  req.userId = null;
  req.orgMemberships = new Map();
  req.activeOrgId = null;
  req.membershipDiagnostics = null;
  req.membershipStatus = 'unauthenticated';
  req.membershipCount = 0;
  req.membershipDegraded = false;
  req.userPermissions = new Set();
  req.authContext = {
    userId: null,
    isAuthenticated: false,
    isPlatformAdmin: false,
    memberships: [],
  };
  try {
    const context = await buildAuthContext(req, { optional: true });
    if (context) {
      req.user = context.user || null;
      req.userId = context.user?.userId || context.user?.id || null;
      req.orgMemberships = context.membershipsMap || new Map();
      req.activeOrgId = context.activeOrgId || null;
      req.membershipDiagnostics = context.membershipDiagnostics || null;
      req.membershipStatus = context.membershipStatus || 'ready';
      req.membershipCount = context.membershipCount ?? null;
      req.membershipDegraded = Boolean(context.membershipDegraded);
      req.userPermissions = new Set(Array.isArray(context.user?.permissions) ? context.user.permissions : []);
      req.authContext = {
        userId: req.userId,
        isAuthenticated: Boolean(req.user),
        isPlatformAdmin: Boolean(req.user?.isPlatformAdmin),
        memberships: Array.from((context.membershipsMap && context.membershipsMap.values && typeof context.membershipsMap.values === 'function') ? context.membershipsMap.values() : []),
      };
    }
  } catch (error) {
    authLog('warn', 'optional_auth_failed', {
      message: error?.message || String(error),
    });
  } finally {
    // Ensure baseline auth context is always set.
    if (!req.authContext) {
      req.authContext = {
        userId: req.userId || null,
        isAuthenticated: Boolean(req.user),
        isPlatformAdmin: Boolean(req.user?.isPlatformAdmin),
        memberships: [],
      };
    }
    authLog('info', 'optional_auth_context_initialized', {
      userId: req.authContext.userId,
      isAuthenticated: req.authContext.isAuthenticated,
      isPlatformAdmin: req.authContext.isPlatformAdmin,
    });
    return next();
  }
}

export function resolveOrganizationContext(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required', message: 'Must be logged in' });
  }

  const requestedOrgId = getRequestedOrgId(req);
  const orgIds = Array.isArray(req.user.organizationIds) ? req.user.organizationIds : [];
  const singleOrgId = orgIds.length === 1 ? orgIds[0] : null;
  const inferredOrgId =
    requestedOrgId ||
    req.activeOrgId ||
    req.user.activeOrgId ||
    // Only allow implicit orgId when the user is single-org.
    singleOrgId ||
    null;

  req.activeOrgId = inferredOrgId;

  // Enforce org scoping for non-platform admins: all admin endpoints should be bound to an org.
  if (!req.user?.isPlatformAdmin && !inferredOrgId) {
    const reason = orgIds.length > 1 ? 'org_selection_required' : 'org_scope_required';
    return res.status(403).json({
      error: reason,
      code: reason,
      message:
        orgIds.length > 1
          ? 'Select an organization to continue.'
          : 'Organization context required for admin operations.',
      meta: {
        membershipCount: orgIds.length,
      },
    });
  }

  next();
}
