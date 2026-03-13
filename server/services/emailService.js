import nodemailer from 'nodemailer';
import { logger } from '../lib/logger.js';

let cachedTransporter = null;
let getSupabaseForLogging = () => null;

const smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST;
const smtpPort = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 587);
const smtpUser = process.env.SMTP_USER || process.env.MAIL_USER;
const smtpPass = process.env.SMTP_PASS || process.env.MAIL_PASS;
const smtpSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
const defaultFrom = process.env.SMTP_FROM || process.env.MAIL_FROM || 'no-reply@the-huddle.co';

const canSend = Boolean(smtpHost && smtpPort && smtpUser && smtpPass);

export const configureEmailLogging = ({ getSupabase }) => {
  if (typeof getSupabase === 'function') {
    getSupabaseForLogging = getSupabase;
  }
};

function getTransporter() {
  if (!canSend) {
    return null;
  }
  if (cachedTransporter) {
    return cachedTransporter;
  }
  cachedTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
  return cachedTransporter;
}

const sanitizeBody = (text, html) => {
  if (text && typeof text === 'string') {
    return text;
  }
  if (html && typeof html === 'string') {
    return html.replace(/<[^>]+>/g, ' ');
  }
  return '';
};

const statusFromResult = (result) => {
  if (result.delivered) return 'sent';
  if (result.reason && result.reason !== 'smtp_not_configured') return 'failed';
  return result.queued ? 'queued' : 'draft';
};

const logEmailAttempt = async (payload, result, logContext = {}) => {
  const supabase = getSupabaseForLogging();
  if (!supabase) return;
  try {
    await supabase.from('email_logs').insert({
      recipient_email: payload.to,
      recipient_type: logContext.recipientType || null,
      recipient_id: logContext.recipientId || null,
      organization_id: logContext.organizationId || null,
      subject: payload.subject,
      body: sanitizeBody(payload.text, payload.html),
      sent_by: logContext.sentBy || null,
      status: statusFromResult(result),
      sent_at: result.delivered ? new Date().toISOString() : null,
      provider_response:
        result.id || result.reason
          ? {
              messageId: result.id || null,
              reason: result.reason || null,
            }
          : null,
      metadata: logContext.metadata || {},
    });
  } catch (error) {
    logger.warn('email_log_insert_failed', {
      message: error?.message ?? String(error),
      recipient: payload.to,
    });
  }
};

export async function sendEmail({
  to,
  subject,
  text,
  html,
  from = defaultFrom,
  logContext,
}) {
  if (!to || !subject) {
    throw new Error('email_missing_fields');
  }

  const transporter = getTransporter();
  const payload = {
    from,
    to,
    subject,
    text: text || html?.replace(/<[^>]+>/g, ' '),
    html,
  };

  if (!transporter) {
    console.warn('[emailService] SMTP not configured. Email payload:', payload);
    const result = { queued: false, delivered: false, reason: 'smtp_not_configured' };
    await logEmailAttempt(payload, result, logContext);
    return result;
  }

  try {
    const info = await transporter.sendMail(payload);
    const result = { queued: true, delivered: true, id: info.messageId };
    await logEmailAttempt(payload, result, logContext);
    return result;
  } catch (error) {
    console.error('[emailService] Failed to send email', { error, to, subject });
    const result = { queued: true, delivered: false, reason: error.message };
    await logEmailAttempt(payload, result, logContext);
    return result;
  }
}

export function isEmailEnabled() {
  return canSend;
}
