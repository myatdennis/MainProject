import cookieParser from 'cookie-parser';
import { createClient } from '@supabase/supabase-js';
import { finalizeUser } from '../lib/finalizeUser.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export async function authenticate(req, res, next) {
  try {
    // CRITICAL:
    // This middleware MUST NOT overwrite an existing req.user.
    // req.user may be set upstream (e.g., E2E bypass or future integrations).
    if (req.user) {
      // CRITICAL: do not overwrite existing req.user; preserve silently.
      return next();
    }

    const token =
      req.cookies?.access_token ||
      req.cookies?.['sb-access-token'] ||
      (req.headers.authorization || '').replace('Bearer ', '');

    if (!token) {
      return next(); // DO NOT set req.user = null
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AUTH FAIL]', error?.message);
      }
      return next(); // DO NOT clear req.user
    }

    const user = data.user;

    req.user = finalizeUser({
      id: user.id,
      email: user.email,
      role: user.app_metadata?.role || 'user',
      platformRole: user.app_metadata?.platform_role || null,
      isPlatformAdmin: user.app_metadata?.platform_role === 'platform_admin'
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('[AUTH SUCCESS]', req.user.id);
    }

    // req.user finalization (freeze) is handled by finalizeUser

    return next();

  } catch (err) {
    console.error('[AUTH ERROR]', err);
    return next();
  }
}
