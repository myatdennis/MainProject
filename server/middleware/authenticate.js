import cookieParser from 'cookie-parser';
import { finalizeUser } from '../lib/finalizeUser.js';
import { supabaseAuthClient, createSupabaseClientForToken, setRequestSupabaseClient } from '../lib/supabaseClient.js';

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

    // Prefer the centralized auth client. It may be unavailable in some test modes.
    const authClient = supabaseAuthClient || null;
    let data = null;
    let error = null;
    if (authClient && typeof authClient.auth?.getUser === 'function') {
      const result = await authClient.auth.getUser(token);
      data = result?.data || null;
      error = result?.error || null;
    } else {
      // Fallback: if centralized auth client is not configured, attempt to
      // create a per-request client for token introspection.
      try {
        const probe = createSupabaseClientForToken(token);
        if (probe && typeof probe.auth?.getUser === 'function') {
          const result = await probe.auth.getUser(token);
          data = result?.data || null;
          error = result?.error || null;
        }
      } catch (e) {
        error = e;
      }
    }

    if (error || !data?.user) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AUTH FAIL]', error?.message);
      }
      return next(); // DO NOT clear req.user
    }

    const user = data.user;

    // Bind a per-request supabase client (with Authorization header) so
    // downstream handlers use the user's JWT for RLS-bound reads.
    try {
      const perReqClient = createSupabaseClientForToken(token);
      if (perReqClient) setRequestSupabaseClient(perReqClient);
    } catch (e) {
      // non-fatal; continue without binding
      console.warn('[AUTH] failed to bind per-request supabase client', e?.message || e);
    }

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
