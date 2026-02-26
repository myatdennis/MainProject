import { createRemoteJWKSet, jwtVerify } from 'jose';
import { extractTokenFromHeader } from '../utils/jwt.js';

const JWT_AUTH_BYPASS_PATHS = ['/api/health', '/api/auth/login', '/api/auth/refresh'];
const DEV_FALLBACK_ENABLED = String(process.env.DEV_FALLBACK || '').toLowerCase() === 'true';
const E2E_MODE = String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true';
const rawSupabaseBaseUrl = (process.env.SUPABASE_URL || '').trim();
if (!rawSupabaseBaseUrl) {
  throw new Error('[supabaseJwt] SUPABASE_URL environment variable is required for JWT validation.');
}

const buildSupabaseUrl = (path) => {
  try {
    return new URL(path, rawSupabaseBaseUrl);
  } catch (error) {
    throw new Error(
      `[supabaseJwt] Invalid SUPABASE_URL "${rawSupabaseBaseUrl}". ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const SUPABASE_JWKS_URL = buildSupabaseUrl('/auth/v1/.well-known/jwks.json');
const SUPABASE_EXPECTED_ISSUER = buildSupabaseUrl('/auth/v1').toString().replace(/\/+$/, '');
console.log('[JWT] JWKS URL:', SUPABASE_JWKS_URL.toString());

const hasCustomIssuerConfig = true;
const AUDIENCE = 'authenticated';
const remoteJwks = createRemoteJWKSet(SUPABASE_JWKS_URL);

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
