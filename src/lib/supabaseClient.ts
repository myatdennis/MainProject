import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { secureGet, secureSet, secureRemove } from './secureStorage';

const supabaseAuthStorage = createSecureSupabaseAuthStorage();

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'thc-supabase-auth',
      storage: supabaseAuthStorage,
    },
  },
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

logSupabaseAuthDiagnostics(supabaseAuthStorage);

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

function logSupabaseAuthDiagnostics(storage: ReturnType<typeof createSecureSupabaseAuthStorage>) {
  if (typeof window === 'undefined') {
    return;
  }
  if ((window as any).__supabaseAuthDiagnosticLogged) {
    return;
  }

  let storageGetItemOk = true;
  try {
    storage.getItem('__supabase_storage_probe__');
  } catch {
    storageGetItemOk = false;
  }

  supabase.auth
    .getSession()
    .then(({ data, error }) => {
      if ((window as any).__supabaseAuthDiagnosticLogged) {
        return;
      }
      (window as any).__supabaseAuthDiagnosticLogged = true;
      console.info('[supabaseClient] auth diagnostics', {
        storageGetItemOk,
        sessionHasAccessToken: Boolean(data?.session?.access_token),
        sessionError: error?.message ?? null,
      });
    })
    .catch((diagnosticError) => {
      if ((window as any).__supabaseAuthDiagnosticLogged) {
        return;
      }
      (window as any).__supabaseAuthDiagnosticLogged = true;
      console.warn('[supabaseClient] auth diagnostics', {
        storageGetItemOk,
        sessionHasAccessToken: false,
        sessionError: diagnosticError?.message ?? String(diagnosticError),
      });
    });
}
