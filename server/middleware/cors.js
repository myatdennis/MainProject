import cors from 'cors';

const normalizeOrigins = (value = '') =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const devDefaults = ['http://localhost:5174', 'http://127.0.0.1:5174', 'http://localhost:8888'];
const prodDefaults = [process.env.NETLIFY_SITE_URL, process.env.DEPLOY_PRIME_URL]
  .filter(Boolean);

const envOrigins = normalizeOrigins(process.env.CORS_ALLOWED_ORIGINS || '');
export const resolvedCorsOrigins =
  envOrigins.length > 0
    ? envOrigins
    : (process.env.NODE_ENV === 'production' ? prodDefaults : devDefaults);

if (!envOrigins.length) {
  console.warn(
    `[cors] CORS_ALLOWED_ORIGINS not set; using defaults: ${
      resolvedCorsOrigins.length ? resolvedCorsOrigins.join(', ') : '(none)'
    }`,
  );
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (resolvedCorsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`[cors] Origin ${origin} is not allowed.`));
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

export default cors(corsOptions);
