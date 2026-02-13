import cors from 'cors';

const normalizeOrigins = (value = '') =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const NETLIFY_PREVIEW_REGEX = /^https:\/\/[a-z0-9-]+--the-huddleco\.netlify\.app$/i;

const devDefaults = [
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://localhost:8888',
];

const requiredProdOrigins = [
  'https://the-huddle.co',
  'https://www.the-huddle.co',
  'https://app.the-huddle.co',
  'https://admin.the-huddle.co',
  'https://api.the-huddle.co',
];

const prodDefaults = requiredProdOrigins;

const envOrigins = normalizeOrigins(process.env.CORS_ALLOWED_ORIGINS || '');
const baseOrigins =
  envOrigins.length > 0 ? envOrigins : process.env.NODE_ENV === 'production' ? prodDefaults : devDefaults;

const resolved = new Set(baseOrigins);
if (process.env.NODE_ENV === 'production') {
  requiredProdOrigins.forEach((origin) => resolved.add(origin));
}

export const resolvedCorsOrigins = Array.from(resolved);

const isLocalDevOrigin = (origin) =>
  typeof origin === 'string' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';

if (!envOrigins.length) {
  console.warn(
    `[cors] CORS_ALLOWED_ORIGINS not set; using defaults: ${
      resolvedCorsOrigins.length ? resolvedCorsOrigins.join(', ') : '(none)'
    }`,
  );
}

const isAllowedOrigin = (origin) => {
  if (resolvedCorsOrigins.includes(origin)) {
    return { allowed: true, reason: 'explicit_allowlist' };
  }
  if (process.env.NODE_ENV === 'production' && NETLIFY_PREVIEW_REGEX.test(origin)) {
    return { allowed: true, reason: 'netlify_preview' };
  }
  if (!isProduction && isLocalDevOrigin(origin)) {
    return { allowed: true, reason: 'local_dev' };
  }
  return { allowed: false, reason: 'not_allowlisted' };
};

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

const baseCorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    const decision = isAllowedOrigin(origin);
    logOriginDecision(origin, decision);
    if (decision.allowed) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'X-Requested-With',
    'X-Org-Id',
    'X-Runtime-Status',
    'X-CSRF-Token',
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 204,
};

const healthCorsOptions = {
  ...baseCorsOptions,
  origin: true,
};

const corsMiddleware = (req, res, next) => {
  if (isHealthRequest(req)) {
    return cors(healthCorsOptions)(req, res, next);
  }
  return cors(baseCorsOptions)(req, res, next);
};

export default corsMiddleware;
