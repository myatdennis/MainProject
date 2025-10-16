import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationAnalytics,
  NotificationEvent,
  NotificationInput,
  NotificationPreferences,
  NotificationRecord,
} from '../types/notifications';
import {
  archiveNotification,
  createNotification as serviceCreateNotification,
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  persistNotificationCache,
  loadNotificationCache,
  subscribeToNotifications,
} from '../services/notificationService';
import {
  buildNotificationAnalytics,
  getNotificationEvents,
  logNotificationEvent,
} from '../services/notificationAnalyticsService';

interface NotificationContextValue {
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  error?: string;
  preferences: NotificationPreferences;
  analytics: NotificationAnalytics;
  events: NotificationEvent[];
  refresh: () => Promise<void>;
  create: (input: NotificationInput) => Promise<NotificationRecord>;
  markAsRead: (id: string) => Promise<void>;
  markAsUnread: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archive: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  recordClick: (id: string) => void;
  setPreferences: (preferences: Partial<NotificationPreferences>) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const PREFERENCE_STORAGE_KEY = 'huddle_notification_preferences_v1';

const loadPreferences = (): NotificationPreferences => {
  try {
    const raw = localStorage.getItem(PREFERENCE_STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) } as NotificationPreferences;
  } catch (error) {
    console.warn('[NotificationContext] Failed to load preferences', error);
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
};

const persistPreferences = (preferences: NotificationPreferences) => {
  try {
    localStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('[NotificationContext] Failed to persist preferences', error);
  }
};

export const NotificationProvider = ({ children }: PropsWithChildren) => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>(loadNotificationCache);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [preferences, setPreferencesState] = useState<NotificationPreferences>(loadPreferences);
  const [events, setEvents] = useState<NotificationEvent[]>(getNotificationEvents);

  const syncCache = useCallback((items: NotificationRecord[]) => {
    setNotifications(items);
    persistNotificationCache(items);
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchNotifications();
      syncCache(result);
      setEvents(getNotificationEvents());
      setError(undefined);
    } catch (err) {
      console.error('[NotificationContext] Failed to fetch notifications', err);
      setError(err instanceof Error ? err.message : 'Unable to load notifications');
    } finally {
      setLoading(false);
    }
  }, [syncCache]);

  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((eventType, record) => {
      setNotifications((current) => {
        if (eventType === 'DELETE') {
          const updated = current.filter((item) => item.id !== record.id);
          persistNotificationCache(updated);
          return updated;
        }

        const exists = current.some((item) => item.id === record.id);
        let updated: NotificationRecord[];
        if (exists) {
          updated = current.map((item) => (item.id === record.id ? { ...item, ...record } : item));
        } else {
          updated = [record, ...current];
        }
        persistNotificationCache(updated);

        if (!exists) {
          const deliveredEvent = logNotificationEvent(record.id, 'delivered', record.recipientUserId);
          setEvents((prev) => [...prev, deliveredEvent]);
        }
        return updated;
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const create = useCallback(async (input: NotificationInput) => {
    const created = await serviceCreateNotification(input);
    setNotifications((prev) => {
      const updated = [created, ...prev.filter((item) => item.id !== created.id)];
      persistNotificationCache(updated);
      return updated;
    });
    const deliveredEvent = logNotificationEvent(created.id, 'delivered', created.recipientUserId);
    setEvents((prev) => [...prev, deliveredEvent]);
    return created;
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    await markNotificationRead(id, true);
    setNotifications((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, isRead: true } : item));
      persistNotificationCache(updated);
      return updated;
    });
    const readEvent = logNotificationEvent(id, 'read');
    setEvents((prev) => [...prev, readEvent]);
  }, []);

  const markAsUnread = useCallback(async (id: string) => {
    await markNotificationRead(id, false);
    setNotifications((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, isRead: false } : item));
      persistNotificationCache(updated);
      return updated;
    });
  }, []);

  const markAllAsReadHandler = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => {
      const updated = prev.map((item) => ({ ...item, isRead: true }));
      persistNotificationCache(updated);
      return updated;
    });
  }, []);

  const archive = useCallback(async (id: string) => {
    await archiveNotification(id, true);
    setNotifications((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, archived: true } : item));
      persistNotificationCache(updated);
      return updated;
    });
    const archivedEvent = logNotificationEvent(id, 'archived');
    setEvents((prev) => [...prev, archivedEvent]);
  }, []);

  const restore = useCallback(async (id: string) => {
    await archiveNotification(id, false);
    setNotifications((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, archived: false } : item));
      persistNotificationCache(updated);
      return updated;
    });
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteNotification(id);
    setNotifications((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      persistNotificationCache(updated);
      return updated;
    });
    const deletedEvent = logNotificationEvent(id, 'deleted');
    setEvents((prev) => [...prev, deletedEvent]);
  }, []);

  const recordClick = useCallback((id: string) => {
    const clickEvent = logNotificationEvent(id, 'clicked');
    setEvents((prev) => [...prev, clickEvent]);
  }, []);

  const setPreferences = useCallback((partial: Partial<NotificationPreferences>) => {
    setPreferencesState((prev) => {
      const next = { ...prev, ...partial };
      persistPreferences(next);
      return next;
    });
  }, []);

  const analytics: NotificationAnalytics = useMemo(
    () => buildNotificationAnalytics(notifications, events),
    [notifications, events]
  );

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead && !item.archived).length,
    [notifications]
  );

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    loading,
    error,
    preferences,
    analytics,
    events,
    refresh: handleRefresh,
    create,
    markAsRead,
    markAsUnread,
    markAllAsRead: markAllAsReadHandler,
    archive,
    restore,
    remove,
    recordClick,
    setPreferences,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotificationCenter = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationCenter must be used within a NotificationProvider');
  }
  return context;
};
