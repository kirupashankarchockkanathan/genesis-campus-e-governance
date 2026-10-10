import cron from 'node-cron';
import { config } from './config/index.js';
import { getDb } from './db/knex.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { tokenCleanup } from './jobs/tokenCleanup.js';
import { pruneNotifications, runAllJobs } from './jobs/index.js';

const db = getDb();
await db.migrate.latest();

const app = createApp({ db });
const server = app.listen(config.PORT, () => logger.info(`API listening on http://localhost:${config.PORT}`));

// Scheduled jobs (spec 7.1): hold expiry, registration auto-close, completion, no-shows and reminders every 5 minutes; clean-up daily.
cron.schedule('*/5 * * * *', () => runAllJobs(db).catch((err) => logger.error({ err }, 'jobs failed')));
cron.schedule('29 3 * * *', () =>
  pruneNotifications(db).catch((err) => logger.error({ err }, 'prune failed')),
);
cron.schedule('17 3 * * *', () =>
  tokenCleanup(db).catch((err) => logger.error({ err }, 'tokenCleanup failed')),
);

const shutdown = () => server.close(() => db.destroy().then(() => process.exit(0)));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
