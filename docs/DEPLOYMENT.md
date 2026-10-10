# Deployment, backups and monitoring

## Hosting plan (spec 7.4)

Static host for `apps/web` (run `npm run build -w apps/web`, serve `apps/web/dist`, route all paths to `index.html`, proxy `/api` and `/uploads` to the API), a small Node host for `apps/api`, and a hosted PostgreSQL. Keep every connection detail in environment variables.

## Checklist before going live

1. Set production values for every variable in `.env.example`: `NODE_ENV=production`, `DATABASE_CLIENT=pg`, `DATABASE_URL`, a long random `JWT_SECRET` (the API refuses to start with a weak one), `WEB_URL`, `API_URL`, real `ALLOWED_EMAIL_DOMAINS`, SMTP details.
2. `AUTO_VERIFY_EMAIL=false`, `SEED_SAMPLE=false`, `MAIL_OUTBOX_FILE` empty (the API refuses it in production).
3. Run migrations before starting the new API version: `npm run db:migrate`. Create the Super Admin with the seed script, then change its password. Run PostgreSQL parity tests first: `DATABASE_CLIENT=pg DATABASE_URL=... npm run test:pg`.
4. Serve over HTTPS only (the refresh cookie is `Secure` outside development). Set `trust proxy` correctly behind your host (already `1` in production).
5. **Uploads**: the API stores posters on local disk. On hosts where the disk is wiped, add an S3-compatible driver in `apps/api/src/lib/storage.js` before launch (not implemented yet), or mount a persistent volume at `UPLOAD_DIR`.
6. Scale: the login limiter, notification stream hub and posting limits are in memory. Run **one API instance**, or move them to Redis or the database first.
7. Optional: set `ANTHROPIC_API_KEY` (and `LLM_MODEL`) for the assistant. Without it the assistant answers by quoting portal text.

## Backups

- PostgreSQL: enable the host's automated daily backups and point-in-time recovery; keep at least 14 days. Test a restore into an empty database once before launch.
- Uploaded posters: back up the upload volume or bucket on the same schedule.
- Local SQLite (development only): copy `apps/api/data/dev.sqlite`.

## Monitoring and error reporting

- Liveness and database check: `GET /api/v1/health` (200 `{status: "ok", database: "up"}`; 503 when the database is down). Point the host's health check and an uptime monitor at it.
- Logs are structured JSON (pino) with passwords, tokens and cookies redacted; every response carries `X-Request-Id`. Ship stdout to the host's log service.
- Alert on: health check failing, rising 5xx rate, repeated `auth.login_locked` and `auth.refresh_reuse` audit entries, jobs failing (`jobs failed` log lines).
- No external error-reporting service is wired in. Add one (for example Sentry) in `apps/api/src/middleware/errorHandler.js` and in the web error boundary (`apps/web/src/components/ui/ErrorBoundary.jsx`).

## Scheduled jobs

Started with the API (`node-cron`): every 5 minutes hold expiry, hold warnings, registration auto-close, recruitment auto-close, event completion, no-shows and 24-hour reminders; daily token clean-up and removal of read notifications older than 180 days. Reminders are de-duplicated, so a restart never sends them twice.

## Time zone

Timestamps are stored in UTC and shown in `APP_TIMEZONE` (default `Asia/Kolkata`; the web build reads `VITE_APP_TIMEZONE`).
