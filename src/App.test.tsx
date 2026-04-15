import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type ReactNode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ToastContext from './context/ToastContext';
import { AppContent, buildCourseInitTargetKey } from './App';

var mockInit: ReturnType<typeof vi.fn> | undefined;
var mockUseSecureAuth: ReturnType<typeof vi.fn> | undefined;

vi.mock('./store/courseStore', () => {
  const init = vi.fn().mockResolvedValue(undefined);
  mockInit = init;
  return {
    courseStore: {
      init,
      getAdminCatalogState: vi.fn(),
      getLearnerCatalogState: vi.fn(),
      getAllCourses: vi.fn().mockReturnValue([]),
    },
  };
});

vi.mock('./hooks/useViewportHeight', () => ({
  default: vi.fn(),
}));

vi.mock('./context/SecureAuthContext', () => {
  const useSecureAuth = vi.fn();
  mockUseSecureAuth = useSecureAuth;
  return {
    useSecureAuth,
  };
});

vi.mock('./components/Admin/AdminLayout', () => ({
  default: () => <div>AdminLayoutStub</div>,
}));

describe('buildCourseInitTargetKey', () => {
  it('includes surface in the computed key so route changes retrigger course init', () => {
    expect(buildCourseInitTargetKey('user-1', 'org-1', 'admin')).toBe('user-1:org-1:admin');
    expect(buildCourseInitTargetKey('user-1', 'org-1', 'client')).toBe('user-1:org-1:client');
    expect(buildCourseInitTargetKey(null, null, 'client')).toBe('guest:none:client');
  });
});

describe('AppContent course store initialization', () => {
  beforeEach(() => {
    mockInit?.mockReset();
    mockUseSecureAuth?.mockReturnValue({
      sessionStatus: 'authenticated',
      user: { id: 'user-1' },
      activeOrgId: 'org-1',
      orgResolutionStatus: 'ready',
      authInitializing: false,
      authStatus: 'authenticated',
      membershipStatus: 'ready',
      hasActiveMembership: true,
      surfaceAuthStatus: { admin: 'ready', lms: 'ready', client: 'ready' },
      isAuthenticated: { admin: true, lms: true, client: true },
      memberships: [],
      organizationIds: [],
      lastActiveOrgId: null,
      requestedOrgId: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
      forgotPassword: vi.fn(),
      sendMfaChallenge: vi.fn(),
      verifyMfa: vi.fn(),
      setActiveOrganization: vi.fn().mockResolvedValue(undefined),
      setRequestedOrgHint: vi.fn(),
      reloadSession: vi.fn().mockResolvedValue(true),
      loadSession: vi.fn().mockResolvedValue(true),
      retryBootstrap: vi.fn(),
    });
  });

  it('reruns the course store init when the surface changes for the same authenticated user', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ToastContext.Provider value={{ showToast: vi.fn() } as any}>{children}</ToastContext.Provider>
    );

    const { rerender } = render(
      <MemoryRouter key="admin" initialEntries={['/admin/dashboard']}>
        <AppContent />
      </MemoryRouter>,
      { wrapper },
    );

    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    rerender(
      <MemoryRouter key="lms" initialEntries={['/lms/dashboard']}>
        <AppContent />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledTimes(2);
    });
  });
});
