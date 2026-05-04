import type { Session } from '@supabase/supabase-js';
import { getGlobalActiveOrgIdForApi } from './orgContext';
import { getSupabase } from './supabaseClient';

let runtimeAuthReady = false;

export type ApiReadinessSnapshot = {
  session: Session | null;
  activeOrgId: string | null;
  authReady: boolean;
};

export class ApiReadinessError extends Error {
  snapshot: ApiReadinessSnapshot;

  constructor(message: string, snapshot: ApiReadinessSnapshot) {
    super(message);
    this.name = 'ApiReadinessError';
    this.snapshot = snapshot;
  }
}

export const setRuntimeAuthReady = (ready: boolean): void => {
  runtimeAuthReady = ready;
  try {
    if (typeof window !== 'undefined') {
      (window as any).__HUDDLE_AUTH_READY = ready;
    }
  } catch {
    // best-effort debug mirror only
  }
};

export const getRuntimeAuthReady = (): boolean => {
  try {
    if (typeof window !== 'undefined' && typeof (window as any).__HUDDLE_AUTH_READY === 'boolean') {
      return Boolean((window as any).__HUDDLE_AUTH_READY);
    }
  } catch {
    // ignore and use module state
  }
  return runtimeAuthReady;
};

export const resolveApiReadinessSnapshot = async (): Promise<ApiReadinessSnapshot> => {
  let session: Session | null = null;
  try {
    const supabase = getSupabase();
    if (supabase && typeof supabase.auth?.getSession === 'function') {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      session = currentSession ?? null;
    }
  } catch {
    session = null;
  }

  return {
    session,
    activeOrgId: getGlobalActiveOrgIdForApi(),
    authReady: getRuntimeAuthReady(),
  };
};

export const logApiDebug = (snapshot: ApiReadinessSnapshot): void => {
  console.log('[API DEBUG]', {
    hasSession: Boolean(snapshot.session),
    hasToken: Boolean(snapshot.session?.access_token),
    activeOrgId: snapshot.activeOrgId,
    authReady: snapshot.authReady,
  });
};

export const assertApiReady = async ({
  requireAuth,
  requireOrg,
}: {
  requireAuth: boolean;
  requireOrg: boolean;
}): Promise<ApiReadinessSnapshot> => {
  const snapshot = await resolveApiReadinessSnapshot();
  logApiDebug(snapshot);
  if (requireAuth && (!snapshot.authReady || !snapshot.session?.access_token || (requireOrg && !snapshot.activeOrgId))) {
    throw new ApiReadinessError('API request blocked until auth and organization context are ready', snapshot);
  }
  return snapshot;
};
