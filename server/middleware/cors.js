import cors from 'cors';

const normalizeOrigins = (value = '') =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const NETLIFY_PREVIEW_REGEX = /^https:\/\/[a-z0-9-]+\.netlify\.app$/i;

const devDefaults = [
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://localhost:8888',
];
const requiredProdOrigins = ['https://the-huddle.co', 'https://www.the-huddle.co', 'https://app.the-huddle.co'];
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
    return true;
  }
  if (process.env.NODE_ENV === 'production' && NETLIFY_PREVIEW_REGEX.test(origin)) {
    return true;
  }
  if (!isProduction && isLocalDevOrigin(origin)) {
    return true;
  }
  return false;
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

export default cors(corsOptions);
