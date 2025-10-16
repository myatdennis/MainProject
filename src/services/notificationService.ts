import { supabase } from '../lib/supabase';
import {
  NotificationFilterOptions,
  NotificationInput,
  NotificationRecord,
} from '../types/notifications';

const STORAGE_KEY = 'huddle_notification_center_v2';

const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

const toNotificationRecord = (payload: any): NotificationRecord => ({
  id: payload.id ?? `note-${Date.now()}`,
  type: payload.type ?? 'system',
  title: payload.title ?? 'Notification',
  message: payload.message ?? '',
  link: payload.link ?? null,
  actionLabel: payload.action_label ?? payload.actionLabel ?? null,
  recipientUserId: payload.recipient_user_id ?? payload.recipientUserId ?? null,
  recipientOrgId: payload.recipient_org_id ?? payload.recipientOrgId ?? null,
  isRead: Boolean(payload.is_read ?? payload.isRead ?? false),
  createdAt: payload.created_at ?? payload.createdAt ?? new Date().toISOString(),
  expiresAt: payload.expires_at ?? payload.expiresAt ?? null,
  priority: payload.priority ?? 'medium',
  senderId: payload.sender_id ?? payload.senderId ?? null,
  category: payload.category ?? 'update',
  metadata: payload.metadata ?? null,
  archived: payload.archived ?? false,
});

const readLocalCache = (): NotificationRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(toNotificationRecord);
  } catch (error) {
    console.error('[NotificationService] Failed to read cache', error);
    return [];
  }
};

const writeLocalCache = (items: NotificationRecord[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('[NotificationService] Failed to persist cache', error);
  }
};

export const loadNotificationCache = (): NotificationRecord[] => {
  return readLocalCache();
};

const filterNotifications = (
  notifications: NotificationRecord[],
  opts?: NotificationFilterOptions
) => {
  if (!opts) return notifications;
  return notifications.filter((notification) => {
    const matchesUser = opts.userId
      ? !notification.recipientUserId || notification.recipientUserId === opts.userId
      : true;
    const matchesOrg = opts.orgId
      ? !notification.recipientOrgId || notification.recipientOrgId === opts.orgId
      : true;
    const matchesArchived = opts.includeArchived ? true : !notification.archived;

    return matchesUser && matchesOrg && matchesArchived;
  });
};

export const fetchNotifications = async (
  opts?: NotificationFilterOptions
): Promise<NotificationRecord[]> => {
  if (isSupabaseConfigured) {
    try {
      const query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      const filters: string[] = [];
      if (opts?.userId) {
        filters.push(`recipient_user_id.eq.${opts.userId}`);
      }
      if (opts?.orgId) {
        filters.push(`recipient_org_id.eq.${opts.orgId}`);
      }

      if (filters.length > 0) {
        query.or(filters.join(','));
      }

      if (opts?.limit) {
        query.limit(opts.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data) return [];

      return data
        .map(toNotificationRecord)
        .filter((item) => (opts?.includeArchived ? true : !item.archived));
    } catch (error) {
      console.warn('[NotificationService] Falling back to cache', error);
    }
  }

  const cache = readLocalCache();
  const filtered = filterNotifications(cache, opts);
  const sorted = filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return opts?.limit ? sorted.slice(0, opts.limit) : sorted;
};

export const createNotification = async (
  input: NotificationInput
): Promise<NotificationRecord> => {
  const payload: NotificationRecord = {
    id: input.id ?? `note-${Date.now()}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
    isRead: input.isRead ?? false,
    archived: input.archived ?? false,
    type: input.type ?? 'system',
    title: input.title ?? 'Notification',
    message: input.message ?? '',
    link: input.link ?? null,
    actionLabel: input.actionLabel ?? null,
    recipientUserId: input.recipientUserId ?? null,
    recipientOrgId: input.recipientOrgId ?? null,
    expiresAt: input.expiresAt ?? null,
    priority: input.priority ?? 'medium',
    senderId: input.senderId ?? null,
    category: input.category ?? 'update',
    metadata: input.metadata ?? null,
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          id: payload.id,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          link: payload.link,
          action_label: payload.actionLabel,
          recipient_user_id: payload.recipientUserId,
          recipient_org_id: payload.recipientOrgId,
          is_read: payload.isRead,
          created_at: payload.createdAt,
          expires_at: payload.expiresAt,
          priority: payload.priority,
          sender_id: payload.senderId,
          category: payload.category,
          metadata: payload.metadata,
          archived: payload.archived,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const record = toNotificationRecord(data);
        if (!isSupabaseConfigured) {
          // Should not happen but keeps types happy
          return record;
        }
        return record;
      }
    } catch (error) {
      console.warn('[NotificationService] Failed to create via Supabase', error);
    }
  }

  const cache = readLocalCache();
  cache.push(payload);
  writeLocalCache(cache);
  return payload;
};

const updateCacheItem = (id: string, updater: (item: NotificationRecord) => NotificationRecord) => {
  const cache = readLocalCache();
  const updated = cache.map((item) => (item.id === id ? updater(item) : item));
  writeLocalCache(updated);
  return updated.find((item) => item.id === id);
};

export const markNotificationRead = async (id: string, isRead = true) => {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: isRead })
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('[NotificationService] Failed to update read status', error);
    }
  }

  return updateCacheItem(id, (item) => ({ ...item, isRead }));
};

export const archiveNotification = async (id: string, archived = true) => {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ archived })
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('[NotificationService] Failed to archive notification', error);
    }
  }

  return updateCacheItem(id, (item) => ({ ...item, archived }));
};

export const deleteNotification = async (id: string) => {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('[NotificationService] Failed to delete notification', error);
    }
  }

  const cache = readLocalCache();
  const filtered = cache.filter((item) => item.id !== id);
  writeLocalCache(filtered);
};

export const markAllNotificationsRead = async (opts?: NotificationFilterOptions) => {
  if (isSupabaseConfigured) {
    try {
      const query = supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
      if (opts?.userId) {
        query.eq('recipient_user_id', opts.userId);
      }
      if (opts?.orgId) {
        query.eq('recipient_org_id', opts.orgId);
      }
      const { error } = await query;
      if (error) throw error;
    } catch (error) {
      console.warn('[NotificationService] Failed to mark all read via Supabase', error);
    }
  }

  const cache = readLocalCache().map((item) => {
    const inScope = (!opts?.userId || item.recipientUserId === opts.userId || !item.recipientUserId)
      && (!opts?.orgId || item.recipientOrgId === opts.orgId || !item.recipientOrgId);
    if (!inScope) return item;
    return { ...item, isRead: true };
  });
  writeLocalCache(cache);
};

export const subscribeToNotifications = (
  callback: (event: 'INSERT' | 'UPDATE' | 'DELETE', record: NotificationRecord) => void
) => {
  if (!isSupabaseConfigured || !supabase?.channel) {
    return () => {};
  }

  const channel = supabase
    .channel('notifications_feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload: any) => {
      const data = payload.new ?? payload.old;
      if (!data) return;
      callback(payload.eventType, toNotificationRecord(data));
    })
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch (error) {
      console.warn('[NotificationService] Failed to unsubscribe', error);
    }
  };
};

export const persistNotificationCache = (notifications: NotificationRecord[]) => {
  writeLocalCache(notifications);
};

export default {
  fetchNotifications,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  archiveNotification,
  deleteNotification,
  subscribeToNotifications,
  persistNotificationCache,
  loadNotificationCache,
};
