import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, Loader2, Megaphone, MessageSquare, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { listAdminNotificationsWithMeta, markNotificationRead } from '../../dal/notifications';
import type { Notification } from '../../dal/notifications';
import { useSecureAuth } from '../../context/SecureAuthContext';
import { useToast } from '../../context/ToastContext';
import Button from '../ui/Button';
import { useNavigate } from 'react-router-dom';
import useActiveOrganization from '../../hooks/useActiveOrganization';
import { wsClient } from '../../dal/wsClient';

const BookIcon = () => (
  <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-sky-100 text-sky-700 text-[10px] font-semibold">
    C
  </span>
);

const notificationTone = (notification: Notification) => {
  switch (notification.type) {
    case 'admin_message':
      return { wrapper: 'bg-violet-50 text-violet-700', icon: <MessageSquare className="h-4 w-4" />, accent: 'text-violet-600' };
    case 'course_assignment':
      return { wrapper: 'bg-sky-50 text-sky-700', icon: <BookIcon />, accent: 'text-sky-600' };
    case 'survey_assignment':
      return { wrapper: 'bg-emerald-50 text-emerald-700', icon: <Check className="h-4 w-4" />, accent: 'text-emerald-600' };
    case 'feedback_submission':
      return { wrapper: 'bg-violet-50 text-violet-700', icon: <MessageSquare className="h-4 w-4" />, accent: 'text-violet-600' };
    case 'announcement':
      return { wrapper: 'bg-indigo-50 text-indigo-700', icon: <Megaphone className="h-4 w-4" />, accent: 'text-indigo-600' };
    case 'reminder':
      return { wrapper: 'bg-amber-50 text-amber-700', icon: <Sparkles className="h-4 w-4" />, accent: 'text-amber-600' };
    default:
      return { wrapper: 'bg-slate-100 text-slate-700', icon: <Bell className="h-4 w-4" />, accent: 'text-slate-600' };
  }
};

const formatTimestamp = (value?: string) => {
  if (!value) return 'Just now';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const AdminNotificationBell = () => {
  const { user } = useSecureAuth();
  const { activeOrgId } = useActiveOrganization({ surface: 'admin' });
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const autoRefreshRef = useRef<number | null>(null);
  const [autoRefreshing, setAutoRefreshing] = useState(false);

  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.read).length, [notifications]);
  const totalCount = useMemo(() => notifications.length, [notifications]);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setDisabled(false);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const { notifications: items, notificationsDisabled } = await listAdminNotificationsWithMeta({
        organizationId: activeOrgId ?? undefined,
        userId: user.id,
      });
      setNotifications(items);
      setDisabled(notificationsDisabled);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load notifications';
      setError(message);
    } finally {
      setLoading(false);
      setAutoRefreshing(false);
    }
  }, [activeOrgId, user?.id]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const refresh = () => {
      void loadNotifications();
    };

    wsClient.on('notification', refresh);
    wsClient.on('notification_deleted', refresh);
    wsClient.on('message_sent', refresh);

    if (wsClient.isEnabled()) {
      wsClient.connect();
    }

    return () => {
      wsClient.off('notification', refresh);
      wsClient.off('notification_deleted', refresh);
      wsClient.off('message_sent', refresh);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) {
      if (autoRefreshRef.current) {
        window.clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
      return;
    }
    autoRefreshRef.current = window.setInterval(() => {
      setAutoRefreshing(true);
      void loadNotifications();
    }, 45000);
    return () => {
      if (autoRefreshRef.current) {
        window.clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [open, loadNotifications]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)));
    try {
      await markNotificationRead(id, true);
    } catch (err) {
      console.warn('Failed to mark notification read', err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((notification) => !notification.read);
    if (!unread.length) return;
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    try {
      await Promise.all(unread.map((notification) => markNotificationRead(notification.id, true)));
    } catch (err) {
      console.warn('Failed to mark all notifications read', err);
    }
  }, [notifications]);

  const handleRefresh = useCallback(() => {
    setAutoRefreshing(true);
    void loadNotifications();
  }, [loadNotifications]);

  const toggleOpen = () => {
    if (!user?.id) {
      showToast?.('Sign in as an admin to view notifications.', 'warning');
      return;
    }
    setOpen((prev) => !prev);
  };

  const navigate = useNavigate();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggleOpen}
        className="relative inline-flex items-center justify-center rounded-full border border-slate/20 bg-white p-2 text-slate/70 hover:border-slate/40 hover:text-slate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        aria-label="Admin notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-400 px-1 text-xs font-semibold text-white shadow-lg">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[22rem] rounded-3xl border border-slate/100 bg-white/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate/100 px-4 py-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate/70" />
                <p className="text-sm font-semibold text-charcoal">Notifications</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate/500">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{totalCount} messages</span>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700">{unreadCount} unread</span>
                <span>{disabled ? 'Disabled in this environment' : unreadCount > 0 ? 'Stay on top of learner activity' : 'All caught up'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {autoRefreshing && <span className="text-[10px] uppercase tracking-wide text-slate/50">Refreshing</span>}
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded-full p-1.5 text-slate/60 hover:text-slate"
                aria-label="Refresh notifications"
              >
                <RefreshCw className={`h-4 w-4 ${loading || autoRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="rounded-full p-1.5 text-slate/60 hover:text-slate disabled:opacity-40"
                aria-label="Mark all notifications read"
                disabled={!unreadCount}
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="max-h-[22rem] overflow-y-auto px-4 py-3 space-y-3">
            {error ? (
              <p className="text-sm text-rose-600">{error}</p>
            ) : loading && !autoRefreshing ? (
              <div className="flex items-center gap-2 text-sm text-slate/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading notifications…
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-slate/70">
                {disabled ? 'Notifications are currently disabled.' : 'No notifications yet.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {notifications.map((notification) => {
                  const tone = notificationTone(notification);
                  return (
                    <li
                      key={notification.id}
                      className={`rounded-2xl border px-3 py-3 text-sm shadow-sm transition ${
                        notification.read ? 'border-transparent bg-softwhite' : 'border-sky-100 bg-sky-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${tone.wrapper}`}>
                          {tone.icon}
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-charcoal">{notification.title}</p>
                              <p className="text-[11px] uppercase tracking-wide text-slate/50">
                                {formatTimestamp(notification.createdAt)}
                              </p>
                            </div>
                            {!notification.read && (
                              <button
                                type="button"
                                onClick={() => void markRead(notification.id)}
                                className="text-xs font-semibold text-skyblue hover:underline"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                          {notification.body && <p className="text-xs text-slate/70">{notification.body}</p>}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full bg-white/70 px-2 py-0.5 text-[11px] ${tone.accent}`}>
                              {(notification.type || 'update').replace(/_/g, ' ')}
                            </span>
                            {!notification.read && (
                              <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                                New
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-slate/100 px-4 py-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center gap-2"
              onClick={() => {
                setOpen(false);
                // Navigate programmatically to avoid any Link-as-child interaction bugs
                try {
                  navigate('/admin/crm');
                } catch (err) {
                  // Fallback: show toast if navigation fails
                  showToast?.('Unable to open CRM view. Please navigate to CRM manually.', 'error');
                }
              }}
            >
              View CRM & Alerts
              <span aria-hidden="true">→</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationBell;
