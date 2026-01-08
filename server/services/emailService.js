import nodemailer from 'nodemailer';

let cachedTransporter = null;

const smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST;
const smtpPort = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 587);
const smtpUser = process.env.SMTP_USER || process.env.MAIL_USER;
const smtpPass = process.env.SMTP_PASS || process.env.MAIL_PASS;
const smtpSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
const defaultFrom = process.env.SMTP_FROM || process.env.MAIL_FROM || 'no-reply@the-huddle.co';

const canSend = Boolean(smtpHost && smtpPort && smtpUser && smtpPass);

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

export async function sendEmail({ to, subject, text, html, from = defaultFrom }) {
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
    return { queued: false, delivered: false, reason: 'smtp_not_configured' };
  }

  try {
    const info = await transporter.sendMail(payload);
    return { queued: true, delivered: true, id: info.messageId };
  } catch (error) {
    console.error('[emailService] Failed to send email', { error, to, subject });
    return { queued: true, delivered: false, reason: error.message };
  }
}

export function isEmailEnabled() {
  return canSend;
}
