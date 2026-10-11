import { Router } from 'express';
import { changePasswordSchema, profileUpdateSchema } from '@gcc/shared';
import { getDb } from '../../db/knex.js';
import { toDb } from '../../db/helpers.js';
import { clock } from '../../lib/clock.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { changePassword, userDto } from '../auth/auth.service.js';
import { setRefreshCookie } from '../auth/auth.routes.js';

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const db = (req) => req.app.locals.db ?? getDb();

/** GET /me payload: the signed-in user and their platform role. */
export const buildMe = async (_knex, userRow) => ({
  user: userDto(userRow),
  platformRole: userRow.platform_role,
});

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
