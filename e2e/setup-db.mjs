// Creates a fresh SQLite database with the sample data for the end-to-end run. SQLite is used here only so the browser
// journeys never touch the real (PostgreSQL) database. Environment comes from start-servers.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../backend/src/config/index.js';
import { createKnex } from '../backend/src/db/knex.js';

const file = path.resolve(config.apiRoot, config.SQLITE_FILE);
for (const f of [file, `${file}-journal`, `${file}-wal`, `${file}-shm`]) fs.rmSync(f, { force: true });
const knex = createKnex();
await knex.migrate.latest();
await knex.seed.run();
await knex.destroy();
