import supabaseJwtMiddleware from './supabaseJwt.js';
import supabase from '../lib/supabaseClient.js';
import { DEV_FALLBACK, E2E_TEST_MODE } from '../config/runtimeFlags.js';

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
  if (DEV_FALLBACK || E2E_TEST_MODE) {
    req.supabaseJwtUser = req.supabaseJwtUser || { ...FALLBACK_SUPERUSER };
    return grantAdminAccess(req, 'dev_fallback');
  }

  const user = req.supabaseJwtUser;
  if (!user?.id) {
    res.status(401).json({
      code: 'AUTH_REQUIRED',
      error: 'Authentication required',
      message: 'Supabase session missing user id.',
    });
    return false;
  }

  try {
    if (!supabase) {
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
      return grantAdminAccess(req, 'profile_flag');
    }

    req.adminPortalAllowed = false;
    req.adminPortalDeniedReason = 'not_allowlisted';
    console.warn('[requireAdminAccess] allowlist_and_profile_denied', {
      requestId: req.requestId ?? null,
      userId: user.id,
      email: user.email ?? null,
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
