import { logger } from '../lib/logger.js';

const DEFAULT_CHANNELS = ['in_app'];
const CHANNEL_PRIORITY = new Set(['email', 'both', 'in_app', 'sms', 'push']);
const STATUS_VALUES = new Set(['unread', 'read']);
const PRIORITY_VALUES = new Set(['low', 'normal', 'high']);

const normalizeChannel = (channel, channels) => {
  const normalized = String(channel || '').toLowerCase();
  if (CHANNEL_PRIORITY.has(normalized)) {
    return normalized;
  }
  if (Array.isArray(channels) && channels.length) {
    const hasEmail = channels.some((value) => String(value).toLowerCase() === 'email');
    const hasInApp = channels.some((value) => String(value).toLowerCase() === 'in_app');
    if (hasEmail && hasInApp) return 'both';
    if (hasEmail) return 'email';
    if (hasInApp) return 'in_app';
  }
  return 'in_app';
};

const normalizeStatus = (status, read) => {
  const normalized = String(status || '').toLowerCase();
  if (STATUS_VALUES.has(normalized)) {
    return normalized;
  }
  return read ? 'read' : 'unread';
};

const normalizePriority = (priority) => {
  const normalized = String(priority || '').toLowerCase();
  if (PRIORITY_VALUES.has(normalized)) {
    return normalized;
  }
  return 'normal';
};

const defaultMetadata = (metadata) =>
  metadata && typeof metadata === 'object' ? metadata : {};

const toNotificationPayload = (input) => {
  const organizationId = input.organizationId || input.organization_id || input.orgId || null;
  const userId = input.userId || input.user_id || null;
  const recipientType =
    input.recipientType ||
    (userId ? 'user' : organizationId ? 'organization' : 'user');
  const recipientId =
    input.recipientId || (recipientType === 'user' ? userId : organizationId);
  const channels = Array.isArray(input.channels) && input.channels.length ? input.channels : DEFAULT_CHANNELS;
  const channel = normalizeChannel(input.channel, channels);
  const status = normalizeStatus(input.status, input.read);
  const priority = normalizePriority(input.priority);

  return {
    title: input.title,
    message: input.message ?? input.body ?? null,
    body: input.body ?? input.message ?? null,
    type: input.type || 'announcement',
    organization_id: organizationId,
    org_id: organizationId,
    user_id: userId,
    recipient_type: recipientType,
    recipient_id: recipientId,
    link: input.link || input.url || null,
    channel,
    channels,
    status,
    priority,
    dispatch_status: input.dispatchStatus || (input.scheduledFor ? 'pending' : 'queued'),
    scheduled_for: input.scheduledFor || null,
    metadata: defaultMetadata(input.metadata),
    created_by: input.createdBy || null,
    read: status === 'read',
    read_at: status === 'read' ? input.readAt || new Date().toISOString() : null,
  };
};

const ensureSupabase = (getSupabase) => {
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  if (!client) {
    throw new Error('supabase_unavailable');
  }
  return client;
};

export const createNotificationService = ({ getSupabase, dispatcher, logger: customLogger } = {}) => {
  const log = customLogger || logger;
  const enqueueDispatch = dispatcher?.enqueueDispatch
    ? dispatcher.enqueueDispatch.bind(dispatcher)
    : () => {};

  const createNotification = async (input) => {
    if (!input || !input.title) {
      throw new Error('notification_title_required');
    }
    const supabase = ensureSupabase(getSupabase);
    const payload = toNotificationPayload(input);
    const { data, error } = await supabase.from('notifications').insert(payload).select('*').single();
    if (error) {
      log.error('notification_created_failed', {
        message: error.message,
        code: error.code,
        organizationId: payload.organization_id,
        userId: payload.user_id,
      });
      throw error;
    }
    log.info('notification_created', {
      notificationId: data.id,
      organizationId: data.organization_id,
      userId: data.user_id,
      type: data.type,
      channel: payload.channel,
    });
    if (!payload.scheduled_for) {
      enqueueDispatch({
        notificationId: data.id,
        channels: payload.channels || DEFAULT_CHANNELS,
        sendEmail: payload.channel === 'email' || payload.channel === 'both' || input.sendEmail === true,
      });
    }
    return data;
  };

  const markNotificationRead = async (id, read = true) => {
    const supabase = ensureSupabase(getSupabase);
    const status = read ? 'read' : 'unread';
    const { data, error } = await supabase
      .from('notifications')
      .update({ status, read, read_at: read ? new Date().toISOString() : null })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      log.warn('notification_mark_read_failed', { notificationId: id, message: error.message });
      throw error;
    }
    log.info('notification_read', { notificationId: id, status });
    return data;
  };

  const listNotificationsForRecipient = async ({ recipientId, limit = 50 } = {}) => {
    const supabase = ensureSupabase(getSupabase);
    const query = supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(limit, 200)));
    const { data, error } = await query;
    if (error) {
      log.warn('notification_fetch_failed', { recipientId, message: error.message });
      throw error;
    }
    return data || [];
  };

  return {
    createNotification,
    markNotificationRead,
    listNotificationsForRecipient,
  };
};

export default createNotificationService;
