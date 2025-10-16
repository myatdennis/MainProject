import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  BookOpen,
  Download, 
  MessageSquare, 
  Phone, 
  LogOut, 
  Menu, 
  X,
  Users,
  TrendingUp,
  Award,
  Settings,
  HelpCircle
} from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';
import NotificationBannerHost from '../notifications/NotificationBannerHost';

interface LMSLayoutProps {
  children: React.ReactNode;
}

const LMSLayout: React.FC<LMSLayoutProps> = ({ children }) => {
  const { logout, isAuthenticated, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Check authentication - but allow demo mode
  React.useEffect(() => {
    // Check if we're in demo mode (Supabase not configured)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    // In demo mode, auto-authenticate as demo user
    if (!supabaseUrl || !supabaseAnonKey) {
      console.log('[LMSLayout] Running in demo mode - auto-authenticating demo user');
      
      // Set up demo authentication if not already done
      if (!isAuthenticated.lms) {
        localStorage.setItem('huddle_lms_auth', 'true');
        const demoUser = {
          name: 'Sarah Chen',
          email: 'demo@thehuddleco.com',
          role: 'user',
          id: `demo-lms-${Date.now()}`
        };
        localStorage.setItem('huddle_user', JSON.stringify(demoUser));
        
        // Refresh the page to pick up the new auth state
        window.location.reload();
      }
      return;
    }
    
    if (!isAuthenticated.lms) {
      navigate('/lms/login');
    }
  }, [isAuthenticated.lms, navigate]);

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

  const isActive = (href: string) => location.pathname === href;

  const handleLogout = async () => {
    await logout('lms');
    navigate('/lms/login');
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
              <Users className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">The Huddle Co.</span>
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
                <h3 className="font-semibold text-gray-900 mb-1">Spring 2025 Leadership Cohort</h3>
                <p className="text-sm text-gray-600">Welcome back, {user?.name || 'Learner'}!</p>
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
      <div className="flex-1 lg:ml-0">
        {/* Top bar */}
        <div className="bg-white shadow-sm border-b border-gray-200 lg:hidden">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-600 hover:text-gray-900"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="bg-gradient-to-r from-orange-400 to-red-500 p-2 rounded-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-gray-900">The Huddle Co.</span>
            </div>
            <NotificationBell variant="client" />
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="hidden items-center justify-end border-b border-gray-200 bg-white px-6 py-4 shadow-sm lg:flex">
            <NotificationBell variant="client" />
          </div>
          <NotificationBannerHost />
          <div className="px-4 py-4 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default LMSLayout;