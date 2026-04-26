/**
 * Supabase Client for Server
 * Server-side Supabase client configuration
 */

import '../env/loadEnv.js';
import { createClient } from '@supabase/supabase-js';
import { AsyncLocalStorage } from 'async_hooks';

const configuredSupabaseUrl = process.env.SUPABASE_URL;
const configuredSupabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const configuredSupabaseAnonKey = process.env.SUPABASE_ANON_KEY;

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
    cachedAdminClient = createClient(url, key);
    cachedAdminSignature = signature;
  }
  return cachedAdminClient;
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
  return createClient(url, anonKey, { global: { headers } });
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

(async () => {
  try {
    const client = getSupabaseAdminClient();
    if (!client) throw new Error("Supabase client is not configured.");

    const { error } = await client
      .from('organizations')
      .select('id')
      .limit(1);
    if (error) {
      console.warn("⚠️ Supabase connection warning:", error.message);
      return;
    }

    console.log("✅ Supabase connected");
  } catch (err) {
    console.warn("⚠️ Supabase connection warning:", err?.message || err);
  }
})();
