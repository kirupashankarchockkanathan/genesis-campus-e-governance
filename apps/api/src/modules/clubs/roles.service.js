import { LOCKED_PERMISSIONS } from '@ccp/shared';
import { newId } from '../../lib/ids.js';
import { clock } from '../../lib/clock.js';
import { errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { boolToDb, toDb } from '../../db/helpers.js';
import { listRoles } from './clubs.service.js';

const slug = (name) =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

const assertAllowed = (permissions) => {
  if (permissions?.some((p) => LOCKED_PERMISSIONS.includes(p))) {
    throw errors.forbidden(
      'event.submit, leadership.transfer and role.manage cannot be given to other roles.',
    );
  }
};

/** Custom club roles (Phase 2, role.manage): rows in club_roles, so no code change is needed (spec 3.2). */
export async function createCustomRole(db, actor, clubId, { name, permissions }) {
  assertAllowed(permissions);
  const key = `CUSTOM_${slug(name)}`;
  if (key === 'CUSTOM_') throw errors.validation('Give the role a name using letters or numbers.');
  const id = newId();
  const now = toDb(clock.now());
  await db.transaction(async (trx) => {
    if (await trx('club_roles').where({ club_id: clubId, key }).first())
      throw errors.conflict('A role with that name already exists.');
    await trx('club_roles').insert({
      id,
      club_id: clubId,
      key,
      name,
      is_system: boolToDb(false),
      created_at: now,
      updated_at: now,
    });
    if (permissions.length)
      await trx('club_role_permissions').insert(
        [...new Set(permissions)].map((permission) => ({ club_role_id: id, permission })),
      );
    await audit(trx, {
      actorId: actor.id,
      action: 'role.created',
      entityType: 'club',
      entityId: clubId,
      meta: { key },
    });
  });
  return (await listRoles(db, clubId)).find((r) => r.id === id);
}

async function customRole(db, clubId, roleId) {
  const r = await db('club_roles').where({ id: roleId, club_id: clubId }).first();
  if (!r) throw errors.notFound('Role not found.');
  if (r.is_system === 1 || r.is_system === true)
    throw errors.forbidden('The default roles cannot be edited.');
  return r;
}

export async function updateCustomRole(db, actor, clubId, roleId, { name, permissions }) {
  assertAllowed(permissions);
  const r = await customRole(db, clubId, roleId);
  await db.transaction(async (trx) => {
    if (name !== undefined)
      await trx('club_roles')
        .where({ id: r.id })
        .update({ name, updated_at: toDb(clock.now()) });
    if (permissions !== undefined) {
      await trx('club_role_permissions').where({ club_role_id: r.id }).del();
      if (permissions.length)
        await trx('club_role_permissions').insert(
          [...new Set(permissions)].map((permission) => ({ club_role_id: r.id, permission })),
        );
    }
    await audit(trx, {
      actorId: actor.id,
      action: 'role.updated',
      entityType: 'club',
      entityId: clubId,
      meta: { key: r.key },
    });
  });
  return (await listRoles(db, clubId)).find((x) => x.id === r.id);
}

export async function deleteCustomRole(db, actor, clubId, roleId) {
  const r = await customRole(db, clubId, roleId);
  const used = await db('club_members').where({ club_role_id: r.id, status: 'active' }).first();
  if (used) throw errors.conflict('Move the members of this role to another role before deleting it.');
  await db.transaction(async (trx) => {
    await trx('club_members')
      .where({ club_role_id: r.id })
      .update({
        club_role_id: (await trx('club_roles').where({ club_id: clubId, key: 'MEMBER' }).first()).id,
      });
    await trx('club_roles').where({ id: r.id }).del(); // permissions cascade
    await audit(trx, {
      actorId: actor.id,
      action: 'role.deleted',
      entityType: 'club',
      entityId: clubId,
      meta: { key: r.key },
    });
  });
}
