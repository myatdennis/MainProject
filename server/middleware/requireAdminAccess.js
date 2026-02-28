import supabaseJwtMiddleware from './supabaseJwt.js';
import supabase from '../lib/supabaseClient.js';

export default [
  supabaseJwtMiddleware,
  async (req, res, next) => {
    const user = req.supabaseJwtUser;
    if (!user?.id) {
      return res.status(401).json({
        code: 'AUTH_REQUIRED',
        error: 'Authentication required',
        message: 'Supabase session missing user id.',
      });
    }

    if (!supabase) {
      return res.status(503).json({
        code: 'SUPABASE_NOT_CONFIGURED',
        error: 'Service unavailable',
        message: 'Supabase service role client is not configured.',
      });
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
        return next();
      }

      return res.status(403).json({
        code: 'ADMIN_REQUIRED',
        error: 'Forbidden',
        message: 'Administrator privileges required.',
      });
    } catch (err) {
      console.error('[requireAdminAccess] profile lookup failed', err);
      return res.status(500).json({
        code: 'ADMIN_LOOKUP_FAILED',
        error: 'Internal Server Error',
        message: 'Unable to verify administrator privileges.',
      });
    }
  },
];
