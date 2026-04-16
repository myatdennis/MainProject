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

const ensureAdminAccess = async (req, res) => {
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
