import supabaseJwtMiddleware from './supabaseJwt.js';
import supabase from '../lib/supabaseClient.js';
import { isDemoMode, isProduction, isTestMode, isDevMode } from '../config/runtimeFlags.js';
import {
  isAllowlistedAdminEmail,
} from './auth.js';

const FALLBACK_SUPERUSER = {
  id: 'dev-admin',
  email: 'dev-admin@local',
  role: 'admin',
  platformRole: 'platform_admin',
  isPlatformAdmin: true,
};

const fetchAdminAllowlistEntry = async (userId, email, { requestId } = {}) => {
  if (!supabase) {
    return { entry: null, error: new Error('SUPABASE_NOT_CONFIGURED') };
  }
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : null;
  if (!userId && !normalizedEmail) {
    return { entry: null, error: null };
  }
  let query = supabase
    .from('admin_users')
    .select('user_id,email,is_active')
    .eq('is_active', true)
    .limit(1);
  if (userId && normalizedEmail) {
    query = query.or(`user_id.eq.${userId},email.eq.${normalizedEmail}`);
  } else if (userId) {
    query = query.eq('user_id', userId);
  } else if (normalizedEmail) {
    query = query.eq('email', normalizedEmail);
  }
  const { data, error } = await query;
  if (error) {
    console.error('[requireAdminAccess] admin_users_query_failed', {
      requestId,
      userId,
      email: normalizedEmail,
      message: error?.message ?? null,
      code: error?.code ?? null,
    });
    return { entry: null, error };
  }
  const entry = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (entry) {
    console.info('[requireAdminAccess] admin_users_match', {
      requestId,
      userId,
      email: normalizedEmail,
    });
  } else {
    console.info('[requireAdminAccess] admin_users_miss', {
      requestId,
      userId,
      email: normalizedEmail,
    });
  }
  return { entry, error: null };
};

const grantAdminAccess = (req, reason, meta = {}) => {
  const { elevatePlatformAdmin = true } = meta;
  req.adminPortalAllowed = true;
  req.adminAccessReason = reason;
  if (meta.allowlistEntry) {
    req.adminAllowlistEntry = meta.allowlistEntry;
  }
  req.user = req.user || {};
  if (elevatePlatformAdmin) {
    req.user.isPlatformAdmin = true;
  }
  if (elevatePlatformAdmin && !req.user.platformRole) {
    req.user.platformRole = 'platform_admin';
  }
  if (!req.user.role) {
    req.user.role = 'admin';
  }
  return true;
};

const fallbackFlagEnabled = (value) => String(value || '').trim().toLowerCase() === 'true';

const isLocalDebugAdminToken = (req) => {
  if (isProduction) return false;
  if (String(process.env.ALLOW_DEBUG_LOGIN || '').trim().toLowerCase() !== 'true') return false;
  const user = req?.supabaseJwtUser;
  const appMetadata = user?.app_metadata || {};
  const userMetadata = user?.user_metadata || {};
  const debugLogin =
    appMetadata.debug_login === true ||
    userMetadata.debug_login === true;
  if (!debugLogin) return false;
  const role = String(user?.role || '').trim().toLowerCase();
  const platformRole = String(user?.platformRole || '').trim().toLowerCase();
  return role === 'admin' || platformRole === 'platform_admin' || user?.isPlatformAdmin === true;
};

const ensureAdminAccess = async (req, res) => {
  // E2E header bypass: allow a local-only bypass when the X-E2E-Bypass header is present.
  // This MUST NOT run in production. It synthesizes a minimal admin identity for E2E tests.
  try {
  const headerVal = (req.get && (req.get('X-E2E-Bypass') || req.get('x-e2e-bypass'))) || req.headers['x-e2e-bypass'] || req.headers['X-E2E-Bypass'] || '';
  const cookieVal = (req.cookies && (req.cookies['x-e2e-bypass'] || req.cookies['e2e_bypass'])) || '';
  const queryVal = (req.query && (req.query['x-e2e-bypass'] || req.query['e2e_bypass'])) || '';
  const hasBypassHeader = Boolean(String(headerVal || cookieVal || queryVal || '').trim().length > 0);
    // Only permit explicit header/cookie/query bypass when E2E_TEST_MODE is explicitly enabled.
    // This MUST NOT work in production.
    const e2eEnabled = String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true';
    if (hasBypassHeader && e2eEnabled) {
      req.e2eBypass = true;
      req.user = req.user || {
        id: '00000000-0000-0000-0000-000000000001',
        role: 'admin',
      };
      req.session = req.session || {
        accessToken: 'e2e-access-token',
        refreshToken: 'e2e-refresh-token',
      };
      // Populate organization/membership shape expected by downstream org checks
      try {
        const headerOrg = (req.get && (req.get('X-Org-Id') || req.get('x-org-id'))) || req.headers['x-org-id'] || req.query?.orgId || req.query?.organizationId || req.body?.orgId || req.body?.organization_id || null;
        const resolvedOrg = headerOrg || (req.body && (req.body.organization_id || req.body.orgId)) || 'demo-sandbox-org';
        req.user.memberships = req.user.memberships || [];
        if (!req.user.memberships.find((m) => String(m.orgId || m.organizationId || m.org_id) === String(resolvedOrg))) {
          req.user.memberships.push({ orgId: resolvedOrg, role: 'admin', status: 'active' });
        }
        req.user.organizationIds = req.user.organizationIds || [];
        if (!req.user.organizationIds.includes(resolvedOrg)) req.user.organizationIds.push(resolvedOrg);
        // activeOrgId is used by getRequestContext and other helpers
        req.activeOrgId = req.activeOrgId || resolvedOrg;
      } catch (e) {
        // non-fatal
      }
      try {
        console.info('[requireAdminAccess] e2e_injected_orgs', { requestId: req.requestId ?? null, userId: req.user?.id, activeOrgId: req.activeOrgId, memberships: req.user?.memberships });
      } catch (e) {}
  console.info('[requireAdminAccess] e2e_header_bypass granted', { requestId: req.requestId ?? null, userId: req.user?.id });
  // For E2E runs, allow the bypass to elevate to platform admin so test harnesses
  // can exercise admin-only endpoints. This is strictly guarded by E2E_TEST_MODE.
  return grantAdminAccess(req, 'e2e_header_bypass', { elevatePlatformAdmin: true });
    }
  } catch (e) {
    // Defensive: don't let any header-parsing error block normal flow.
    console.warn('[requireAdminAccess] e2e_header_bypass_check_failed', { err: e?.message || e });
  }
  if (isProduction && (fallbackFlagEnabled(process.env.DEV_FALLBACK) || fallbackFlagEnabled(process.env.DEMO_MODE) || fallbackFlagEnabled(process.env.E2E_TEST_MODE))) {
    console.error('[requireAdminAccess] FALLBACK_MODE_NOT_ALLOWED_IN_PRODUCTION', {
      DEV_FALLBACK: process.env.DEV_FALLBACK,
      DEMO_MODE: process.env.DEMO_MODE,
      E2E_TEST_MODE: process.env.E2E_TEST_MODE,
    });
    res.status(500).json({
      code: 'FALLBACK_MODE_NOT_ALLOWED_IN_PRODUCTION',
      error: 'Invalid configuration',
      message: 'Fallback modes are not allowed in production.',
    });
    return false;
  }

  const safeFallbackEnabled = !isProduction && fallbackFlagEnabled(process.env.E2E_TEST_MODE);
  console.log('[requireAdminAccess] safeFallbackEnabled', { safeFallbackEnabled, supabaseJwtUser: req?.supabaseJwtUser });

  if (safeFallbackEnabled) {
    // In E2E mode, bypass external allowlist lookups, but DO NOT elevate to platform-admin.
    // Preserve the org scope embedded in the token so cross-org operations still enforce correctly.
    req.supabaseJwtUser = req.supabaseJwtUser || { ...FALLBACK_SUPERUSER };
    req.user = req.user || req.supabaseJwtUser;

    // If an X-Org-Id header / body org is present, ensure membership shape exists so
    // requireOrgAccess and related checks can validate organization scope in E2E mode.
    try {
      const headerOrg = (req.get && (req.get('X-Org-Id') || req.get('x-org-id'))) || req.headers['x-org-id'] || req.query?.orgId || req.query?.organizationId || req.body?.orgId || req.body?.organization_id || null;
      const resolvedOrg = headerOrg || req.user?.organization_id || req.user?.org_id || null;
      if (resolvedOrg) {
        req.user.memberships = req.user.memberships || [];
        if (!req.user.memberships.find((m) => String(m.orgId || m.organizationId || m.org_id) === String(resolvedOrg))) {
          req.user.memberships.push({ orgId: resolvedOrg, role: 'admin', status: 'active' });
        }
        req.user.organizationIds = req.user.organizationIds || [];
        if (!req.user.organizationIds.includes(resolvedOrg)) req.user.organizationIds.push(resolvedOrg);
        req.activeOrgId = req.activeOrgId || resolvedOrg;
      }
    } catch (e) {}

    const role = String(req.user?.role || '').trim().toLowerCase();
    const platformRole = String(req.user?.platformRole || '').trim().toLowerCase();
    const isAdmin = role === 'admin' || platformRole === 'platform_admin' || req.user?.isPlatformAdmin === true;

    if (!isAdmin) {
      res.status(403).json({
        code: 'ADMIN_REQUIRED',
        error: 'Forbidden',
        message: 'Administrator privileges required.',
        reason: 'e2e_admin_required',
      });
      return false;
    }

    console.log('[requireAdminAccess] granted e2e_fallback', { userId: req.user?.id });
    return grantAdminAccess(req, 'e2e_fallback', { elevatePlatformAdmin: false });
  }

  const user = req.supabaseJwtUser;
  if (!user?.id) {
    console.warn('[requireAdminAccess] auth_required_missing_user_id', {
      requestId: req.requestId ?? null,
      userId: null,
      email: req?.supabaseJwtUser?.email ?? null,
    });
    res.status(401).json({
      code: 'AUTH_REQUIRED',
      error: 'Authentication required',
      message: 'Supabase session missing user id.',
    });
    return false;
  }

  req.user = req.user || req.supabaseJwtUser;

  if (isLocalDebugAdminToken(req)) {
    console.info('[requireAdminAccess] local_debug_admin_token', {
      requestId: req.requestId ?? null,
      userId: user.id,
      email: user.email ?? null,
    });
    return grantAdminAccess(req, 'local_debug_admin_token');
  }

  // Strong admin checks derived from authoritative DB data.
  // 1) allowlist email
  const normalizedEmail = user.email ? user.email.trim().toLowerCase() : null;
  if (normalizedEmail && isAllowlistedAdminEmail(normalizedEmail)) {
    console.info('[requireAdminAccess] allowlisted_admin_email', { userId: user.id, email: normalizedEmail });
    return grantAdminAccess(req, 'allowlisted_email');
  }

  // 2) admin_users lookup
  const { entry: allowlistEntry, error: allowlistError } = await fetchAdminAllowlistEntry(user.id, user.email, { requestId: req.requestId ?? null });
  if (allowlistError) {
    if (allowlistError.message === 'SUPABASE_NOT_CONFIGURED') {
      console.error('[requireAdminAccess] supabase_not_configured', {
        requestId: req.requestId ?? null,
        userId: user.id,
        email: user.email ?? null,
      });
      res.status(503).json({
        code: 'SUPABASE_NOT_CONFIGURED',
        error: 'Service unavailable',
        message: 'Supabase service role client is not configured.',
      });
      return false;
    }
    throw allowlistError;
  }
  if (allowlistEntry) {
    return grantAdminAccess(req, 'allowlist', { allowlistEntry });
  }

  // 3) user_profiles is_admin check
  if (!supabase) {
    console.error('[requireAdminAccess] supabase_not_configured', {
      requestId: req.requestId ?? null,
      userId: user.id,
      email: user.email ?? null,
    });
    res.status(503).json({
      code: 'SUPABASE_NOT_CONFIGURED',
      error: 'Service unavailable',
      message: 'Supabase service role client is not configured.',
    });
    return false;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('is_admin, role')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const normalizedProfileRole = data?.role ? String(data.role).trim().toLowerCase() : null;
  if (data?.is_admin === true || normalizedProfileRole === 'admin' || normalizedProfileRole === 'platform_admin') {
    console.info('[requireAdminAccess] profile_flag_passed', {
      requestId: req.requestId ?? null,
      userId: user.id,
      email: user.email ?? null,
      role: normalizedProfileRole,
      is_admin: data?.is_admin === true,
    });
    return grantAdminAccess(req, 'profile_flag');
  }

  req.adminPortalAllowed = false;
  req.adminPortalDeniedReason = 'not_allowlisted';
  console.warn('[admin-auth] deny_reason', {
    requestId: req.requestId ?? null,
    userId: user.id ?? null,
    email: user.email ?? null,
    platformRole: user.platformRole ?? null,
    isPlatformAdmin: user.isPlatformAdmin ?? null,
    reason: 'not_allowlisted',
  });
  res.status(403).json({
    code: 'ADMIN_REQUIRED',
    error: 'Forbidden',
    message: 'Administrator privileges required. Ask an existing admin to add you to admin_users allowlist.',
    reason: 'not_allowlisted',
  });
  return false;
};

const requireAdminAccess = [
  supabaseJwtMiddleware,
  async (req, res, next) => {
    const allowed = await ensureAdminAccess(req, res);
    if (!allowed) {
      return;
    }
    next();
  },
];

export default requireAdminAccess;
export { ensureAdminAccess };
