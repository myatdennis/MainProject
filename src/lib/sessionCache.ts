import { getSupabase, supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';

// Short-lived in-memory cache for supabase.auth.getSession() to avoid
// duplicate network calls when multiple helpers request the current
// session in quick succession. This intentionally does NOT persist tokens
// anywhere — it only caches the runtime response for a small TTL.

let lastFetchedAt = 0;
let lastSession: Session | null = null;
let inFlight: Promise<Session | null> | null = null;

const DEFAULT_TTL_MS = 500; // half-second cache window

export async function getSessionCached(ttl = DEFAULT_TTL_MS): Promise<Session | null> {
  const now = Date.now();
  if (inFlight) return inFlight;
  if (lastFetchedAt && now - lastFetchedAt < ttl) {
    return Promise.resolve(lastSession);
  }

  const p = (async (): Promise<Session | null> => {
    try {
      // getSupabase() gates on env config being present, which prevents session
      // lookups in dev/test environments where config is absent but the real
      // (or E2E-mocked) client is still usable. Fall back to the client directly
      // in that case rather than silently treating the user as unauthenticated.
      const client = getSupabase() ?? supabase;
      if (!client || typeof client.auth?.getSession !== 'function') return null;
      const {
        data: { session },
      } = await client.auth.getSession();
      lastSession = session ?? null;
      lastFetchedAt = Date.now();
      return lastSession;
    } catch (err) {
      // don't poison cache on error — allow callers to retry
      return null;
    } finally {
      inFlight = null;
    }
  })();

  inFlight = p;
  return p;
}

export function clearSessionCache(): void {
  lastFetchedAt = 0;
  lastSession = null;
  inFlight = null;
}

export default getSessionCached;
