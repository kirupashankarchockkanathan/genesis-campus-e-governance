import { clock } from '../lib/clock.js';
import { toDb } from '../db/helpers.js';

/** Deletes expired/used auth tokens and expired/revoked refresh tokens only (TC-DB-25). */
export async function tokenCleanup(db) {
  const now = toDb(clock.now());
  const authTokens = await db('auth_tokens')
    .where((b) => b.where('expires_at', '<', now).orWhereNotNull('used_at'))
    .del();
  const refreshTokens = await db('refresh_tokens')
    .where((b) => b.where('expires_at', '<', now).orWhereNotNull('revoked_at'))
    .del();
  return { authTokens, refreshTokens };
}
