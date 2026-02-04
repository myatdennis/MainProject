import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_MISSING_CONFIG_MESSAGE =
  'Supabase configuration missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';

export const HAS_SUPABASE_CONFIG = Boolean(supabaseUrl && supabaseAnonKey);

export function hasSupabaseConfig(): boolean {
  return HAS_SUPABASE_CONFIG;
}

// Internal singleton
let _supabase: SupabaseClient | null = null;
let warnedMissingConfig = false;

// Create (or return existing) client
function initClient(): SupabaseClient | null {
  if (!hasSupabaseConfig()) {
    if (import.meta.env.DEV && !warnedMissingConfig) {
      console.warn('[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
      warnedMissingConfig = true;
    }
    return null;
  }

  if (_supabase) return _supabase;

  _supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return _supabase;
}

// ✅ Export a ready reference (will be null if not configured)
export const supabase: SupabaseClient | null = initClient();

// ✅ Keep an accessor for code that prefers calling a function
export function getSupabase(): SupabaseClient | null {
  return initClient();
}
