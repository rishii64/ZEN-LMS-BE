import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let cachedTransporter = null;

function getSmtpAuthUser() {
  if (env.SMTP_USER && env.SMTP_USER.includes('@')) return env.SMTP_USER;
  if (env.MAIL_FROM && env.MAIL_FROM.includes('@')) return env.MAIL_FROM;
  return env.SMTP_USER;
}

function getFromHeader() {
  if (env.SMTP_USER && !env.SMTP_USER.includes('@') && env.MAIL_FROM) {
    return `"${env.SMTP_USER}" <${env.MAIL_FROM}>`;
  }
  return env.MAIL_FROM;
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: getSmtpAuthUser(),
      pass: env.SMTP_PASS
    }
  });
  return cachedTransporter;
}

export async function sendMail({ to, subject, html, text }) {
  if (env.isTest || env.MAIL_DRIVER !== 'smtp' || !env.SMTP_HOST) {
    logger.info({ to, subject, text }, '[mail:console] Email dispatched');
    return { driver: 'console', messageId: `console-${Date.now()}` };
  }

  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: getFromHeader(),
    to,
    subject,
    text,
    html
  });

  logger.info({ to, subject, messageId: info.messageId }, '[mail:smtp] Email sent');
  return { driver: 'smtp', messageId: info.messageId };
}

export async function sendPasswordResetEmail({ to, fullName, resetToken, resetUrl }) {
  const safeName = fullName || 'User';
  const subject = 'Reset your AstraLearn Enterprise LMS password';
  const text = [
    `Hi ${safeName},`,
    '',
    'We received a request to reset your AstraLearn Enterprise LMS password.',
    `Reset Link: ${resetUrl}`,
    `Reset Token: ${resetToken}`,
    '',
    'This link and token will expire in 60 minutes.',
    'If you did not request a password reset, you can safely ignore this email.'
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a;">
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px;">
        <div style="display: inline-block; background: #2563eb; color: #ffffff; font-weight: 700; font-size: 16px; padding: 8px 12px; border-radius: 10px; margin-bottom: 20px;">
          AL
        </div>
        <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #0f172a;">Reset your password</h2>
        <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #475569;">
          Hi ${safeName}, we received a request to reset the password for your AstraLearn Enterprise LMS account.
        </p>
        <div style="margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 10px;">
            Reset Password
          </a>
        </div>
        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
          Or paste this reset token
        </p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-family: monospace; font-size: 13px; color: #0f172a; word-break: break-all;">
          ${resetToken}
        </div>
        <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.5; color: #64748b;">
          This reset link and token will expire in 60 minutes. If you did not request this, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;

  return sendMail({ to, subject, html, text });
}
