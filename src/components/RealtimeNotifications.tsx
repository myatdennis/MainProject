import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCircle, AlertTriangle, Info, BookOpen, Award, TrendingUp } from 'lucide-react';

type Notification = {
  id: string;
  title: string;
  message: string;
  type: 'course_assigned' | 'progress_sync' | 'achievement' | 'announcement' | 'reminder';
  priority: 'low' | 'medium' | 'high';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
};

const getPriorityColor = (priority: Notification['priority']) => {
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

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'course_assigned':
      return <BookOpen className="w-4 h-4 text-blue-600" />;
    case 'progress_sync':
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    case 'achievement':
      return <Award className="w-4 h-4 text-yellow-600" />;
    case 'announcement':
      return <Info className="w-4 h-4 text-blue-600" />;
    case 'reminder':
      return <AlertTriangle className="w-4 h-4 text-orange-600" />;
    default:
      return <Bell className="w-4 h-4 text-gray-600" />;
  }
};

const formatTimestamp = (timestamp: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
};

const RealtimeNotifications: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-charcoal hover:text-sunrise focus:outline-none focus:ring-2 focus:ring-sunrise rounded-xl shadow-card"
          aria-label="Show notifications"
        >
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-sunrise text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-heading">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22 }}
              className="absolute right-0 mt-2 w-96 bg-ivory rounded-2xl shadow-2xl border border-mutedgrey z-50 max-h-96 overflow-hidden"
              role="menu"
              aria-label="Notifications dropdown"
            >
              <div className="px-6 py-4 border-b border-mutedgrey flex items-center justify-between bg-gradient-to-r from-sunrise/10 to-indigo-100">
                <h3 className="text-xl font-heading text-charcoal">Notifications</h3>
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-xs text-indigo-600 hover:text-indigo-800 font-heading">
                      Mark all read
                    </button>
                  )}
                  <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-charcoal focus:outline-none focus:ring-2 focus:ring-sunrise rounded-full" aria-label="Close notifications">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="font-body">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-mutedgrey">
                    {notifications.map(notification => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24 }}
                        transition={{ duration: 0.18 }}
                        className={`px-6 py-4 hover:bg-sunrise/5 border-l-4 ${getPriorityColor(notification.priority)} ${
                          !notification.read ? 'bg-indigo-50' : 'bg-ivory'
                        } rounded-xl mb-1`}
                        role="menuitem"
                        tabIndex={0}
                        aria-label={notification.title}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className="flex-shrink-0 mt-1">{getNotificationIcon(notification.type)}</div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-base font-heading ${!notification.read ? 'text-charcoal' : 'text-gray-700'}`}>{notification.title}</p>
                              <p className="text-sm text-gray-600 mt-1 font-body">{notification.message}</p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-500 font-body">{formatTimestamp(notification.timestamp)}</span>
                                {notification.actionUrl && (
                                  <a
                                    href={notification.actionUrl}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-heading"
                                    onClick={() => {
                                      markAsRead(notification.id);
                                      setIsOpen(false);
                                    }}
                                  >
                                    {notification.actionLabel}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 ml-2">
                            {!notification.read && (
                              <button onClick={() => markAsRead(notification.id)} className="p-1 text-indigo-600 hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-sunrise rounded-full" title="Mark as read" aria-label="Mark as read">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => deleteNotification(notification.id)} className="p-1 text-gray-400 hover:text-charcoal focus:outline-none focus:ring-2 focus:ring-sunrise rounded-full" title="Delete notification" aria-label="Delete notification">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-6 py-4 border-t border-mutedgrey bg-indigo-50 rounded-b-2xl">
                  <button onClick={clearAllNotifications} className="w-full text-xs text-gray-600 hover:text-charcoal font-heading">
                    Clear all notifications
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {/* Click outside to close */}
        {isOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-label="Close notifications dropdown background" />
        )}
      </div>
    </>
  );
};

export default RealtimeNotifications;