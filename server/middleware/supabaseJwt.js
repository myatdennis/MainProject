import { createRemoteJWKSet, jwtVerify } from 'jose';
import { LRUCache } from 'lru-cache';
import { extractTokenFromHeader } from '../utils/jwt.js';

const JWT_AUTH_BYPASS_PATHS = ['/api/health', '/api/auth/login', '/api/auth/refresh'];
const DEV_FALLBACK_ENABLED = String(process.env.DEV_FALLBACK || '').toLowerCase() === 'true';
const E2E_MODE = String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true';
const DEFAULT_SUPABASE_PROJECT_URL = 'https://eprsgmfzqjptfywoecuy.supabase.co';
const rawSupabaseBaseUrl = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_PROJECT_URL).trim() || DEFAULT_SUPABASE_PROJECT_URL;

const buildSupabaseUrl = (path) => {
  try {
    return new URL(path, rawSupabaseBaseUrl);
  } catch (error) {
    throw new Error(
      `[supabaseJwt] Invalid SUPABASE_URL "${rawSupabaseBaseUrl}". ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const SUPABASE_JWKS_URL = new URL('/auth/v1/.well-known/jwks.json', rawSupabaseBaseUrl);
const SUPABASE_EXPECTED_ISSUER = new URL('/auth/v1', rawSupabaseBaseUrl).toString().replace(/\/+$/, '');
console.log('[JWT] JWKS URL:', SUPABASE_JWKS_URL.toString());

const hasCustomIssuerConfig = true;
const AUDIENCE = 'authenticated';
const JWKS_CACHE_TTL_MS = Number(process.env.SUPABASE_JWKS_CACHE_MS || 6 * 60 * 60 * 1000);
const jwksCache = new LRUCache({
  max: 1,
  ttl: JWKS_CACHE_TTL_MS,
});
const JWKS_CACHE_KEY = 'remote_jwks';
const getRemoteJwks = () => {
  const cached = jwksCache.get(JWKS_CACHE_KEY);
  if (cached) return cached;
  const client = createRemoteJWKSet(SUPABASE_JWKS_URL);
  jwksCache.set(JWKS_CACHE_KEY, client);
  return client;
};

const shouldBypass = (path = '') => JWT_AUTH_BYPASS_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const resolveTokenFromRequest = (req) => {
  const headerToken = extractTokenFromHeader(req.headers?.authorization);
  if (headerToken) return headerToken;
  return null;
};

const mapClaimsToUser = (claims) => ({
  id: claims.sub,
  email: claims.email || claims.user_email || null,
  app_metadata: claims.app_metadata || {},
  user_metadata: claims.user_metadata || {},
  role: claims.role || claims?.app_metadata?.role || null,
});

const verifySupabaseToken = async (token) => {
  try {
    const remoteJwks = getRemoteJwks();
    const { payload } = await jwtVerify(token, remoteJwks, {
      algorithms: ['RS256'],
      audience: AUDIENCE,
      issuer: SUPABASE_EXPECTED_ISSUER,
      clockTolerance: 5,
    });
    if (!payload || !payload.sub) {
      throw new Error('invalid_payload');
    }
    return payload;
  } catch (error) {
    if (error?.code && String(error.code).startsWith('ERR_JWKS')) {
      jwksCache.delete(JWKS_CACHE_KEY);
      console.error('[supabaseJwt] JWKS verification failed', {
        message: error.message,
        code: error.code,
      });
    }
    throw error;
  }
};

const shouldSkipAuthInDev = (DEV_FALLBACK_ENABLED || E2E_MODE) && !hasCustomIssuerConfig;

export default async function supabaseJwtMiddleware(req, res, next) {
  if (shouldBypass(req.path || req.originalUrl || '')) {
    return next();
  }

  if (shouldSkipAuthInDev) {
    return next();
  }

  const token = resolveTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'No bearer token provided in the Authorization header',
    });
  }

  try {
    const claims = await verifySupabaseToken(token);
    req.supabaseJwtClaims = claims;
    req.supabaseJwtUser = mapClaimsToUser(claims);
    req.supabaseJwtToken = token;
    return next();
  } catch (error) {
    const code = error?.message || 'token_verification_failed';
    console.warn('[supabaseJwt] token validation failed', code);
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Invalid or expired token',
    });
  }
}
