import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, Loader2, Megaphone, RefreshCw } from 'lucide-react';
import { listAdminNotificationsWithMeta, markNotificationRead } from '../../services/notificationService';
import type { Notification } from '../../services/notificationService';
import { useSecureAuth } from '../../context/SecureAuthContext';
import { useToast } from '../../context/ToastContext';
import Button from '../ui/Button';
import { Link } from 'react-router-dom';

const formatTimestamp = (value?: string) => {
  if (!value) return 'Just now';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const notificationIcon = (notification: Notification) => {
  if (notification.type === 'course_assignment') return <BookIcon />;
  if (notification.type === 'survey_assignment') return <Check className="h-4 w-4 text-emerald-500" />;
  if (notification.type === 'announcement') return <Megaphone className="h-4 w-4 text-skyblue" />;
  return <Bell className="h-4 w-4 text-slate/70" />;
};

const BookIcon = () => <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-sky-100 text-sky-700 text-[10px] font-semibold">C</span>;

const AdminNotificationBell = () => {
  const { user } = useSecureAuth();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

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
    }
  }, [user?.id]);

  useEffect(() => {
    void loadNotifications();
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

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)),
      );
      try {
        await markNotificationRead(id, true);
      } catch (err) {
        console.warn('Failed to mark notification read', err);
      }
    },
    [],
  );

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

  const handleRefresh = () => {
    void loadNotifications();
  };

  const toggleOpen = () => {
    if (!user?.id) {
      showToast?.('Sign in as an admin to view notifications.', 'warning');
      return;
    }
    setOpen((prev) => !prev);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggleOpen}
        className="relative inline-flex items-center justify-center rounded-full border border-mist bg-white p-2 text-slate/70 hover:text-slate"
        aria-label="Admin notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-mist bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-mist px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-charcoal">Notifications</p>
              {disabled ? (
                <p className="text-xs text-slate/70">Notifications disabled for this environment.</p>
              ) : (
                <p className="text-xs text-slate/70">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded-full p-1 text-slate/60 hover:text-slate"
                aria-label="Refresh notifications"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="rounded-full p-1 text-slate/60 hover:text-slate"
                aria-label="Mark all notifications read"
                disabled={!unreadCount}
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="max-h-[22rem] overflow-y-auto px-4 py-2">
            {error ? (
              <p className="text-sm text-rose-600">{error}</p>
            ) : loading ? (
              <div className="flex items-center gap-2 text-sm text-slate/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading notifications…
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-slate/70">
                {disabled ? 'Notifications are currently disabled.' : 'No notifications yet.'}
              </p>
            ) : (
              <ul className="space-y-3">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      notification.read ? 'border-transparent bg-softwhite' : 'border-sky-100 bg-sky-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {notificationIcon(notification)}
                        <p className="font-semibold text-charcoal">{notification.title}</p>
                      </div>
                      {!notification.read && (
                        <button
                          type="button"
                          onClick={() => void markRead(notification.id)}
                          className="text-xs text-skyblue hover:underline"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                    {notification.body && <p className="mt-1 text-xs text-slate/70">{notification.body}</p>}
                    <p className="mt-1 text-[11px] uppercase text-slate/50">{formatTimestamp(notification.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-mist px-4 py-3">
            <Button asChild variant="ghost" size="sm" className="w-full justify-center">
              <Link to="/admin/crm" onClick={() => setOpen(false)}>
                View CRM & Alerts
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationBell;
