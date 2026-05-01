/**
 * Supabase Client for Server
 * Server-side Supabase client configuration
 */

import '../env/loadEnv.js';
import { createClient } from '@supabase/supabase-js';
import { AsyncLocalStorage } from 'async_hooks';
// lightweight timeout wrapper to protect admin client calls from hanging
const withTimeoutMs = (promise, ms = 3000) => {
  if (!promise || typeof promise.then !== 'function') return promise;
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`supabase_call_timeout:${ms}ms`)), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]);
};

const wrapClientWithTimeout = (client, ms = Number(process.env.SUPABASE_CALL_TIMEOUT_MS || 3000)) => {
  if (!client || typeof client !== 'object') return client;
  return new Proxy(client, {
    get(target, prop) {
      const v = target[prop];
      if (typeof v === 'function') {
        return function wrapped(...args) {
          try {
            const result = v.apply(target, args);
            return withTimeoutMs(result, ms);
          } catch (err) {
            return Promise.reject(err);
          }
        };
      }
      return v;
    },
  });
};

const configuredSupabaseUrl = process.env.SUPABASE_URL;
const configuredSupabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const configuredSupabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const E2E_TEST_MODE_ACTIVE = String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true';
const TEST_RUNNER_ACTIVE = Boolean(process.env.VITEST || process.env.VITEST_WORKER_ID) || process.env.NODE_ENV === 'test';

// -----------------------
// Startup environment validation
// -----------------------
// In strict (non-test) runs we require real Supabase credentials. For
// E2E_TEST_MODE (local/CI test harnesses) we allow placeholder values so the
// server can start and synthesize users without hitting a real Supabase
// instance. This avoids accidental usage of production credentials in tests.
if (!E2E_TEST_MODE_ACTIVE && !TEST_RUNNER_ACTIVE) {
  const requiredEnv = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = requiredEnv.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error('[ENV ERROR] Missing required Supabase env vars:', missing);
    // Fail fast — do not continue running with invalid configuration
    process.exit(1);
  }

  function isValidSupabaseKey(key) {
    return typeof key === 'string' && key.startsWith('eyJ');
  }

  if (!isValidSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error('[ENV ERROR] Invalid SUPABASE_SERVICE_ROLE_KEY format');
    process.exit(1);
  }

  if (!isValidSupabaseKey(process.env.SUPABASE_ANON_KEY)) {
    console.error('[ENV ERROR] Invalid SUPABASE_ANON_KEY format');
    process.exit(1);
  }
}

// Safe diagnostics (no secrets)
let urlHostSafe = null;
try {
  urlHostSafe = configuredSupabaseUrl ? new URL(configuredSupabaseUrl).host : null;
} catch {
  urlHostSafe = null;
}
console.log('[SUPABASE CONFIG]', {
  urlHost: urlHostSafe,
  hasServiceKey: !!configuredSupabaseServiceKey,
  hasAnonKey: !!configuredSupabaseAnonKey,
});

let cachedAdminClient = null;
let cachedAdminSignature = null;
let cachedUserClient = null;
let cachedUserSignature = null;
// Per-request async storage so we can attach a user-scoped client that
// forwards the user's JWT to the DB (current_setting('request.jwt.claims')).
const requestAsyncLocalStorage = new AsyncLocalStorage();

export { requestAsyncLocalStorage };

const clientSignature = (url, key) => (url && key ? `${url}:${key.length}:${key.slice(0, 8)}` : null);

export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const signature = clientSignature(url, key);
  if (!signature) return null;
  if (!cachedAdminClient || cachedAdminSignature !== signature) {
    try {
      if (!key) {
        console.error('[SUPABASE ADMIN CLIENT] missing service role key');
      }
      // Create a non-persistent admin client — server should not persist
      // sessions or auto-refresh tokens using the service role key.
      cachedAdminClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      console.info('[SUPABASE ADMIN CLIENT] created');
    } catch (err) {
      console.error('[SUPABASE ADMIN CLIENT] creation failed', err?.message || err);
      throw err;
    }
    cachedAdminSignature = signature;
  }
  return wrapClientWithTimeout(cachedAdminClient);
}

/**
 * Return an admin client or throw a clear error when the service role key
 * is not available. Use this in code paths that must never silently proceed
 * without admin privileges.
 */
export function requireSupabaseAdminClient() {
  const client = getSupabaseAdminClient();
  if (!client) {
    const msg = 'SUPABASE_SERVICE_ROLE_KEY is not configured';
    console.error('[SUPABASE][FATAL]', msg);
    throw new Error(msg);
  }
  return client;
}

export function getSupabaseUserClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const signature = clientSignature(url, key);
  if (!signature) return null;
  if (!cachedUserClient || cachedUserSignature !== signature) {
    cachedUserClient = createClient(url, key);
    cachedUserSignature = signature;
  }
  return cachedUserClient;
}

export const getSupabaseAuthClient = getSupabaseUserClient;

const legacySupabaseAdminClient = getSupabaseAdminClient();

const legacySupabaseUserClient = getSupabaseUserClient();

const legacySupabaseClient = legacySupabaseAdminClient;
const legacySupabaseAuthClient = legacySupabaseUserClient;

/**
 * Lightweight, non-secret diagnostics used by health routes.
 * Never include raw keys here.
 */
let urlHost = null;
try {
  urlHost = configuredSupabaseUrl ? new URL(configuredSupabaseUrl).host : null;
} catch {
  urlHost = null;
}

export const supabaseEnv = {
  configured: Boolean(configuredSupabaseUrl && (configuredSupabaseServiceKey || configuredSupabaseAnonKey)),
  urlConfigured: Boolean(configuredSupabaseUrl),
  urlHost,
  hasServiceRoleKey: Boolean(configuredSupabaseServiceKey),
  hasAnonKey: Boolean(configuredSupabaseAnonKey),
};

export {
  legacySupabaseAuthClient as supabaseAuthClient,
  legacySupabaseAdminClient as supabaseAdminClient,
  legacySupabaseUserClient as supabaseUserClient,
};

/**
 * Create a Supabase client that will run with the provided user JWT.
 * Use the anon/public key as the client secret so RLS still applies,
 * but include the Authorization header so Postgres can read request.jwt.claims.
 */
export function createSupabaseClientForToken(token) {
  const url = configuredSupabaseUrl;
  const anonKey = configuredSupabaseAnonKey;
  if (!url || !anonKey) return null;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const client = createClient(url, anonKey, { global: { headers } });
    // Note: don't attempt any network operation here; creation is cheap.
    return client;
  } catch (err) {
    console.error('[SUPABASE REQUEST CLIENT] creation failed', err?.message || err);
    return null;
  }
}

/**
 * Store a per-request client on the AsyncLocalStorage store.
 * Call this from authentication middleware once the request's token is known.
 */
export function setRequestSupabaseClient(client) {
  const store = requestAsyncLocalStorage.getStore?.();
  if (store) store.supabase = client;
}

/**
 * Get the active supabase client for the current request.
 * Priority: request-bound client (with JWT) -> cached anon client -> cached admin client
 */
export function getActiveSupabaseClient() {
  const store = requestAsyncLocalStorage.getStore?.();
  if (store && store.supabase) return store.supabase;
  // Fallback to a shared anon client (no JWT)
  const anon = getSupabaseUserClient();
  if (anon) return anon;
  return getSupabaseAdminClient();
}

// Export a proxy as the default export so existing imports that do
// `import supabase from '../lib/supabaseClient.js'` continue to work.
const supabaseProxy = new Proxy({}, {
  get(_target, prop) {
    const client = getActiveSupabaseClient();
    if (!client) return undefined;
    const v = client[prop];
    return typeof v === 'function' ? v.bind(client) : v;
  },
  apply(_target, _thisArg, args) {
    const client = getActiveSupabaseClient();
    if (typeof client === 'function') return client.apply(_thisArg, args);
  },
});

export default supabaseProxy;

export function isSupabaseConfigured() {
  return getSupabaseAdminClient() !== null;
}

export function isSupabaseAuthConfigured() {
  return getSupabaseAuthClient() !== null;
}

// During E2E test mode we skip the startup DB verification so tests can spin
// up the server with placeholder values. In normal runs, verify DB access.
if (!E2E_TEST_MODE_ACTIVE && !TEST_RUNNER_ACTIVE) {
  (async () => {
    try {
      const client = getSupabaseAdminClient();
      if (!client) throw new Error("Supabase client is not configured.");
      const { data, error } = await client.from('organizations').select('id').limit(1);
      if (error) {
        console.error('[SUPABASE ERROR] Failed to connect:', error.message || error);
        return;
      }

      console.log('[SUPABASE] connection verified');
    } catch (err) {
      console.error('[SUPABASE ERROR] Failed to initialize Supabase client:', err?.message || err);
    }
  })();
} else {
  console.info('[SUPABASE] test/E2E mode active - skipping startup DB verification');
}
