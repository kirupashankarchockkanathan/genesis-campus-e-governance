import { createKnex } from '../../src/db/knex.js';

/**
 * Fresh migrated database for a test file (spec 15.1 rules 1-3).
 * SQLite by default (in-memory); PostgreSQL when DATABASE_CLIENT=pg (schema reset between files).
 */
export async function createTestDb() {
  const usePg = process.env.DATABASE_CLIENT === 'pg';
  const knex = usePg
    ? createKnex({ client: 'pg', connectionString: process.env.DATABASE_URL })
    : createKnex({ client: 'sqlite3', filename: ':memory:' });
  if (usePg) {
    await knex.raw('DROP SCHEMA public CASCADE');
    await knex.raw('CREATE SCHEMA public');
  }
  await knex.migrate.latest();
  return knex;
}

export const TABLES_IN_CLEAN_ORDER = [
  'audit_logs',
  'refresh_tokens',
  'auth_tokens',
  'favorite_clubs',
  'club_members',
  'club_role_permissions',
  'club_roles',
  'clubs',
  'halls',
  'users',
];

export async function cleanDb(knex) {
  for (const t of TABLES_IN_CLEAN_ORDER) await knex(t).del();
}
