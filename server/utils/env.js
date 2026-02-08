import dotenv from 'dotenv';

dotenv.config();

const parseBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

const parseNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const getString = (key, fallback = '') => {
  const value = process.env[key];
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

export const env = {
  NODE_ENV: getString('NODE_ENV', 'development'),
  PORT: parseNumber(getString('PORT', ''), 8888),
  DEV_FALLBACK: parseBoolean(process.env.DEV_FALLBACK, false),
  DEMO_MODE: parseBoolean(process.env.DEMO_MODE, false),
  E2E_TEST_MODE: parseBoolean(process.env.E2E_TEST_MODE, false),
  SUPABASE_URL: getString('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: getString('SUPABASE_SERVICE_ROLE_KEY') || getString('SUPABASE_SERVICE_KEY'),
  SUPABASE_ANON_KEY: getString('SUPABASE_ANON_KEY'),
  JWT_SECRET: getString('JWT_SECRET'),
  JWT_EXPIRES_IN: getString('JWT_EXPIRES_IN', '15m'),
  REFRESH_TOKEN_EXPIRES_IN: getString('REFRESH_TOKEN_EXPIRES_IN', '7d'),
  CORS_ALLOWED_ORIGINS: getString(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5174,http://localhost:5175,http://127.0.0.1:5174,http://127.0.0.1:5175',
  ),
  DATABASE_URL: getString('DATABASE_URL'),
  COOKIE_DOMAIN: getString('COOKIE_DOMAIN'),
  BROADCAST_API_KEY: getString('BROADCAST_API_KEY'),
};

export default env;
