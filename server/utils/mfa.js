import speakeasy from 'speakeasy';
import nodemailer from 'nodemailer';

export function generateTOTPSecret() {
  return speakeasy.generateSecret({ length: 20 });
}

export function getTOTPToken(secret) {
  return speakeasy.totp({
    secret,
    encoding: 'base32',
  });
}

export function verifyTOTPToken(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1,
  });
}

export async function sendMfaEmail(email, code) {
  // Configure your SMTP transport here
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@yourdomain.com',
    to: email,
    subject: 'Your MFA Verification Code',
    text: `Your verification code is: ${code}`,
  });
}
