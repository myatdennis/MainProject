import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search, Zap, ChevronDown, LogOut, LayoutDashboard } from 'lucide-react';
import Button from './ui/Button';
import Input from './ui/Input';
import cn from '../utils/cn';
import { logAuthRedirect } from '../utils/logAuthRedirect';
import RealtimeNotifications from './RealtimeNotifications';
import { useSecureAuth } from '../context/SecureAuthContext';
import { useAdminAccessState } from '../lib/adminAccessState';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Courses', href: '/courses' },
    { name: 'Resources', href: '/resources' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' },
  ];
  const navigate = useNavigate();
  const { user, isAuthenticated, authInitializing, logout, sessionStatus } = useSecureAuth();
  const {
    adminPortalAllowed,
    hasSession: adminHasSession,
    sessionStatus: adminSessionStatus,
    authInitializing: adminAuthInitializing,
  } = useAdminAccessState();
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const isLoggedIn = Boolean(user) && (isAuthenticated?.admin || isAuthenticated?.lms);
  const displayName = useMemo(() => {
    if (!user) return '';
    const composed = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (composed.length > 0) return composed;
    if (user.email) return user.email.split('@')[0];
    return 'User';
  }, [user]);

  const userInitials = useMemo(() => {
    if (!user) return 'U';
    const first = user.firstName?.charAt(0);
    const last = user.lastName?.charAt(0);
    const fallback = user.email?.charAt(0) ?? 'U';
    return `${first ?? ''}${last ?? ''}`.trim().toUpperCase() || fallback.toUpperCase();
  }, [user]);

  const isAdminRole = (user?.role ?? '').toLowerCase() === 'admin' || Boolean(user?.isPlatformAdmin);
  const roleLabel = isAdminRole ? 'Admin' : 'Learner';
  const gateSessionStatus = adminSessionStatus ?? sessionStatus;
  const gateAuthInitializing = adminAuthInitializing ?? authInitializing;
  const canAccessAdmin = Boolean(isAuthenticated?.admin);
  const canAccessLms = Boolean(isAuthenticated?.lms);
  const primaryWorkspacePath = canAccessAdmin ? '/admin/dashboard' : '/lms/dashboard';

  const handleToggleUserMenu = useCallback(() => {
    if (!isLoggedIn || authInitializing) {
      return;
    }
    setUserMenuOpen((prev) => !prev);
  }, [authInitializing, isLoggedIn]);

  const handleNavigateTo = useCallback(
    (path: string) => {
      setUserMenuOpen(false);
      navigate(path);
    },
    [navigate],
  );

  const handleLogout = useCallback(async () => {
    if (!isLoggedIn) return;
    setUserMenuOpen(false);
    const surface: 'admin' | 'lms' = canAccessAdmin ? 'admin' : 'lms';
    try {
      await logout(surface);
    } catch (error) {
      console.warn('[Header] logout failed (continuing)', error);
    }
    const target = surface === 'admin' ? '/admin/login' : '/lms/login';
    if (surface === 'admin') {
      logAuthRedirect('Header.handleLogout', { target });
    }
    navigate(target);
  }, [canAccessAdmin, isLoggedIn, logout, navigate]);

  const handleAdminCtaClick = useCallback(() => {
    const gateHasSession = adminHasSession ?? Boolean(user);
    const gateState = {
      sessionStatus: gateSessionStatus,
      hasSession: gateHasSession,
      adminPortalAllowed,
      isAdminRole,
    };
    if (import.meta.env?.DEV) {
      console.debug('[Header] admin_cta_gate_state', gateState);
    }
    if (gateAuthInitializing || gateSessionStatus !== 'ready') {
      return;
    }
    if (gateHasSession && adminPortalAllowed) {
      navigate('/admin/courses');
      return;
    }
    logAuthRedirect('Header.admin_cta', { target: '/admin/login', gateState });
    navigate('/admin/login');
  }, [adminHasSession, adminPortalAllowed, gateAuthInitializing, gateSessionStatus, isAdminRole, navigate, user]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!userMenuOpen) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    setUserMenuOpen(false);
  }, [location.pathname]);

  const isActive = (href: string) => location.pathname === href;

  return (
    <header
      className={`sticky top-0 z-50 border-b border-mist/60 bg-softwhite/95 backdrop-blur supports-[backdrop-filter]:bg-softwhite/80 transition-shadow ${
        scrolled ? 'shadow-[0_6px_24px_rgba(16,24,40,0.08)]' : ''
      }`}
      aria-label="Primary navigation"
      role="navigation"
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-12">
        <Link to="/" aria-label="Go to home" className="flex items-center gap-3 no-underline">
          <img
            src="/logo.svg"
            alt="Huddle Co."
            className="h-12 w-12 rounded-2xl shadow-card-sm"
          />
        </Link>

        <nav className="hidden lg:flex items-center gap-2" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`nav-link ${isActive(item.href) ? 'is-active' : ''}`}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {isLoggedIn && (
            <RealtimeNotifications enabled={!authInitializing} limit={20} />
          )}
          <div className="hidden md:flex items-center gap-2 rounded-full border border-mist bg-white px-3 py-1.5 shadow-sm">
            <Search className="h-4 w-4 text-slate/70" />
            <Input
              placeholder="Search courses"
              className="w-40 border-none p-0 text-sm text-charcoal focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="hidden md:inline-flex"
            leadingIcon={<Zap className="h-4 w-4" />}
          >
            Demo Mode
          </Button>
          {!isLoggedIn && (
            <>
              <Link
                to="/lms/login"
                className={cn(
                  'hidden sm:inline-flex h-11 items-center justify-center rounded-lg border border-skyblue/30 px-4 text-sm font-semibold text-skyblue transition-colors hover:bg-skyblue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite'
                )}
              >
                Client Login
              </Link>
              <button
                type="button"
                onClick={handleAdminCtaClick}
                className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-heading font-semibold shadow-card-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite btn-cta"
              >
                Admin Portal
              </button>
            </>
          )}
          {isLoggedIn && (
            <div className="relative hidden md:block" ref={userMenuRef}>
              <button
                type="button"
                ref={userMenuButtonRef}
                onClick={handleToggleUserMenu}
                className="flex items-center gap-3 rounded-full border border-mist bg-white px-3 py-1.5 text-left shadow-sm transition hover:border-skyblue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue"
                aria-haspopup="true"
                aria-expanded={userMenuOpen}
                aria-controls="primary-user-menu"
                disabled={authInitializing}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-skyblue/10 text-skyblue font-heading text-sm">
                  {userInitials}
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-charcoal">{displayName || 'Welcome'}</p>
                  <p className="text-xs text-slate/70">{roleLabel}</p>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate/70 transition ${userMenuOpen ? 'rotate-180 text-skyblue' : ''}`} />
              </button>
              {userMenuOpen && (
                <div
                  id="primary-user-menu"
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-mist bg-white shadow-2xl"
                >
                  <div className="border-b border-mist px-4 py-3 text-xs text-slate/70">
                    Signed in as
                    <div className="truncate text-sm font-semibold text-charcoal">{user?.email ?? 'Unknown user'}</div>
                  </div>
                  {canAccessAdmin && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleNavigateTo('/admin/dashboard')}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-charcoal transition hover:bg-cloud/60"
                    >
                      <LayoutDashboard className="h-4 w-4 text-slate" />
                      <span>Admin Dashboard</span>
                    </button>
                  )}
                  {canAccessLms && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleNavigateTo('/lms/dashboard')}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-charcoal transition hover:bg-cloud/60"
                    >
                      <LayoutDashboard className="h-4 w-4 text-slate" />
                      <span>Learner Home</span>
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 border-t border-mist px-4 py-3 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-mist text-charcoal lg:hidden"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="border-t border-mist/60 bg-softwhite lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsMenuOpen(false)}
                className={`nav-link ${isActive(item.href) ? 'is-active' : ''}`}
              >
                {item.name}
              </Link>
            ))}
            {isLoggedIn && (
              <div className="py-4 border-t border-mist/60">
                <RealtimeNotifications enabled={!authInitializing} limit={10} />
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-mist bg-white px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-skyblue/10 text-skyblue font-heading">
                    {userInitials}
                  </div>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-charcoal">{displayName || 'Welcome'}</p>
                    <p className="text-xs text-slate/70">{roleLabel}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {!isLoggedIn ? (
                <>
                  <Link
                    to="/lms/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-skyblue/30 text-sm font-semibold text-skyblue transition hover:bg-skyblue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite"
                  >
                    Client
                  </Link>
                  <Link
                    to="/admin/login"
                    onClick={() => {
                      logAuthRedirect('Header.mobile_admin_cta', { target: '/admin/login' });
                      setIsMenuOpen(false);
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-lg text-sm font-heading font-semibold shadow-card-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite btn-cta"
                  >
                    Admin
                  </Link>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigate(primaryWorkspacePath);
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-skyblue/30 text-sm font-semibold text-skyblue transition hover:bg-skyblue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite"
                  >
                    {canAccessAdmin ? 'Admin Dashboard' : 'Learner Home'}
                  </button>
                  {canAccessAdmin && canAccessLms ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate('/lms/dashboard');
                      }}
                      className="inline-flex h-11 items-center justify-center rounded-lg text-sm font-heading font-semibold shadow-card-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite btn-cta"
                    >
                      Learner Home
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate(primaryWorkspacePath);
                      }}
                      className="inline-flex h-11 items-center justify-center rounded-lg text-sm font-heading font-semibold shadow-card-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite btn-cta"
                    >
                      Continue
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      void handleLogout();
                    }}
                    className="col-span-2 inline-flex h-11 items-center justify-center rounded-lg border border-rose-200 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
