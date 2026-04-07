import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Megaphone, BookOpen, Check, MessageSquare, Sparkles } from 'lucide-react';
import { listLearnerNotifications, markLearnerNotificationRead } from '../../dal/notifications';
import type { Notification } from '../../dal/notifications';
import { syncService } from '../../dal/sync';
import { wsClient } from '../../dal/wsClient';
import Button from '../ui/Button';

const REALTIME_REFRESH_DEBOUNCE_MS = 300;

const REALTIME_REFRESH_EVENT_TYPES = new Set([
  'assignment_created',
  'assignment_updated',
  'assignment_deleted',
  'message_sent',
  'org_message_sent',
  'notification',
  'notification_created',
  'notification_deleted',
]);

const notificationTone = (notification: Notification) => {
  switch (notification.type) {
    case 'admin_message':
      return { wrapper: 'bg-violet-50 text-violet-700', icon: <MessageSquare className="h-4 w-4" />, accent: 'text-violet-600' };
    case 'course_assignment':
      return { wrapper: 'bg-sky-50 text-sky-700', icon: <BookOpen className="h-4 w-4" />, accent: 'text-sky-600' };
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

const ClientNotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listLearnerNotifications();
      setNotifications(items);
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleNotificationRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void loadNotifications();
    }, REALTIME_REFRESH_DEBOUNCE_MS);
  }, [loadNotifications]);

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);

  useEffect(() => {
    if (open) {
      void loadNotifications();
    }
  }, [open, loadNotifications]);

  useEffect(() => {
    const refreshFromSync = () => {
      scheduleNotificationRefresh();
    };

    const unsubs = [
      syncService.subscribe('assignment_created', refreshFromSync),
      syncService.subscribe('assignment_updated', refreshFromSync),
      syncService.subscribe('assignment_deleted', refreshFromSync),
      syncService.subscribe('refresh_all', refreshFromSync),
    ];

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe?.());
    };
  }, [scheduleNotificationRefresh]);

  useEffect(() => {
    const handleRealtimeEvent = (payload: unknown) => {
      const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
      const eventType =
        typeof record?.type === 'string'
          ? record.type
          : typeof record?.event === 'string'
            ? record.event
            : null;
      if (!eventType) return;
      if (!REALTIME_REFRESH_EVENT_TYPES.has(eventType)) return;
      scheduleNotificationRefresh();
    };

    wsClient.on('event', handleRealtimeEvent);
    wsClient.on('notification', handleRealtimeEvent);
    wsClient.on('notification_deleted', handleRealtimeEvent);
    wsClient.on('message_sent', handleRealtimeEvent);

    if (wsClient.isEnabled()) {
      wsClient.connect();
    }

    return () => {
      wsClient.off('event', handleRealtimeEvent);
      wsClient.off('notification', handleRealtimeEvent);
      wsClient.off('notification_deleted', handleRealtimeEvent);
      wsClient.off('message_sent', handleRealtimeEvent);
    };
  }, [scheduleNotificationRefresh]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

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

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await markLearnerNotificationRead(id);
    } catch {
      // ignore error
    }
  }, []);

  const resolveNotificationActionUrl = useCallback((notification: Notification): string | null => {
    const payload = (notification.payload ?? notification.metadata ?? null) as Record<string, unknown> | null;
    if (!payload || typeof payload !== 'object') return null;
    const actionUrl = payload.actionUrl;
    return typeof actionUrl === 'string' && actionUrl.startsWith('/') ? actionUrl : null;
  }, []);

  const handleNotificationClick = useCallback(
    async (notification: Notification) => {
      await markRead(notification.id);
      const actionUrl = resolveNotificationActionUrl(notification);
      if (actionUrl) {
        setOpen(false);
        navigate(actionUrl);
      }
    },
    [markRead, navigate, resolveNotificationActionUrl],
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative inline-flex items-center justify-center rounded-full border border-slate/20 bg-white p-2 text-slate/70 hover:border-slate/40 hover:text-slate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        aria-label="Notifications"
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
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate/70" />
              <p className="text-sm font-semibold text-charcoal">Notifications</p>
            </div>
            <Button size="sm" variant="ghost" onClick={loadNotifications} disabled={loading}>
              Refresh
            </Button>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate/50">
            {loading ? (
              <div className="p-6 text-center text-slate/60">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-slate/60">No notifications yet.</div>
            ) : (
              notifications.map((notification) => {
                const tone = notificationTone(notification);
                return (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer ${!notification.read ? 'bg-sky-50/40' : ''}`}
                    onClick={() => {
                      void handleNotificationClick(notification);
                    }}
                  >
                    <div className={`flex-shrink-0 rounded-full p-2 ${tone.wrapper}`}>{tone.icon}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-0.5">{notification.title}</div>
                      {notification.body && <div className="text-xs text-slate/70 mb-1">{notification.body}</div>}
                      <div className="text-xs text-slate/50">{formatTimestamp(notification.createdAt)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientNotificationBell;
