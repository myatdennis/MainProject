import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ClientErrorBoundary from '../ClientErrorBoundary';
import ProgressSyncStatus from '../ProgressSyncStatus';
import RealtimeNotifications from '../RealtimeNotifications';
import { useEnhancedCourseProgress } from '../../hooks/useEnhancedCourseProgress';
import { LayoutDashboard, BookOpen, Download, MessageSquare, Phone, LogOut, Menu, X, Users, Settings, HelpCircle, Zap } from 'lucide-react';
const EnhancedLMSLayout = ({ children }) => {
    const { logout, isAuthenticated, user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    // Enhanced course progress for global sync status
    const { syncStatus, isOnline, isSaving, pendingChanges, queueSize, queuedItems, isProcessingQueue, lastSaved, forceSave, flushQueue } = useEnhancedCourseProgress('global', {
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
    const isActive = (href) => location.pathname === href;
    const handleLogout = async () => {
        // Force save any pending changes before logout
        if (pendingChanges > 0) {
            await forceSave();
        }
        await logout('lms');
        navigate('/lms/login');
    };
    return (_jsx(ClientErrorBoundary, { children: _jsxs("div", { className: "min-h-screen bg-gray-50 flex", children: [sidebarOpen && (_jsx("div", { className: "fixed inset-0 z-40 lg:hidden", children: _jsx("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-75", onClick: () => setSidebarOpen(false) }) })), _jsxs("div", { className: `fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`, children: [_jsxs("div", { className: "flex items-center justify-between h-16 px-6 border-b border-gray-200", children: [_jsxs(Link, { to: "/lms/dashboard", className: "flex items-center space-x-2", children: [_jsx("div", { className: "p-2 rounded-lg", style: { background: 'var(--gradient-orange-red)' }, children: _jsx(Users, { className: "h-6 w-6 text-white" }) }), _jsx("span", { className: "font-bold text-lg text-gray-900", children: "The Huddle Co." })] }), _jsx("button", { className: "lg:hidden", onClick: () => setSidebarOpen(false), children: _jsx(X, { className: "h-6 w-6 text-gray-600" }) })] }), _jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "flex-1 px-4 py-6", children: [_jsx("div", { className: "mb-6", children: _jsxs("div", { className: "p-4 rounded-lg border border-blue-100", style: { background: 'var(--gradient-banner)' }, children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h3", { className: "font-semibold text-gray-900", children: "Spring 2025 Leadership Cohort" }), _jsx(Zap, { className: "w-4 h-4 text-blue-600" })] }), _jsxs("p", { className: "text-sm text-gray-600 mb-3", children: ["Welcome back, ", user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Learner' : 'Learner', "!"] }), _jsx("div", { className: "mt-3 p-2 bg-white rounded border", children: _jsx(ProgressSyncStatus, { isOnline: isOnline, isSaving: isSaving, syncStatus: syncStatus, pendingChanges: pendingChanges, queueSize: queueSize, lastSaved: lastSaved, onForceSave: forceSave }) })] }) }), _jsx("nav", { className: "space-y-2", children: navigation.map((item) => (_jsxs(Link, { to: item.href, onClick: () => setSidebarOpen(false), className: `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive(item.href)
                                                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`, children: [_jsx(item.icon, { className: `mr-3 h-5 w-5 ${isActive(item.href) ? 'text-blue-600' : 'text-gray-400'}` }), item.name] }, item.name))) }), _jsxs("div", { className: "mt-8", children: [_jsx("h4", { className: "text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3", children: "Quick Actions" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("button", { onClick: () => navigate('/lms/settings'), className: "flex items-center w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors", children: [_jsx(Settings, { className: "mr-3 h-4 w-4 text-gray-400" }), "Settings"] }), _jsxs("button", { onClick: () => navigate('/lms/help'), className: "flex items-center w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors", children: [_jsx(HelpCircle, { className: "mr-3 h-4 w-4 text-gray-400" }), "Help & Support"] })] })] }), _jsxs("div", { className: "mt-8", children: [_jsx("h4", { className: "text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3", children: "Sync Status" }), _jsx(ProgressSyncStatus, { isOnline: isOnline, isSaving: isSaving, syncStatus: syncStatus, pendingChanges: pendingChanges, queueSize: queueSize, isProcessingQueue: isProcessingQueue, queuedItems: queuedItems, lastSaved: lastSaved, onForceSave: forceSave, onFlushQueue: flushQueue, showDetailed: true })] })] }), _jsx("div", { className: "px-4 py-4 border-t border-gray-200", children: _jsxs("button", { onClick: handleLogout, className: "flex items-center w-full px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors", children: [_jsx(LogOut, { className: "mr-3 h-5 w-5 text-gray-400" }), "Sign Out", pendingChanges > 0 && (_jsx("span", { className: "ml-auto text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full", children: "Saving..." }))] }) })] })] }), _jsxs("div", { className: "flex-1 flex flex-col", children: [_jsx("header", { className: "bg-white shadow-sm border-b border-gray-200", children: _jsx("div", { className: "px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "flex justify-between items-center h-16", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("button", { className: "lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--hud-orange)]", onClick: () => setSidebarOpen(true), children: _jsx(Menu, { className: "h-6 w-6" }) }), _jsx("nav", { className: "ml-4 lg:ml-0", children: _jsxs("ol", { className: "flex items-center space-x-2 text-sm text-gray-500", children: [_jsx("li", { children: _jsx(Link, { to: "/lms/dashboard", className: "hover:text-gray-700", children: "Learning Platform" }) }), location.pathname !== '/lms/dashboard' && (_jsxs(_Fragment, { children: [_jsx("li", { className: "text-gray-300", children: "/" }), _jsx("li", { className: "text-gray-900 font-medium", children: location.pathname.split('/').pop()?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) })] }))] }) })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsx(ProgressSyncStatus, { isOnline: isOnline, isSaving: isSaving, syncStatus: syncStatus, pendingChanges: pendingChanges, queueSize: queueSize, isProcessingQueue: isProcessingQueue, queuedItems: queuedItems, lastSaved: lastSaved, onForceSave: forceSave, onFlushQueue: flushQueue }), _jsx(RealtimeNotifications, { userId: user?.id || 'demo-user', enabled: true }), _jsx("div", { className: "relative", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full flex items-center justify-center", style: { background: 'var(--gradient-blue-green)' }, children: _jsx("span", { className: "text-white text-sm font-medium", children: ((user?.firstName || user?.lastName) ? `${user.firstName || ''}${user.lastName ? ' ' + user.lastName : ''}`.trim().charAt(0).toUpperCase() : 'U') }) }), _jsxs("div", { className: "hidden sm:block text-right", children: [_jsx("p", { className: "text-sm font-medium text-gray-900", children: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User' : 'User' }), _jsx("p", { className: "text-xs text-gray-500", children: user?.role || 'Learner' })] })] }) })] })] }) }) }), _jsx("main", { className: "flex-1 overflow-auto", children: children })] })] }) }));
};
export default EnhancedLMSLayout;
