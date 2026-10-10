import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import knexLib from 'knex';
import { config } from '../config/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Build a Knex config. `overrides.filename` may be ':memory:' for tests. */
export function buildKnexConfig({ client = config.DATABASE_CLIENT, filename, connectionString } = {}) {
  const common = {
    migrations: { directory: path.join(here, 'migrations'), loadExtensions: ['.js'] },
    seeds: { directory: path.join(here, 'seeds'), loadExtensions: ['.js'] },
  };
  if (client === 'pg') {
    return {
      ...common,
      client: 'pg',
      connection: connectionString ?? config.DATABASE_URL,
      pool: { min: 0, max: 10 },
    };
  }
  const file = filename ?? path.resolve(config.apiRoot, config.SQLITE_FILE);
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  return {
    ...common,
    client: 'better-sqlite3',
    connection: { filename: file },
    useNullAsDefault: true,
    // Section 9.4: foreign keys must be ON for every SQLite connection.
    pool: {
      min: 1,
      max: file === ':memory:' ? 1 : 5,
      afterCreate: (conn, done) => {
        conn.pragma('foreign_keys = ON');
        done(null, conn);
      },
    },
  };
}

export const createKnex = (opts) => knexLib(buildKnexConfig(opts));

let shared = null;
export const getDb = () => (shared ??= createKnex());
export const closeDb = async () => {
  if (shared) await shared.destroy();
  shared = null;
};
export const isPg = (knex) => knex.client.config.client === 'pg';
