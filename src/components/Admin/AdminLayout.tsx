import { useCallback, useEffect, useRef, useState, useTransition, Suspense, type ChangeEvent, type FC, type ReactNode, useSyncExternalStore } from 'react';
import { Link, NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { ErrorBoundary } from '../ErrorHandling';
import AdminErrorBoundary from '../ErrorBoundary/AdminErrorBoundary';
import { useSecureAuth } from '../../context/SecureAuthContext';
import {
  Menu,
  X,
  LogOut,
  Bell,
  Search,
  Plus,
  BookOpen,
  BarChart3,
  TrendingUp,
  Settings,
  ClipboardList,
  FileText,
  LayoutDashboard,
  PenSquare,
  Users as UsersIcon,
  Building2,
  Wand2,
  Brain,
  RefreshCcw,
  ChevronDown,
  UserCircle2,
  AlertTriangle,
  Award,
  BarChart2,
} from 'lucide-react';
import { ADMIN_ROUTES } from '../../registry/ButtonRouteRegistry';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';
import SurveyQueueStatus from '../Survey/SurveyQueueStatus';
import type { LucideIcon } from 'lucide-react';
import { useActiveOrganization } from '../../hooks/useActiveOrganization';
import useRuntimeStatus from '../../hooks/useRuntimeStatus';
import { refreshRuntimeStatus } from '../../state/runtimeStatus';
import ApiStatusBanner from '../system/ApiStatusBanner';
import { useToast } from '../../context/ToastContext';
import { logAuthRedirect, logAuthDiagnostic } from '../../utils/logAuthRedirect';
import { useAdminAccessState } from '../../lib/adminAccessState';
import AdminNotificationBell from './AdminNotificationBell';
import AdminOrgSelectorModal from './AdminOrgSelectorModal';
import { courseStore } from '../../store/courseStore';

interface AdminLayoutProps {
  children?: ReactNode;
}


// Map route labels to Lucide icons
const iconMap: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  'Users': UsersIcon,
  'Organizations': Building2,
  'Organizations & CRM': Building2,
  'Courses': BookOpen,
  'Course Builder': Wand2,
  'Surveys': ClipboardList,
  'Survey Creator': PenSquare,
  'Analytics': BarChart3,
  'Reports': BarChart2,
  'Team Huddle': UsersIcon,
  'Documents': FileText,
  'Certificates': Award,
  'Performance': TrendingUp,
  'Settings': Settings,
  'Leadership AI': Brain,
};

const navigation = ADMIN_ROUTES
  .filter((route) => route.location === 'Admin Sidebar' && route.status === 'working')
  .map((route) => ({
    name: route.label,
    href: route.targetRoute || '#',
    icon: iconMap[route.label] || LayoutDashboard,
    exact: route.targetRoute === '/admin/dashboard',
  }));

const AdminLayout: FC<AdminLayoutProps> = ({ children }) => {
  // useTransition allows React to defer the route update as a non-urgent
  // transition.  When a nav click triggers a lazy chunk load, React keeps the
  // CURRENT page visible (instead of showing the Suspense fallback) until the
  // new chunk resolves.  isPending can be used to show a subtle loading indicator
  // in the sidebar without blanking the content area.
  const [navPending, startNavTransition] = useTransition();
  const { isAuthenticated, user: authUser, authInitializing, authStatus, logout, sessionStatus, user, membershipStatus, orgResolutionStatus } = useSecureAuth();
  const {
    adminPortalAllowed: adminPortalAllowedRaw,
    hasSession,
    sessionStatus: adminSessionStatus,
    authInitializing: adminAuthInitializing,
  } = useAdminAccessState();
  const normalizedSessionStatus = adminSessionStatus ?? sessionStatus;
  const normalizedAuthInitializing = adminAuthInitializing ?? authInitializing;
  const adminPortalAllowed = adminPortalAllowedRaw || Boolean(isAuthenticated?.admin);
  const { showToast: _showToast } = useToast();
  const runtimeStatus = useRuntimeStatus();
  const {
    organizations: organizationOptions,
    activeOrgId,
    activeMembership,
    isMultiOrg,
    isSwitching,
    selectOrganization,
    refreshOrganizations,
  } = useActiveOrganization({ surface: 'admin' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const logoutInFlightRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const accountEmail = user?.email ?? authUser?.email ?? 'Admin';
  const env = import.meta.env as Record<string, string | boolean | undefined>;
  const ADMIN_MENU_DEBUG = Boolean(env?.DEV || env?.VITE_ENABLE_ADMIN_MENU_DEBUG === 'true');
  const apiReachable = runtimeStatus.apiReachable ?? runtimeStatus.apiHealthy;
  const apiAuthRequired = Boolean(runtimeStatus.apiAuthRequired);
  const isOrgSelectionRequired = Boolean(isMultiOrg && !activeOrgId);
  const [orgModalOpen, setOrgModalOpen] = useState(false);

  const catalogState = useSyncExternalStore(courseStore.subscribe, courseStore.getAdminCatalogState);
  const lastAdminCatalogRetryKeyRef = useRef<string | null>(null);
  const prevAdminReadyRef = useRef(false);

  const adminReady =
    !normalizedAuthInitializing &&
    authStatus === 'authenticated' &&
    normalizedSessionStatus === 'authenticated' &&
    hasSession &&
    Boolean(isAuthenticated?.admin) &&
    orgResolutionStatus === 'ready';

  useEffect(() => {
    if (adminReady && !prevAdminReadyRef.current) {
      console.info('[AdminLayout] admin_ready', {
        path: location.pathname,
        userId: user?.id ?? authUser?.id ?? null,
        activeOrgId,
        membershipStatus,
        apiReachable,
      });
    }
    prevAdminReadyRef.current = adminReady;
  }, [adminReady, activeOrgId, membershipStatus, apiReachable, authUser?.id, user?.id, location.pathname]);

  useEffect(() => {
    if (!adminReady) {
      lastAdminCatalogRetryKeyRef.current = null;
      return;
    }

    if (catalogState.phase === 'loading' || catalogState.adminLoadStatus === 'success') {
      return;
    }

    const retryKey = `${user?.id ?? authUser?.id ?? 'anon'}:${activeOrgId ?? 'none'}:${catalogState.phase}:${catalogState.adminLoadStatus}`;
    if (lastAdminCatalogRetryKeyRef.current === retryKey) {
      return;
    }
    lastAdminCatalogRetryKeyRef.current = retryKey;

    console.info('[AdminLayout] admin_catalog_recovery', {
      path: location.pathname,
      phase: catalogState.phase,
      status: catalogState.adminLoadStatus,
      activeOrgId,
      userId: user?.id ?? authUser?.id ?? null,
      membershipStatus,
      reason: 'admin_ready_retry',
    });

    void courseStore.init({ reason: 'admin_layout_admin_ready_retry' }).catch((error) => {
      console.warn('[AdminLayout] admin_catalog_recovery_failed', {
        error: error instanceof Error ? error.message : String(error),
        phase: catalogState.phase,
        status: catalogState.adminLoadStatus,
      });
    });
  }, [adminReady, catalogState.phase, catalogState.adminLoadStatus, activeOrgId, membershipStatus, authStatus, normalizedSessionStatus, normalizedAuthInitializing, hasSession, user?.id, authUser?.id, location.pathname]);

  const handleRuntimeRetry = useCallback(() => {
    refreshRuntimeStatus().catch((error) => {
      console.warn('[AdminLayout] runtime status retry failed', error);
    });
  }, []);

  const logMenuEvent = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      if (!ADMIN_MENU_DEBUG) {
        return;
      }
      console.info('[AdminMenu]', event, {
        path: location.pathname,
        ...payload,
      });
    },
    [ADMIN_MENU_DEBUG, location.pathname],
  );

  const closeMenu = useCallback(
    (reason: string, extra: Record<string, unknown> = {}) => {
      setMenuOpen((prev) => {
        if (!prev) {
          return prev;
        }
        logMenuEvent('close', { reason, ...extra });
        return false;
      });
    },
    [logMenuEvent],
  );

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => {
      const next = !prev;
      logMenuEvent(next ? 'open' : 'close', { reason: 'toggle_click' });
      return next;
    });
  }, [logMenuEvent]);

  const handleMenuButtonClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const pointerType = 'pointerType' in event.nativeEvent ? (event.nativeEvent as PointerEvent).pointerType : 'mouse';
      logMenuEvent('button_click', { pointerType, defaultPrevented: event.defaultPrevented });
      toggleMenu();
    },
    [logMenuEvent, toggleMenu],
  );

  const activeOrgLabel =
    activeMembership?.organizationName ||
    organizationOptions.find((org) => org.id === activeOrgId)?.label ||
    organizationOptions[0]?.label ||
    null;

  const handleOrganizationChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const nextOrgId = event.target.value || null;
    try {
      await selectOrganization(nextOrgId);
      // Flush the stale catalog cache for the old org so the learner/admin view
      // doesn't serve a 30-minute-old snapshot from a different workspace.
      courseStore.forceInit({ newOrgId: nextOrgId }).catch((err: unknown) => {
        console.warn('[AdminLayout] forceInit after org switch failed', err);
      });
    } catch (error) {
      console.warn('[AdminLayout] Failed to select organization', error);
    }
  };

  const handleRefreshOrganizations = async () => {
    try {
      await refreshOrganizations();
    } catch (error) {
      console.warn('[AdminLayout] Failed to refresh organizations', error);
    }
  };

  const guardNavigation = useCallback(
    (targetPath: string) => {
      // Provide an explicit debug trace for blocked navigation so we can
      // diagnose "clicks do nothing" in the running app without relying
      // on the ADMIN_MENU_DEBUG build flag.
      const blockedReason = (() => {
        if (!isOrgSelectionRequired) return null;
        // Never block when an org switch is already in flight — activeOrgId
        // will populate shortly and blocking the nav here would appear broken.
        if (isSwitching) return null;
        // Allow navigation freely while memberships are still resolving.
        // This covers the transient window between memberships arriving and
        // the auto-select effect in RequireAuth setting activeOrgId.
        if (
          membershipStatus === 'loading' ||
          membershipStatus === 'idle' ||
          membershipStatus === 'ready'
        ) {
          if (import.meta.env?.DEV) {
            console.debug('[NAV] guardNavigation: allowing nav — activeOrgId resolving (membershipStatus=%s)', membershipStatus);
          }
          return null;
        }
        // Only allow explicit org management and settings without an active org.
        const allowList = ['/admin/organizations', '/admin/settings'];
        if (allowList.some((allowed) => targetPath.startsWith(allowed))) return null;
        return 'org_required';
      })();

      if (blockedReason) {
        if (import.meta.env?.DEV) {
          console.warn('[NAV] guardNavigation: BLOCKED nav to', targetPath, 'reason:', blockedReason, {
            isOrgSelectionRequired, isMultiOrg, activeOrgId, membershipStatus, isSwitching,
          });
        }
        // Open an in-page modal prompting the user to choose an organization.
        setOrgModalOpen(true);
        return true;
      }

      return false
    },
    [isOrgSelectionRequired, isSwitching, isMultiOrg, activeOrgId, membershipStatus],
  );

  const logAdminNavEvent = useCallback((event: string, meta: Record<string, unknown> = {}) => {
    if (!import.meta.env.DEV) return;
    try {
      console.info('[admin] ' + event, {
        source: meta.source || 'sidebar',
        from: location.pathname,
        target: meta.target || null,
        timestamp: Date.now(),
        ...meta,
      });
    } catch (err) {
      // swallow
    }
  }, [location.pathname]);

  useEffect(() => {
    if (normalizedAuthInitializing) {
      return;
    }
    // Only redirect when auth is definitively settled as unauthenticated.
    // Using authStatus (not sessionStatus) prevents the transient race where
    // sessionStatus='unauthenticated' fires before /auth/session resolves.
    // RequireAuth is the primary auth gate; this is a safety net for the layout
    // shell only.
    if (!hasSession && authStatus === 'unauthenticated') {
      logAuthDiagnostic('AdminLayout.auth_guard', {
        path: location.pathname,
        reason: 'missing_session',
        authStatus,
        sessionStatus: normalizedSessionStatus,
      });
      console.debug('[AUTH_GATE_DECISION]', {
        source: 'AdminLayout.auth_guard',
        decision: 'redirect_login',
        pathname: location.pathname,
        reason: 'missing_session_post_bootstrap',
      });
      const onLoginRoute = location.pathname === '/admin/login';
      if (!onLoginRoute) {
        navigate('/admin/login');
      }
    }
  }, [
    normalizedAuthInitializing,
    authStatus,
    normalizedSessionStatus,
    hasSession,
    location.pathname,
    navigate,
  ]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }
    console.debug('[AdminLayout] gate_state', {
      path: location.pathname,
      authInitializing: normalizedAuthInitializing,
      sessionStatus: normalizedSessionStatus,
      hasSession,
      adminPortalAllowed,
    });
  }, [normalizedAuthInitializing, normalizedSessionStatus, hasSession, adminPortalAllowed, location.pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        closeMenu('click_outside');
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu('escape_key');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closeMenu, menuOpen]);

  useEffect(() => {
    closeMenu('route_change', { to: location.pathname });
  }, [closeMenu, location.pathname]);

  // Log when a route is rendered inside admin and allow easy detection of mismatches
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    try {
      console.info('[admin] admin_route_rendered', { pathname: location.pathname, timestamp: Date.now() });
    } catch (err) {
      // swallow
    }
  }, [location.pathname]);

  // NAV COMMIT: confirms React has committed the new route to the DOM.
  // Absence of this log after a click means the URL changed but React Router
  // did not re-render the Outlet — the key prop below forces that.
  useEffect(() => {
    console.debug('[NAV COMMIT]', location.pathname);
  }, [location.pathname]);

  // LAYOUT COMMIT: confirms the AdminLayout shell itself (sidebar, header, Outlet
  // wrapper) committed to the DOM for this pathname.  If [NAV COMMIT] fires but
  // [LAYOUT COMMIT] does NOT, a parent component is blocking the layout render.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug('[LAYOUT COMMIT]', location.pathname);
  }, [location.pathname]);

  // Page identity is derived exclusively from location.pathname — no event-based
  // reporting from page components.  This eliminates false-positive mismatch logs
  // caused by stale page names arriving from the previous route.
  const getExpectedAdminLabel = (pathname: string) => {
    const match = ADMIN_ROUTES.find((r) => r.location === 'Admin Sidebar' && r.targetRoute && pathname.startsWith(r.targetRoute));
    return match ? match.label : null;
  };

  // Log the current route label whenever the pathname changes (DEV only).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const label = getExpectedAdminLabel(location.pathname);
    console.info('[admin] current_route', { pathname: location.pathname, label: label ?? '(no match)', timestamp: Date.now() });
  }, [location.pathname]);

  useEffect(() => {
    if (!ADMIN_MENU_DEBUG) {
      return;
    }
    const handleDocumentClickTrace = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const onButton = menuButtonRef.current ? menuButtonRef.current.contains(target) : false;
      const insideMenu = menuRef.current ? menuRef.current.contains(target) : false;
      const pointerType = 'pointerType' in event ? (event as PointerEvent).pointerType : 'mouse';
      const composedPath = typeof event.composedPath === 'function' ? event.composedPath() : [];
      const formattedPath = composedPath
        .map((node) => {
          if (!(node instanceof HTMLElement)) return null;
          const id = node.id ? `#${node.id}` : '';
          const classes = node.className && typeof node.className === 'string' ? `.${node.className.split(/\s+/).filter(Boolean).join('.')}` : '';
          return `${node.tagName}${id}${classes}`;
        })
        .filter(Boolean);
      console.debug('[AdminMenu] document click', {
        pointerType,
        target,
        onButton,
        insideMenu,
        path: formattedPath,
        timestamp: Date.now(),
      });
      logMenuEvent('document_click_trace', {
        onButton,
        insideMenu,
        pointerType,
        tag: target?.tagName,
      });
    };
    document.addEventListener('click', handleDocumentClickTrace, true);
    return () => {
      document.removeEventListener('click', handleDocumentClickTrace, true);
    };
  }, [ADMIN_MENU_DEBUG, logMenuEvent]);

  const handleLogout = useCallback(async () => {
    if (logoutInFlightRef.current) {
      logAuthDiagnostic('AdminLayout.logout_skip', { reason: 'in_flight', path: location.pathname });
      return;
    }
    logoutInFlightRef.current = true;
    logAuthDiagnostic('AdminLayout.logout_start', { path: location.pathname });
    try {
      if (typeof logout === 'function') {
        await logout('admin');
      }
      logAuthDiagnostic('AdminLayout.logout_success', { path: location.pathname });
    } catch (err) {
      console.error('Logout failed', err);
      logAuthDiagnostic('AdminLayout.logout_error', {
        path: location.pathname,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      logAuthRedirect('AdminLayout.handleLogout', { path: location.pathname });
      navigate('/admin/login');
      logoutInFlightRef.current = false;
    }
  }, [location.pathname, logout, navigate]);

  const activeUser = user ?? authUser;

  // Cold-boot gate: only show the full-screen spinner during the very first
  // load when we have no session at all.  Once a session exists, this layout
  // NEVER shows a blocking overlay — RequireAuth is responsible for access
  // denial; AdminLayout only redirects on a hard unauthenticated state.
  if (normalizedAuthInitializing && !hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-softwhite">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // At this point we have a session (or auth is still resolving with a session).
  // Do NOT block here on unauthenticated state — the useEffect above fires the
  // navigate() redirect.  Returning null here caused blank flashes on navigation
  // while the session status was transitioning.  Let the layout stay mounted and
  // let RequireAuth / the redirect effect handle the auth denial path.
  // Do NOT block the layout render on adminPortalAllowed — that check is
  // performed asynchronously by RequireAuth which will show its own denial UI
  // if access is ultimately refused.  Blocking here caused a "Checking admin
  // access…" overlay on every internal navigation while the snapshot resolved.
  if (import.meta.env.DEV) {
    console.debug('[ADMIN LAYOUT RENDER]', location.pathname);
  }

  const content = (
    <div className="flex min-h-screen bg-softwhite">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-charcoal/40 backdrop-blur lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] transform bg-white shadow-[0_24px_60px_rgba(16,24,40,0.12)] transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-mist/70 px-6 py-6">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <img src="/logo.svg" alt="The Huddle Co." className="h-12 w-12 rounded-2xl shadow-lg" />
            <div className="min-w-0">
              <p className="font-heading text-xl font-bold text-charcoal">The Huddle Co.</p>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate/70">Admin Workspace</p>
              <p className="mt-1 text-[11px] text-slate/500">Manage learning, analytics, and organization settings.</p>
            </div>
          </Link>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5 text-slate/70" />
          </button>
        </div>

        <div className="flex h-full flex-col justify-between px-6 py-6">
          <div className="space-y-6">
            <Card tone="muted" className="space-y-3">
              {(() => {
                const sl = runtimeStatus.statusLabel;
                const label =
                  sl === 'ok' ? 'System Online' :
                  sl === 'degraded' ? 'Degraded' :
                  sl === 'demo-fallback' ? 'Demo Mode' :
                  'Checking…';
                const tone = (sl === 'ok' ? 'info' : 'attention') as 'info' | 'attention';
                const cls =
                  sl === 'ok'
                    ? 'bg-skyblue/10 text-skyblue'
                    : sl === 'degraded'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-gray-100 text-gray-600';
                return (
                  <Badge tone={tone} className={cls}>
                    {label}
                  </Badge>
                );
              })()}
              <div>
                <p className="font-heading text-lg font-semibold text-charcoal">
                  Welcome, {activeUser ? `${activeUser.firstName || ''} ${activeUser.lastName || ''}`.trim() || 'Admin' : 'Admin'}
                </p>
                <p className="text-xs text-slate/70">{activeUser?.role || 'Admin & Facilitator'}</p>
                {activeOrgLabel && (
                  <p className="text-xs text-slate/60">
                    Active org: <span className="font-semibold text-slate/90">{activeOrgLabel}</span>
                  </p>
                )}
              </div>
            </Card>

            <nav className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    end={item.exact}
                    onClick={(event) => {
                      if (import.meta.env.DEV) {
                        console.debug('[NAV CLICK]', item.href, { from: location.pathname });
                      }
                      logAdminNavEvent('admin_navigation_clicked', { source: 'sidebar', target: item.href });
                      const blocked = guardNavigation(item.href);
                      if (blocked) {
                        event.preventDefault();
                        return;
                      }
                      // Prevent NavLink's default navigation and drive it through
                      // startNavTransition so React keeps the current page visible
                      // while the target lazy chunk loads (deferred transition).
                      // Without this, React would show the Suspense fallback
                      // (spinner) immediately on every first visit to a page.
                      event.preventDefault();
                      startNavTransition(() => {
                        setSidebarOpen(false);
                        navigate(item.href);
                      });
                    }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-gradient-to-r from-sunrise/90 to-skyblue/90 text-white shadow-card-sm'
                          : 'text-slate/80 hover:bg-cloud hover:text-skyblue'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                            isActive ? 'bg-white/20 text-white' : 'bg-cloud text-slate'
                          }`}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="truncate">{item.name}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            <Card tone="muted" className="space-y-3">
              <p className="font-heading text-sm font-semibold text-charcoal">Quick actions</p>
              <Button asChild size="sm" variant="secondary" leadingIcon={<Plus className="h-4 w-4" />}>
                <Link
                  to="/admin/courses/new"
                    onClick={(event) => {
                      logAdminNavEvent('admin_quick_action_navigation_clicked', { source: 'quick_action', target: '/admin/courses/new' });
                      const blocked = guardNavigation('/admin/courses/new');
                      if (blocked) event.preventDefault();
                    }}
                >
                  Create course
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost" leadingIcon={<ClipboardList className="h-4 w-4" />}>
                <Link
                  to="/admin/courses/import"
                  onClick={(event) => {
                    logAdminNavEvent('admin_quick_action_navigation_clicked', { source: 'quick_action', target: '/admin/courses/import' });
                    const blocked = guardNavigation('/admin/courses/import');
                    if (blocked) event.preventDefault();
                  }}
                >
                  Import courses
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost" leadingIcon={<Bell className="h-4 w-4" />}>
                <Link
                  to="/admin/surveys/queue"
                  onClick={(event) => {
                    logAdminNavEvent('admin_quick_action_navigation_clicked', { source: 'quick_action', target: '/admin/surveys/queue' });
                    const blocked = guardNavigation('/admin/surveys/queue');
                    if (blocked) event.preventDefault();
                  }}
                >
                  Survey queue
                </Link>
              </Button>
            </Card>
          </div>

          {/* <Button variant="ghost" className="w-full justify-center" leadingIcon={<LogOut className="h-4 w-4" />} onClick={handleLogout}>
             Logout
           </Button> */}
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <ApiStatusBanner
          surface="admin"
          apiReachable={apiReachable}
          apiAuthRequired={apiAuthRequired}
          isAuthenticated={Boolean(isAuthenticated?.admin)}
          lastCheckedAt={runtimeStatus.lastChecked}
          onRetry={handleRuntimeRetry}
        />
  <header className="sticky top-0 z-20 border-b border-mist/60 bg-white/90 backdrop-blur">
          <div className="flex h-20 items-center justify-between px-6 lg:px-10">
            <div className="flex items-center gap-4">
              <button className="text-slate/70 hover:text-sunrise lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-6 w-6" />
              </button>
              <div className="relative hidden items-center rounded-full border border-mist bg-white px-4 py-2 text-sm text-slate/70 shadow-sm lg:flex">
                <Search className="mr-2 h-4 w-4" />
                <Input
                  placeholder="Search reports, orgs, or learners"
                  className="border-none p-0 text-sm text-charcoal focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <AdminNotificationBell />
              <div className="hidden items-center gap-3 rounded-full border border-mist bg-white px-4 py-2 text-sm text-slate/70 shadow-sm lg:flex">
                <div className="leading-tight">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate/60">Organization</p>
                  <p className="text-sm font-semibold text-charcoal">{activeOrgLabel ?? 'No organization'}</p>
                </div>
                {isMultiOrg && (
                  <select
                    className="rounded-md border border-cloud bg-white px-2 py-1 text-sm text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue"
                    value={activeOrgId ?? ''}
                    onChange={handleOrganizationChange}
                    disabled={isSwitching}
                  >
                    {organizationOptions.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.label}
                        {org.status ? ` · ${org.status}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={handleRefreshOrganizations}
                  disabled={isSwitching}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cloud text-slate/70 transition hover:text-skyblue disabled:opacity-60"
                  title="Sync organizations"
                  aria-label="Sync organizations"
                >
                  <RefreshCcw className="h-4 w-4" />
                </button>
              </div>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<ClipboardList className="h-4 w-4" />}
                onClick={() => startNavTransition(() => { void navigate('/admin/surveys/builder'); })}
              >
                New survey
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<LogOut className="h-4 w-4" />}
                onClick={() => void handleLogout()}
                className="hidden lg:inline-flex"
              >
                Logout
              </Button>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  ref={menuButtonRef}
                  onClick={handleMenuButtonClick}
                  className="flex items-center gap-2 rounded-full border border-mist bg-white px-4 py-2 text-sm font-semibold text-charcoal shadow-sm transition hover:border-skyblue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-controls="admin-account-menu"
                >
                  <span className="max-w-[160px] truncate">{accountEmail}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition ${menuOpen ? 'rotate-180 text-skyblue' : 'text-slate/80'}`}
                    aria-hidden="true"
                  />
                </button>

                {menuOpen && (
                  <div
                    id="admin-account-menu"
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-cloud bg-white shadow-[0_20px_50px_rgba(15,23,42,0.15)]"
                  >
                    <div className="border-b border-cloud px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate/60">
                      Signed in as
                      <div className="mt-1 truncate text-sm font-semibold text-charcoal">{accountEmail}</div>
                    </div>

                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-charcoal transition hover:bg-cloud/70"
                      onClick={() => {
                        closeMenu('nav_profile');
                        startNavTransition(() => { void navigate('/admin/profile'); });
                      }}
                    >
                      <UserCircle2 className="h-4 w-4 text-slate" aria-hidden="true" />
                      <span>Profile & Settings</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-3 border-t border-cloud px-4 py-3 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                      onClick={() => {
                        closeMenu('logout_click');
                        void handleLogout();
                      }}
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      <span>Log out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        <div className="px-6 pb-4 pt-0 lg:px-10">
          <SurveyQueueStatus />
        </div>
      </header>
      {isOrgSelectionRequired && (
        <div className="mx-6 mt-4 flex items-start gap-3 rounded-2xl border border-sunrise/30 bg-sunrise/10 px-4 py-3 text-sm text-sunrise lg:mx-10">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <div className="flex flex-1 flex-col gap-1">
            <span className="font-semibold">Select an active organization</span>
            <span className="text-sunrise/80">
              Admin tools stay locked until you choose a workspace. Pick an organization from the header dropdown to continue.
            </span>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              className="rounded-full border border-sunrise/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sunrise transition hover:bg-sunrise/10"
              onClick={handleRefreshOrganizations}
            >
              Refresh list
            </button>
            <button
              type="button"
              className="rounded-full bg-sunrise px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-sunrise/90"
              onClick={() => startNavTransition(() => { void navigate('/admin/organizations'); })}
            >
              Choose organization
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto bg-softwhite px-6 py-8 lg:px-12">
        {/* Nav-transition progress bar: visible only while startNavTransition is pending
            (i.e. a lazy chunk is loading after a sidebar click). Zero height when idle
            so it never shifts layout. */}
        {navPending && (
          <div className="pointer-events-none fixed left-0 right-0 top-0 z-[9999] h-0.5 overflow-hidden">
            <div className="h-full animate-[progress_1s_ease-in-out_infinite] bg-gradient-to-r from-sunrise via-skyblue to-forest" />
          </div>
        )}
        {/*
          resetKey={location.pathname} on AdminErrorBoundary clears its error
          state via getDerivedStateFromProps whenever the route changes — without
          unmounting the boundary fiber.  This is critical for startTransition
          deferred rendering: if we used key={location.pathname} instead, React
          would unmount the old fiber immediately on navigation, destroying the
          current Suspense tree and preventing startTransition from keeping the
          previous page visible while a lazy chunk loads.

          Class-based error boundaries do not reset their `hasError` state on
          re-render; getDerivedStateFromProps is the standard pattern for
          prop-driven resets without remounting.
        */}
        <AdminErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[40vh]">
              <LoadingSpinner size="lg" />
            </div>
          }>
            {/*
              NOTE: No key on <Outlet> or on AdminErrorBoundary.
              AdminErrorBoundary uses resetKey={location.pathname} which resets
              error state via getDerivedStateFromProps without unmounting the
              fiber tree — this preserves React's startTransition deferred
              rendering so the current page stays visible while a new lazy
              chunk loads.

              Page-level state resets are handled by useRouteChangeReset() inside
              each page component.  Module-level flags (_dashboardCatalogEverSucceeded
              etc.) survive unmount either way.
            */}
            <div>
              {import.meta.env.DEV && (() => { console.debug('[OUTLET RENDER]', location.pathname); return null; })()}
              {children ?? <Outlet />}
            </div>
          </Suspense>
        </AdminErrorBoundary>
      </main>
      <AdminOrgSelectorModal
        open={orgModalOpen}
        onClose={() => setOrgModalOpen(false)}
        organizationOptions={organizationOptions}
        activeOrgId={activeOrgId}
        selectOrganization={selectOrganization}
      />
      </div>
    </div>
  );

  return (
    <ErrorBoundary>
      {content}
    </ErrorBoundary>
  );
};

export default AdminLayout;
