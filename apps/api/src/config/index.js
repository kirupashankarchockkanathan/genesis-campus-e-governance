import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, '../..');
dotenv.config({ path: path.resolve(apiRoot, '../../.env') });
dotenv.config({ path: path.resolve(apiRoot, '.env') });

const bool = (def) =>
  z
    .enum(['true', 'false'])
    .default(def)
    .transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  WEB_URL: z.string().default('http://localhost:5173'),
  API_URL: z.string().default('http://localhost:4000'),
  LOG_LEVEL: z.string().default('info'),
  APP_TIMEZONE: z.string().default('Asia/Kolkata'),
  DATABASE_CLIENT: z.enum(['sqlite3', 'pg']).default('sqlite3'),
  SQLITE_FILE: z.string().default('./data/dev.sqlite'),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().default('change-me-to-a-long-random-string'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().default(14),
  ALLOWED_EMAIL_DOMAINS: z.string().default('campus.example'),
  AUTO_VERIFY_EMAIL: bool('false'),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  RATE_LIMIT_MAX: z.coerce.number().default(30),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  // Development and end-to-end tests only: append every outgoing mail to this file as JSON lines.
  MAIL_OUTBOX_FILE: z.string().default(''),
  MAIL_FROM: z.string().default('Campus Clubs Portal <no-reply@campus.example>'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  HOLD_EXPIRY_DAYS: z.coerce.number().default(14),
  MAX_ACTIVE_HOLDS_PER_CLUB: z.coerce.number().default(2),
  ANTHROPIC_API_KEY: z.string().default(''),
  LLM_MODEL: z.string().default(''),
  CHAT_TIMEOUT_MS: z.coerce.number().default(20000),
  CHAT_RATE_PER_MINUTE: z.coerce.number().default(20),
  SEED_SAMPLE: bool('false'),
  SEED_SAMPLE_PASSWORD: z.string().default(''),
  SEED_SUPER_ADMIN_EMAIL: z.string().default('superadmin@campus.example'),
  SEED_SUPER_ADMIN_PASSWORD: z.string().default(''),
  SEED_OSI_EMAIL: z.string().default('osi@campus.example'),
  SEED_OSI_PASSWORD: z.string().default(''),
  SEED_EVENTS_EMAIL: z.string().default('events@campus.example'),
  SEED_EVENTS_PASSWORD: z.string().default(''),
});

export function loadConfig(env = process.env) {
  // Treat empty strings as unset so ".env.example" blanks fall back to defaults.
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ''));
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }
  const c = parsed.data;
  if (c.NODE_ENV === 'production') {
    if (c.JWT_SECRET.length < 32 || c.JWT_SECRET.startsWith('change-me')) {
      throw new Error('JWT_SECRET is missing or too weak for production');
    }
    if (c.AUTO_VERIFY_EMAIL) throw new Error('AUTO_VERIFY_EMAIL must be false in production');
    if (c.MAIL_OUTBOX_FILE) throw new Error('MAIL_OUTBOX_FILE must not be set in production');
  }
  return {
    ...c,
    apiRoot,
    allowedEmailDomains: c.ALLOWED_EMAIL_DOMAINS.split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
    isProd: c.NODE_ENV === 'production',
  };
}

export const config = loadConfig();

/** Test helper: shallow-merge overrides into the live config object. */
export function overrideConfig(patch) {
  Object.assign(config, patch);
  return config;
}
