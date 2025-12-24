import { useEffect, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  Award,
  Download,
  MessageSquare,
  Phone,
  Settings,
  HelpCircle,
  Menu,
  X,
  Users,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';

interface LMSLayoutProps {
  children?: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/lms/dashboard', icon: LayoutDashboard },
  { name: 'My Courses', href: '/lms/courses', icon: BookOpen },
  { name: 'Progress', href: '/lms/progress', icon: TrendingUp },
  { name: 'Certificates', href: '/lms/certificates', icon: Award },
  { name: 'Downloads', href: '/lms/downloads', icon: Download },
  { name: 'Submit Feedback', href: '/lms/feedback', icon: MessageSquare },
  { name: 'Contact Coach', href: '/lms/contact', icon: Phone },
  { name: 'Settings', href: '/lms/settings', icon: Settings },
  { name: 'Help', href: '/lms/help', icon: HelpCircle },
];

const LMSLayout = ({ children }: LMSLayoutProps) => {
  const { logout, isAuthenticated, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const supabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

  useEffect(() => {
    if (!supabaseConfigured) {
      return;
    }

    if (!isAuthenticated.lms) {
      navigate('/lms/login');
    }
  }, [isAuthenticated.lms, navigate, supabaseConfigured]);

  if (isAuthenticated.lms === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-softwhite">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!supabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-softwhite px-6 text-center">
        <Card tone="muted" className="max-w-xl space-y-4">
          <Badge tone="info" className="bg-sunrise/10 text-sunrise">
            LMS configuration required
          </Badge>
          <h1 className="font-heading text-2xl font-bold text-charcoal">Connect Supabase to enable the learner portal</h1>
          <p className="text-sm text-slate/80">
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your environment before accessing the LMS. Once configured,
            redeploy and sign in with your learner credentials.
          </p>
        </Card>
      </div>
    );
  }

  const isActive = (href: string) => location.pathname === href;

  const handleLogout = async () => {
    await logout('lms');
    navigate('/lms/login');
  };

  return (
    <div className="flex min-h-screen bg-softwhite">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-charcoal/40 backdrop-blur lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] transform bg-white shadow-[0_24px_60px_rgba(16,24,40,0.12)] transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-mist/70 px-6 py-6">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ background: 'var(--gradient-brand)' }}>
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading text-base font-bold text-charcoal">The Huddle Co.</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate/70">Learner Portal</p>
            </div>
          </Link>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5 text-slate/70" />
          </button>
        </div>

        <div className="flex h-full flex-col justify-between px-5 py-6">
          <div className="space-y-6">
            <Card tone="muted" className="space-y-3">
              <Badge tone="info" className="bg-skyblue/10 text-skyblue">
                Spring 2025 Cohort
              </Badge>
              <div>
                <p className="font-heading text-base font-semibold text-charcoal">Welcome, {user?.email || 'Learner'}</p>
                <p className="text-xs text-slate/70">Keep building your inclusive leadership practice.</p>
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
                        ? 'text-white shadow-card-sm'
                        : 'text-slate/80 hover:bg-cloud hover:text-skyblue'
                    }`}
                    style={active ? { background: 'var(--gradient-blue-green)' } : undefined}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
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
          </div>

          <Button variant="ghost" className="w-full justify-center" leadingIcon={<LogOut className="h-4 w-4" />} onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-mist/60 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-6 lg:px-10">
            <div className="flex items-center gap-3">
              <button className="text-slate/70 hover:text-sunrise lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-6 w-6" />
              </button>
              <p className="hidden font-heading text-lg font-semibold text-charcoal lg:block">Leadership Journey</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate/70">
              <Badge tone="info" className="bg-sunrise/10 text-sunrise">
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Badge>
              <span>{user?.email}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-softwhite px-6 py-8 lg:px-12">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
};

export default LMSLayout;
