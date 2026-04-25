/**
 * Supabase Client for Server
 * Server-side Supabase client configuration
 */

import '../env/loadEnv.js';
import { createClient } from '@supabase/supabase-js';

const configuredSupabaseUrl = process.env.SUPABASE_URL;
const configuredSupabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const configuredSupabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let cachedAdminClient = null;
let cachedAdminSignature = null;
let cachedUserClient = null;
let cachedUserSignature = null;

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

export default legacySupabaseClient;
export {
  legacySupabaseAuthClient as supabaseAuthClient,
  legacySupabaseAdminClient as supabaseAdminClient,
  legacySupabaseUserClient as supabaseUserClient,
};

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
