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

  if (!supabase) {
    res.status(503).json({
      code: 'SUPABASE_NOT_CONFIGURED',
      error: 'Service unavailable',
      message: 'Supabase service role client is not configured.',
    });
    return false;
  }

  try {
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
