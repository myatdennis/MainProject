import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCircle, AlertTriangle, Info, BookOpen, Award, TrendingUp } from 'lucide-react';
const getPriorityColor = (priority) => {
    switch (priority) {
        case 'high':
            return 'border-l-red-500 bg-red-50';
        case 'medium':
            return 'border-l-yellow-500 bg-yellow-50';
        case 'low':
            return 'border-l-blue-500 bg-blue-50';
        default:
            return 'border-l-gray-500 bg-gray-50';
    }
};
const getNotificationIcon = (type) => {
    switch (type) {
        case 'course_assigned':
            return _jsx(BookOpen, { className: "w-4 h-4 text-blue-600" });
        case 'progress_sync':
            return _jsx(TrendingUp, { className: "w-4 h-4 text-green-600" });
        case 'achievement':
            return _jsx(Award, { className: "w-4 h-4 text-yellow-600" });
        case 'announcement':
            return _jsx(Info, { className: "w-4 h-4 text-blue-600" });
        case 'reminder':
            return _jsx(AlertTriangle, { className: "w-4 h-4 text-orange-600" });
        default:
            return _jsx(Bell, { className: "w-4 h-4 text-gray-600" });
    }
};
const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0)
        return `${diffDays}d ago`;
    if (diffHours > 0)
        return `${diffHours}h ago`;
    if (diffMins > 0)
        return `${diffMins}m ago`;
    return 'Just now';
};
const RealtimeNotifications = ({ userId = 'demo-user', enabled = true }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    useEffect(() => {
        if (!enabled)
            return;
        // Placeholder init: we may subscribe to realtime topics here using the userId
        console.log('[RealtimeNotifications] initialized for user', userId);
    }, [enabled, userId]);
    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    }, []);
    const clearAllNotifications = useCallback(() => {
        setNotifications([]);
        setUnreadCount(0);
    }, []);
    const markAsRead = useCallback((id) => {
        setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
        setUnreadCount(prev => Math.max(0, prev - 1));
    }, []);
    const deleteNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        setUnreadCount(prev => Math.max(0, prev - 1));
    }, []);
    return (_jsx(_Fragment, { children: _jsxs("div", { className: "relative", children: [_jsxs("button", { onClick: () => setIsOpen(!isOpen), className: "relative p-2 text-charcoal hover:text-sunrise focus:outline-none focus:ring-2 focus:ring-sunrise rounded-xl shadow-card", "aria-label": "Show notifications", children: [_jsx(Bell, { className: "w-6 h-6" }), unreadCount > 0 && (_jsx("span", { className: "absolute -top-1 -right-1 bg-sunrise text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-heading", children: unreadCount > 99 ? '99+' : unreadCount }))] }), _jsx(AnimatePresence, { children: isOpen && (_jsxs(motion.div, { initial: { opacity: 0, y: -16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -16 }, transition: { duration: 0.22 }, className: "absolute right-0 mt-2 w-96 bg-ivory rounded-2xl shadow-2xl border border-mutedgrey z-50 max-h-96 overflow-hidden", role: "menu", "aria-label": "Notifications dropdown", children: [_jsxs("div", { className: "px-6 py-4 border-b border-mutedgrey flex items-center justify-between bg-gradient-to-r from-sunrise/10 to-indigo-100", children: [_jsx("h3", { className: "text-xl font-heading text-charcoal", children: "Notifications" }), _jsxs("div", { className: "flex items-center space-x-2", children: [unreadCount > 0 && (_jsx("button", { onClick: markAllAsRead, className: "text-xs text-indigo-600 hover:text-indigo-800 font-heading", children: "Mark all read" })), _jsx("button", { onClick: () => setIsOpen(false), className: "text-gray-400 hover:text-charcoal focus:outline-none focus:ring-2 focus:ring-sunrise rounded-full", "aria-label": "Close notifications", children: _jsx(X, { className: "w-5 h-5" }) })] })] }), _jsx("div", { className: "max-h-80 overflow-y-auto", children: notifications.length === 0 ? (_jsxs("div", { className: "px-6 py-12 text-center text-gray-500", children: [_jsx(Bell, { className: "w-8 h-8 mx-auto mb-2 opacity-50" }), _jsx("p", { className: "font-body", children: "No notifications yet" })] })) : (_jsx("div", { className: "divide-y divide-mutedgrey", children: notifications.map(notification => (_jsx(motion.div, { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 24 }, transition: { duration: 0.18 }, className: `px-6 py-4 hover:bg-sunrise/5 border-l-4 ${getPriorityColor(notification.priority)} ${!notification.read ? 'bg-indigo-50' : 'bg-ivory'} rounded-xl mb-1`, role: "menuitem", tabIndex: 0, "aria-label": notification.title, children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex items-start space-x-3 flex-1", children: [_jsx("div", { className: "flex-shrink-0 mt-1", children: getNotificationIcon(notification.type) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: `text-base font-heading ${!notification.read ? 'text-charcoal' : 'text-gray-700'}`, children: notification.title }), _jsx("p", { className: "text-sm text-gray-600 mt-1 font-body", children: notification.message }), _jsxs("div", { className: "flex items-center justify-between mt-2", children: [_jsx("span", { className: "text-xs text-gray-500 font-body", children: formatTimestamp(notification.timestamp) }), notification.actionUrl && (_jsx("a", { href: notification.actionUrl, className: "text-xs text-indigo-600 hover:text-indigo-800 font-heading", onClick: () => {
                                                                                markAsRead(notification.id);
                                                                                setIsOpen(false);
                                                                            }, children: notification.actionLabel }))] })] })] }), _jsxs("div", { className: "flex items-center space-x-1 ml-2", children: [!notification.read && (_jsx("button", { onClick: () => markAsRead(notification.id), className: "p-1 text-indigo-600 hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-sunrise rounded-full", title: "Mark as read", "aria-label": "Mark as read", children: _jsx(CheckCircle, { className: "w-4 h-4" }) })), _jsx("button", { onClick: () => deleteNotification(notification.id), className: "p-1 text-gray-400 hover:text-charcoal focus:outline-none focus:ring-2 focus:ring-sunrise rounded-full", title: "Delete notification", "aria-label": "Delete notification", children: _jsx(X, { className: "w-4 h-4" }) })] })] }) }, notification.id))) })) }), notifications.length > 0 && (_jsx("div", { className: "px-6 py-4 border-t border-mutedgrey bg-indigo-50 rounded-b-2xl", children: _jsx("button", { onClick: clearAllNotifications, className: "w-full text-xs text-gray-600 hover:text-charcoal font-heading", children: "Clear all notifications" }) }))] })) }), isOpen && (_jsx("div", { className: "fixed inset-0 z-40", onClick: () => setIsOpen(false), "aria-label": "Close notifications dropdown background" }))] }) }));
};
export default RealtimeNotifications;
