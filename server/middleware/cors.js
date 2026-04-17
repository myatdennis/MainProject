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
    .map((entry) => entry.trim().replace(/\/+$/, '')) // strip trailing slashes
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
// Any subdomain of the-huddle.co (e.g. admin.the-huddle.co, app.the-huddle.co)
const THE_HUDDLE_SUBDOMAIN_REGEX = /^https:\/\/[a-z0-9-]+\.the-huddle\.co$/i;

const isPreviewAllowed = () => process.env.NODE_ENV !== 'production';

const STATIC_ALLOWED_ORIGINS = ['https://the-huddle.co', 'https://www.the-huddle.co', 'https://admin.the-huddle.co', 'http://localhost:5173', 'http://localhost:5174'];
const devDefaults = STATIC_ALLOWED_ORIGINS;
const requiredProdOrigins = ['https://the-huddle.co', 'https://www.the-huddle.co', 'https://admin.the-huddle.co'];
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
  typeof origin === 'string' && /^http:\/\/(localhost|127\.)/i.test(origin);

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
  // Strip trailing slashes.
  normalized = normalized.replace(/\/+$/, '');

  try {
    const url = new URL(normalized);
    const scheme = String(url.protocol).toLowerCase();
    const hostname = String(url.hostname).toLowerCase();
    const port = String(url.port || '');
    let host = hostname;

    if (port && !(scheme === 'https:' && port === '443') && !(scheme === 'http:' && port === '80')) {
      host = `${hostname}:${port}`;
    }

    return `${scheme}//${host}`;
  } catch {
    return normalized;
  }
};

const resolveCorsOriginDecision = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return { allowed: false, reason: 'missing_origin', resolvedOrigin: null };
  }

  const originWithoutDefaultPort = normalizedOrigin.replace(/:(443|80)$/i, '');

  const isAllowed =
    resolvedCorsOrigins.includes(normalizedOrigin) ||
    resolvedCorsOrigins.includes(originWithoutDefaultPort);

  if (isAllowed) {
    return { allowed: true, reason: 'allowlist', resolvedOrigin: originWithoutDefaultPort || normalizedOrigin };
  }

  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (!isProduction && isLocalDevOrigin(normalizedOrigin)) {
    return { allowed: true, reason: 'local_dev', resolvedOrigin: normalizedOrigin };
  }

  // Always allow any subdomain of the-huddle.co (e.g. admin, app, www, etc.)
  if (THE_HUDDLE_SUBDOMAIN_REGEX.test(normalizedOrigin)) {
    return { allowed: true, reason: 'huddle_subdomain', resolvedOrigin: normalizedOrigin };
  }

  if (isPreviewAllowed()) {
    if (NETLIFY_PREVIEW_REGEX.test(normalizedOrigin) || NETLIFY_ANY_PREVIEW_REGEX.test(normalizedOrigin)) {
      return { allowed: true, reason: 'netlify_preview', resolvedOrigin: normalizedOrigin };
    }
  }

  console.warn('[cors] rejecting_origin', { origin, normalizedOrigin, originWithoutDefaultPort, allowedOrigins: resolvedCorsOrigins });
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

// Build the allowed headers list dynamically so we can gate test-only headers
// (like X-E2E-Bypass) behind explicit environment flags.
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
  // Allow our E2E bypass header only when E2E_TEST_MODE is explicitly enabled
  // and never in production. This prevents accidental bypass surface exposure.
  ...(String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true' && (process.env.NODE_ENV || '').toLowerCase() !== 'production'
    ? ['X-E2E-Bypass', 'x-e2e-bypass']
    : []),
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
