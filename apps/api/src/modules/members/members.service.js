import { CLUB_ROLES, MEMBER_ADDED_VIA, MEMBER_STATUS, USER_STATUS } from '@ccp/shared';
import { newId } from '../../lib/ids.js';
import { clock } from '../../lib/clock.js';
import { errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { toDb } from '../../db/helpers.js';

const roleByKey = (trx, clubId, key) => trx('club_roles').where({ club_id: clubId, key }).first();

export async function listMembers(db, clubId) {
  const rows = await db('club_members as m')
    .join('users as u', 'u.id', 'm.user_id')
    .join('club_roles as r', 'r.id', 'm.club_role_id')
    .where({ 'm.club_id': clubId, 'm.status': MEMBER_STATUS.ACTIVE })
    .select('u.id as user_id', 'u.full_name', 'u.username', 'r.key as role_key', 'r.name as role_name', 'm.joined_at')
    .orderBy('r.name')
    .orderBy('u.full_name');
  return rows.map((r) => ({
    userId: r.user_id,
    fullName: r.full_name,
    username: r.username,
    roleKey: r.role_key,
    roleName: r.role_name,
    joinedAt: r.joined_at,
  }));
}

/** Add (or re-activate) a member. A club has exactly one Leader, so LEADER cannot be assigned here. */
export async function addMember(db, actor, clubId, { email, roleKey = CLUB_ROLES.MEMBER }) {
  if (roleKey === CLUB_ROLES.LEADER) throw errors.forbidden('Leadership changes only through leadership transfer.');
  return db.transaction(async (trx) => {
    const user = await trx('users').whereRaw('lower(email) = ?', [email.toLowerCase()]).first();
    if (!user || user.status !== USER_STATUS.ACTIVE) throw errors.notFound('No active student with that email.');
    const role = await roleByKey(trx, clubId, roleKey);
    if (!role) throw errors.validation('Unknown club role.');
    const now = toDb(clock.now());
    const existing = await trx('club_members').where({ club_id: clubId, user_id: user.id }).first();
    if (existing?.status === MEMBER_STATUS.ACTIVE) throw errors.conflict('That person is already a member.');
    if (existing) {
      await trx('club_members')
        .where({ id: existing.id })
        .update({ status: 'active', club_role_id: role.id, left_at: null, joined_at: now, updated_at: now });
    } else {
      await trx('club_members').insert({
        id: newId(),
        club_id: clubId,
        user_id: user.id,
        club_role_id: role.id,
        status: 'active',
        joined_at: now,
        added_via: MEMBER_ADDED_VIA.DIRECT,
        created_at: now,
        updated_at: now,
      });
    }
    await audit(trx, { actorId: actor.id, action: 'member.added', entityType: 'club', entityId: clubId, meta: { userId: user.id, roleKey } });
    return { userId: user.id, roleKey };
  });
}

async function activeMembership(trx, clubId, userId) {
  return trx('club_members as m')
    .join('club_roles as r', 'r.id', 'm.club_role_id')
    .where({ 'm.club_id': clubId, 'm.user_id': userId, 'm.status': MEMBER_STATUS.ACTIVE })
    .select('m.*', 'r.key as role_key')
    .first();
}

export async function changeRole(db, actor, clubId, userId, roleKey) {
  if (roleKey === CLUB_ROLES.LEADER) throw errors.forbidden('Leadership changes only through leadership transfer.');
  return db.transaction(async (trx) => {
    const m = await activeMembership(trx, clubId, userId);
    if (!m) throw errors.notFound('Member not found.');
    if (m.role_key === CLUB_ROLES.LEADER) throw errors.forbidden('The Leader role cannot be changed here.');
    const role = await roleByKey(trx, clubId, roleKey);
    if (!role) throw errors.validation('Unknown club role.');
    await trx('club_members').where({ id: m.id }).update({ club_role_id: role.id, updated_at: toDb(clock.now()) });
    await audit(trx, { actorId: actor.id, action: 'member.role_changed', entityType: 'club', entityId: clubId, meta: { userId, from: m.role_key, to: roleKey } });
    return { userId, roleKey };
  });
}

export async function removeMember(db, actor, clubId, userId) {
  return db.transaction(async (trx) => {
    const m = await activeMembership(trx, clubId, userId);
    if (!m) throw errors.notFound('Member not found.');
    if (m.role_key === CLUB_ROLES.LEADER) throw errors.forbidden('The Leader cannot be removed. Transfer leadership first.');
    const now = toDb(clock.now());
    const self = actor.id === userId;
    await trx('club_members')
      .where({ id: m.id })
      .update({ status: self ? MEMBER_STATUS.LEFT : MEMBER_STATUS.REMOVED, left_at: now, updated_at: now });
    await audit(trx, { actorId: actor.id, action: self ? 'member.left' : 'member.removed', entityType: 'club', entityId: clubId, meta: { userId } });
  });
}

/**
 * Atomically swap Leader (FR / spec 3.5 rule 3, TC-RBAC-11, TC-DB-27).
 * The old Leader becomes `demoteTo` (default Vice Leader); exactly one Leader remains.
 */
export async function transferLeadership(db, actor, clubId, toUserId, demoteTo = CLUB_ROLES.VICE_LEADER) {
  if (demoteTo === CLUB_ROLES.LEADER) throw errors.validation('Choose a different role for the outgoing Leader.');
  return db.transaction(async (trx) => {
    const current = await trx('club_members as m')
      .join('club_roles as r', 'r.id', 'm.club_role_id')
      .where({ 'm.club_id': clubId, 'm.status': 'active', 'r.key': CLUB_ROLES.LEADER })
      .select('m.*')
      .first();
    if (!current) throw errors.invalidState('This club has no active Leader.');
    if (current.user_id === toUserId) throw errors.conflict('That member is already the Leader.');
    const target = await activeMembership(trx, clubId, toUserId);
    if (!target) throw errors.notFound('The new Leader must be an active member of this club.');
    const leaderRole = await roleByKey(trx, clubId, CLUB_ROLES.LEADER);
    const demoteRole = await roleByKey(trx, clubId, demoteTo);
    if (!demoteRole) throw errors.validation('Unknown club role.');
    const now = toDb(clock.now());
    await trx('club_members').where({ id: current.id }).update({ club_role_id: demoteRole.id, updated_at: now });
    await trx('club_members').where({ id: target.id }).update({ club_role_id: leaderRole.id, updated_at: now });
    const leaders = await trx('club_members').where({ club_id: clubId, club_role_id: leaderRole.id, status: 'active' }).count('* as c').first();
    if (Number(leaders.c) !== 1) throw errors.invalidState('Exactly one Leader must remain.');
    await audit(trx, { actorId: actor.id, action: 'leadership.transferred', entityType: 'club', entityId: clubId, meta: { from: current.user_id, to: toUserId, demoteTo } });
    return { clubId, leaderUserId: toUserId };
  });
}
