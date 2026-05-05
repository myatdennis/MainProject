import { supabaseAuthClient } from '../lib/supabaseClient.js';

// Single-source-of-truth Supabase session middleware
export default async function supabaseSessionAuth(req, res, next) {
  try {
    const headerToken = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const cookieToken = (req.cookies?.access_token ?? req.cookies?.sb_access_token ?? '').trim();
    const token = headerToken || cookieToken || null;
    console.log('[AUTH SOURCE]', {
      hasBearer: Boolean(headerToken),
      hasCookie: Boolean(cookieToken),
      selected: headerToken ? 'bearer' : cookieToken ? 'cookie' : 'none',
    });

    if (!token) return next();

    if (!supabaseAuthClient || typeof supabaseAuthClient.auth?.getUser !== 'function') {
      // Supabase not configured; allow downstream to handle unauthenticated requests
      return next();
    }

    const { data, error } = await supabaseAuthClient.auth.getUser(token);
    if (error || !data?.user) {
      console.log('[AUTH FAIL]', error ? (error.message || error) : 'no user');
      return next();
    }

    // Attach validated supabase session data for authenticate() to consume.
  // Do NOT write legacy request-level user shapes here.
    req.authValidatedUser = {
      id: data.user.id,
      userId: data.user.id,
      email: data.user.email,
      role: (data.user?.role || 'user'),
      isPlatformAdmin: Boolean(data.user?.app_metadata?.platform_role === 'platform_admin'),
      app_metadata: data.user?.app_metadata || {},
    };
    req.supabaseJwtToken = token;
  console.log('[AUTH SUCCESS] authValidatedUser=', req.authValidatedUser.id);
    return next();
  } catch (err) {
    console.error('[AUTH ERROR]', err);
    return next();
  }
}
