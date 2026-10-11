// Drops, migrates and seeds the LOCAL SQLite database (npm run db:reset).
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config/index.js';
import { createKnex } from '../src/db/knex.js';

if (config.isProd || config.DATABASE_CLIENT !== 'sqlite3') {
  console.error('db:reset only works on the local SQLite database outside production.');
  process.exit(1);
}
const file = path.resolve(config.apiRoot, config.SQLITE_FILE);
for (const f of [file, `${file}-journal`, `${file}-wal`, `${file}-shm`]) fs.rmSync(f, { force: true });

const knex = createKnex();
await knex.migrate.latest();
await knex.seed.run();
console.log(`Database reset: ${file}`);
await knex.destroy();
