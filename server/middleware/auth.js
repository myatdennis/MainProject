/**
 * Authentication Middleware
 * Server-side authentication and authorization
 */

import rateLimit from 'express-rate-limit';
import supabase, { supabaseAuthClient } from '../lib/supabaseClient.js';
import { extractTokenFromHeader } from '../utils/jwt.js';
import { getActiveOrgFromRequest } from '../utils/authCookies.js';
import { getUserMemberships, getMembershipDiagnostics } from '../utils/memberships.js';
import { E2E_TEST_MODE, DEV_FALLBACK, demoAutoAuthEnabled } from '../config/runtimeFlags.js';
import { getPermissionsForRole, mergePermissions } from '../../shared/permissions/index.js';

const normalizeEmail = (value = '') => value.trim().toLowerCase();
const PRIMARY_ADMIN_EMAIL = normalizeEmail(process.env.PRIMARY_ADMIN_EMAIL || 'mya@the-huddle.co');
const STRICT_AUTH = String(process.env.STRICT_AUTH || 'false').toLowerCase() === 'true';
const MEMBERSHIP_CACHE_MS = Number(process.env.AUTH_MEMBERSHIP_CACHE_MS || 60_000);
const TOKEN_CACHE_LIMIT = Number(process.env.AUTH_TOKEN_CACHE_LIMIT || 5000);

const membershipCache = new Map();
const tokenCache = new Map();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const writableOrgRoles = new Set(['owner', 'admin', 'manager', 'editor']);

const fetchUserProfileRole = async (userId) => {
  if (!userId || !supabase) {
    return null;
  }
  try {
    const { data, error } = await supabase.from('user_profiles').select('role').eq('id', userId).maybeSingle();
    if (error) {
      throw error;
    }
    return data?.role ? String(data.role).toLowerCase() : null;
  } catch (error) {
    console.warn('[auth] Failed to fetch user profile role', {
      userId,
      error: error?.message || error,
    });
    return null;
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

  return null;
};

const resolveUserRole = (user = {}, memberships = []) => {
  const email = normalizeEmail(user.email || '');
  if (email && isCanonicalAdminEmail(email)) {
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

export { normalizeEmail, PRIMARY_ADMIN_EMAIL, isCanonicalAdminEmail, resolveUserRole };

// ============================================================================
// Authentication Middleware
// ============================================================================

const DEV_BYPASS_HOSTS = (process.env.DEV_FALLBACK_ALLOWED_HOSTS || 'localhost,127.0.0.1')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

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
  if (!demoAutoAuthEnabled) {
    return false;
  }
  if (E2E_TEST_MODE) {
    return true;
  }
  if (!DEV_FALLBACK) {
    return false;
  }
  return isDevRequest(req);
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

export const mapMembershipRows = (rows = []) =>
  rows.map((row) => {
    const orgId = row.organization_id ?? row.org_id ?? null;
    return {
      orgId,
      organizationId: orgId,
      role: row.role || null,
      status: row.status || 'active',
      organizationName: row.organizationName ?? row.organization_name ?? row.org_name ?? null,
      organizationSlug: row.organizationSlug ?? row.organization_slug ?? row.org_slug ?? null,
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

const buildUserPayload = (user, memberships) => {
  const organizationIds = memberships.filter((m) => m.status === 'active').map((m) => m.orgId);
  const platformRole = derivePlatformRole(user);
  let inferredRole = resolveUserRole(user, memberships);

  if (inferredRole === 'admin' && memberships.length === 0 && !platformRole) {
    console.warn('[auth] Suppressing admin role due to missing memberships', {
      userId: user?.id,
      email: user?.email,
    });
    inferredRole = 'learner';
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
    isPlatformAdmin: platformRole === 'platform_admin' || inferredRole === 'admin',
    organizationId: organizationIds[0] || null,
    organizationIds,
    memberships,
    permissions: serializedPermissions,
    appMetadata: user.app_metadata || {},
    userMetadata: user.user_metadata || {},
  };
};

const resolveAccessTokenFromRequest = (req) => {
  const authorizationHeader = req.headers?.authorization;
  const headerToken = extractTokenFromHeader(authorizationHeader);
  if (headerToken) {
    return { token: headerToken, source: 'authorization' };
  }


  return { token: null, source: null };
};

export async function buildAuthContext(req, { optional = false } = {}) {
  const { token } = resolveAccessTokenFromRequest(req);

  if (!token && allowDemoBypassForRequest(req)) {
    console.warn('[auth] Granting demo auto-auth bypass for request', {
      path: req.originalUrl || req.url,
      host: req.headers?.host,
      origin: req.headers?.origin,
    });
    const demoUser = {
      id: 'demo-admin',
      email: 'demo-admin@localhost',
      app_metadata: { platform_role: 'platform_admin' },
    };
    const memberships = [
      {
        orgId: 'demo-org',
        role: 'owner',
        status: 'active',
        organizationName: 'Demo Org',
        organizationStatus: 'active',
      },
    ];
    const payload = buildUserPayload(demoUser, memberships);
    return {
      user: payload,
      membershipsMap: buildMembershipMap(memberships),
      activeOrgId: memberships[0].orgId,
    };
  }

  if (!token) {
    if (optional) return null;
    throw new Error('missing_token');
  }

  if (!supabase) {
    if (optional && !STRICT_AUTH) return null;
    throw new Error('supabase_not_configured');
  }

  const supabaseUser = await loadSupabaseUser(token);
  if (!supabaseUser) {
    if (optional) return null;
    throw new Error('invalid_token');
  }

  const memberships = await loadMemberships(supabaseUser.id);
  const userPayload = buildUserPayload(supabaseUser, memberships);
  const membershipMap = buildMembershipMap(memberships);
  const activeOrgId = determineActiveOrgId(req, memberships);

  const membershipDiagnostics =
    (memberships && memberships.__diagnostics && { ...memberships.__diagnostics }) || null;

  return { user: userPayload, membershipsMap: membershipMap, activeOrgId, membershipDiagnostics };
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
    req.orgMemberships = context.membershipsMap;
    req.activeOrgId = context.activeOrgId;
    req.membershipDiagnostics = context.membershipDiagnostics || null;
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
      req.userPermissions = new Set(Array.isArray(context.user.permissions) ? context.user.permissions : []);
    }
  } catch (error) {
    console.warn('[auth] optional auth failed:', error.message);
  }

  next();
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
    const profileRole = await fetchUserProfileRole(userId);
    if (profileRole) {
      resolvedRole = profileRole;
      if (profileRole === 'admin') {
        isPlatformAdmin = true;
      }
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

export const requirePlatformAdmin = requireAdmin;


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


/**
 * Require user to be authenticated (any role)
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Must be logged in',
    });
  }
  next();
}

/**
 * Require user to own the resource or be an admin
 */
export function requireOwnerOrAdmin(getUserId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }
    
    const resourceUserId = getUserId(req);
    
    // Allow if admin or resource owner
    if (req.user.role === 'admin' || req.user.userId === resourceUserId) {
      return next();
    }
    
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your own resources',
    });
  };
}

/**
 * Require user to be in the same organization or be an admin
 */
export function requireSameOrganizationOrAdmin(getOrganizationId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }
    
    // Platform admins can access all organizations
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

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Rate limiter for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many attempts',
    message: 'Too many login attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Rate limiter for API endpoints
 */
const RATE_LIMIT_BYPASS_PREFIXES = ['/auth', '/mfa', '/health', '/diagnostics'];
const RATE_LIMIT_BYPASS_EXACT = new Set(['/auth/csrf']);

const shouldBypassApiRateLimit = (req) => {
  if (!req) return false;
  if (req.method === 'OPTIONS') return true;
  const path = req.path || '';
  if (RATE_LIMIT_BYPASS_EXACT.has(path)) {
    return true;
  }
  return RATE_LIMIT_BYPASS_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // 500 requests per minute (increased for development)
  message: {
    error: 'Too many requests',
    message: 'Please slow down and try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldBypassApiRateLimit(req),
});

/**
 * Strict rate limiter for sensitive operations
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many requests for this operation.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// Security Headers
// ============================================================================

/**
 * Add security headers to response
 */
export function securityHeaders(req, res, next) {
  // Prevent clickjacking (SAMEORIGIN still protects from framing by other sites
  // but allows same-origin frames if needed). Change via env if you need
  // a different policy.
  res.setHeader('X-Frame-Options', process.env.X_FRAME_OPTIONS || 'SAMEORIGIN');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy - relaxed for dev mode
  if (process.env.NODE_ENV === 'production') {
    // Allow embedding of trusted frame sources (e.g. YouTube) while keeping
    // a sensible default for other directives. You can override via
    // ALLOWED_FRAME_SRC env (space-separated origins) and FRAME_ANCESTORS.
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
  
  // Strict Transport Security (HTTPS only)
  if (req.secure && process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
}

// ============================================================================
// Request Logging
// ============================================================================

/**
 * Log authenticated requests
 */
export function logAuthRequest(req, res, next) {
  if (req.user) {
    console.log(`[AUTH] ${req.method} ${req.path} - User: ${req.user.email} (${req.user.role})`);
  }
  next();
}

// ============================================================================
// Error Handler
// ============================================================================

/**
 * Handle authentication errors
 */
export function authErrorHandler(err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Authentication failed',
    });
  }
  
  next(err);
}
