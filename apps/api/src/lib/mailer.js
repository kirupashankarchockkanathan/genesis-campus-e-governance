import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from './logger.js';

// Test mailer: captures messages in memory (spec 15.1 rule 5).
export const outbox = [];

let transport = null;
const getTransport = () => {
  if (!config.SMTP_HOST) return null;
  transport ??= nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  });
  return transport;
};

export async function sendMail({ to, subject, text }) {
  if (config.NODE_ENV === 'test') {
    outbox.push({ to, subject, text });
    return;
  }
  const t = getTransport();
  if (!t) {
    // Development: print the message (including links) to the console.
    logger.info({ to, subject }, 'mail (console transport)');
    console.log(`\n--- MAIL to ${to}: ${subject}\n${text}\n---\n`);
    return;
  }
  await t.sendMail({ from: config.MAIL_FROM, to, subject, text });
}

export const verificationMail = (to, token) => ({
  to,
  subject: 'Verify your Campus Clubs Portal email',
  text: `Open this link to verify your email (valid 24 hours):\n${config.WEB_URL}/verify-email?token=${token}`,
});
export const resetMail = (to, token) => ({
  to,
  subject: 'Reset your Campus Clubs Portal password',
  text: `Open this link to reset your password (valid 1 hour):\n${config.WEB_URL}/reset-password?token=${token}`,
});
