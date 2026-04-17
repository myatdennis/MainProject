import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import { LRUCache } from 'lru-cache';
import { extractTokenFromHeader, verifyAccessToken } from '../utils/jwt.js';
import { getAccessTokenFromRequest } from '../utils/authCookies.js';
import { syncUserProfileFlags } from './auth.js';
import { isAllowlistedAdminEmail } from './auth.js';
import { isProduction } from '../config/runtimeFlags.js';

const JWT_AUTH_BYPASS_PATHS = ['/health', '/auth/login', '/auth/refresh', '/audit-log', '/analytics', '/client/courses'];
const DEMO_MODE_ENABLED =
  String(process.env.DEMO_MODE || process.env.ALLOW_DEMO || process.env.DEV_FALLBACK || '').toLowerCase() === 'true';
const DEMO_AUTO_AUTH_ENABLED = String(process.env.DEMO_AUTO_AUTH || process.env.ALLOW_DEMO_AUTO_AUTH || '').toLowerCase() === 'true';
// In E2E test mode, requireAdminAccess provides its own fallback superuser.
// supabaseJwtMiddleware must not block token-less requests — it should call next()
// and let downstream middleware (requireAdminAccess.safeFallbackEnabled) handle auth.
const E2E_TEST_MODE_ACTIVE = String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true';
const rawSupabaseBaseUrl = (process.env.SUPABASE_URL || '').trim();
if (!rawSupabaseBaseUrl && !E2E_TEST_MODE_ACTIVE) {
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

// When SUPABASE_URL is absent (E2E-only env), use a safe placeholder to avoid
// URL constructor throws. JWKS validation is never reached in E2E mode.
const _effectiveSupabaseBaseUrl = rawSupabaseBaseUrl || 'http://localhost:54321';
const SUPABASE_JWKS_URL = new URL('/auth/v1/.well-known/jwks.json', _effectiveSupabaseBaseUrl);
const SUPABASE_EXPECTED_ISSUER = new URL('/auth/v1', _effectiveSupabaseBaseUrl).toString().replace(/\/+$/, '');
const SUPABASE_URL_HOST = (() => {
  try {
    return new URL(_effectiveSupabaseBaseUrl).host;
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

const jwtLog = (level, event, detail = {}) => {
  const logger = console[level] || console.log;
  logger(`[supabaseJwt] ${event}`, detail);
};

// Emit a single startup log so Railway logs always show the JWT config state.
// Never log the secret value itself.
jwtLog('info', 'startup_config', {
  ...getSupabaseJwtSecretDiagnostics(),
  expectedIssuer: SUPABASE_EXPECTED_ISSUER,
  jwksUrl: SUPABASE_JWKS_URL.toString(),
  hs256SecretConfigured: SUPABASE_JWT_SECRET_CONFIGURED,
  devFallbackEnabled: DEMO_MODE_ENABLED,
  e2eMode: DEMO_AUTO_AUTH_ENABLED,
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
    jwtLog('warn', 'issuer_mismatch', {
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

const hasRequestAuthToken = (req) => Boolean(extractTokenFromHeader(req.headers?.authorization));

const normalizePathForBypass = (path) => {
  if (!path || typeof path !== 'string') return '';
  const cleaned = path.trim().toLowerCase();
  if (cleaned.startsWith('/api/')) {
    return cleaned.slice(4); // '/api/admin/me' -> '/admin/me'
  }
  return cleaned;
};

const shouldBypass = (req) => {
  const path = normalizePathForBypass(req.path || '');
  const isBypassPath = JWT_AUTH_BYPASS_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (!isBypassPath) return false;
  // If an Authorization header is present, validate the token instead of bypassing.
  if (hasRequestAuthToken(req)) return false;
  return true;
};

const hasExplicitE2EBypassHeader = (req) =>
  String(req?.headers?.['x-e2e-bypass'] || '').trim().toLowerCase() === 'true' ||
  String(req?.headers?.['x-user-role'] || '').trim().length > 0;

const shouldBypassForE2ETokenlessRequest = (req) => {
  // If an Authorization token is present, prefer validating it.
  if (hasRequestAuthToken(req)) return false;

  // Allow explicit E2E bypass header locally (non-production) even when
  // the global E2E_TEST_MODE flag isn't set. This makes smoke scripts and
  // local test runners able to run without toggling E2E_TEST_MODE env var
  // (which is intentionally restricted when real Supabase creds are set).
  if (hasExplicitE2EBypassHeader(req) && (process.env.NODE_ENV || 'development') !== 'production') {
    return true;
  }

  if (!E2E_TEST_MODE_ACTIVE) return false;
  return hasExplicitE2EBypassHeader(req);
};

const resolveTokenFromRequest = (req) => {
  const headerToken = extractTokenFromHeader(req.headers?.authorization);
  if (headerToken) return headerToken;
  const cookieToken = getAccessTokenFromRequest(req);
  if (cookieToken) return cookieToken;
  return null;
};

const mapClaimsToUser = (claims) => {
  const appMetadata = claims.app_metadata || {};
  const userMetadata = claims.user_metadata || {};
  const email = claims.email || claims.user_email || null;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const allowlistedAdmin = isAllowlistedAdminEmail(normalizedEmail);
  const derivedRole =
    claims.role ||
    appMetadata.role ||
    userMetadata.role ||
    appMetadata.platform_role ||
    userMetadata.platform_role ||
    (allowlistedAdmin ? 'admin' : null);
  const platformRole =
    appMetadata.platform_role ||
    userMetadata.platform_role ||
    (allowlistedAdmin ? 'platform_admin' : null);
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
      String(platformRole || derivedRole || '').toLowerCase() === 'platform_admin' || allowlistedAdmin,
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
      jwtLog('error', 'jwks_fetch_failed', {
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

const shouldSkipAuthInDev = DEMO_MODE_ENABLED && DEMO_AUTO_AUTH_ENABLED;

const mapLocalClaimsToSupabaseClaims = (claims = {}) => {
  const platformRole = claims.platformRole || null;
  return {
    sub: claims.userId || claims.sub || null,
    email: claims.email || null,
    role: claims.role || null,
    app_metadata: {
      platform_role: platformRole,
      organization_ids: Array.isArray(claims.organizationIds) ? claims.organizationIds : [],
      memberships: Array.isArray(claims.memberships) ? claims.memberships : [],
      permissions: Array.isArray(claims.permissions) ? claims.permissions : [],
    },
    user_metadata: {},
    organization_ids: Array.isArray(claims.organizationIds) ? claims.organizationIds : [],
  };
};

export default async function supabaseJwtMiddleware(req, res, next) {
  const path = req.path || req.originalUrl || '';
  if (shouldBypass(req)) {
    if (!isProduction) {
      jwtLog('info', 'bypassing_auth', { path });
    }
    return next();
  }

  if (shouldSkipAuthInDev) {
    if (!isProduction) {
      jwtLog('info', 'dev_fallback_skip_auth', { path });
    }
    return next();
  }

  if (shouldBypassForE2ETokenlessRequest(req)) {
    if (!isProduction) {
      jwtLog('info', 'e2e_tokenless_bypass', {
        path,
        e2eBypass: String(req?.headers?.['x-e2e-bypass'] || '').trim().toLowerCase() === 'true',
        roleHeaderPresent: String(req?.headers?.['x-user-role'] || '').trim().length > 0,
      });
    }
    return next();
  }

  const token = resolveTokenFromRequest(req);
  if (!token) {
    jwtLog('warn', 'token_missing', { path });
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
    const isConfigError = code === 'supabase_jwt_secret_missing';

    if (!isProduction) {
      const localClaims = verifyAccessToken(token);
      if (localClaims && localClaims.userId) {
        jwtLog('warn', 'local_access_token_accepted_non_production', { path });
        const supabaseClaims = mapLocalClaimsToSupabaseClaims(localClaims);
        const supabaseUser = mapClaimsToUser(supabaseClaims);
        syncUserProfileFlags(supabaseUser);
        req.supabaseJwtUser = supabaseUser;
        req.supabaseJwtToken = token;
        if (!req.user) {
          req.user = supabaseUser;
        }
        return next();
      }
    }

    const isExpired =
      (error?.code === 'ERR_JWT_CLAIM_INVALID' && error?.claim === 'iss') ||
      String(error?.message || '').includes('exp claim timestamp check failed');

    if (isConfigError) {
      // Already logged inside getHs256SecretKey — no need to repeat here
    } else if (isExpired) {
      jwtLog('warn', 'token_expired', {
        code: 'token_expired',
        algorithm: (() => { try { return decodeProtectedHeader(token)?.alg; } catch { return 'unknown'; } })(),
        secretConfigured: SUPABASE_JWT_SECRET_CONFIGURED,
      });
    } else {
      jwtLog('warn', 'token_validation_failed', {
        code,
        algorithm: (() => { try { return decodeProtectedHeader(token)?.alg; } catch { return 'unknown'; } })(),
        secretConfigured: SUPABASE_JWT_SECRET_CONFIGURED,
      });
    }

    if (shouldSkipAuthInDev) {
      jwtLog('warn', 'dev_or_e2e_auth_fallthrough', { path, code });
      return next();
    }

    if (isExpired) {
      return res.status(401).json({
        error: 'token_expired',
        code: 'token_expired',
        message: 'Your session has expired. Please refresh your authentication token.',
      });
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
