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

const fetchAdminAllowlistEntry = async (userId, email) => {
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
    return { entry: null, error };
  }
  const entry = Array.isArray(data) && data.length > 0 ? data[0] : null;
  return { entry, error: null };
};

const ensureAdminAccess = async (req, res) => {
  if (DEV_FALLBACK || E2E_TEST_MODE) {
    req.supabaseJwtUser = req.supabaseJwtUser || { ...FALLBACK_SUPERUSER };
    req.adminPortalAllowed = true;
    return true;
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
    );
    if (allowlistError) {
      throw allowlistError;
    }
    if (allowlistEntry) {
      req.adminPortalAllowed = true;
      req.adminAllowlistEntry = allowlistEntry;
      return true;
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
      req.adminPortalAllowed = true;
      return true;
    }

    res.status(403).json({
      code: 'ADMIN_REQUIRED',
      error: 'Forbidden',
      message: 'Administrator privileges required.',
    });
    return false;
  } catch (err) {
    console.error('[requireAdminAccess] profile lookup failed', err);
    res.status(500).json({
      code: 'ADMIN_LOOKUP_FAILED',
      error: 'Internal Server Error',
      message: 'Unable to verify administrator privileges.',
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
