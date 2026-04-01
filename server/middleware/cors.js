import cors from 'cors';

const isHttpOrigin = (origin) => {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const normalizeOrigins = (value = '') =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((origin) => {
      // Silently discard wildcard glob patterns — they are not valid browser origins
      // and will never match the Origin header.  Netlify preview URLs are handled
      // separately by NETLIFY_PREVIEW_REGEX.
      if (origin.includes('*')) {
        return false;
      }
      if (isHttpOrigin(origin)) {
        return true;
      }
      console.warn('[cors] Ignoring invalid origin in CORS_ALLOWED_ORIGINS', { origin });
      return false;
    });

// Matches any Netlify deploy preview or branch deploy URL for this project.
// The pattern intentionally accepts any subdomain so PR previews and branch
// deploys don't require manual CORS allowlist updates.
const NETLIFY_PREVIEW_REGEX = /^https:\/\/[a-z0-9-]+--the-huddleco\.netlify\.app$/i;
// Broader fallback: any *.netlify.app origin is also allowed for previews.
const NETLIFY_ANY_PREVIEW_REGEX = /^https:\/\/[a-z0-9-]+\.netlify\.app$/i;

const STATIC_ALLOWED_ORIGINS = ['https://the-huddle.co', 'https://www.the-huddle.co', 'http://localhost:5173', 'http://localhost:5174'];
const devDefaults = STATIC_ALLOWED_ORIGINS;
const requiredProdOrigins = ['https://the-huddle.co', 'https://www.the-huddle.co'];
const prodDefaults = STATIC_ALLOWED_ORIGINS;

const envOrigins = normalizeOrigins(process.env.CORS_ALLOWED_ORIGINS || '');
const baseOrigins =
  envOrigins.length > 0 ? envOrigins : process.env.NODE_ENV === 'production' ? prodDefaults : devDefaults;

const resolved = new Set(baseOrigins);
if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
  requiredProdOrigins.forEach((origin) => resolved.add(origin));
}

export const resolvedCorsOrigins = Array.from(resolved);

const isLocalDevOrigin = (origin) =>
  typeof origin === 'string' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

if (!envOrigins.length) {
  console.warn(
    `[cors] CORS_ALLOWED_ORIGINS not set; using defaults: ${
      resolvedCorsOrigins.length ? resolvedCorsOrigins.join(', ') : '(none)'
    }`,
  );
}

const normalizeOrigin = (origin) => {
  if (!origin || typeof origin !== 'string') return '';
  let normalized = origin.trim();
  // Strip trailing slash, if present (browsers may include it in some edge cases
  // or proxies may canonicalize differently).
  normalized = normalized.replace(/\/+$/, '');
  if (!normalized) return '';
  try {
    const url = new URL(normalized);
    return `${url.protocol}//${url.host}`;
  } catch {
    return normalized;
  }
};

const resolveCorsOriginDecision = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return { allowed: false, reason: 'missing_origin', resolvedOrigin: null };
  }
  if (resolvedCorsOrigins.includes(normalizedOrigin)) {
    return { allowed: true, reason: 'allowlist', resolvedOrigin: normalizedOrigin };
  }
  // Allow all Netlify preview and branch-deploy URLs in all environments so PR
  // previews never hit CORS errors when calling the Railway API.
  if (NETLIFY_PREVIEW_REGEX.test(normalizedOrigin) || NETLIFY_ANY_PREVIEW_REGEX.test(normalizedOrigin)) {
    return { allowed: true, reason: 'netlify_preview', resolvedOrigin: normalizedOrigin };
  }
  if ((process.env.NODE_ENV || '').toLowerCase() !== 'production' && isLocalDevOrigin(normalizedOrigin)) {
    return { allowed: true, reason: 'local_dev', resolvedOrigin: normalizedOrigin };
  }
  return { allowed: false, reason: 'not_allowlisted', resolvedOrigin: null };
};

const isAllowedOrigin = (origin) => resolveCorsOriginDecision(origin);

const logOriginDecision = (origin, decision) => {
  if (!origin) return;
  // In production, skip logging allowed origins entirely — they are the overwhelmingly common
  // case and produce nothing actionable. Only log denials (potential mis-config or attacks).
  if (decision.allowed) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[cors] origin_check', { origin, allowed: true, reason: decision.reason });
    }
    return;
  }
  console.warn('[cors] origin_denied', { origin, reason: decision.reason });
};

const isHealthRequest = (req) => {
  const path = req?.path || req?.originalUrl || '';
  return typeof path === 'string' && path.startsWith('/api/health');
};

const allowHeaders = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'X-Org-Id',
  'X-Organization-Id',
  'X-User-Role',
  'X-User-Id',
  'X-Runtime-Status',
  'X-CSRF-Token',
  'x-org-id',
  'x-organization-id',
  'x-user-role',
  'x-user-id',
  'x-runtime-status',
  'x-csrf-token',
  'X-Request-Id',
  'x-request-id',
];

const setHeader = (res, key, value) => {
  if (typeof res.setHeader === 'function') {
    res.setHeader(key, value);
  } else if (typeof res.header === 'function') {
    res.header(key, value);
  } else {
    res[key] = value;
  }
};

const getHeader = (res, key) => {
  if (typeof res.getHeader === 'function') {
    return res.getHeader(key);
  }
  if (typeof res.get === 'function') {
    return res.get(key);
  }
  return undefined;
};

const ensureVaryOrigin = (res) => {
  const existing = getHeader(res, 'Vary');
  if (!existing) {
    setHeader(res, 'Vary', 'Origin');
    return;
  }
  const values = Array.isArray(existing)
    ? existing
    : String(existing)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
  if (!values.includes('Origin')) {
    values.push('Origin');
    setHeader(res, 'Vary', values.join(', '));
  }
};

const allowedMethodsHeader = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].join(', ');
const allowedHeadersHeader = allowHeaders.join(', ');

const appendCorsResponseHeaders = (req, res) => {
  ensureVaryOrigin(res);
  const origin = req?.headers?.origin;
  const decision = resolveCorsOriginDecision(origin);
  if (decision.allowed && decision.resolvedOrigin) {
    setHeader(res, 'Access-Control-Allow-Origin', decision.resolvedOrigin);
    setHeader(res, 'Access-Control-Allow-Credentials', 'true');
    setHeader(res, 'Access-Control-Expose-Headers', 'Content-Type, X-Request-Id, X-CSRF-Token, Set-Cookie');
  }
  return decision;
};

const baseCorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    const decision = resolveCorsOriginDecision(origin);
    logOriginDecision(origin, decision);
    if (decision.allowed) {
      return callback(null, decision.resolvedOrigin || origin);
    }
    return callback(null, false);
  },
  methods: allowedMethodsHeader,
  allowedHeaders: allowedHeadersHeader,
  exposedHeaders: 'Content-Type, X-Request-Id, X-CSRF-Token, Set-Cookie',
  credentials: true,
  optionsSuccessStatus: 200,
};

const baseHandler = cors(baseCorsOptions);
const healthHandler = cors({
  ...baseCorsOptions,
  origin: true,
});

const handlePreflight = (req, res, decision) => {
  if (req.method !== 'OPTIONS') {
    return false;
  }
  if (decision.allowed && decision.resolvedOrigin) {
    setHeader(res, 'Access-Control-Allow-Methods', allowedMethodsHeader);
    setHeader(res, 'Access-Control-Allow-Headers', allowedHeadersHeader);
    setHeader(res, 'Access-Control-Max-Age', '86400');
    res.status(204).end();
    return true;
  }
  res.status(403).json({
    ok: false,
    error: 'origin_not_allowed',
    message: 'The requested origin is not allowed.',
  });
  return true;
};

const corsMiddleware = (req, res, next) => {
  const decision = appendCorsResponseHeaders(req, res);

  if (decision.allowed === false && req.headers?.origin) {
    // For disallowed origins send consistent response (preflight handled separately)
    if (req.method === 'OPTIONS') {
      if (handlePreflight(req, res, decision)) {
        return;
      }
    } else {
      return res.status(403).json({
        ok: false,
        error: 'origin_not_allowed',
        message: 'The requested origin is not allowed.',
      });
    }
  }

  if (handlePreflight(req, res, decision)) {
    return;
  }

  if (isHealthRequest(req)) {
    return healthHandler(req, res, next);
  }

  return baseHandler(req, res, next);
};

export default corsMiddleware;
export { resolveCorsOriginDecision, allowHeaders as corsAllowedHeaders };
