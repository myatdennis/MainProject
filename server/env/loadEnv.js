import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Centralized env loader for server-side entrypoints and scripts.
// Loads .env.local then .env (if present) and performs guarded fail-fast
// checks for required environment variables in non-dev/non-demo runs.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const parseEnvFlag = (value) => ['true', '1', 'yes', 'y', 'on'].includes(String(value || '').trim().toLowerCase());

// Load .env.local first (developer override) and then fallback to .env
try {
  const localPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(localPath)) {
    const dotenv = await import('dotenv');
    dotenv.config({ path: localPath });
  }
} catch (e) {
  // ignore
}

try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const dotenv = await import('dotenv');
    dotenv.config({ path: envPath });
  }
} catch (e) {
  // ignore
}

// Minimal non-sensitive diagnostics (do NOT print secrets)
try {
  const isDev = (process.env.NODE_ENV || '').toLowerCase() !== 'production';
  const isDemo = parseEnvFlag(process.env.DEMO_MODE);
  const isE2E = parseEnvFlag(process.env.E2E_TEST_MODE);

  console.info('[env/loadEnv] loaded env sample', {
    nodeEnv: process.env.NODE_ENV || 'development',
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasDatabaseUrl: !!(
      process.env.DATABASE_POOLER_URL ||
      process.env.SUPABASE_DB_POOLER_URL ||
      process.env.SUPABASE_DB_URL ||
      process.env.DATABASE_URL
    ),
    allowDebugLogin: parseEnvFlag(process.env.ALLOW_DEBUG_LOGIN),
    demoMode: isDemo,
    e2eTestMode: isE2E,
  });

  // Fail-fast required vars for non-dev, non-demo, non-e2e runs
  const requiredWhenProd = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  if (!isDev && !isDemo && !isE2E) {
    const missing = requiredWhenProd.filter((k) => !process.env[k]);
    const hasDatabaseUrl = Boolean(
      process.env.DATABASE_POOLER_URL ||
        process.env.SUPABASE_DB_POOLER_URL ||
        process.env.SUPABASE_DB_URL ||
        process.env.DATABASE_URL
    );
    if (!hasDatabaseUrl) {
      missing.push('DATABASE_POOLER_URL | SUPABASE_DB_POOLER_URL | SUPABASE_DB_URL | DATABASE_URL');
    }
    if (missing.length) {
      console.error('[env/loadEnv] FATAL: missing required env vars for production: ', missing);
      // Exit so deployment does not start in a misconfigured state
      process.exit(1);
    }
  }
} catch (e) {
  // non-fatal
}

export default null;
