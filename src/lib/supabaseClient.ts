import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { secureGet, secureSet, secureRemove } from './secureStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const SUPABASE_MISSING_CONFIG_MESSAGE =
  'Supabase configuration missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';

let supabase: SupabaseClient | null = null;
let warnedMissingConfig = false;

export const hasSupabaseConfig = () => Boolean(supabaseUrl && supabaseAnonKey);

type SupabaseStorageAdapter = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

const SUPABASE_STORAGE_PREFIX = 'supabase:auth:';
const buildStorageKey = (key: string) => `${SUPABASE_STORAGE_PREFIX}${key}`;

const createSecureSupabaseStorage = (): SupabaseStorageAdapter => ({
  getItem(key: string) {
    try {
      const value = secureGet<string>(buildStorageKey(key));
      return value ?? null;
    } catch (error) {
      console.warn('[supabaseClient] storage.getItem failed', { key, error });
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      secureSet(buildStorageKey(key), value);
    } catch (error) {
      console.warn('[supabaseClient] storage.setItem failed', { key, error });
    }
  },
  removeItem(key: string) {
    try {
      secureRemove(buildStorageKey(key));
    } catch (error) {
      console.warn('[supabaseClient] storage.removeItem failed', { key, error });
    }
  },
});

const supabaseAuthStorage = createSecureSupabaseStorage();

export function getSupabase(): SupabaseClient | null {
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
      storage: supabaseAuthStorage,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return supabase;
}

export { supabase };
