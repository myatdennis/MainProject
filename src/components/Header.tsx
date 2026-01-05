import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search, Zap } from 'lucide-react';
import Button from './ui/Button';
import Input from './ui/Input';
import cn from '../utils/cn';
import RealtimeNotifications from './RealtimeNotifications';
import { useSecureAuth } from '../context/SecureAuthContext';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
  const { user, isAuthenticated, authInitializing } = useSecureAuth();
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

  const roleLabel = user?.role === 'admin' ? 'Admin' : 'Learner';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
                onClick={() => navigate('/admin/login')}
                className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-heading font-semibold shadow-card-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite btn-cta"
              >
                Admin Portal
              </button>
            </>
          )}
          {isLoggedIn && (
            <div className="hidden md:flex items-center gap-2 rounded-full border border-mist bg-white px-3 py-1.5 shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-skyblue/10 text-skyblue font-heading text-sm">
                {userInitials}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-charcoal">{displayName || 'Welcome'}</p>
                <p className="text-xs text-slate/70">{roleLabel}</p>
              </div>
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
                    onClick={() => setIsMenuOpen(false)}
                    className="inline-flex h-11 items-center justify-center rounded-lg text-sm font-heading font-semibold shadow-card-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite btn-cta"
                  >
                    Admin
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to={user?.role === 'admin' ? '/admin/dashboard' : '/lms/dashboard'}
                    onClick={() => setIsMenuOpen(false)}
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-skyblue/30 text-sm font-semibold text-skyblue transition hover:bg-skyblue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite"
                  >
                    {user?.role === 'admin' ? 'Admin Portal' : 'Learner Home'}
                  </Link>
                  <button
                    type="button"
                    onClick={() => navigate(user?.role === 'admin' ? '/admin/dashboard' : '/lms/dashboard')}
                    className="inline-flex h-11 items-center justify-center rounded-lg text-sm font-heading font-semibold shadow-card-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyblue focus-visible:ring-offset-2 focus-visible:ring-offset-softwhite btn-cta"
                  >
                    Continue
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
