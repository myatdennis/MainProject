import { supabase, getSupabase } from '../lib/supabaseClient';

interface StartSupabaseLoginOptions {
  fallbackPath?: string;
  returnTo?: string | null;
}

const resolveDefaultFallback = () => {
  if (typeof window === 'undefined' || !window.location) return '/login';

  const pathname = window.location.pathname || '';
  if (pathname.startsWith('/admin')) return '/admin/login';
  if (pathname.startsWith('/lms')) return '/lms/login';
  return '/login';
};

const sanitizeReturnTo = (value?: string | null) => {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return undefined; // block full URLs
  if (trimmed.startsWith('/auth/callback')) return undefined; // avoid loops
  return trimmed;
};

export async function startSupabaseLogin(options?: StartSupabaseLoginOptions) {
  if (typeof window === 'undefined') return;

  const fallbackPath = options?.fallbackPath || resolveDefaultFallback();
  const client = supabase ?? getSupabase();

  const redirectToFallback = () => window.location.assign(fallbackPath);

  if (!client) {
    if (import.meta.env.DEV) {
      console.error('[startSupabaseLogin] Supabase client missing; redirecting to fallback login.');
    }
    redirectToFallback();
    return;
  }

  const origin = window.location.origin || '';
  const candidateReturnTo =
    options?.returnTo ??
    (window.location.pathname.startsWith('/auth/callback')
      ? undefined
      : `${window.location.pathname}${window.location.search || ''}`);

  const safeReturnTo = sanitizeReturnTo(candidateReturnTo);
  const search = safeReturnTo ? `?returnTo=${encodeURIComponent(safeReturnTo)}` : '';
  const redirectTo = origin ? `${origin}/auth/callback${search}` : undefined;

  try {
    await client.auth.signInWithOAuth({
      provider: 'github', // <-- IMPORTANT: matches your GitHub provider setup
      options: redirectTo ? { redirectTo } : undefined,
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[startSupabaseLogin] Failed to launch Supabase login', error);
    }
    redirectToFallback();
  }
}
