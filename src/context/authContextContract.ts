import type { UserMembership, UserSession } from '../lib/secureStorage';
import type { Session } from '@supabase/supabase-js';
import type { LoginResult, RefreshOptions, RegisterInput, RegisterResult } from './authTypes';
import type { OrgResolutionStatus } from './organizationResolution';
import type { AuthState, SessionSurface, SurfaceAuthStatus } from './surfaceAccess';

export interface AuthContextType {
  isAuthenticated: AuthState;
  // Indicates the Supabase client has completed its initial session check
  authInitialized?: boolean;
  authInitializing: boolean;
  authReady?: boolean;
  session?: Session | null;
  authStatus: 'booting' | 'authenticated' | 'unauthenticated' | 'error';
  sessionStatus: 'loading' | 'authenticated' | 'unauthenticated';
  membershipStatus: 'idle' | 'loading' | 'ready' | 'error' | 'degraded';
  hasActiveMembership: boolean;
  surfaceAuthStatus: Record<SessionSurface, SurfaceAuthStatus>;
  orgResolutionStatus: OrgResolutionStatus;
  // orgReady is true when organization resolution has completed (ready or degraded)
  orgReady: boolean;
  // selectedOrgId mirrors activeOrgId but named for compatibility with callers
  selectedOrgId?: string | null;
  user: UserSession | null;
  // Derived synchronously from `user` (isPlatformAdmin / platform_role claims),
  // available in the same render — unlike window.__IS_PLATFORM_ADMIN__, which is
  // set by a separate effect and can race with early admin-page data fetches.
  isPlatformAdmin: boolean;
  memberships: UserMembership[];
  organizationIds: string[];
  activeOrgId: string | null;
  lastActiveOrgId: string | null;
  requestedOrgId?: string | null;
  login: (email: string, password: string, type: 'lms' | 'admin', mfaCode?: string) => Promise<LoginResult>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  sendMfaChallenge: (email: string) => Promise<boolean>;
  verifyMfa: (email: string, code: string) => Promise<boolean>;
  logout: (type?: 'lms' | 'admin') => Promise<void>;
  refreshToken: (options?: RefreshOptions) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
  setActiveOrganization: (orgId: string | null) => Promise<void>;
  setRequestedOrgHint: (orgId: string | null) => void;
  reloadSession: (options?: { surface?: SessionSurface; force?: boolean }) => Promise<boolean>;
  loadSession: (options?: { surface?: SessionSurface }) => Promise<boolean>;
  retryBootstrap: () => void;
}

export const defaultAuthContext: AuthContextType = {
  isAuthenticated: { lms: false, admin: false, client: false },
  authInitialized: false,
  authInitializing: true,
  authReady: false,
  session: null,
  authStatus: 'booting',
  sessionStatus: 'loading',
  membershipStatus: 'idle',
  hasActiveMembership: false,
  surfaceAuthStatus: { admin: 'idle', lms: 'idle', client: 'idle' },
  orgResolutionStatus: 'idle',
  orgReady: false,
  user: null,
  isPlatformAdmin: false,
  memberships: [],
  organizationIds: [],
  activeOrgId: null,
  lastActiveOrgId: null,
  requestedOrgId: null,
  selectedOrgId: null,
  setRequestedOrgHint() {},
  async login() {
    return {
      success: false,
      error: 'Authentication provider not initialized. Please refresh the page.',
      errorType: 'unknown_error',
    };
  },
  async sendMfaChallenge() {
    return false;
  },
  async register() {
    return {
      success: false,
      error: 'Registration is unavailable. Please refresh and try again.',
      errorType: 'unknown_error',
    };
  },
  async verifyMfa() {
    return false;
  },
  async logout() {
    console.warn('[SecureAuth] logout called before provider mounted.');
  },
  async refreshToken() {
    return false;
  },
  async forgotPassword() {
    return false;
  },
  async setActiveOrganization() {
    return;
  },
  async reloadSession() {
    return false;
  },
  async loadSession() {
    return false;
  },
  retryBootstrap() {},
};
