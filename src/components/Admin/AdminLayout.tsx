import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Outlet } from 'react-router-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ErrorBoundary from '../ErrorBoundary';
import AdminDashboard from '../../pages/Admin/AdminDashboard';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  BookOpen, 
  BarChart3, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Shield,
  Bell,
  Search,
  TrendingUp,
  Award,
  Zap,
  Brain,
  Plus,
  Send
} from 'lucide-react';

const AdminLayout: FC = () => {
  const { logout, isAuthenticated, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [showDirectDashboard, setShowDirectDashboard] = useState(false);

  // Check authentication
  useEffect(() => {
    // Avoid redirect loops or premature navigation while the auth provider
    // is still initializing. If we're already on the login page, don't
    // force navigation. Also respect a localStorage demo flag so transient
    // states don't cause a redirect before AuthProvider finishes.
    if (location.pathname === '/admin/login') return;

    const adminLocal = typeof window !== 'undefined' && localStorage.getItem('huddle_admin_auth') === 'true';
    // Only navigate to the login page when we are sure the user is not
    // authenticated (no local flag and context says unauthenticated).
    if (!isAuthenticated?.admin && !adminLocal) {
      navigate('/admin/login');
    }
  }, [isAuthenticated?.admin, navigate]);

  const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Users & Progress', href: '/admin/users', icon: Users },
    { name: 'Organizations', href: '/admin/organizations', icon: Building2 },
    { name: 'Send Resource', href: '/admin/send-resource', icon: Send },
    { name: 'Course Management', href: '/admin/courses', icon: BookOpen },
    { name: 'DEI Surveys', href: '/admin/surveys', icon: BarChart3 },
    { name: 'Reports & Analytics', href: '/admin/reports', icon: TrendingUp },
  { name: 'Advanced Analytics', href: '/admin/analytics', icon: Brain },
    { name: 'Certificates', href: '/admin/certificates', icon: Award },
    { name: 'Integrations', href: '/admin/integrations', icon: Zap },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const isActive = (href: string) => location.pathname === href;

  const handleLogout = async () => {
    await logout('admin');
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <Link to="/" className="flex items-center space-x-2">
            <div className="bg-gradient-to-r from-orange-400 to-red-500 p-2 rounded-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-gray-900">Admin Portal</span>
              <p className="text-xs text-gray-500">The Huddle Co.</p>
            </div>
          </Link>
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>

        <div className="flex flex-col h-full">
          <div className="flex-1 px-4 py-6">
            <div className="mb-6">
              <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-1">Welcome, {user?.name || 'Admin'}</h3>
                <p className="text-sm text-gray-600">{user?.role || 'Admin & Facilitator'}</p>
                <div className="mt-2 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">System Online</span>
                </div>
              </div>
            </div>

            <nav className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                      isActive(item.href)
                        ? 'bg-orange-50 text-orange-600 border-r-2 border-orange-500'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors duration-200"
            >
              <LogOut className="h-5 w-5 mr-3" />
              Logout
            </button>
          </div>
        </div>
      </div>

  {/* Main content */}
  <div className="flex-1 lg:ml-64">
        {/* Top bar */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-gray-600 hover:text-gray-900 lg:hidden"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="hidden lg:flex items-center space-x-2">
                <div className="bg-gradient-to-r from-orange-400 to-red-500 p-2 rounded-lg">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-gray-900">Admin Portal</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users, orgs..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm w-64"
                />
              </div>
              {/* Quick create button using Plus icon */}
              <button
                title="Create new"
                onClick={() => navigate('/admin/organizations/new')}
                className="ml-2 inline-flex items-center px-3 py-2 rounded bg-green-50 text-green-600 hover:bg-green-100"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button className="relative p-2 text-gray-600 hover:text-gray-900">
                <Bell className="h-5 w-5" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400"></span>
              </button>
              <div className="flex items-center space-x-2">
                <img 
                  src="https://images.pexels.com/photos/3184416/pexels-photo-3184416.jpeg?auto=compress&cs=tinysrgb&w=100" 
                  alt={user?.name || 'Admin'}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.name || 'Admin'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Debug toggle - visible so we can mount the dashboard directly */}
        <div className="absolute right-6 top-20">
          <button
            onClick={() => setShowDirectDashboard(prev => !prev)}
            className="text-xs px-2 py-1 bg-yellow-100 border border-yellow-200 rounded text-yellow-800"
            title="Toggle direct dashboard (debug)"
          >
            Toggle Direct Dashboard
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="p-4 bg-yellow-50 border-b border-yellow-100 text-sm text-yellow-800">
            Debug: current path: {location.pathname}
          </div>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>

          {/* Temporary debug: allow mounting the AdminDashboard directly to check
              if the dashboard component itself renders in environments where
              the routed Outlet appears blank. Toggle with the button in the
              top bar. Remove after debugging. */}
          {showDirectDashboard && (
            <div className="p-6 mt-4 bg-white border border-red-200 rounded-lg">
              <div className="mb-2 text-sm text-red-600 font-medium">Debug: Direct-mounted AdminDashboard</div>
              <AdminDashboard />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;