import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { secureGet, secureSet, secureRemove } from './secureStorage';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'thc-supabase-auth',
      storage: createSecureSupabaseAuthStorage(),
    }
  }
);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
let warnedMissingConfig = false;

export const SUPABASE_MISSING_CONFIG_MESSAGE =
  'Supabase configuration missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';

export const hasSupabaseConfig = () => Boolean(supabaseUrl && supabaseAnonKey);

export function getSupabase(): SupabaseClient | null {
  if (!hasSupabaseConfig()) {
    if (import.meta.env.DEV && !warnedMissingConfig) {
      console.warn('[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
      warnedMissingConfig = true;
    }
    return null;
  }
  return supabase;
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  (window as any).__supabase = supabase;
  (window as any).supabase = supabase;
}

function createSecureSupabaseAuthStorage() {
  const prefix = 'thc-supabase-auth';
  const withPrefix = (key: string) => `${prefix}:${key}`;

  return {
    getItem(key: string) {
      try {
        return secureGet<string>(withPrefix(key));
      } catch (error) {
        console.warn('[supabaseClient] secure storage getItem failed', key, error);
        return null;
      }
    },
    setItem(key: string, value: string) {
      try {
        secureSet(withPrefix(key), value);
      } catch (error) {
        console.warn('[supabaseClient] secure storage setItem failed', { key, error });
      }
    },
    removeItem(key: string) {
      try {
        secureRemove(withPrefix(key));
      } catch (error) {
        console.warn('[supabaseClient] secure storage removeItem failed', { key, error });
      }
    },
  };
}
