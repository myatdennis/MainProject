import supabaseJwtMiddleware from './supabaseJwt.js';
import supabase from '../lib/supabaseClient.js';
import { isDemoMode, isProduction, isTestMode, isDevMode } from '../config/runtimeFlags.js';
import { isPlatformAdmin } from './auth.js';

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
  req.adminPortalAllowed = true;
  req.adminAccessReason = reason;
  if (meta.allowlistEntry) {
    req.adminAllowlistEntry = meta.allowlistEntry;
  }
  return true;
};

const ensureAdminAccess = async (req, res) => {
  console.log('[requireAdminAccess] start', {
    requestId: req.requestId ?? null,
    userId: req?.supabaseJwtUser?.id ?? null,
    email: req?.supabaseJwtUser?.email ?? null,
    userRole: req?.supabaseJwtUser?.role ?? null,
    platformRole: req?.supabaseJwtUser?.platformRole ?? null,
    isPlatformAdmin: req?.supabaseJwtUser?.isPlatformAdmin ?? null,
    isProduction,
    isDemoMode,
    isTestMode,
    path: req.originalUrl || req.url,
    method: req.method,
  });
  if (isProduction && isDemoMode) {
    console.error('[requireAdminAccess] fatal: demo mode active in production');
    res.status(500).json({
      code: 'INVALID_CONFIGURATION',
      error: 'Server configuration invalid',
      message: 'Demo/fallback authentication modes are not allowed in production.',
    });
    return false;
  }

  // In strictly test environment (unit tests), bypass fallback unless explicit E2E_TEST_MODE is set.
  const safeFallbackEnabled = !isProduction && (isDemoMode || isDevMode || isTestMode || process.env.E2E_TEST_MODE === 'true');
  console.log('[requireAdminAccess] safeFallbackEnabled', { safeFallbackEnabled, supabaseJwtUser: req?.supabaseJwtUser });
  if (safeFallbackEnabled) {
    req.supabaseJwtUser = req.supabaseJwtUser || { ...FALLBACK_SUPERUSER };
    req.supabaseJwtUser.isPlatformAdmin = true;
    req.user = req.user || req.supabaseJwtUser;
    console.log('[requireAdminAccess] granted dev_fallback', { userId: req.user?.id });
    return grantAdminAccess(req, 'dev_fallback');
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

  try {
    if (isPlatformAdmin(user)) {
      console.info('[admin-auth] platform_admin_access_check', {
        requestId: req.requestId ?? null,
        userId: user.id,
        email: user.email ?? null,
        platformRole: user.platformRole ?? null,
        identitySource: 'supabaseJwt',
      });
      return grantAdminAccess(req, 'platform_admin_profile');
    }

    // If platform admin via user_profiles is detected it is considered equal to full admin.
    if (req.user && isPlatformAdmin(req.user)) {
      console.info('[admin-auth] platform_admin_access_check', {
        requestId: req.requestId ?? null,
        userId: req.user.id ?? null,
        email: req.user.email ?? null,
        platformRole: req.user.platformRole ?? null,
        identitySource: 'user_payload',
      });
      return grantAdminAccess(req, 'platform_admin_profile');
    }

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

    const { entry: allowlistEntry, error: allowlistError } = await fetchAdminAllowlistEntry(
      user.id,
      user.email,
      { requestId: req.requestId ?? null },
    );
    if (allowlistError) {
      throw allowlistError;
    }
    if (allowlistEntry) {
      return grantAdminAccess(req, 'allowlist', { allowlistEntry });
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.is_admin === true) {
      console.info('[requireAdminAccess] profile_flag_passed', {
        requestId: req.requestId ?? null,
        userId: user.id,
        email: user.email ?? null,
        is_admin: true,
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
  } catch (err) {
    console.error('[requireAdminAccess] profile lookup failed', err);
    res.status(500).json({
      code: 'ADMIN_LOOKUP_FAILED',
      error: 'Internal Server Error',
      message: 'Unable to verify administrator privileges.',
      requestId: req.requestId ?? null,
    });
    return false;
  }
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
