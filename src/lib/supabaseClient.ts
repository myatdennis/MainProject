import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const SUPABASE_MISSING_CONFIG_MESSAGE =
  'Supabase configuration missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';

export const hasSupabaseConfig = () => Boolean(supabaseUrl && supabaseAnonKey);

// Create the client immediately (no async), so callers never accidentally get a Promise.
export const supabase: SupabaseClient | null = hasSupabaseConfig()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Safe accessor (sync).
 * Returns the singleton client or null if env is missing.
 */
export function getSupabase(): SupabaseClient | null {
  if (!supabase && import.meta.env.DEV) {
    console.warn('[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  }
  return supabase;
}
