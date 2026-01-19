/**
 * Supabase Client for Server
 * Server-side Supabase client configuration
 */

import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '../config/supabaseConfig.js';

// Server-side Supabase credentials should use service role key for database access
// and anon key for end-user authentication flows so Supabase records login events.
const supabaseEnv = getSupabaseConfig();

const supabase = supabaseEnv.configured
  ? createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey)
  : null;

const supabaseAuthClient = supabaseEnv.url && supabaseEnv.anonKey
  ? createClient(supabaseEnv.url, supabaseEnv.anonKey)
  : null;

export default supabase;
export { supabaseAuthClient, supabaseEnv };

export function isSupabaseConfigured() {
  return supabase !== null;
}

export function isSupabaseAuthConfigured() {
  return supabaseAuthClient !== null;
}
