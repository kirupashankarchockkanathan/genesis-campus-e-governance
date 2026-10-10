import { Router } from 'express';
import { z } from 'zod';
import { CLUB_CATEGORIES, CLUB_ROLE_KEYS, PERMISSIONS, PLATFORM_ROLES, emailSchema } from '@ccp/shared';
import { getDb } from '../../db/knex.js';
import { requireAuth, requireClubPermission, requirePlatformRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createClub, getClub, listClubs, listRoles } from './clubs.service.js';
import {
  addMember,
  changeRole,
  listMembers,
  removeMember,
  transferLeadership,
} from '../members/members.service.js';
import { errors } from '../../lib/errors.js';

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const db = (req) => req.app.locals.db ?? getDb();

const createClubSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(CLUB_CATEGORIES),
  description: z.string().trim().max(5000).optional(),
  tagline: z.string().trim().max(200).optional(),
  facultyCoordinator: z.string().trim().max(120).optional(),
  leaderEmail: emailSchema,
});
const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
});
const addMemberSchema = z.object({ email: emailSchema, roleKey: z.enum(CLUB_ROLE_KEYS).optional() });
const roleSchema = z.object({ roleKey: z.enum(CLUB_ROLE_KEYS) });
const transferSchema = z.object({ toUserId: z.string().min(1), demoteTo: z.enum(CLUB_ROLE_KEYS).optional() });

/** Resolves a club id from a path segment that may be an id or a slug. */
const clubIdFromParams = async (req, knex) =>
  (await knex('clubs').where({ id: req.params.id }).orWhere({ slug: req.params.id }).first())?.id;

export const clubsRouter = Router();
clubsRouter.use(requireAuth());

clubsRouter.get(
  '/',
  validate({ query: listQuery }),
  wrap(async (req, res) => res.json({ data: await listClubs(db(req), req.validatedQuery) })),
);
clubsRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const club = await getClub(db(req), req.params.id);
    const fav = await db(req)('favorite_clubs').where({ user_id: req.user.id, club_id: club.id }).first();
    res.json({ data: { ...club, isFavourite: Boolean(fav) } });
  }),
);

clubsRouter.post(
  '/',
  requirePlatformRole(PLATFORM_ROLES.OSI_ADMIN),
  validate({ body: createClubSchema }),
  wrap(async (req, res) => res.status(201).json({ data: await createClub(db(req), req.actor, req.body) })),
);

// Roles: any active member of the club.
clubsRouter.get(
  '/:id/roles',
  requireClubPermission(null, clubIdFromParams),
  wrap(async (req, res) => res.json({ data: await listRoles(db(req), req.clubId) })),
);
clubsRouter.get(
  '/:id/members',
  requireClubPermission(null, clubIdFromParams),
  wrap(async (req, res) => res.json({ data: await listMembers(db(req), req.clubId) })),
);

clubsRouter.post(
  '/:id/members',
  requireClubPermission(PERMISSIONS.MEMBER_MANAGE, clubIdFromParams),
  validate({ body: addMemberSchema }),
  wrap(async (req, res) =>
    res.status(201).json({ data: await addMember(db(req), req.actor, req.clubId, req.body) }),
  ),
);
clubsRouter.patch(
  '/:id/members/:userId',
  requireClubPermission(PERMISSIONS.MEMBER_MANAGE, clubIdFromParams),
  validate({ body: roleSchema }),
  wrap(async (req, res) =>
    res.json({ data: await changeRole(db(req), req.actor, req.clubId, req.params.userId, req.body.roleKey) }),
  ),
);
// Remove another member (needs member.manage) or leave the club yourself.
clubsRouter.delete(
  '/:id/members/:userId',
  requireClubPermission(null, clubIdFromParams),
  wrap(async (req, res) => {
    const self = req.params.userId === req.user.id;
    if (!self && !req.membership.permissions.includes(PERMISSIONS.MEMBER_MANAGE)) throw errors.forbidden();
    await removeMember(db(req), req.actor, req.clubId, req.params.userId);
    res.json({ data: { removed: true } });
  }),
);
clubsRouter.post(
  '/:id/leadership-transfer',
  requireClubPermission(PERMISSIONS.LEADERSHIP_TRANSFER, clubIdFromParams),
  validate({ body: transferSchema }),
  wrap(async (req, res) =>
    res.json({
      data: await transferLeadership(db(req), req.actor, req.clubId, req.body.toUserId, req.body.demoteTo),
    }),
  ),
);
