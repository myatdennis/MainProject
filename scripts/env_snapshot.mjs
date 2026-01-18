import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const envFiles = ['.env', '.env.local', '.env.production', '.env.deploy'];
envFiles.forEach((file) => {
  const envPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
});

const normalizeList = (value) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const apiBase =
  process.env.API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  process.env.VITE_API_URL ||
  process.env.NETLIFY_DEPLOY_URL ||
  '(proxy via Netlify/dev server)';

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? normalizeList(process.env.CORS_ALLOWED_ORIGINS)
  : [];

const cookieDomain = process.env.COOKIE_DOMAIN || '(not set)';
const cookieSameSite = process.env.COOKIE_SAMESITE || '(default:lax)';
const cookieSecure = process.env.COOKIE_SECURE || '(auto)';

const hasSupabase =
  Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);
const hasDatabase = Boolean(process.env.DATABASE_URL);

const flags = await import('../server/config/runtimeFlags.js');
const demoDescription = flags.describeDemoMode();

const formatBool = (value) => (value ? 'yes' : 'no');

console.log('== Backend Environment Snapshot ==');
console.log(`NODE_ENV: ${process.env.NODE_ENV || '(not set)'}`);
console.log(`API base URL: ${apiBase}`);
console.log(`CORS allowed origins: ${allowedOrigins.length ? allowedOrigins.join(', ') : '(not set)'}`);
console.log(`Cookie domain: ${cookieDomain}`);
console.log(`Cookie sameSite: ${cookieSameSite}`);
console.log(`Cookie secure: ${cookieSecure}`);
console.log(`Demo mode enabled: ${formatBool(flags.demoLoginEnabled)}${demoDescription.enabled ? ` (source: ${demoDescription.source || 'unknown'})` : ''}`);
console.log(`Dev fallback: ${formatBool(flags.DEV_FALLBACK)}`);
console.log(`Supabase credentials present: ${formatBool(hasSupabase)}`);
console.log(`Database URL present: ${formatBool(hasDatabase)}`);
