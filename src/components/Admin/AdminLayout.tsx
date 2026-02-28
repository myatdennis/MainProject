import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FC, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { ErrorBoundary } from '../ErrorHandling';
import AdminErrorBoundary from '../ErrorBoundary/AdminErrorBoundary';
import { useSecureAuth } from '../../context/SecureAuthContext';
import {
  Shield,
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
} from 'lucide-react';
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
import { logAuthRedirect } from '../../utils/logAuthRedirect';
import { getAdminAccessSnapshot, hasAdminPortalAccess } from '../../lib/adminAccess';

interface AdminLayoutProps {
  children?: ReactNode;
}

type AdminNavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

const navigation: AdminNavItem[] = [
  { name: 'Overview', href: '/admin/dashboard', icon: LayoutDashboard, exact: true },
  { name: 'Courses', href: '/admin/courses', icon: BookOpen },
  { name: 'Course Builder', href: '/admin/course-builder/new', icon: Wand2 },
  { name: 'Surveys', href: '/admin/surveys', icon: ClipboardList },
  { name: 'Survey Creator', href: '/admin/surveys/builder', icon: PenSquare },
  { name: 'Organizations', href: '/admin/organizations', icon: Building2 },
  { name: 'Users', href: '/admin/users', icon: UsersIcon },
  { name: 'Leadership AI', href: '/admin/leadership', icon: Brain },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Documents', href: '/admin/documents', icon: FileText },
  { name: 'Performance', href: '/admin/performance', icon: TrendingUp },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

const AdminLayout: FC<AdminLayoutProps> = ({ children }) => {
  const {
    isAuthenticated,
    user: authUser,
    authInitializing,
    logout: legacyLogout,
    sessionStatus,
    user,
  } = useSecureAuth();
  const hasSession = Boolean(user);
  const { showToast } = useToast();
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
  const location = useLocation();
  const navigate = useNavigate();
  const accountEmail = user?.email ?? authUser?.email ?? 'Admin';
  const env = import.meta.env as Record<string, string | boolean | undefined>;
  const ADMIN_MENU_DEBUG = Boolean(env?.DEV || env?.VITE_ENABLE_ADMIN_MENU_DEBUG === 'true');
  const apiReachable = runtimeStatus.apiReachable ?? runtimeStatus.apiHealthy;
  const apiAuthRequired = Boolean(runtimeStatus.apiAuthRequired);
  const isOrgSelectionRequired = Boolean(isMultiOrg && !activeOrgId);

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
      console.log('[AdminMenu] button click', {
        pointerType,
        defaultPrevented: event.defaultPrevented,
        target: event.currentTarget,
        timestamp: Date.now(),
      });
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
      if (!isOrgSelectionRequired) {
        return false;
      }
      const allowList = ['/admin/organizations', '/admin/settings'];
      if (allowList.some((allowed) => targetPath.startsWith(allowed))) {
        return false;
      }
      showToast('Select an active organization to access this area.', 'error');
      return true;
    },
    [isOrgSelectionRequired, showToast],
  );

  const adminAccessSnapshot = getAdminAccessSnapshot();
  const adminPortalAllowed = hasAdminPortalAccess(adminAccessSnapshot?.payload ?? null);

  useEffect(() => {
    if (authInitializing || sessionStatus !== 'ready') {
      return;
    }
    if (!hasSession || !adminPortalAllowed) {
      if (location.pathname !== '/admin/login') {
        logAuthRedirect('AdminLayout.auth_guard', {
          path: location.pathname,
          reason: 'missing_admin_session',
        });
        navigate('/admin/login');
      }
    }
  }, [authInitializing, sessionStatus, hasSession, adminPortalAllowed, location.pathname, navigate]);

  useEffect(() => {
    if (!(import.meta.env?.DEV || process.env?.NODE_ENV !== 'production')) {
      return;
    }
    console.debug('[AdminLayout] gate_state', {
      path: location.pathname,
      authInitializing,
      sessionStatus,
      hasSession,
      adminPortalAllowed,
    });
  }, [authInitializing, sessionStatus, hasSession, adminPortalAllowed, location.pathname]);

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
      console.log('[AdminMenu] document click', {
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

  const handleLogout = async () => {
    try {
      await logout();
      if (typeof legacyLogout === 'function') {
        await legacyLogout('admin');
      }
      logAuthRedirect('AdminLayout.handleLogout', { path: location.pathname });
      navigate('/admin/login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const activeUser = user ?? authUser;

  if (authInitializing || sessionStatus !== 'ready') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-softwhite">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated?.admin || !adminPortalAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-softwhite text-sm text-slate/80">
        Checking admin access…
      </div>
    );
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
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sunrise via-skyblue to-forest text-white">
              <Shield className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading text-lg font-bold text-charcoal">Admin Portal</p>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate/70">The Huddle Co.</p>
            </div>
          </Link>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5 text-slate/70" />
          </button>
        </div>

        <div className="flex h-full flex-col justify-between px-6 py-6">
          <div className="space-y-6">
            <Card tone="muted" className="space-y-3">
              <Badge tone="info" className="bg-skyblue/10 text-skyblue">
                System Online
              </Badge>
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
                      if (guardNavigation(item.href)) {
                        event.preventDefault();
                        return;
                      }
                      setSidebarOpen(false);
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
                    if (guardNavigation('/admin/courses/new')) event.preventDefault();
                  }}
                >
                  Create course
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost" leadingIcon={<ClipboardList className="h-4 w-4" />}>
                <Link
                  to="/admin/courses/import"
                  onClick={(event) => {
                    if (guardNavigation('/admin/courses/import')) event.preventDefault();
                  }}
                >
                  Import courses
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost" leadingIcon={<Bell className="h-4 w-4" />}>
                <Link
                  to="/admin/surveys/queue"
                  onClick={(event) => {
                    if (guardNavigation('/admin/surveys/queue')) event.preventDefault();
                  }}
                >
                  Survey queue
                </Link>
              </Button>
            </Card>
          </div>

          <Button variant="ghost" className="w-full justify-center" leadingIcon={<LogOut className="h-4 w-4" />} onClick={handleLogout}>
            Logout
          </Button>
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
                  title="Refresh organizations"
                >
                  <RefreshCcw className="h-4 w-4" />
                </button>
              </div>
              <Button variant="ghost" size="sm" leadingIcon={<Bell className="h-4 w-4" />}>
                Alerts
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<ClipboardList className="h-4 w-4" />}
                onClick={() => navigate('/admin/surveys/builder')}
              >
                New survey
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
                        navigate('/admin/profile');
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
          <button
            type="button"
            className="rounded-full border border-sunrise/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sunrise transition hover:bg-sunrise/10"
            onClick={handleRefreshOrganizations}
          >
            Refresh list
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto bg-softwhite px-6 py-8 lg:px-12">
        {children ?? <Outlet />}
      </main>
      </div>
    </div>
  );

  return (
    <ErrorBoundary>
      <AdminErrorBoundary>{content}</AdminErrorBoundary>
    </ErrorBoundary>
  );
};

export default AdminLayout;
