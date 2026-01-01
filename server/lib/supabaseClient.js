/**
 * Supabase Client for Server
 * Server-side Supabase client configuration
 */

import { createClient } from '@supabase/supabase-js';

// Server-side Supabase credentials should use service role key for database access
// and anon key for end-user authentication flows so Supabase records login events.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''; // Never fall back to service key for anon client

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const supabaseAuthClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export default supabase;
export { supabaseAuthClient };

export function isSupabaseConfigured() {
  return supabase !== null;
}

export function isSupabaseAuthConfigured() {
  return supabaseAuthClient !== null;
}
