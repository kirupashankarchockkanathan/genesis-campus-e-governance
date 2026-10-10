import { newId } from './ids.js';
import { clock } from './clock.js';
import { toDb, jsonToDb } from '../db/helpers.js';

/** Writes an audit row (spec 3.5 rule 8). `db` may be a knex instance or a transaction. */
export async function audit(
  db,
  { actorId = null, action, entityType = null, entityId = null, meta = null, ip = null },
) {
  await db('audit_logs').insert({
    id: newId(),
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    meta_json: jsonToDb(meta),
    ip,
    created_at: toDb(clock.now()),
  });
}
