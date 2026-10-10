import { Router } from 'express';
import { changePasswordSchema, profileUpdateSchema } from '@ccp/shared';
import { getDb } from '../../db/knex.js';
import { toDb } from '../../db/helpers.js';
import { clock } from '../../lib/clock.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { changePassword, userDto } from '../auth/auth.service.js';
import { setRefreshCookie } from '../auth/auth.routes.js';

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const db = (req) => req.app.locals.db ?? getDb();

/** GET /me payload: user, platform role and, per club, the club role and permission keys (spec 3.5 rule 6). */
export async function buildMe(knex, userRow) {
  const rows = await knex('club_members as m')
    .join('clubs as c', 'c.id', 'm.club_id')
    .join('club_roles as r', 'r.id', 'm.club_role_id')
    .where({ 'm.user_id': userRow.id, 'm.status': 'active' })
    .select(
      'c.id as club_id',
      'c.slug',
      'c.name',
      'r.id as role_id',
      'r.key as role_key',
      'r.name as role_name',
    )
    .orderBy('c.name');
  const perms = rows.length
    ? await knex('club_role_permissions').whereIn(
        'club_role_id',
        rows.map((r) => r.role_id),
      )
    : [];
  return {
    user: userDto(userRow),
    platformRole: userRow.platform_role,
    memberships: rows.map((r) => ({
      club: { id: r.club_id, slug: r.slug, name: r.name },
      roleKey: r.role_key,
      roleName: r.role_name,
      permissions: perms
        .filter((p) => p.club_role_id === r.role_id)
        .map((p) => p.permission)
        .sort(),
    })),
  };
}

export const usersRouter = Router();

usersRouter.get(
  '/me',
  requireAuth(),
  wrap(async (req, res) => res.json({ data: await buildMe(db(req), req.user) })),
);

usersRouter.patch(
  '/me/profile',
  requireAuth(),
  validate({ body: profileUpdateSchema }),
  wrap(async (req, res) => {
    const b = req.body;
    const patch = {};
    if (b.fullName !== undefined) patch.full_name = b.fullName;
    if (b.rollNumber !== undefined) patch.roll_number = b.rollNumber;
    if (b.department !== undefined) patch.department = b.department;
    if (b.yearOfStudy !== undefined) patch.year_of_study = b.yearOfStudy;
    if (b.phone !== undefined) patch.phone = b.phone;
    if (Object.keys(patch).length) {
      await db(req)('users')
        .where({ id: req.user.id })
        .update({ ...patch, updated_at: toDb(clock.now()) });
    }
    // Username and email are never editable (FR-PROF-01).
    const fresh = await db(req)('users').where({ id: req.user.id }).first();
    res.json({ data: await buildMe(db(req), fresh) });
  }),
);

// Reachable while must_change_password is set (spec 11.3).
usersRouter.post(
  '/me/change-password',
  requireAuth({ allowMustChange: true }),
  validate({ body: changePasswordSchema }),
  wrap(async (req, res) => {
    const result = await changePassword(db(req), req.user, req.body, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    setRefreshCookie(res, result.refresh);
    res.json({ data: { accessToken: result.accessToken, user: result.user } });
  }),
);
