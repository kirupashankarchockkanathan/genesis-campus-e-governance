import cron from 'node-cron';
import { config } from './config/index.js';
import { getDb } from './db/knex.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { tokenCleanup } from './jobs/tokenCleanup.js';

const db = getDb();
await db.migrate.latest();

const app = createApp({ db });
const server = app.listen(config.PORT, () => logger.info(`API listening on http://localhost:${config.PORT}`));

// Daily token clean-up (spec 7.1). More jobs arrive in Phase 1.
cron.schedule('17 3 * * *', () => tokenCleanup(db).catch((err) => logger.error({ err }, 'tokenCleanup failed')));

const shutdown = () => server.close(() => db.destroy().then(() => process.exit(0)));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
