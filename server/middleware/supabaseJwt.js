import { createClient } from '@supabase/supabase-js';
import { extractTokenFromHeader } from '../utils/jwt.js';

const JWT_AUTH_BYPASS_PATHS = ['/api/auth/login', '/api/auth/logout', '/api/auth/health', '/api/health'];
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabasePublicClient =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const isDev = (process.env.NODE_ENV || '').toLowerCase() !== 'production';

const resolveTokenFromRequest = (req) => {
  const headerToken = extractTokenFromHeader(req.headers?.authorization);
<<<<<<< HEAD
  if (headerToken) return headerToken;
  const cookieToken = getAccessTokenFromRequest(req);
  if (cookieToken) return cookieToken;
=======
  if (headerToken) {
    return headerToken;
  }
>>>>>>> 43edcac (fadfdsa)
  return null;
};

export async function supabaseJwtMiddleware(req, res, next) {
<<<<<<< HEAD
  const originalUrl = req.originalUrl || req.url || '';
  if (JWT_AUTH_BYPASS_PATHS.some((prefix) => originalUrl.startsWith(prefix))) {
    return next();
  }
=======
  try {
    const token = resolveTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No bearer token provided in the Authorization header',
      });
    }

    const claims = await verifySupabaseJwt(token);
    req.supabaseJwtClaims = claims;
    req.supabaseJwtToken = token;
    const user = buildUserFromClaims(claims);
    req.user = user;
    return next();
  } catch (error) {
    if (error?.code === 'missing_token') {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No bearer token provided in the Authorization header',
      });
    }
>>>>>>> 43edcac (fadfdsa)

  if (!supabasePublicClient) {
    const devFallbackEnabled = String(process.env.DEV_FALLBACK || '').toLowerCase() === 'true';
    const e2eMode = String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true';
    if (devFallbackEnabled || e2eMode) {
      return next();
    }
    console.error('[supabaseJwt] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return res.status(503).json({
      error: 'auth_unavailable',
      message: 'Authentication service not configured',
    });
  }

  const token = resolveTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'No token provided (header or cookie)',
    });
  }

  try {
    const { data, error } = await supabasePublicClient.auth.getUser(token);
    if (isDev) {
      console.log('Auth check', { hasToken: Boolean(token), success: Boolean(data?.user) });
    }
    if (error || !data?.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Invalid or expired token',
      });
    }
    req.user = data.user;
    req.supabaseJwtUser = data.user;
    req.supabaseJwtToken = token;
    return next();
  } catch (error) {
    console.error('[supabaseJwt] token validation failed', error?.message || error);
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Invalid or expired token',
    });
  }
}

export default supabaseJwtMiddleware;
