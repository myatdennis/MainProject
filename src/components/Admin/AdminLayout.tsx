import { useEffect, useState, type FC, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
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
  LayoutDashboard,
  PenSquare,
  Users as UsersIcon,
  Building2,
  Wand2,
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';
import SurveyQueueStatus from '../Survey/SurveyQueueStatus';
import type { LucideIcon } from 'lucide-react';

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
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
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
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    end={item.exact}
                    onClick={() => setSidebarOpen(false)}
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
