import {
  NotificationAnalytics,
  NotificationEvent,
  NotificationEventType,
  NotificationRecord,
} from '../types/notifications';

const EVENT_STORAGE_KEY = 'huddle_notification_events_v1';

const readEvents = (): NotificationEvent[] => {
  try {
    const raw = localStorage.getItem(EVENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as NotificationEvent[];
  } catch (error) {
    console.error('[NotificationAnalytics] Failed to read events', error);
    return [];
  }
};

const writeEvents = (events: NotificationEvent[]) => {
  try {
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(events));
  } catch (error) {
    console.error('[NotificationAnalytics] Failed to persist events', error);
  }
};

export const logNotificationEvent = (
  notificationId: string,
  type: NotificationEventType,
  userId?: string | null,
  metadata?: Record<string, unknown>
) => {
  const events = readEvents();
  const event: NotificationEvent = {
    id: `${notificationId}-${type}-${Date.now()}`,
    notificationId,
    type,
    occurredAt: new Date().toISOString(),
    userId,
    metadata,
  };
  events.push(event);
  writeEvents(events);
  return event;
};

export const getNotificationEvents = () => readEvents();

export const clearNotificationEvents = () => writeEvents([]);

const initTypeMap = <T extends string>(keys: T[], fallback = 0) =>
  keys.reduce<Record<T, number>>((acc, key) => {
    acc[key] = fallback;
    return acc;
  }, {} as Record<T, number>);

export const buildNotificationAnalytics = (
  notifications: NotificationRecord[],
  events: NotificationEvent[]
): NotificationAnalytics => {
  const total = notifications.length;
  const read = notifications.filter((n) => n.isRead).length;
  const unread = notifications.filter((n) => !n.isRead && !n.archived).length;
  const archived = notifications.filter((n) => n.archived).length;
  const urgent = notifications.filter((n) => n.priority === 'urgent' || n.priority === 'high').length;

  const byType = notifications.reduce<Record<string, number>>((acc, note) => {
    acc[note.type] = (acc[note.type] ?? 0) + 1;
    return acc;
  }, initTypeMap(['assignment', 'course_update', 'survey_reminder', 'completion', 'broadcast', 'system', 'message'] as const));

  const byCategory = notifications.reduce<Record<string, number>>((acc, note) => {
    acc[note.category] = (acc[note.category] ?? 0) + 1;
    return acc;
  }, initTypeMap(['alert', 'announcement', 'update', 'celebration', 'reminder'] as const));

  const deliveredEvents = events.filter((event) => event.type === 'delivered');
  const clickEvents = events.filter((event) => event.type === 'clicked');

  const denominator = deliveredEvents.length || total || 1;
  const openRate = total === 0 ? 0 : read / total;
  const clickRate = clickEvents.length / denominator;

  const engagementByOrgMap = notifications.reduce<Record<string, { sent: number; read: number }>>((acc, notification) => {
    if (!notification.recipientOrgId) return acc;
    const bucket = acc[notification.recipientOrgId] ?? { sent: 0, read: 0 };
    bucket.sent += 1;
    if (notification.isRead) bucket.read += 1;
    acc[notification.recipientOrgId] = bucket;
    return acc;
  }, {});

  const engagementByOrg = Object.entries(engagementByOrgMap).map(([orgId, stats]) => ({
    orgId,
    ...stats,
  }));

  return {
    total,
    read,
    unread,
    archived,
    urgent,
    byType: byType as NotificationAnalytics['byType'],
    byCategory: byCategory as NotificationAnalytics['byCategory'],
    openRate,
    clickRate,
    engagementByOrg,
  };
};

export default {
  logNotificationEvent,
  getNotificationEvents,
  clearNotificationEvents,
  buildNotificationAnalytics,
};
