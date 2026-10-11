import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import knexLib from 'knex';
import { config } from '../config/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Hosted PostgreSQL (Neon, Supabase, RDS...) needs TLS. The driver does not understand `channel_binding`, so it is
 * dropped from the URL and TLS is switched on whenever the URL asks for it (sslmode=require) or is not localhost.
 */
export function pgConnection(url) {
  if (!url) throw new Error('DATABASE_URL is required when DATABASE_CLIENT=pg');
  const u = new URL(url);
  u.searchParams.delete('channel_binding');
  const wantsTls =
    u.searchParams.get('sslmode') === 'require' || !['localhost', '127.0.0.1'].includes(u.hostname);
  u.searchParams.delete('sslmode');
  return { connectionString: u.toString(), ...(wantsTls ? { ssl: { rejectUnauthorized: true } } : {}) };
}

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
      connection: pgConnection(connectionString ?? config.DATABASE_URL),
      pool: { min: 0, max: 10 },
    };
  }
  // SQLite is for the automated tests and the end-to-end stack only, never for a running service.
  if (config.isProd)
    throw new Error('SQLite is not allowed in production. Set DATABASE_CLIENT=pg and DATABASE_URL.');
  const file = filename ?? path.resolve(config.apiRoot, config.SQLITE_FILE);
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  return {
    ...common,
    client: 'better-sqlite3',
    connection: { filename: file },
    useNullAsDefault: true,
    // Foreign keys must be ON for every SQLite connection.
    pool: {
      min: 1,
      max: 1, // one connection serialises SQLite writers, so check-then-insert in a transaction is race-free
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
