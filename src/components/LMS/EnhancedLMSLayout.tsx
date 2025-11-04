import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ClientErrorBoundary from '../ClientErrorBoundary';
import ProgressSyncStatus from '../ProgressSyncStatus';
import RealtimeNotifications from '../RealtimeNotifications';
import { useEnhancedCourseProgress } from '../../hooks/useEnhancedCourseProgress';
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
  Settings,
  HelpCircle,
  Zap
} from 'lucide-react';

interface EnhancedLMSLayoutProps {
  children: React.ReactNode;
}

const EnhancedLMSLayout: React.FC<EnhancedLMSLayoutProps> = ({ children }) => {
  const { logout, isAuthenticated, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Enhanced course progress for global sync status
  const {
    syncStatus,
    isOnline,
    isSaving,
    pendingChanges,
    queueSize,
    queuedItems,
    isProcessingQueue,
    lastSaved,
    forceSave,
    flushQueue
  } = useEnhancedCourseProgress('global', {
    enableAutoSave: true,
    enableRealtime: true,
    autoSaveInterval: 30000
  });

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated.lms) {
      navigate('/lms/login');
    }
  }, [isAuthenticated.lms, navigate]);

  const navigation = [
    { name: 'Dashboard', href: '/lms/dashboard', icon: LayoutDashboard },
    { name: 'My Courses', href: '/lms/courses', icon: BookOpen },
    { name: 'Downloads', href: '/lms/downloads', icon: Download },
    { name: 'Submit Feedback', href: '/lms/feedback', icon: MessageSquare },
    { name: 'Contact Coach', href: '/lms/contact', icon: Phone },
  ];

  const isActive = (href: string) => location.pathname === href;

  const handleLogout = async () => {
    // Force save any pending changes before logout
    if (pendingChanges > 0) {
      await forceSave();
    }
    
    await logout('lms');
    navigate('/lms/login');
  };

  return (
    <ClientErrorBoundary>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div 
              className="fixed inset-0 bg-gray-600 bg-opacity-75" 
              onClick={() => setSidebarOpen(false)} 
            />
          </div>
        )}

        {/* Enhanced Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
          
          {/* Logo and Close Button */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <Link to="/lms/dashboard" className="flex items-center space-x-2">
              <div className="p-2 rounded-lg" style={{ background: 'var(--gradient-orange-red)' }}>
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
              
              {/* User Cohort Info */}
              <div className="mb-6">
                <div className="p-4 rounded-lg border border-blue-100" style={{ background: 'var(--gradient-banner)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">Spring 2025 Leadership Cohort</h3>
                    <Zap className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-sm text-gray-600 mb-3">Welcome back, {user?.name || 'Learner'}!</p>
                  
                  {/* Enhanced Sync Status */}
                  <div className="mt-3 p-2 bg-white rounded border">
                    <ProgressSyncStatus
                      isOnline={isOnline}
                      isSaving={isSaving}
                      syncStatus={syncStatus}
                      pendingChanges={pendingChanges}
                      queueSize={queueSize}
                      lastSaved={lastSaved}
                      onForceSave={forceSave}
                    />
                  </div>
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-2">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      isActive(item.href)
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className={`mr-3 h-5 w-5 ${
                      isActive(item.href) ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    {item.name}
                  </Link>
                ))}
              </nav>

              {/* Quick Actions */}
              <div className="mt-8">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Quick Actions
                </h4>
                <div className="space-y-2">
                  <button
                    onClick={() => navigate('/lms/settings')}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Settings className="mr-3 h-4 w-4 text-gray-400" />
                    Settings
                  </button>
                  
                  <button
                    onClick={() => navigate('/lms/help')}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <HelpCircle className="mr-3 h-4 w-4 text-gray-400" />
                    Help & Support
                  </button>
                </div>
              </div>

              {/* Detailed Sync Status (Expandable) */}
              <div className="mt-8">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Sync Status
                </h4>
                <ProgressSyncStatus
                  isOnline={isOnline}
                  isSaving={isSaving}
                  syncStatus={syncStatus}
                  pendingChanges={pendingChanges}
                  queueSize={queueSize}
                  isProcessingQueue={isProcessingQueue}
                  queuedItems={queuedItems}
                  lastSaved={lastSaved}
                  onForceSave={forceSave}
                  onFlushQueue={flushQueue}
                  showDetailed={true}
                />
              </div>
            </div>

            {/* Bottom section with logout */}
            <div className="px-4 py-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <LogOut className="mr-3 h-5 w-5 text-gray-400" />
                Sign Out
                {pendingChanges > 0 && (
                  <span className="ml-auto text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                    Saving...
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          
          {/* Enhanced Header */}
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                
                {/* Mobile menu button and breadcrumb */}
                <div className="flex items-center">
                  <button
                    className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--hud-orange)]"
                    onClick={() => setSidebarOpen(true)}
                  >
                    <Menu className="h-6 w-6" />
                  </button>
                  
                  {/* Breadcrumb */}
                  <nav className="ml-4 lg:ml-0">
                    <ol className="flex items-center space-x-2 text-sm text-gray-500">
                      <li>
                        <Link to="/lms/dashboard" className="hover:text-gray-700">
                          Learning Platform
                        </Link>
                      </li>
                      {location.pathname !== '/lms/dashboard' && (
                        <>
                          <li className="text-gray-300">/</li>
                          <li className="text-gray-900 font-medium">
                            {location.pathname.split('/').pop()?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </li>
                        </>
                      )}
                    </ol>
                  </nav>
                </div>

                {/* Header Actions */}
                <div className="flex items-center space-x-4">
                  
                  {/* Global Sync Status */}
                  <ProgressSyncStatus
                    isOnline={isOnline}
                    isSaving={isSaving}
                    syncStatus={syncStatus}
                    pendingChanges={pendingChanges}
                    queueSize={queueSize}
                    isProcessingQueue={isProcessingQueue}
                    queuedItems={queuedItems}
                    lastSaved={lastSaved}
                    onForceSave={forceSave}
                    onFlushQueue={flushQueue}
                  />

                  {/* Real-time Notifications */}
                  <RealtimeNotifications 
                    userId={user?.id || 'demo-user'}
                    enabled={true}
                  />

                  {/* User Profile Menu */}
                  <div className="relative">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--gradient-blue-green)' }}>
                        <span className="text-white text-sm font-medium">
                          {(user?.name || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="hidden sm:block text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {user?.name || 'User'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {user?.role || 'Learner'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </ClientErrorBoundary>
  );
};

export default EnhancedLMSLayout;
