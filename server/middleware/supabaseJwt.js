import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import { LRUCache } from 'lru-cache';
import { extractTokenFromHeader } from '../utils/jwt.js';
import { syncUserProfileFlags } from './auth.js';

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
const SUPABASE_URL_HOST = (() => {
  try {
    return new URL(rawSupabaseBaseUrl).host;
  } catch {
    return null;
  }
})();
const SUPABASE_JWT_SECRET = (process.env.SUPABASE_JWT_SECRET || '').trim();
const SUPABASE_JWT_SECRET_IS_PLACEHOLDER = SUPABASE_JWT_SECRET.startsWith('PASTE_');
const SUPABASE_JWT_SECRET_CONFIGURED = Boolean(SUPABASE_JWT_SECRET) && !SUPABASE_JWT_SECRET_IS_PLACEHOLDER;
const getSupabaseJwtSecretDiagnostics = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return {
    hasSupabaseJwtSecret: Boolean(SUPABASE_JWT_SECRET),
    isPlaceholder: SUPABASE_JWT_SECRET_IS_PLACEHOLDER,
    secretLength: SUPABASE_JWT_SECRET.length,
    nodeEnv,
    supabaseUrlHost: SUPABASE_URL_HOST || '(invalid)',
    activeVerificationMode: SUPABASE_JWT_SECRET_CONFIGURED ? 'hs256' : 'jwks_only',
  };
};

// Emit a single startup log so Railway logs always show the JWT config state.
// Never log the secret value itself.
console.log('[supabaseJwt] startup_config', {
  ...getSupabaseJwtSecretDiagnostics(),
  expectedIssuer: SUPABASE_EXPECTED_ISSUER,
  jwksUrl: SUPABASE_JWKS_URL.toString(),
  hs256SecretConfigured: SUPABASE_JWT_SECRET_CONFIGURED,
  devFallbackEnabled: DEV_FALLBACK_ENABLED,
  e2eMode: E2E_MODE,
});
let cachedHs256Secret;
const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

const hasCustomIssuerConfig = true;
const AUDIENCE = 'authenticated';
const JWKS_CACHE_TTL_MS = Number(process.env.SUPABASE_JWKS_CACHE_MS || 10 * 60 * 1000);
const jwksCache = new LRUCache({
  max: 1,
  ttl: JWKS_CACHE_TTL_MS,
});
const JWKS_CACHE_KEY = 'remote_jwks';
const getHs256SecretKey = () => {
  if (!SUPABASE_JWT_SECRET_CONFIGURED) {
    // Emit a loud server-side error so Railway/local logs surface the root cause.
    // This fires per-request (not just startup) so it's visible in Railway log tailing.
    console.error(
      '[supabaseJwt] FATAL CONFIG: SUPABASE_JWT_SECRET is not set or is still a placeholder. ' +
      'All HS256 token validation will fail with 401. ' +
      'Get the JWT secret from: Supabase Dashboard → Settings → API → JWT Settings → "JWT Secret" ' +
      'Then set SUPABASE_JWT_SECRET in Railway environment variables and REDEPLOY.'
    );
    throw new Error('supabase_jwt_secret_missing');
  }
  if (!cachedHs256Secret) {
    if (!textEncoder) {
      throw new Error('text_encoder_unavailable');
    }
    cachedHs256Secret = textEncoder.encode(SUPABASE_JWT_SECRET);
  }
  return cachedHs256Secret;
};
const getRemoteJwks = () => {
  const cached = jwksCache.get(JWKS_CACHE_KEY);
  if (cached) return cached;
  const client = createRemoteJWKSet(SUPABASE_JWKS_URL);
  jwksCache.set(JWKS_CACHE_KEY, client);
  return client;
};
const logIssuerMismatch = (error) => {
  if (error?.code === 'ERR_JWT_CLAIM_INVALID' && error?.claim === 'iss') {
    console.warn('[supabaseJwt] issuer_mismatch', {
      expected: SUPABASE_EXPECTED_ISSUER,
      received: error?.claimValue,
    });
  }
};
const ensureValidPayload = (payload) => {
  if (!payload || !payload.sub) {
    throw new Error('invalid_payload');
  }
  return payload;
};

const shouldBypass = (path = '') => JWT_AUTH_BYPASS_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const resolveTokenFromRequest = (req) => {
  const headerToken = extractTokenFromHeader(req.headers?.authorization);
  if (headerToken) return headerToken;
  return null;
};

const mapClaimsToUser = (claims) => {
  const appMetadata = claims.app_metadata || {};
  const userMetadata = claims.user_metadata || {};
  const derivedRole =
    claims.role ||
    appMetadata.role ||
    userMetadata.role ||
    appMetadata.platform_role ||
    userMetadata.platform_role ||
    null;
  const platformRole = appMetadata.platform_role || userMetadata.platform_role || null;
  const organizationIds = Array.isArray(appMetadata.organization_ids)
    ? appMetadata.organization_ids
    : Array.isArray(claims.organization_ids)
    ? claims.organization_ids
    : [];
  const memberships = Array.isArray(appMetadata.memberships) ? appMetadata.memberships : [];
  const permissions = Array.isArray(appMetadata.permissions) ? appMetadata.permissions : [];
  return {
    id: claims.sub,
    userId: claims.sub,
    email: claims.email || claims.user_email || null,
    role: derivedRole ? String(derivedRole).toLowerCase() : null,
    platformRole: platformRole ? String(platformRole).toLowerCase() : null,
    isPlatformAdmin:
      String(derivedRole || '').toLowerCase() === 'admin' ||
      String(platformRole || '').toLowerCase() === 'platform_admin',
    organizationIds,
    memberships,
    permissions,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
  };
};

const verifyHs256Token = async (token) => {
  try {
    const secretKey = getHs256SecretKey();
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
      audience: AUDIENCE,
      issuer: SUPABASE_EXPECTED_ISSUER,
      clockTolerance: 5,
    });
    return ensureValidPayload(payload);
  } catch (error) {
    logIssuerMismatch(error);
    throw error;
  }
};

const verifyAsymmetricToken = async (token, algorithm) => {
  try {
    const remoteJwks = getRemoteJwks();
    const { payload } = await jwtVerify(token, remoteJwks, {
      algorithms: [algorithm],
      audience: AUDIENCE,
      issuer: SUPABASE_EXPECTED_ISSUER,
      clockTolerance: 5,
    });
    return ensureValidPayload(payload);
  } catch (error) {
    logIssuerMismatch(error);
    if (error?.code && String(error.code).startsWith('ERR_JWKS')) {
      jwksCache.delete(JWKS_CACHE_KEY);
      console.error('[supabaseJwt] jwks_fetch_failed', {
        message: error.message,
        code: error.code,
      });
    }
    throw error;
  }
};

const getTokenAlgorithm = (token) => {
  try {
    const header = decodeProtectedHeader(token);
    return typeof header?.alg === 'string' ? header.alg : '';
  } catch (error) {
    console.warn('[supabaseJwt] token validation failed', 'header_decode_failed');
    throw error;
  }
};

const verifySupabaseToken = async (token) => {
  const alg = getTokenAlgorithm(token);
  const normalizedAlg = alg.toUpperCase();
  if (!normalizedAlg) {
    console.warn('[supabaseJwt] alg_mismatch', { alg: 'missing' });
    throw new Error('alg_missing');
  }
  if (normalizedAlg === 'NONE') {
    console.warn('[supabaseJwt] alg_mismatch', { alg: 'none' });
    throw new Error('alg_none_not_allowed');
  }
  if (normalizedAlg === 'HS256') {
    return verifyHs256Token(token);
  }
  if (normalizedAlg === 'RS256' || normalizedAlg === 'ES256') {
    return verifyAsymmetricToken(token, normalizedAlg);
  }
  console.warn('[supabaseJwt] alg_mismatch', { alg });
  throw new Error('alg_not_supported');
};

const shouldSkipAuthInDev = DEV_FALLBACK_ENABLED || E2E_MODE;

export default async function supabaseJwtMiddleware(req, res, next) {
  if (shouldBypass(req.path || req.originalUrl || '')) {
    return next();
  }

  if (shouldSkipAuthInDev) {
    return next();
  }

  const token = resolveTokenFromRequest(req);
  if (!token) {
    console.warn('[supabaseJwt] token_missing');
    return res.status(401).json({
      error: 'Authentication required',
      message: 'No bearer token provided in the Authorization header',
    });
  }

  try {
    const claims = await verifySupabaseToken(token);
    req.supabaseJwtClaims = claims;
    const supabaseUser = mapClaimsToUser(claims);
    syncUserProfileFlags(supabaseUser);
    req.supabaseJwtUser = supabaseUser;
    req.supabaseJwtToken = token;
    if (!req.user) {
      req.user = supabaseUser;
    }
    return next();
  } catch (error) {
    const code = error?.message || 'token_verification_failed';
    // Distinguish between config errors and invalid tokens to aid Railway log triage
    const isConfigError = code === 'supabase_jwt_secret_missing';
    if (isConfigError) {
      // Already logged inside getHs256SecretKey — no need to repeat here
    } else {
      console.warn('[supabaseJwt] token validation failed', {
        code,
        algorithm: (() => { try { return decodeProtectedHeader(token)?.alg; } catch { return 'unknown'; } })(),
        secretConfigured: SUPABASE_JWT_SECRET_CONFIGURED,
      });
    }
    // In E2E / dev-fallback mode, a token that fails JWT verification (e.g.
    // a synthetic "e2e-access-token" placeholder) must NOT cause an immediate
    // 401.  Instead we fall through to the authenticate middleware which has
    // its own demo-bypass logic (buildAuthContext / allowDemoBypassForRequest).
    // This keeps the two guards consistent: JWT pre-validation is optional in
    // dev/E2E; the real auth gate is always buildAuthContext.
    if (shouldSkipAuthInDev) {
      console.warn('[supabaseJwt] dev/E2E mode — falling through after token validation failure');
      return next();
    }
    return res.status(401).json({
      error: 'Authentication required',
      message: isConfigError
        ? 'Server authentication is not configured. Contact the administrator.'
        : 'Invalid or expired token',
    });
  }
}

export { verifySupabaseToken, SUPABASE_JWT_SECRET_CONFIGURED, getSupabaseJwtSecretDiagnostics };
