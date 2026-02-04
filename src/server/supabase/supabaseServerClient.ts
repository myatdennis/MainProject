import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type ClientKind = 'service' | 'anon';

const sanitize = (value: string | undefined | null) => (typeof value === 'string' ? value.trim() : '');

const resolveEnvValue = (keys: string[]): string | null => {
  for (const key of keys) {
    const value = sanitize(process.env[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

const SUPABASE_URL = resolveEnvValue(['SUPABASE_URL', 'VITE_SUPABASE_URL']);
const SUPABASE_SERVICE_KEY = resolveEnvValue([
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_KEY',
]);
const SUPABASE_ANON_KEY = resolveEnvValue(['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']);

const createSupabaseClient = (kind: ClientKind): SupabaseClient | null => {
  if (!SUPABASE_URL) return null;
  if (kind === 'service' && SUPABASE_SERVICE_KEY) {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, detectSessionInUrl: false },
    });
  }
  if (kind === 'anon' && SUPABASE_ANON_KEY) {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, detectSessionInUrl: false },
    });
  }
  return null;
};

export const supabaseServiceClient = createSupabaseClient('service');
export const supabaseAuthClient = createSupabaseClient('anon');

export const isSupabaseConfigured = () => Boolean(supabaseServiceClient);
export const isSupabaseAuthConfigured = () => Boolean(supabaseAuthClient);

