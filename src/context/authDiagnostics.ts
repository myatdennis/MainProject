import { useEffect } from 'react';
import { AUTH_STORAGE_MODE } from '../lib/supabaseClient';
import { isAdminSurface } from '../utils/surface';
import { registerCourseStoreOrgResolver, writeBridgeSnapshot, type OrgContextSnapshot } from '../store/courseStoreOrgBridge';
import type { UserMembership, UserSession } from '../lib/secureStorage';
import type { SurfaceAuthStatus } from './surfaceAccess';
import type { OrgResolutionStatus } from './organizationResolution';

const isDevEnvironment = Boolean(import.meta.env?.DEV);

export const logAuthDebug = (label: string, payload: Record<string, unknown>) => {
  if (!isDevEnvironment) return;
  try {
    console.debug(label, payload);
  } catch {
    // ignore
  }
};

export const logSessionResult = (status: string) => logAuthDebug('[auth] session result', { status });
export const logRefreshResult = (status: string) => logAuthDebug('[auth] refresh result', { status });

export const logAuthSessionState = (contextLabel: string, session: UserSession | null) => {
  if (!isDevEnvironment) {
    return;
  }

  const summary = {
    event: contextLabel,
    timestamp: new Date().toISOString(),
    sessionExists: Boolean(session),
    userId: session?.id ?? null,
    role: session?.role ?? null,
    isPlatformAdmin: Boolean(session?.isPlatformAdmin || session?.role === 'admin'),
    organizationId: session?.organizationId ?? null,
    activeOrgId: session?.activeOrgId ?? null,
  };

  console.info('[SecureAuth][DEV:auth-session]', summary);
};

interface MembershipFetchMeta {
  requestId: number;
  startedAt: number | null;
  finishedAt: number | null;
  statusCode: number | null;
  membershipCount: number | null;
  reason?: string | null;
}

interface UseAuthDiagnosticsParams {
  authInitializing: boolean;
  authStatus: 'booting' | 'authenticated' | 'unauthenticated' | 'error';
  sessionStatus: 'loading' | 'authenticated' | 'unauthenticated';
  membershipStatus: 'idle' | 'loading' | 'ready' | 'error' | 'degraded';
  orgResolutionStatus: OrgResolutionStatus;
  surfaceAuthStatus: Record<'admin' | 'lms' | 'client', SurfaceAuthStatus>;
  user: UserSession | null;
  memberships: UserMembership[];
  activeOrgId: string | null;
  hasActiveMembership: boolean;
  requestedOrgHint: string | null;
  lastActiveOrgId: string | null;
  lastMembershipFetchMeta: MembershipFetchMeta;
  authDebugSignatureRef: React.MutableRefObject<string | null>;
  hasLoggedAppLoadRef: React.MutableRefObject<boolean>;
  lastMembershipStatusRef: React.MutableRefObject<'idle' | 'loading' | 'ready' | 'error' | 'degraded'>;
  orgContextLoggedRef: React.MutableRefObject<string | null>;
  deriveOrgContextSnapshotCallback: () => OrgContextSnapshot;
}

export const useAuthDiagnostics = ({
  authInitializing,
  authStatus,
  sessionStatus,
  membershipStatus,
  orgResolutionStatus,
  surfaceAuthStatus,
  user,
  memberships,
  activeOrgId,
  hasActiveMembership,
  requestedOrgHint,
  lastActiveOrgId,
  lastMembershipFetchMeta,
  authDebugSignatureRef,
  hasLoggedAppLoadRef,
  lastMembershipStatusRef,
  orgContextLoggedRef,
  deriveOrgContextSnapshotCallback,
}: UseAuthDiagnosticsParams) => {
  useEffect(() => {
    if (orgResolutionStatus !== 'ready') {
      return;
    }
    const resolvedOrgId = activeOrgId ?? user?.activeOrgId ?? user?.organizationId ?? null;
    const key = `${user?.id ?? 'anon'}:${resolvedOrgId ?? 'none'}:${memberships.length}`;
    if (orgContextLoggedRef.current === key) {
      return;
    }
    orgContextLoggedRef.current = key;
    console.info('[ORG CONTEXT READY]', {
      userId: user?.id ?? null,
      activeOrgId: resolvedOrgId,
      membershipCount: memberships.length,
    });
  }, [orgResolutionStatus, activeOrgId, memberships.length, user?.id, user?.activeOrgId, user?.organizationId, orgContextLoggedRef]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated') {
      return;
    }
    if (hasLoggedAppLoadRef.current) {
      return;
    }
    logAuthSessionState('app_load', user);
    hasLoggedAppLoadRef.current = true;
  }, [sessionStatus, user, hasLoggedAppLoadRef]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const pathname = window.location?.pathname ?? '';
      let surfaceStatus: 'admin' | 'client' = 'client';
      try {
        surfaceStatus = isAdminSurface(pathname) ? 'admin' : 'client';
      } catch {
        surfaceStatus = 'client';
      }
      const hasSession = Boolean(user);
      const lastRedirect = window.__HUDDLE_LAST_AUTH_REDIRECT__ ?? null;
      let secureSessionStored = false;
      try {
        secureSessionStored = Boolean(window.localStorage?.getItem('secure_user_session'));
      } catch {
        secureSessionStored = false;
      }
      const payload = {
        pathname,
        surfaceStatus,
        authStatus,
        sessionStatus,
        surfaceAuthStatus,
        orgResolutionStatus,
        membershipStatus,
        membershipCount: memberships.length,
        hasActiveMembership,
        hasSession,
        activeOrgId,
        requestedOrgId: requestedOrgHint,
        lastActiveOrgId,
        storageMode: AUTH_STORAGE_MODE,
        lastRedirect,
        lastMembershipFetch: lastMembershipFetchMeta,
        secureUserSessionKeyPresent: secureSessionStored,
        redirectReason: 'state_change',
        timestamp: new Date().toISOString(),
      };
      if (import.meta.env?.DEV) {
        const debugSnapshot: typeof payload & { dump?: () => Record<string, unknown> } = { ...payload };
        debugSnapshot.dump = () => {
          const { dump, ...rest } = debugSnapshot;
          console.info('[SecureAuth][debug] dump', rest);
          return rest;
        };
        window.__HUDDLE_AUTH_DEBUG__ = debugSnapshot;
        const signature = JSON.stringify({
          pathname,
          surfaceStatus,
          authStatus,
          sessionStatus,
          hasSession,
          orgResolutionStatus,
          surfaceAuthStatus,
        });
        if (authDebugSignatureRef.current !== signature) {
          authDebugSignatureRef.current = signature;
          console.info('[SecureAuth][debug] auth_state_update', { reason: 'state_change', payload });
        }
      }
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn('[SecureAuth][debug] snapshot_failed', error);
      }
    }
  }, [
    authStatus,
    sessionStatus,
    surfaceAuthStatus,
    orgResolutionStatus,
    membershipStatus,
    memberships.length,
    hasActiveMembership,
    user,
    activeOrgId,
    requestedOrgHint,
    lastActiveOrgId,
    lastMembershipFetchMeta,
    authDebugSignatureRef,
  ]);

  useEffect(() => {
    if (import.meta.env?.DEV) {
      console.debug('[AUTH_STATE_MACHINE]', {
        pathname: typeof window !== 'undefined' ? window.location?.pathname : '',
        authInitializing,
        authStatus,
        sessionStatus,
        membershipStatus,
        activeOrgId: activeOrgId ?? null,
        ts: Date.now(),
      });
    }
  }, [authInitializing, authStatus, sessionStatus, membershipStatus, activeOrgId]);

  useEffect(() => {
    if (membershipStatus === 'ready' && lastMembershipStatusRef.current !== 'ready') {
      if (typeof window !== 'undefined') {
        const detail = {
          activeOrgId: activeOrgId ?? null,
          membershipCount: memberships.length,
          userId: user?.id ?? null,
        };
        if (import.meta.env?.DEV) {
          console.debug('[AUTH READY]', {
            sessionStatus,
            membershipStatus,
            activeOrgId: activeOrgId ?? null,
            userId: user?.id ?? null,
            membershipCount: memberships.length,
            pathname: window.location?.pathname ?? 'ssr',
            ts: Date.now(),
          });
        }
        try {
          // Ensure the courseStore org-bridge has a fresh snapshot available
          // BEFORE we signal auth readiness. This prevents a race where
          // consumers (like courseStore) receive `huddle:auth_ready` and
          // read the bridge before it's been populated.
          writeBridgeSnapshot(deriveOrgContextSnapshotCallback());
        } catch (err) {
          console.warn('[authDiagnostics] Failed to write bridge snapshot before auth_ready', err);
        }
        window.dispatchEvent(new CustomEvent('huddle:auth_ready', { detail }));
      }
    }
    lastMembershipStatusRef.current = membershipStatus;
  }, [membershipStatus, activeOrgId, memberships.length, user?.id, sessionStatus, lastMembershipStatusRef]);

  useEffect(() => {
    try {
      writeBridgeSnapshot(deriveOrgContextSnapshotCallback());
    } catch (error) {
      console.warn('[SecureAuthContext] Failed to write org snapshot bridge', error);
    }
  }, [deriveOrgContextSnapshotCallback]);

  useEffect(() => {
    registerCourseStoreOrgResolver(() => deriveOrgContextSnapshotCallback());
    return () => {
      registerCourseStoreOrgResolver(null);
    };
  }, [deriveOrgContextSnapshotCallback]);
};
