import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const SUPABASE_MISSING_CONFIG_MESSAGE =
  'Supabase configuration missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';

let supabase: SupabaseClient | null = null;
let warnedMissingConfig = false;

export const hasSupabaseConfig = () => Boolean(supabaseUrl && supabaseAnonKey);

async function initClient(): Promise<SupabaseClient | null> {
  if (!hasSupabaseConfig()) {
    if (import.meta.env.DEV && !warnedMissingConfig) {
      console.warn('[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
      warnedMissingConfig = true;
    }
    return null;
  }

  if (supabase) return supabase;

  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabase;
}

export async function getSupabase(): Promise<SupabaseClient | null> {
  return initClient();
}

export { supabase };
