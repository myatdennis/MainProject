import { useEffect, useState, type FC, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { ErrorBoundary } from '../ErrorHandling';
import AdminErrorBoundary from '../ErrorBoundary/AdminErrorBoundary';
import { useAuth } from '../../context/AuthContext';
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
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';
import SurveyQueueStatus from '../Survey/SurveyQueueStatus';

interface AdminLayoutProps {
  children?: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: TrendingUp },
  { name: 'Courses', href: '/admin/courses', icon: BookOpen },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Surveys', href: '/admin/surveys', icon: ClipboardList },
  { name: 'Documents', href: '/admin/documents', icon: FileText },
  { name: 'Performance', href: '/admin/performance', icon: TrendingUp },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

const AdminLayout: FC<AdminLayoutProps> = ({ children }) => {
  const { isAuthenticated, user, authInitializing, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (authInitializing) return;
    if (!isAuthenticated?.admin && location.pathname !== '/admin/login') {
      navigate('/admin/login');
    }
  }, [authInitializing, isAuthenticated?.admin, location.pathname, navigate]);

  const isActive = (href: string) => {
    if (href === '/admin/dashboard') {
      return location.pathname === '/admin' || location.pathname === '/admin/dashboard';
    }
    return location.pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await logout('admin');
    navigate('/admin/login');
  };

  if (authInitializing || isAuthenticated?.admin === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-softwhite">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated?.admin) {
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
                  Welcome, {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin' : 'Admin'}
                </p>
                <p className="text-xs text-slate/70">{user?.role || 'Admin & Facilitator'}</p>
              </div>
            </Card>

            <nav className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      active
                        ? 'bg-gradient-to-r from-sunrise/90 to-skyblue/90 text-white shadow-card-sm'
                        : 'text-slate/80 hover:bg-cloud hover:text-skyblue'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        active ? 'bg-white/20 text-white' : 'bg-cloud text-slate'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <Card tone="muted" className="space-y-3">
              <p className="font-heading text-sm font-semibold text-charcoal">Quick actions</p>
              <Button asChild size="sm" variant="secondary" leadingIcon={<Plus className="h-4 w-4" />}>
                <Link to="/admin/courses/new">Create course</Link>
              </Button>
              <Button asChild size="sm" variant="ghost" leadingIcon={<ClipboardList className="h-4 w-4" />}>
                <Link to="/admin/courses/import">Import courses</Link>
              </Button>
              <Button asChild size="sm" variant="ghost" leadingIcon={<Bell className="h-4 w-4" />}>
                <Link to="/admin/surveys/queue">Survey queue</Link>
              </Button>
            </Card>
          </div>

          <Button variant="ghost" className="w-full justify-center" leadingIcon={<LogOut className="h-4 w-4" />} onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-mist/60 bg-white/90 backdrop-blur">
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
            </div>
          </div>
          <div className="px-6 pb-4 pt-0 lg:px-10">
            <SurveyQueueStatus />
          </div>
        </header>

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
