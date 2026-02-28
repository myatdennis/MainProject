import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { secureGet, secureSet, secureRemove } from './secureStorage';

type SupabaseStorageAdapter = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const AUTH_KEYS = ['thc-supabase-auth', 'thc-supabase-auth:thc-supabase-auth'];

const AUTH_STORAGE_MODE = (import.meta.env.VITE_AUTH_STORAGE_MODE || 'secure').toLowerCase();
const supabaseAuthStorage: SupabaseStorageAdapter =
  AUTH_STORAGE_MODE === 'plain' ? createPlainSupabaseAuthStorage() : createSecureSupabaseAuthStorage();

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

if (typeof window !== 'undefined') {
  if (import.meta.env?.DEV) {
    console.info('[supabaseClient] auth storage mode', AUTH_STORAGE_MODE);
  }
  (window as any).__supabase = supabase;
  if (import.meta.env?.DEV) {
    (window as any).supabase = supabase;
  }
}
if (typeof window !== 'undefined') {
  if (!(window as any).__supabaseDiagnosticsInitialized) {
    (window as any).__supabaseDiagnosticsInitialized = true;
    captureAuthDiagnostics('app_start');
  }
  if (import.meta.env?.DEV) {
    (window as any).debugAuthStorage = debugAuthStorage;
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  console.info('[supabaseClient] auth_state_change', {
    event,
    hasAccessToken: Boolean(session?.access_token),
    userId: session?.user?.id ?? null,
  });
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    debugAuthStorage(`auth_event:${event}`);
  }
});

function createSecureSupabaseAuthStorage(): SupabaseStorageAdapter {
  const legacyPrefix = 'thc-supabase-auth:';

  const migrateLegacyKey = (key: string): string | null => {
    const legacyValue = secureGet<string>(`${legacyPrefix}${key}`);
    if (typeof legacyValue === 'string') {
      secureSet(key, legacyValue);
      secureRemove(`${legacyPrefix}${key}`);
      return legacyValue;
    }
    return null;
  };

  const readValue = (key: string): string | null => {
    const current = secureGet<string>(key);
    if (typeof current === 'string') {
      return current;
    }
    if (current !== null && typeof current !== 'undefined') {
      try {
        return typeof current === 'string' ? current : JSON.stringify(current);
      } catch {
        return null;
      }
    }
    return migrateLegacyKey(key);
  };

  return {
    getItem(key: string) {
      try {
        return readValue(key);
      } catch (error) {
        console.warn('[supabaseClient] secure storage getItem failed', key, error);
        return null;
      }
    },
    setItem(key: string, value: string) {
      try {
        secureSet(key, value);
      } catch (error) {
        console.warn('[supabaseClient] secure storage setItem failed', { key, error });
      }
    },
    removeItem(key: string) {
      try {
        secureRemove(key);
        secureRemove(`${legacyPrefix}${key}`);
      } catch (error) {
        console.warn('[supabaseClient] secure storage removeItem failed', { key, error });
      }
    },
  };
}

function createPlainSupabaseAuthStorage(): SupabaseStorageAdapter {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    const memory = new Map<string, string>();
    return {
      getItem(key: string) {
        return memory.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        memory.set(key, value);
      },
      removeItem(key: string) {
        memory.delete(key);
      },
    };
  }

  const storage = window.localStorage;
  return {
    getItem(key: string) {
      try {
        return storage.getItem(key);
      } catch (error) {
        console.warn('[supabaseClient] plain storage getItem failed', key, error);
        return null;
      }
    },
    setItem(key: string, value: string) {
      try {
        storage.setItem(key, value);
      } catch (error) {
        console.warn('[supabaseClient] plain storage setItem failed', { key, error });
      }
    },
    removeItem(key: string) {
      try {
        storage.removeItem(key);
      } catch (error) {
        console.warn('[supabaseClient] plain storage removeItem failed', { key, error });
      }
    },
  };
}

function collectKeys(storage: Storage | null | undefined, predicate: (key: string) => boolean): string[] {
  if (!storage) return [];
  const keys: string[] = [];
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && predicate(key)) {
        keys.push(key);
      }
    }
  } catch (error) {
    console.warn('[supabaseClient] unable to enumerate storage keys', error);
  }
  return keys;
}

function safeRead(storage: Storage | null | undefined, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch (error) {
    console.warn('[supabaseClient] storage read failed', { key, error });
    return null;
  }
}

export function debugAuthStorage(label: string) {
  if (typeof window === 'undefined') {
    return;
  }
  const browserLocalStorage = window.localStorage ?? null;
  const browserSessionStorage = window.sessionStorage ?? null;
  const matchThcKey = (key: string) => key.includes('thc-supabase-auth');
  const matchSupabaseToken = (key: string) => /sb-.*-auth-token/i.test(key);

  const localKeys = collectKeys(browserLocalStorage, matchThcKey);
  const sessionKeys = collectKeys(browserSessionStorage, matchThcKey);
  const supabaseTokenKeys = Array.from(
    new Set([
      ...collectKeys(browserLocalStorage, matchSupabaseToken),
      ...collectKeys(browserSessionStorage, matchSupabaseToken),
    ]),
  );

  const inspectedKeys = [...AUTH_KEYS, ...supabaseTokenKeys];
  const inspectedValues: Record<string, string | null> = {};
  inspectedKeys.forEach((key) => {
    inspectedValues[`local:${key}`] = safeRead(browserLocalStorage, key);
    inspectedValues[`session:${key}`] = safeRead(browserSessionStorage, key);
  });

  console.info('[supabaseClient] auth storage snapshot', {
    label,
    mode: AUTH_STORAGE_MODE,
    timestamp: new Date().toISOString(),
    localKeys,
    sessionKeys,
    supabaseTokenKeys,
    inspectedValues,
  });
}

async function logSupabaseSessionStatus(label: string) {
  try {
    const { data, error } = await supabase.auth.getSession();
    console.info('[supabaseClient] session snapshot', {
      label,
      sessionHasAccessToken: Boolean(data?.session?.access_token),
      sessionUserId: data?.session?.user?.id ?? null,
      sessionError: error?.message ?? null,
    });
  } catch (sessionError) {
    console.warn('[supabaseClient] session snapshot failed', {
      label,
      error: sessionError instanceof Error ? sessionError.message : String(sessionError),
    });
  }
}

export function captureAuthDiagnostics(label: string) {
  debugAuthStorage(label);
  void logSupabaseSessionStatus(label);
}
