import { supabase } from '../lib/supabase';

export type Notification = {
  id: string;
  title: string;
  body?: string;
  orgId?: string;
  userId?: string;
  createdAt: string;
  read?: boolean;
  priority?: 'low' | 'normal' | 'high';
};

const KEY = 'huddle_notifications_v1';

const isSupabaseConfigured = () =>
  Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

const readLocal = (): Notification[] => {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Notification[];
  } catch (error) {
    console.warn('Failed to parse cached notifications, resetting store', error);
    localStorage.removeItem(KEY);
    return [];
  }
};

const writeLocal = (items: Notification[]) => {
  localStorage.setItem(KEY, JSON.stringify(items));
};

const mapRowToNotification = (row: any): Notification => ({
  id: row.id,
  title: row.subject ?? row.title ?? row.type ?? 'Notification',
  body: row.body ?? row.metadata?.body ?? undefined,
  orgId: row.organization_id ?? undefined,
  userId: row.recipient_user_id ?? row.metadata?.userId ?? undefined,
  createdAt: row.created_at ?? new Date().toISOString(),
  read: Boolean(row.read_at),
  priority: (row.metadata?.priority as Notification['priority']) ?? 'normal',
});

export const listNotifications = async (opts?: { orgId?: string; userId?: string }) => {
  if (isSupabaseConfigured()) {
    const query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (opts?.orgId) {
      query.eq('organization_id', opts.orgId);
    }
    if (opts?.userId) {
      query.or(
        `recipient_user_id.eq.${opts.userId},metadata->>userId.eq.${opts.userId},recipient_user_id.is.null`
      );
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Supabase notifications fetch failed, falling back to cache', error);
    } else if (data) {
      const mapped = data.map(mapRowToNotification);
      writeLocal(mapped);
      return mapped;
    }
  }

  let items = readLocal();
  if (opts?.orgId) items = items.filter(item => item.orgId === opts.orgId || !item.orgId);
  if (opts?.userId) items = items.filter(item => item.userId === opts.userId || !item.userId);
  return items.slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
};

export const addNotification = async (
  payload: Omit<Notification, 'id' | 'createdAt'> & { metadata?: Record<string, any> }
): Promise<Notification> => {
  const now = new Date().toISOString();
  const baseNotification: Notification = {
    id: `note-${Date.now()}`,
    createdAt: now,
    read: false,
    priority: payload.priority ?? 'normal',
    ...payload,
  };

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        id: baseNotification.id,
        organization_id: payload.orgId ?? null,
        recipient_user_id: payload.userId ?? null,
        subject: payload.title,
        body: payload.body ?? null,
        metadata: {
          priority: baseNotification.priority,
          ...payload.metadata,
        },
      })
      .select()
      .single();

    if (!error && data) {
      const mapped = mapRowToNotification(data);
      const cache = readLocal();
      cache.unshift(mapped);
      writeLocal(cache.slice(0, 50));
      return mapped;
    }

    console.warn('Supabase notification insert failed, persisting locally', error);
  }

  const cache = readLocal();
  cache.unshift(baseNotification);
  writeLocal(cache.slice(0, 50));
  return baseNotification;
};

export const markNotificationRead = async (id: string) => {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.warn('Failed to mark notification as read remotely', error);
    }
  }

  const items = readLocal();
  const updated = items.map(item => (item.id === id ? { ...item, read: true } : item));
  writeLocal(updated);
  return updated.find(item => item.id === id) ?? null;
};

export const clearNotifications = async (opts?: { orgId?: string }) => {
  if (isSupabaseConfigured() && opts?.orgId) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .match({ organization_id: opts.orgId });

    if (error) {
      console.warn('Failed to clear notifications remotely', error);
    }
  }

  if (!opts?.orgId) {
    writeLocal([]);
    return;
  }

  const remaining = readLocal().filter(item => item.orgId && item.orgId !== opts.orgId);
  writeLocal(remaining);
};

export default { listNotifications, addNotification, clearNotifications, markNotificationRead };
