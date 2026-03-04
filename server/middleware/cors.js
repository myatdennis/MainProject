import cors from 'cors';

const normalizeOrigins = (value = '') =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const NETLIFY_PREVIEW_REGEX = /^https:\/\/[a-z0-9-]+--the-huddleco\.netlify\.app$/i;

const STATIC_ALLOWED_ORIGINS = ['https://the-huddle.co', 'https://www.the-huddle.co', 'http://localhost:5173'];
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

const resolveCorsOriginDecision = (origin) => {
  if (!origin) {
    return { allowed: false, reason: 'missing_origin', resolvedOrigin: null };
  }
  if (resolvedCorsOrigins.includes(origin)) {
    return { allowed: true, reason: 'allowlist', resolvedOrigin: origin };
  }
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production' && NETLIFY_PREVIEW_REGEX.test(origin)) {
    return { allowed: true, reason: 'netlify_preview', resolvedOrigin: origin };
  }
  if ((process.env.NODE_ENV || '').toLowerCase() !== 'production' && isLocalDevOrigin(origin)) {
    return { allowed: true, reason: 'local_dev', resolvedOrigin: origin };
  }
  return { allowed: false, reason: 'not_allowlisted', resolvedOrigin: null };
};

const isAllowedOrigin = (origin) => resolveCorsOriginDecision(origin);

const logOriginDecision = (origin, decision) => {
  if (!origin) return;
  const logger = (decision.allowed ? console.debug : console.warn).bind(console);
  logger('[cors] origin_check', {
    origin,
    allowed: decision.allowed,
    reason: decision.reason,
  });
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
  'X-User-Role',
  'X-User-Id',
  'X-Runtime-Status',
  'X-CSRF-Token',
  'x-org-id',
  'x-user-role',
  'x-user-id',
  'x-runtime-status',
  'x-csrf-token',
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
  credentials: true,
  allowedHeaders: allowHeaders,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 204,
};

const healthCorsOptions = {
  ...baseCorsOptions,
  origin: true,
};

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

const baseHandler = cors(baseCorsOptions);
const healthHandler = cors(healthCorsOptions);

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
export { resolveCorsOriginDecision };
