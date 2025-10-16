import { useState, useEffect } from 'react';
import type { FC, ReactNode } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { ErrorBoundary } from '../ErrorHandling';
import AdminErrorBoundary from '../ErrorBoundary/AdminErrorBoundary';
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
  Search,
  Plus,
  TrendingUp,
  Brain,
  Smartphone,
  FileCheck,
  Activity,
  Clock,
  Target
} from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';
import NotificationBannerHost from '../notifications/NotificationBannerHost';

interface AdminLayoutProps {
  children?: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Organizations', href: '/admin/organizations', icon: Building2 },
  { name: 'Courses', href: '/admin/courses', icon: BookOpen },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Performance', href: '/admin/performance', icon: TrendingUp },
  { name: 'Notifications', href: '/admin/notifications', icon: Target },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

const AdminLayout: FC<AdminLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [liveStats, setLiveStats] = useState({
    activeUsers: 47,
    activeCourses: 23,
    loadTime: 0.8,
    successRate: 99.1,
    activeSurveys: 3,
    surveyResponses: 156
  });
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Handle authentication redirect with delay to allow auth to complete
  useEffect(() => {
    console.log('AdminLayout: Auth state check', { isAuthenticated, user, location: location.pathname });
    
    // Give auth system time to initialize
    const authCheckTimeout = setTimeout(() => {
      setAuthLoading(false);
      
      if (!isAuthenticated?.admin) {
        console.log('AdminLayout: Not authenticated after timeout, redirecting to login');
        // Only redirect if we're not already on the login page
        if (location.pathname !== '/admin/login') {
          navigate('/admin/login');
        }
      } else {
        console.log('AdminLayout: Admin authenticated successfully');
      }
    }, 1000); // Give 1 second for auth to initialize

    return () => clearTimeout(authCheckTimeout);
  }, [isAuthenticated, navigate, location.pathname]);

  // If still loading auth, show loading screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-gray-900">Initializing Admin Portal...</h2>
          <p className="text-gray-600">Checking authentication status</p>
        </div>
      </div>
    );
  }

  // Simulate real-time updates for sidebar widgets
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStats(prev => ({
        activeUsers: Math.max(30, Math.min(60, prev.activeUsers + Math.floor(Math.random() * 3) - 1)),
        activeCourses: Math.max(15, Math.min(35, prev.activeCourses + Math.floor(Math.random() * 2) - 1)),
        loadTime: Math.max(0.5, Math.min(1.2, prev.loadTime + (Math.random() - 0.5) * 0.1)),
        successRate: Math.max(95, Math.min(100, prev.successRate + (Math.random() - 0.5) * 0.5)),
        activeSurveys: Math.max(1, Math.min(5, prev.activeSurveys + Math.floor(Math.random() * 2) - 1)),
        surveyResponses: prev.surveyResponses + Math.floor(Math.random() * 2)
      }));
    }, 15000); // Update every 15 seconds

    return () => clearInterval(interval);
  }, []);

  // Show loading while checking auth
  if (!isAuthenticated?.admin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Checking authentication...</div>
      </div>
    );
  }

  const isActive = (path: string) => {
    if (path === '/admin/dashboard') {
      return location.pathname === '/admin' || location.pathname === '/admin/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await logout('admin');
    navigate('/admin/login');
  };

  const handleAIContent = () => {
    // Navigate to a modal or dedicated AI content creation area
    navigate('/admin/dashboard', { state: { showAIModal: true } });
  };

  const handleMobileView = () => {
    // Open mobile admin interface in new tab or modal
    window.open('/admin/mobile', '_blank');
  };

  const handleQuickActivity = () => {
    // Navigate to real-time analytics
    navigate('/admin/analytics', { state: { tab: 'realtime' } });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 lg:flex lg:flex-col lg:shadow-none lg:border-r lg:border-gray-200`}>
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

              {/* Enhanced Portal Widgets */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Enhanced Tools
                </h3>
                
                {/* Real-time Activity Widget */}
                <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg mx-2 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors" 
                     onClick={handleQuickActivity}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-700">Live Activity</span>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                  <div className="text-xs text-blue-600">
                    <div className="flex justify-between">
                      <span>Active Users:</span>
                      <span className="font-semibold">{liveStats.activeUsers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Courses Active:</span>
                      <span className="font-semibold">{liveStats.activeCourses}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="mb-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg mx-2">
                  <div className="flex items-center space-x-2 mb-2">
                    <Brain className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-medium text-green-700">AI Assistant</span>
                  </div>
                  <button 
                    onClick={handleAIContent}
                    className="w-full text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors">
                    Generate Content
                  </button>
                </div>

                {/* Performance Metrics */}
                <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg mx-2 cursor-pointer hover:from-purple-100 hover:to-pink-100 transition-colors"
                     onClick={() => navigate('/admin/performance')}>
                  <div className="flex items-center space-x-2 mb-2">
                    <Target className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700">Performance</span>
                  </div>
                  <div className="text-xs text-purple-600">
                    <div className="flex justify-between">
                      <span>Load Time:</span>
                      <span className={`font-semibold ${liveStats.loadTime < 1.0 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {liveStats.loadTime.toFixed(1)}s
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Success Rate:</span>
                      <span className={`font-semibold ${liveStats.successRate > 98 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {liveStats.successRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile Admin Quick Access */}
                <div className="mb-4 p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg mx-2">
                  <div className="flex items-center space-x-2 mb-2">
                    <Smartphone className="h-4 w-4 text-orange-600" />
                    <span className="text-xs font-medium text-orange-700">Mobile Admin</span>
                  </div>
                  <button 
                    onClick={handleMobileView}
                    className="w-full text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700 transition-colors">
                    Launch Mobile View
                  </button>
                </div>

                {/* Survey Status */}
                <div className="mb-4 p-3 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg mx-2 cursor-pointer hover:from-teal-100 hover:to-cyan-100 transition-colors"
                     onClick={() => navigate('/admin/surveys')}>
                  <div className="flex items-center space-x-2 mb-2">
                    <FileCheck className="h-4 w-4 text-teal-600" />
                    <span className="text-xs font-medium text-teal-700">DEI Surveys</span>
                  </div>
                  <div className="text-xs text-teal-600">
                    <div className="flex justify-between">
                      <span>Active:</span>
                      <span className="font-semibold">{liveStats.activeSurveys}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Responses:</span>
                      <span className="font-semibold">{liveStats.surveyResponses}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Activity Feed */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg mx-2">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <span className="text-xs font-medium text-gray-700">Recent Activity</span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="truncate">Sarah Chen completed Course A</div>
                    <div className="truncate">Mike Johnson registered</div>
                    <div className="truncate">AI analysis completed</div>
                  </div>
                </div>
              </div>
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
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Top bar */}
          <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
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
                <button
                  title="Create new"
                  onClick={() => navigate('/admin/organizations/new')}
                  className="ml-2 inline-flex items-center px-3 py-2 rounded bg-green-50 text-green-600 hover:bg-green-100"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <NotificationBell variant="admin" />
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

          {/* Page content */}
          <main className="flex-1 bg-gray-50 min-h-0">
            <div className="p-6 h-full">
              <NotificationBannerHost />
              <AdminErrorBoundary showDetails={true}>
                <ErrorBoundary>
                  {children ? children : <Outlet />}
                </ErrorBoundary>
              </AdminErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;