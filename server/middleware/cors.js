import cors from 'cors';

const DEFAULT_ORIGINS = [
  'https://the-huddle.co',
  'https://www.the-huddle.co',
  'https://api.the-huddle.co',
  'http://localhost:5173',
];

// Merge env safely (optional override)
function getAllowedOrigins() {
  const env = process.env.CORS_ALLOWED_ORIGINS;
  if (!env) return DEFAULT_ORIGINS;
  const parsed = env
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o && !o.includes('*'));
  return [...new Set([...DEFAULT_ORIGINS, ...parsed])];
}

const allowedOrigins = getAllowedOrigins();

// Named exports for legacy consumers/tests
export const resolvedCorsOrigins = allowedOrigins;

export const corsAllowedHeaders = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'X-Org-Id',
  'X-Organization-Id',
  'X-User-Role',
  'X-User-Id',
  'X-Runtime-Status',
  'X-CSRF-Token',
  'X-Request-Id',
  '__authsource',
];

export function resolveCorsOriginDecision(origin) {
  if (!origin) return { allowed: false, reason: 'missing_origin', resolvedOrigin: null };
  if (allowedOrigins.includes(origin)) {
    return { allowed: true, reason: 'allowlist', resolvedOrigin: origin };
  }
  // Allow Netlify preview origins during local development for convenience
  if (process.env.NODE_ENV !== 'production' && /netlify\.app$/i.test(origin)) {
    return { allowed: true, reason: 'netlify_preview', resolvedOrigin: origin };
  }
  return { allowed: false, reason: 'not_allowlisted', resolvedOrigin: null };
}

function originHandler(origin, callback) {
  if (!origin) return callback(null, true); // allow curl/postman
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error('CORS origin not allowed: ' + origin));
}

const baseCors = cors({
  origin: originHandler,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: corsAllowedHeaders,
  exposedHeaders: ['Set-Cookie'],
});

export const corsMiddleware = baseCors;

export function installCors(app) {
  app.use(corsMiddleware);
  app.options('*', corsMiddleware);
  console.log('[CORS] Active origins:', allowedOrigins);
}

export default installCors;
