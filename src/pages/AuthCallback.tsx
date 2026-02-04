import { useEffect, useState } from 'react';
import { supabase, getSupabase } from '../lib/supabaseClient';
import { startSupabaseLogin } from '../utils/startSupabaseLogin';

type Status = 'checking' | 'redirecting' | 'error';

const AuthCallback = () => {
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState('Completing your secure sign-in…');

  useEffect(() => {
    let cancelled = false;

    const processCallback = async () => {
      if (typeof window === 'undefined') return;

      const client = supabase ?? getSupabase();
      if (!client) {
        setStatus('error');
        setMessage('Supabase is not configured. Please try again later.');
        return;
      }

      try {
        // 1) Finalize OAuth (important when Supabase redirects back with ?code=...)
        // If there is no code, exchangeCodeForSession safely does nothing useful.
        const url = window.location.href;
        if (url.includes('code=')) {
          await client.auth.exchangeCodeForSession(url);
        }

        // 2) Get Supabase session
        const { data, error } = await client.auth.getSession();
        if (error || !data.session) {
          throw error ?? new Error('Missing Supabase session.');
        }

        const supabaseAccessToken = data.session.access_token;

        // 3) Tell your API to mint your APP session cookies (access_token/refresh_token)
        // IMPORTANT: use /api if you proxy through Netlify; otherwise use the full API origin.
        const resp = await fetch('/api/auth/supabase', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseAccessToken}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({}),
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`API session mint failed (${resp.status}): ${text}`);
        }

        // 4) Redirect to where the user wanted to go
        const params = new URLSearchParams(window.location.search);
        const returnTo = params.get('returnTo');
        const fallback = window.location.pathname.startsWith('/lms') ? '/lms/dashboard' : '/admin';
        const target = returnTo && returnTo.startsWith('/') ? returnTo : fallback;

        setStatus('redirecting');
        if (!cancelled) window.location.replace(target);
      } catch (err) {
        if (import.meta.env.DEV) console.error('[AuthCallback] Failed', err);
        if (!cancelled) {
          setStatus('error');
          setMessage('We could not verify your session. Please try logging in again.');
        }
      }
    };

    void processCallback();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-lg">
          <p className="text-base font-semibold text-charcoal">Sign-in issue</p>
          <p className="mt-2 text-sm text-slate/80">{message}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="flex-1 rounded-xl bg-charcoal px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-charcoal/90"
              onClick={() => startSupabaseLogin()}
            >
              Try again
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl border border-slate/30 px-4 py-2 text-sm font-semibold text-slate shadow-sm transition hover:bg-slate-50"
              onClick={() => window.location.assign('/admin/login')}
            >
              Go to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-mist bg-white p-6 text-center shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate">
          {status === 'redirecting' ? 'Redirecting' : 'Verifying session'}
        </p>
        <p className="mt-2 text-sm text-slate/80">
          {status === 'redirecting' ? 'Redirecting you to the dashboard…' : 'Please wait while we secure your session.'}
        </p>
        <div className="mx-auto mt-4 h-10 w-10 animate-spin rounded-full border-4 border-cloud border-t-sunrise" />
      </div>
    </div>
  );
};

export default AuthCallback;
