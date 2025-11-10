/**
 * Supabase Client for Server
 * Server-side Supabase client configuration
 */

import { createClient } from '@supabase/supabase-js';

// Server-side Supabase credentials should use service role key, never client anon key.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export default supabase;

export function isSupabaseConfigured() {
  return supabase !== null;
}
