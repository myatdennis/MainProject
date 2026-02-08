/**
 * Supabase Client for Server
 * Server-side Supabase client configuration
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

const supabaseAuthClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/**
 * Lightweight, non-secret diagnostics used by health routes.
 * Never include raw keys here.
 */
let urlHost = null;
try {
  urlHost = supabaseUrl ? new URL(supabaseUrl).host : null;
} catch {
  urlHost = null;
}

export const supabaseEnv = {
  configured: Boolean(supabaseUrl && (supabaseServiceKey || supabaseAnonKey)),
  urlConfigured: Boolean(supabaseUrl),
  urlHost,
  hasServiceRoleKey: Boolean(supabaseServiceKey),
  hasAnonKey: Boolean(supabaseAnonKey),
};

export default supabase;
export { supabaseAuthClient };

export function isSupabaseConfigured() {
  return supabase !== null;
}

export function isSupabaseAuthConfigured() {
  return supabaseAuthClient !== null;
}
