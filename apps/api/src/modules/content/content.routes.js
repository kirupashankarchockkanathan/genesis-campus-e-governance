import { Router } from 'express';
import { z } from 'zod';
import {
  PERMISSIONS,
  PLATFORM_ROLES,
  adminUserCreateSchema,
  adminUserUpdateSchema,
  announcementSchema,
  announcementUpdateSchema,
  clubUpdateSchema,
  isoDate,
  workSchema,
} from '@ccp/shared';
import { getDb } from '../../db/knex.js';
import { errors } from '../../lib/errors.js';
import {
  loadMembership,
  requireAuth,
  requireClubPermission,
  requirePlatformRole,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as ann from '../announcements/announcements.service.js';
import * as content from '../clubs/clubContent.service.js';
import { calendarItems } from '../calendar/calendar.service.js';
import * as admin from '../admin/admin.service.js';

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const db = (req) => req.app.locals.db ?? getDb();
const auth = requireAuth();
const clubIdOf = async (req, knex) =>
  (await knex('clubs').where({ id: req.params.id }).orWhere({ slug: req.params.id }).first())?.id;
const annClub = async (req, knex) => {
  req.announcementRow = await ann.getAnnouncementRow(knex, req.params.id).catch(() => null);
  return req.announcementRow?.club_id;
};

export const contentRouter = Router();

// ---------- Announcements (FR-ANN-01/02) ----------
contentRouter.get(
  '/clubs/:id/announcements',
  auth,
  wrap(async (req, res) => {
    const clubId = await clubIdOf(req, db(req));
    if (!clubId) throw errors.notFound('Club not found.');
    res.json({ data: await ann.listAnnouncements(db(req), clubId) });
  }),
);
contentRouter.post(
  '/clubs/:id/announcements',
  auth,
  requireClubPermission(PERMISSIONS.ANNOUNCEMENT_POST, clubIdOf),
  validate({ body: announcementSchema }),
  wrap(async (req, res) =>
    res.status(201).json({
      data: await ann.postAnnouncement(
        db(req),
        { ...req.actor, fullName: req.user.full_name },
        req.clubId,
        req.body,
      ),
    }),
  ),
);
contentRouter.patch(
  '/announcements/:id',
  auth,
  requireClubPermission(null, annClub),
  validate({ body: announcementUpdateSchema }),
  wrap(async (req, res) =>
    res.json({
      data: await ann.updateAnnouncement(
        db(req),
        { ...req.actor, fullName: req.user.full_name },
        req.membership,
        req.announcementRow,
        req.body,
      ),
    }),
  ),
);
contentRouter.delete(
  '/announcements/:id',
  auth,
  requireClubPermission(null, annClub),
  wrap(async (req, res) => {
    await ann.deleteAnnouncement(db(req), req.actor, req.membership, req.announcementRow);
    res.json({ data: { deleted: true } });
  }),
);

// ---------- Our work and club profile (FR-CLUB-05) ----------
contentRouter.get(
  '/clubs/:id/works',
  auth,
  wrap(async (req, res) => {
    const clubId = await clubIdOf(req, db(req));
    if (!clubId) throw errors.notFound('Club not found.');
    res.json({ data: await content.listWorks(db(req), clubId) });
  }),
);
contentRouter.post(
  '/clubs/:id/works',
  auth,
  requireClubPermission(PERMISSIONS.CLUB_WORKS_MANAGE, clubIdOf),
  validate({ body: workSchema }),
  wrap(async (req, res) =>
    res.status(201).json({ data: await content.addWork(db(req), req.actor, req.clubId, req.body) }),
  ),
);
contentRouter.patch(
  '/clubs/:id/works/:workId',
  auth,
  requireClubPermission(PERMISSIONS.CLUB_WORKS_MANAGE, clubIdOf),
  validate({ body: workSchema.partial() }),
  wrap(async (req, res) =>
    res.json({ data: await content.updateWork(db(req), req.clubId, req.params.workId, req.body) }),
  ),
);
contentRouter.delete(
  '/clubs/:id/works/:workId',
  auth,
  requireClubPermission(PERMISSIONS.CLUB_WORKS_MANAGE, clubIdOf),
  wrap(async (req, res) => {
    await content.deleteWork(db(req), req.clubId, req.params.workId);
    res.json({ data: { deleted: true } });
  }),
);

// club.profile.edit or the OSI (spec 10.3).
contentRouter.patch(
  '/clubs/:id',
  auth,
  validate({ body: clubUpdateSchema }),
  wrap(async (req, res) => {
    const clubId = await clubIdOf(req, db(req));
    if (!clubId) throw errors.notFound('Club not found.');
    if (req.user.platform_role !== PLATFORM_ROLES.OSI_ADMIN) {
      const m = await loadMembership(db(req), req.user.id, clubId);
      if (!m?.permissions.includes(PERMISSIONS.CLUB_PROFILE_EDIT)) throw errors.forbidden();
    }
    res.json({ data: await content.updateClub(db(req), req.actor, clubId, req.body) });
  }),
);

// ---------- Favourites and my clubs ----------
const student = (req, _res, next) =>
  req.user.platform_role === PLATFORM_ROLES.STUDENT
    ? next()
    : next(errors.forbidden('Only students can favourite clubs.'));
contentRouter.post(
  '/clubs/:id/favourite',
  auth,
  student,
  wrap(async (req, res) => {
    const clubId = await clubIdOf(req, db(req));
    if (!clubId) throw errors.notFound('Club not found.');
    res.json({ data: await content.setFavourite(db(req), req.user.id, clubId, true) });
  }),
);
contentRouter.delete(
  '/clubs/:id/favourite',
  auth,
  student,
  wrap(async (req, res) => {
    const clubId = await clubIdOf(req, db(req));
    if (!clubId) throw errors.notFound('Club not found.');
    res.json({ data: await content.setFavourite(db(req), req.user.id, clubId, false) });
  }),
);
contentRouter.get(
  '/me/favourites',
  auth,
  wrap(async (req, res) => res.json({ data: await content.myFavourites(db(req), req.user.id) })),
);
contentRouter.get(
  '/me/favourite-ids',
  auth,
  wrap(async (req, res) => res.json({ data: await content.favouriteIds(db(req), req.user.id) })),
);
contentRouter.get(
  '/me/clubs',
  auth,
  wrap(async (req, res) => res.json({ data: await content.myClubs(db(req), req.user.id) })),
);

// ---------- Calendar ----------
const calendarQuery = z.object({
  from: isoDate,
  to: isoDate,
  filter: z.enum(['all', 'registrations', 'favourites', 'clubs']).optional().default('all'),
});
contentRouter.get(
  '/calendar',
  auth,
  validate({ query: calendarQuery }),
  wrap(async (req, res) => res.json({ data: await calendarItems(db(req), req.user, req.validatedQuery) })),
);

// ---------- Super Admin ----------
const superAdmin = requirePlatformRole(PLATFORM_ROLES.SUPER_ADMIN);
contentRouter.get(
  '/admin/users',
  auth,
  superAdmin,
  wrap(async (req, res) =>
    res.json({
      data: await admin.listUsers(db(req), {
        role: req.query.role ? String(req.query.role) : undefined,
        q: req.query.q ? String(req.query.q) : undefined,
      }),
    }),
  ),
);
contentRouter.post(
  '/admin/users',
  auth,
  superAdmin,
  validate({ body: adminUserCreateSchema }),
  wrap(async (req, res) =>
    res.status(201).json({ data: await admin.createAdmin(db(req), req.actor, req.body) }),
  ),
);
contentRouter.patch(
  '/admin/users/:id',
  auth,
  superAdmin,
  validate({ body: adminUserUpdateSchema }),
  wrap(async (req, res) =>
    res.json({ data: await admin.setUserStatus(db(req), req.actor, req.params.id, req.body.status) }),
  ),
);
contentRouter.get(
  '/admin/audit-logs',
  auth,
  superAdmin,
  wrap(async (req, res) => {
    const q = req.query;
    const r = await admin.listAuditLogs(db(req), {
      entityType: q.entityType ? String(q.entityType) : undefined,
      actorId: q.actorId ? String(q.actorId) : undefined,
      from: q.from ? new Date(String(q.from)).toISOString() : undefined,
      to: q.to ? new Date(String(q.to)).toISOString() : undefined,
      page: Math.max(1, Number(q.page) || 1),
    });
    res.json({ data: r.items, meta: r.meta });
  }),
);
