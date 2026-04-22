import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Centralized env loader for server-side entrypoints and scripts.
// Loads .env.local then .env (if present) and performs guarded fail-fast
// checks for required environment variables in non-dev/non-demo runs.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local first (developer override) and then fallback to .env
try {
  const localPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(localPath)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dotenv = await import('dotenv');
    dotenv.config({ path: localPath });
  }
} catch (e) {
  // ignore
}

try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dotenv = await import('dotenv');
    dotenv.config({ path: envPath });
  }
} catch (e) {
  // ignore
}

// Minimal non-sensitive diagnostics (do NOT print secrets)
try {
  const isDev = (process.env.NODE_ENV || '').toLowerCase() !== 'production';
  const isDemo = String(process.env.DEMO_MODE || '').toLowerCase() === 'true';
  const isE2E = Boolean(process.env.E2E_TEST_MODE);

  console.info('[env/loadEnv] loaded env sample', {
    nodeEnv: process.env.NODE_ENV || 'development',
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    allowDebugLogin: String(process.env.ALLOW_DEBUG_LOGIN || '').toLowerCase() === 'true',
    demoMode: isDemo,
    e2eTestMode: isE2E,
  });

  // Fail-fast required vars for non-dev, non-demo, non-e2e runs
  const requiredWhenProd = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  if (!isDev && !isDemo && !isE2E) {
    const missing = requiredWhenProd.filter((k) => !process.env[k]);
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
