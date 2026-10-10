import bcrypt from 'bcryptjs';
import { PLATFORM_ROLES, USER_STATUS } from '@ccp/shared';
import { config } from '../../config/index.js';
import { newId } from '../../lib/ids.js';
import { clock } from '../../lib/clock.js';
import { errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { isUniqueViolation, jsonFromDb, toDb } from '../../db/helpers.js';
import { notify } from '../notifications/notifications.service.js';
import { revokeAllSessions, userDto } from '../auth/auth.service.js';

/** Super Admin user list; students are included so accounts can be found, but only admins can be created. */
export async function listUsers(db, { role, q } = {}) {
  const query = db('users').orderBy('created_at', 'desc').limit(200);
  if (role) query.where({ platform_role: role });
  if (q)
    query.where((b) =>
      b
        .whereRaw('lower(email) like ?', [`%${q.toLowerCase()}%`])
        .orWhereRaw('lower(full_name) like ?', [`%${q.toLowerCase()}%`]),
    );
  return (await query).map((u) => ({ ...userDto(u), lastLoginAt: u.last_login_at, createdAt: u.created_at }));
}

/** FR-AUTH-08: admin accounts are created only by a Super Admin and must change the password at first login. */
export async function createAdmin(db, actor, input) {
  const email = input.email.toLowerCase();
  const username = input.username.toLowerCase();
  const now = toDb(clock.now());
  const id = newId();
  try {
    await db.transaction(async (trx) => {
      await trx('users').insert({
        id,
        username,
        email,
        password_hash: await bcrypt.hash(input.temporaryPassword, config.BCRYPT_COST),
        full_name: input.fullName,
        platform_role: input.role,
        email_verified_at: now,
        must_change_password: 1,
        status: USER_STATUS.ACTIVE,
        created_at: now,
        updated_at: now,
      });
      await audit(trx, {
        actorId: actor.id,
        action: 'admin.created',
        entityType: 'user',
        entityId: id,
        meta: { role: input.role },
      });
      await notify(trx, {
        userIds: [id],
        type: 'admin.account_created',
        title: 'Your admin account is ready',
        body: 'Change your temporary password at first login.',
        route: '/settings',
      });
    });
  } catch (err) {
    if (isUniqueViolation(err))
      throw errors.conflict('An account with that email or username already exists.');
    throw err;
  }
  return userDto(await db('users').where({ id }).first());
}

/** Suspending ends every session at once (TC-AUTH-17). A Super Admin cannot suspend themselves. */
export async function setUserStatus(db, actor, userId, status) {
  const u = await db('users').where({ id: userId }).first();
  if (!u) throw errors.notFound('User not found.');
  if (u.id === actor.id) throw errors.forbidden('You cannot change your own status.');
  if (u.platform_role === PLATFORM_ROLES.STUDENT)
    throw errors.forbidden('Student accounts are not managed here.');
  await db('users')
    .where({ id: userId })
    .update({ status, updated_at: toDb(clock.now()) });
  if (status === USER_STATUS.SUSPENDED) await revokeAllSessions(db, userId);
  await audit(db, {
    actorId: actor.id,
    action: status === USER_STATUS.SUSPENDED ? 'admin.suspended' : 'admin.reactivated',
    entityType: 'user',
    entityId: userId,
  });
  return userDto(await db('users').where({ id: userId }).first());
}

export async function listAuditLogs(db, { entityType, actorId, from, to, page = 1, pageSize = 50 } = {}) {
  const q = db('audit_logs as a')
    .leftJoin('users as u', 'u.id', 'a.actor_id')
    .select('a.*', 'u.full_name as actor_name');
  if (entityType) q.where('a.entity_type', entityType);
  if (actorId) q.where('a.actor_id', actorId);
  if (from) q.where('a.created_at', '>=', from);
  if (to) q.where('a.created_at', '<=', to);
  const total = Number((await q.clone().clearSelect().count('* as c').first()).c);
  const rows = await q
    .orderBy('a.created_at', 'desc')
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return {
    items: rows.map((r) => ({
      id: r.id,
      at: r.created_at,
      action: r.action,
      actorId: r.actor_id,
      actorName: r.actor_name,
      entityType: r.entity_type,
      entityId: r.entity_id,
      meta: jsonFromDb(r.meta_json, null),
    })),
    meta: { page, pageSize, total },
  };
}
