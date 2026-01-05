import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  X,
  CheckCircle,
  AlertTriangle,
  Info,
  BookOpen,
  Award,
  TrendingUp,
  Loader2,
  RefreshCcw,
} from 'lucide-react';
import { useSecureAuth } from '../context/SecureAuthContext';
import {
  listLearnerNotifications,
  markLearnerNotificationRead,
  markLearnerNotificationsRead,
  type Notification as LearnerNotification,
} from '../services/notificationService';
import { wsClient } from '../services/wsClient';

type NotificationCategory = 'course_assigned' | 'progress_sync' | 'achievement' | 'announcement' | 'reminder' | 'generic';
type NotificationPriority = 'low' | 'medium' | 'high';

type DisplayNotification = {
  id: string;
  title: string;
  message: string;
  type: NotificationCategory;
  priority: NotificationPriority;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
};

const DEFAULT_REFRESH_MS = 2 * 60 * 1000;
const MAX_NOTIFICATIONS = 50;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getPriorityColor = (priority: NotificationPriority) => {
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

const getNotificationIcon = (type: NotificationCategory) => {
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

const deriveCategory = (input?: string | null): NotificationCategory => {
  switch ((input || '').toLowerCase()) {
    case 'course_assigned':
      return 'course_assigned';
    case 'progress_sync':
    case 'progress_update':
      return 'progress_sync';
    case 'achievement':
    case 'milestone':
      return 'achievement';
    case 'reminder':
    case 'deadline':
      return 'reminder';
    case 'announcement':
    case 'broadcast':
      return 'announcement';
    default:
      return 'generic';
  }
};

const derivePriority = (notification: LearnerNotification, category: NotificationCategory): NotificationPriority => {
  const payload = notification.payload;
  if (isRecord(payload) && typeof payload.priority === 'string') {
    const normalized = payload.priority.toLowerCase();
    if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
      return normalized;
    }
  }

  if (category === 'course_assigned') return 'high';
  if (category === 'progress_sync' || category === 'reminder') return 'medium';
  return 'low';
};

const deriveMessage = (notification: LearnerNotification) => {
  if (typeof notification.body === 'string' && notification.body.trim().length > 0) {
    return notification.body.trim();
  }
  if (isRecord(notification.payload) && typeof notification.payload.message === 'string') {
    return notification.payload.message.trim();
  }
  return '';
};

const deriveAction = (notification: LearnerNotification) => {
  if (!isRecord(notification.payload)) return { actionUrl: undefined, actionLabel: undefined };
  const actionUrl =
    typeof notification.payload.actionUrl === 'string'
      ? notification.payload.actionUrl
      : typeof notification.payload.url === 'string'
        ? notification.payload.url
        : undefined;
  const actionLabel =
    typeof notification.payload.actionLabel === 'string'
      ? notification.payload.actionLabel
      : actionUrl
        ? 'Open'
        : undefined;

  return { actionUrl, actionLabel };
};

const toDisplayNotification = (notification: LearnerNotification): DisplayNotification => {
  const category = deriveCategory(notification.type);
  const { actionUrl, actionLabel } = deriveAction(notification);

  return {
    id: notification.id,
    title: notification.title || 'Notification',
    message: deriveMessage(notification),
    type: category,
    priority: derivePriority(notification, category),
    timestamp: new Date(notification.createdAt || Date.now()),
    read: Boolean(notification.read ?? notification.readAt),
    actionUrl,
    actionLabel,
  };
};

const sortNotifications = (entries: DisplayNotification[]) =>
  [...entries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

interface RealtimeNotificationsProps {
  userId?: string | null;
  enabled?: boolean;
  limit?: number;
  refreshIntervalMs?: number;
}

const RealtimeNotifications: React.FC<RealtimeNotificationsProps> = ({
  userId: overrideUserId,
  enabled = true,
  limit = 25,
  refreshIntervalMs = DEFAULT_REFRESH_MS,
}) => {
  const { user, authInitializing } = useSecureAuth();
  const normalizedOverride = useMemo(
    () => (overrideUserId ? String(overrideUserId).trim().toLowerCase() : undefined),
    [overrideUserId]
  );
  const authUserId = useMemo(() => (user?.id ? String(user.id).trim().toLowerCase() : undefined), [user?.id]);
  const effectiveUserId = normalizedOverride ?? authUserId;
  const canFetch = enabled && Boolean(effectiveUserId) && !authInitializing;
  const normalizedLimit = Math.min(Math.max(limit, 1), MAX_NOTIFICATIONS);

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<DisplayNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(() => notifications.filter(notification => !notification.read).length, [notifications]);

  const fetchNotifications = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!canFetch) return;
      if (opts?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const items = await listLearnerNotifications({ limit: normalizedLimit });
        setNotifications(sortNotifications(items.map(toDisplayNotification)));
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load notifications';
        setError(message);
      } finally {
        if (opts?.silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [canFetch, normalizedLimit]
  );

  useEffect(() => {
    if (!canFetch) {
      setNotifications([]);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    void fetchNotifications();
  }, [canFetch, fetchNotifications]);

  useEffect(() => {
    if (!canFetch || typeof window === 'undefined' || !effectiveUserId) return;
    if (!wsClient.isEnabled()) return;

    wsClient.connect();
    const topic = `notifications:user:${effectiveUserId}`;

    const handleRealtimeNotification = (payload: any) => {
      if (!payload?.data) return;
      const normalized = toDisplayNotification(payload.data);
      setNotifications(prev => {
        const copy = [...prev];
        const existingIndex = copy.findIndex(entry => entry.id === normalized.id);
        if (existingIndex >= 0) {
          copy[existingIndex] = normalized;
        } else {
          copy.unshift(normalized);
        }
        return sortNotifications(copy).slice(0, normalizedLimit);
      });
    };

    wsClient.on('notification', handleRealtimeNotification);
    wsClient.subscribeTopic(topic);

    return () => {
      wsClient.unsubscribeTopic(topic);
      wsClient.off('notification', handleRealtimeNotification);
    };
  }, [canFetch, effectiveUserId, normalizedLimit]);

  useEffect(() => {
    if (!canFetch || !refreshIntervalMs || refreshIntervalMs <= 0 || typeof window === 'undefined') {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchNotifications({ silent: true });
    }, refreshIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [canFetch, refreshIntervalMs, fetchNotifications]);

  const handleToggle = useCallback(() => {
    if (!canFetch) return;
    setIsOpen(prev => !prev);
  }, [canFetch]);

  const handleMarkAsRead = useCallback(
    async (id: string) => {
      if (!canFetch) return;
      setNotifications(prev => prev.map(notification => (notification.id === id ? { ...notification, read: true } : notification)));
      try {
        await markLearnerNotificationRead(id);
      } catch (err) {
        console.error('Failed to mark notification as read', err);
        void fetchNotifications({ silent: true });
      }
    },
    [canFetch, fetchNotifications]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    if (!canFetch) return;
    const unreadIds = notifications.filter(entry => !entry.read).map(entry => entry.id);
    if (unreadIds.length === 0) return;
    setMarkingAll(true);
    setNotifications(prev => prev.map(entry => ({ ...entry, read: true })));

    try {
      await markLearnerNotificationsRead(unreadIds);
    } catch (err) {
      console.error('Failed to mark all notifications read', err);
      void fetchNotifications({ silent: true });
    } finally {
      setMarkingAll(false);
    }
  }, [canFetch, notifications, fetchNotifications]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(entry => entry.id !== id));
  }, []);

  const handleActionClick = useCallback(
    (notification: DisplayNotification) => {
      if (notification.actionUrl) {
        void handleMarkAsRead(notification.id);
        setIsOpen(false);
      }
    },
    [handleMarkAsRead]
  );

  return (
    <>
      <div className="relative">
        <button
          onClick={handleToggle}
          className="relative p-2 text-charcoal hover:text-sunrise focus:outline-none focus:ring-2 focus:ring-sunrise rounded-xl shadow-card disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Show notifications"
          disabled={!canFetch}
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
                <div>
                  <h3 className="text-xl font-heading text-charcoal">Notifications</h3>
                  {refreshing && (
                    <p className="text-xs text-gray-500 font-body">Syncing latest updates…</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => void fetchNotifications({ silent: false })}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-heading flex items-center space-x-1"
                    disabled={loading}
                  >
                    <RefreshCcw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-heading"
                      disabled={markingAll}
                    >
                      {markingAll ? 'Marking…' : 'Mark all read'}
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-charcoal focus:outline-none focus:ring-2 focus:ring-sunrise rounded-full"
                    aria-label="Close notifications"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {!enabled ? (
                  <div className="px-6 py-12 text-center text-gray-500">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                    <p className="font-body">Notifications are disabled for this workspace.</p>
                  </div>
                ) : !effectiveUserId ? (
                  <div className="px-6 py-12 text-center text-gray-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="font-body">Sign in to view your notifications.</p>
                  </div>
                ) : loading && notifications.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
                    <p className="font-body">Loading notifications…</p>
                  </div>
                ) : error && notifications.length === 0 ? (
                  <div className="px-6 py-12 text-center text-red-500">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                    <p className="font-body mb-3">{error}</p>
                    <button
                      onClick={() => void fetchNotifications({ silent: false })}
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-heading"
                    >
                      Try again
                    </button>
                  </div>
                ) : notifications.length === 0 ? (
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
                              {notification.message && (
                                <p className="text-sm text-gray-600 mt-1 font-body">{notification.message}</p>
                              )}
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-500 font-body">{formatTimestamp(notification.timestamp)}</span>
                                {notification.actionUrl && (
                                  <a
                                    href={notification.actionUrl}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-heading"
                                    onClick={() => handleActionClick(notification)}
                                  >
                                    {notification.actionLabel}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 ml-2">
                            {!notification.read && (
                              <button
                                onClick={() => void handleMarkAsRead(notification.id)}
                                className="p-1 text-indigo-600 hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-sunrise rounded-full"
                                title="Mark as read"
                                aria-label="Mark as read"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => dismissNotification(notification.id)}
                              className="p-1 text-gray-400 hover:text-charcoal focus:outline-none focus:ring-2 focus:ring-sunrise rounded-full"
                              title="Dismiss notification"
                              aria-label="Dismiss notification"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
              {notifications.length > 0 && (
                <div className="px-6 py-4 border-t border-mutedgrey bg-indigo-50 rounded-b-2xl">
                  <div className="flex items-center justify-between text-xs text-gray-600 font-heading">
                    <span>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</span>
                    <button
                      onClick={() => void fetchNotifications({ silent: false })}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      Refresh feed
                    </button>
                  </div>
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