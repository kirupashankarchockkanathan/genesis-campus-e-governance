// Starts a seeded test stack for Playwright: a fresh SQLite database, the API on 4100 and the web app on 5273.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PASSWORDS } from './passwords.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = path.join(root, 'e2e', '.data');
fs.rmSync(data, { recursive: true, force: true });
fs.mkdirSync(data, { recursive: true });

const apiEnv = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: '4100',
  WEB_URL: 'http://localhost:5273',
  API_URL: 'http://localhost:4100',
  LOG_LEVEL: 'warn',
  DATABASE_CLIENT: 'sqlite3',
  SQLITE_FILE: '../../e2e/.data/e2e.sqlite',
  UPLOAD_DIR: '../../e2e/.data/uploads',
  MAIL_OUTBOX_FILE: '../../e2e/.data/mail.jsonl',
  JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-secret-1234',
  AUTO_VERIFY_EMAIL: 'true',
  BCRYPT_COST: '4',
  RATE_LIMIT_MAX: '10000',
  MAX_ACTIVE_HOLDS_PER_CLUB: '50',
  ALLOWED_EMAIL_DOMAINS: 'campus.example',
  SEED_SAMPLE: 'true',
  SEED_SAMPLE_PASSWORD: PASSWORDS.sample,
  SEED_SUPER_ADMIN_PASSWORD: PASSWORDS.superAdmin,
  SEED_OSI_PASSWORD: PASSWORDS.osi,
  SEED_EVENTS_PASSWORD: PASSWORDS.events,
  ANTHROPIC_API_KEY: '',
};

const reset = spawnSync(process.execPath, ['apps/api/scripts/dbReset.js'], {
  cwd: root,
  env: apiEnv,
  stdio: 'inherit',
});
if (reset.status !== 0) process.exit(reset.status ?? 1);

const api = spawn(process.execPath, ['apps/api/src/server.js'], { cwd: root, env: apiEnv, stdio: 'inherit' });
const web = spawn(
  process.execPath,
  [path.join(root, 'node_modules/vite/bin/vite.js'), '--port', '5273', '--strictPort'],
  {
    cwd: path.join(root, 'apps/web'),
    env: { ...process.env, API_TARGET: 'http://localhost:4100' },
    stdio: 'inherit',
  },
);

const stop = () => {
  api.kill();
  web.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
api.on('exit', (c) => c && process.exit(c));
web.on('exit', (c) => c && process.exit(c));
