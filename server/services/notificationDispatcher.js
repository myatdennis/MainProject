import { enqueueJob, registerJobProcessor } from '../jobs/taskQueue.js';
import { logger } from '../lib/logger.js';

const JOB_NAME = 'notifications.dispatch';

const fetchUserEmails = async (supabase, userIds = []) => {
  if (!userIds.length) return [];
  const unique = [...new Set(userIds.filter(Boolean))];
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, email')
    .in('user_id', unique)
    .limit(500);
  if (error) {
    logger.warn('notifications_fetch_profiles_failed', { message: error.message });
    return [];
  }
  return (data || []).map((row) => ({ id: row.user_id, email: row.email })).filter((row) => !!row.email);
};

const fetchOrgRecipientEmails = async (supabase, orgId) => {
  if (!orgId) return [];
  const membershipQuery = await supabase
    .from('organization_memberships')
    .select('user_id')
    .eq('org_id', orgId)
    .limit(500);
  if (membershipQuery.error) {
    logger.warn('notifications_fetch_org_members_failed', { orgId, message: membershipQuery.error.message });
    return [];
  }
  const memberIds = (membershipQuery.data || []).map((row) => row.user_id);
  return fetchUserEmails(supabase, memberIds);
};

export const setupNotificationDispatcher = ({ supabase, emailSender }) => {
  registerJobProcessor(JOB_NAME, async (payload) => {
    if (!supabase) {
      logger.warn('notifications_dispatch_skipped_supabase_offline');
      return null;
    }

    const { notificationId, channels = ['in_app'], sendEmail = false } = payload || {};
    if (!notificationId) {
      logger.warn('notifications_dispatch_missing_id');
      return null;
    }

    const { data: notification, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .maybeSingle();

    if (error) {
      logger.error('notifications_fetch_failed', { message: error.message, notificationId });
      return null;
    }
    if (!notification) {
      logger.warn('notifications_missing_record', { notificationId });
      return null;
    }

    await supabase
      .from('notifications')
      .update({ dispatch_status: 'processing' })
      .eq('id', notificationId);

    let recipients = [];
    if (notification.user_id) {
      recipients = await fetchUserEmails(supabase, [notification.user_id]);
    } else if (notification.org_id) {
      recipients = await fetchOrgRecipientEmails(supabase, notification.org_id);
    }

    if (sendEmail && emailSender && recipients.length) {
      await Promise.all(
        recipients.map(async ({ email }) => {
          try {
            await emailSender({
              to: email,
              subject: notification.title,
              text: notification.body || 'You have a new notification',
            });
          } catch (error) {
            logger.warn('notifications_email_send_failed', { email, message: error?.message || String(error) });
          }
        })
      );
    }

    await supabase
      .from('notifications')
      .update({
        dispatch_status: 'delivered',
        delivered_at: new Date().toISOString(),
        metadata: {
          ...(notification.metadata || {}),
          dispatched_channels: channels,
          dispatched_recipients: recipients.length,
        },
      })
      .eq('id', notificationId);

    return { recipients: recipients.length, channels };
  });

  return {
    enqueueDispatch: (payload = {}) => enqueueJob(JOB_NAME, payload),
  };
};

export default setupNotificationDispatcher;
