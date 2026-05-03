import cookieParser from 'cookie-parser';
import { finalizeUser } from '../lib/finalizeUser.js';
import { supabaseAuthClient, createSupabaseClientForToken, setRequestSupabaseClient } from '../lib/supabaseClient.js';

const isDev = process.env.NODE_ENV !== 'production';

export async function authenticate(req, res, next) {
  try {
    if (isDev) {
      console.log('[AUTH START]', {
        hasAuthHeader: !!req.headers.authorization,
        hasCookie: !!req.cookies,
      });
      console.log('[AUTH CHECK]', {
        hasHeader: !!req.headers.authorization,
        hasCookie: !!req.cookies,
      });
    }

    // CRITICAL:
    // This middleware MUST NOT overwrite an existing req.user.
    // req.user may be set upstream (e.g., E2E bypass or future integrations).
    if (req.user) {
      if (isDev) {
        console.log('[AUTH RESULT]', {
          hasUser: true,
          userId: req.user?.id || req.user?.userId || null,
          preserved: true,
        });
      }
      return next();
    }

    const token =
      req.cookies?.access_token ||
      req.cookies?.['sb-access-token'] ||
      (req.headers.authorization || '').replace('Bearer ', '');

    if (!token) {
      console.warn('[AUTH MISSING TOKEN]', {
        path: req.originalUrl || req.url || null,
        hasHeader: !!req.headers.authorization,
      });
      if (isDev) {
        console.log('[AUTH RESULT]', {
          hasUser: false,
          userId: null,
        });
      }
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
      console.warn('[AUTH INVALID TOKEN]', {
        reason: error?.message || 'supabase_user_missing',
        path: req.originalUrl || req.url || null,
      });
      if (isDev) {
        console.log('[AUTH RESULT]', {
          hasUser: false,
          userId: null,
        });
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
      userId: user.id,
      email: user.email,
      role: user.app_metadata?.role || 'user',
      platformRole: user.app_metadata?.platform_role || null,
      isPlatformAdmin: user.app_metadata?.platform_role === 'platform_admin'
    });

    if (isDev) {
      console.log('[AUTH TOKEN]', {
        hasUser: !!req.user,
        userId: req.user?.id,
      });
      console.log('[AUTH RESULT]', {
        hasUser: !!req.user,
        userId: req.user?.id || req.user?.userId || null,
      });
      console.log('[AUTH SUCCESS]', req.user?.id || req.user?.userId || null);
    }

    // req.user finalization (freeze) is handled by finalizeUser

    return next();

  } catch (err) {
    console.error('[AUTH ERROR]', {
      reason: err?.message || String(err),
      path: req.originalUrl || req.url || null,
    });
    if (isDev) {
      console.log('[AUTH RESULT]', {
        hasUser: false,
        userId: null,
      });
    }
    return next();
  }
}
