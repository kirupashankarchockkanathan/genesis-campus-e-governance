import { Router } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import {
  ERROR_CODES,
  LIMITS,
  PERMISSIONS,
  PLATFORM_ROLES,
  applicationDecisionSchema,
  applySchema,
  customRoleSchema,
  customRoleUpdateSchema,
  discussionMessageSchema,
  recruitmentSchema,
  recruitmentUpdateSchema,
  reportMessageSchema,
} from '@ccp/shared';
import { config } from '../../config/index.js';
import { getDb } from '../../db/knex.js';
import { toDb } from '../../db/helpers.js';
import { clock } from '../../lib/clock.js';
import { AppError, errors } from '../../lib/errors.js';
import { buildIcs } from '../../lib/ics.js';
import { saveUpload } from '../../lib/storage.js';
import {
  loadMembership,
  requireAuth,
  requireClubPermission,
  requirePlatformRole,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as rec from '../recruitment/recruitment.service.js';
import * as disc from '../discussions/discussions.service.js';
import * as roles from '../clubs/roles.service.js';
import { clubReport } from '../clubs/reports.service.js';
import { favouriteIds } from '../clubs/clubContent.service.js';

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const db = (req) => req.app.locals.db ?? getDb();
const auth = requireAuth();
const clubIdOf = async (req, knex) =>
  (await knex('clubs').where({ id: req.params.id }).orWhere({ slug: req.params.id }).first())?.id;
const recClub = async (req, knex) => {
  req.recruitmentRow = await rec.getRow(knex, req.params.id).catch(() => null);
  return req.recruitmentRow?.club_id;
};
const student = (req, _res, next) =>
  req.user.platform_role === PLATFORM_ROLES.STUDENT
    ? next()
    : next(errors.forbidden('Only students can do this.'));

export const engagementRouter = Router();

// ---------- Recruitment (FR-REC-01..06) ----------
engagementRouter.get(
  '/clubs/:id/recruitments',
  auth,
  wrap(async (req, res) => {
    const clubId = await clubIdOf(req, db(req));
    if (!clubId) throw errors.notFound('Club not found.');
    const isMember = Boolean(await loadMembership(db(req), req.user.id, clubId));
    res.json({ data: await rec.listForClub(db(req), clubId, { isMember, viewerId: req.user.id }) });
  }),
);
engagementRouter.post(
  '/clubs/:id/recruitments',
  auth,
  requireClubPermission(PERMISSIONS.RECRUITMENT_MANAGE, clubIdOf),
  validate({ body: recruitmentSchema }),
  wrap(async (req, res) => {
    const id = await rec.createRecruitment(db(req), req.actor, req.clubId, req.body);
    res.status(201).json({ data: await rec.get(db(req), id, req.user.id) });
  }),
);
engagementRouter.get(
  '/recruitments/:id',
  auth,
  wrap(async (req, res) => {
    const row = await rec.getRow(db(req), req.params.id).catch(() => null);
    if (!row) throw errors.notFound('Recruitment not found.');
    const isMember = Boolean(await loadMembership(db(req), req.user.id, row.club_id));
    const data = await rec.get(db(req), row.id, req.user.id);
    if (!isMember && !data.acceptingApplications && !data.myApplication)
      throw errors.notFound('Recruitment not found.');
    res.json({ data });
  }),
);
engagementRouter.patch(
  '/recruitments/:id',
  auth,
  requireClubPermission(PERMISSIONS.RECRUITMENT_MANAGE, recClub),
  validate({ body: recruitmentUpdateSchema }),
  wrap(async (req, res) =>
    res.json({ data: await rec.updateRecruitment(db(req), req.actor, req.recruitmentRow, req.body) }),
  ),
);
engagementRouter.post(
  '/recruitments/:id/open',
  auth,
  requireClubPermission(PERMISSIONS.RECRUITMENT_MANAGE, recClub),
  wrap(async (req, res) =>
    res.json({ data: await rec.openRecruitment(db(req), req.actor, req.recruitmentRow) }),
  ),
);
engagementRouter.post(
  '/recruitments/:id/close',
  auth,
  requireClubPermission(PERMISSIONS.RECRUITMENT_MANAGE, recClub),
  wrap(async (req, res) =>
    res.json({ data: await rec.closeRecruitment(db(req), req.actor, req.recruitmentRow) }),
  ),
);
engagementRouter.post(
  '/recruitments/:id/apply',
  auth,
  student,
  validate({ body: applySchema }),
  wrap(async (req, res) =>
    res.status(201).json({ data: await rec.apply(db(req), req.user, req.params.id, req.body) }),
  ),
);
engagementRouter.delete(
  '/recruitments/:id/apply',
  auth,
  student,
  wrap(async (req, res) => res.json({ data: await rec.withdraw(db(req), req.user, req.params.id) })),
);
engagementRouter.get(
  '/recruitments/:id/applications',
  auth,
  requireClubPermission(PERMISSIONS.APPLICATION_REVIEW, recClub),
  wrap(async (req, res) => res.json({ data: await rec.listApplications(db(req), req.params.id) })),
);
engagementRouter.patch(
  '/applications/:id',
  auth,
  requireClubPermission(PERMISSIONS.APPLICATION_REVIEW, (req, knex) =>
    rec.getApplicationClub(knex, req.params.id),
  ),
  validate({ body: applicationDecisionSchema }),
  wrap(async (req, res) => res.json({ data: await rec.decide(db(req), req.actor, req.params.id, req.body) })),
);
engagementRouter.get(
  '/me/applications',
  auth,
  wrap(async (req, res) => res.json({ data: await rec.myApplications(db(req), req.user.id) })),
);

// ---------- Discussions (FR-DISC-01/02) ----------
const scopeOf = (req) => {
  if (!['internal', 'public'].includes(req.params.scope)) throw errors.notFound('Discussion not found.');
  return req.params.scope;
};
engagementRouter.get(
  '/clubs/:id/discussions/:scope/messages',
  auth,
  wrap(async (req, res) => {
    const scope = scopeOf(req);
    const clubId = await clubIdOf(req, db(req));
    if (!clubId) throw errors.notFound('Club not found.');
    // Internal discussion is for active members only (TC-DISC-01).
    if (scope === 'internal' && !(await loadMembership(db(req), req.user.id, clubId)))
      throw errors.forbidden();
    res.json({ data: await disc.listMessages(db(req), clubId, scope) });
  }),
);
engagementRouter.post(
  '/clubs/:id/discussions/:scope/messages',
  auth,
  validate({ body: discussionMessageSchema }),
  wrap(async (req, res) => {
    const scope = scopeOf(req);
    const club = await db(req)('clubs').where({ id: req.params.id }).orWhere({ slug: req.params.id }).first();
    if (!club) throw errors.notFound('Club not found.');
    res.status(201).json({ data: await disc.postMessage(db(req), req.user, club, scope, req.body.body) });
  }),
);
engagementRouter.delete(
  '/discussion-messages/:id',
  auth,
  wrap(async (req, res) => {
    const msg = await disc.getMessageContext(db(req), req.params.id);
    if (!msg) throw errors.notFound('Message not found.');
    await disc.deleteMessage(db(req), req.user, msg);
    res.json({ data: { deleted: true } });
  }),
);
engagementRouter.post(
  '/discussion-messages/:id/report',
  auth,
  validate({ body: reportMessageSchema }),
  wrap(async (req, res) => {
    const msg = await disc.getMessageContext(db(req), req.params.id);
    if (!msg) throw errors.notFound('Message not found.');
    await disc.reportMessage(db(req), req.user, msg, req.body.reason);
    res.status(201).json({ data: { reported: true } });
  }),
);
engagementRouter.get(
  '/clubs/:id/discussions/reported',
  auth,
  requireClubPermission(PERMISSIONS.DISCUSSION_MODERATE, clubIdOf),
  wrap(async (req, res) => res.json({ data: await disc.reportedMessages(db(req), { clubId: req.clubId }) })),
);
engagementRouter.get(
  '/osi/reports',
  auth,
  requirePlatformRole(PLATFORM_ROLES.OSI_ADMIN),
  wrap(async (req, res) => res.json({ data: await disc.reportedMessages(db(req)) })),
);

// ---------- Custom roles (role.manage, Leader only) and reports ----------
engagementRouter.post(
  '/clubs/:id/roles',
  auth,
  requireClubPermission(PERMISSIONS.ROLE_MANAGE, clubIdOf),
  validate({ body: customRoleSchema }),
  wrap(async (req, res) =>
    res.status(201).json({ data: await roles.createCustomRole(db(req), req.actor, req.clubId, req.body) }),
  ),
);
engagementRouter.patch(
  '/clubs/:id/roles/:roleId',
  auth,
  requireClubPermission(PERMISSIONS.ROLE_MANAGE, clubIdOf),
  validate({ body: customRoleUpdateSchema }),
  wrap(async (req, res) =>
    res.json({
      data: await roles.updateCustomRole(db(req), req.actor, req.clubId, req.params.roleId, req.body),
    }),
  ),
);
engagementRouter.delete(
  '/clubs/:id/roles/:roleId',
  auth,
  requireClubPermission(PERMISSIONS.ROLE_MANAGE, clubIdOf),
  wrap(async (req, res) => {
    await roles.deleteCustomRole(db(req), req.actor, req.clubId, req.params.roleId);
    res.json({ data: { deleted: true } });
  }),
);
engagementRouter.get(
  '/clubs/:id/reports',
  auth,
  requireClubPermission(PERMISSIONS.REPORT_VIEW, clubIdOf),
  wrap(async (req, res) => res.json({ data: await clubReport(db(req), req.clubId) })),
);

// ---------- File-upload form field (Phase 2) ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.POSTER_MAX_BYTES, files: 1 },
});
engagementRouter.post(
  '/uploads/form-file',
  auth,
  student,
  (req, res, next) =>
    upload.single('file')(req, res, (err) => {
      if (err?.code === 'LIMIT_FILE_SIZE')
        return next(new AppError(ERROR_CODES.PAYLOAD_TOO_LARGE, 'The file is larger than 5 MB.'));
      next(err);
    }),
  wrap(async (req, res) => {
    if (!req.file) throw errors.validation('Attach the file in the "file" field.');
    res.status(201).json({ data: { url: await saveUpload(req.file.buffer) } });
  }),
);

// ---------- Personal ICS feed (FR-CAL-07) ----------
// Calendar apps cannot send an Authorization header, so the feed URL carries a long-lived signed token.
engagementRouter.get(
  '/me/calendar-feed',
  auth,
  wrap(async (req, res) => {
    const token = jwt.sign({ sub: req.user.id, purpose: 'ics' }, config.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '365d',
    });
    res.json({ data: { url: `${config.API_URL}/api/v1/calendar.ics?token=${token}` } });
  }),
);
engagementRouter.get(
  '/calendar.ics',
  wrap(async (req, res) => {
    let payload;
    try {
      payload = jwt.verify(String(req.query.token ?? ''), config.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      throw errors.unauthenticated('The calendar link is invalid or has expired.');
    }
    if (payload.purpose !== 'ics')
      throw errors.unauthenticated('The calendar link is invalid or has expired.');
    const d = db(req);
    const user = await d('users').where({ id: payload.sub, status: 'active' }).first();
    if (!user) throw errors.unauthenticated('The calendar link is invalid or has expired.');
    const now = clock.now();
    const from = toDb(new Date(now.getTime() - 30 * 86400000));
    const to = toDb(new Date(now.getTime() + 180 * 86400000));
    const fav = await favouriteIds(d, user.id);
    const member = await d('club_members').where({ user_id: user.id, status: 'active' }).pluck('club_id');
    const registered = await d('registrations')
      .where({ user_id: user.id })
      .whereIn('status', ['registered', 'attended', 'waitlisted'])
      .pluck('event_id');
    const rows = await d('events as e')
      .join('clubs as c', 'c.id', 'e.club_id')
      .leftJoin('halls as h', 'h.id', 'e.hall_id')
      .whereIn('e.status', ['approved', 'completed'])
      .whereNotNull('e.circulated_at')
      .where('e.ends_at', '>=', from)
      .where('e.starts_at', '<=', to)
      .where((q) => q.whereIn('e.id', registered).orWhereIn('e.club_id', [...fav, ...member]))
      .select('e.*', 'c.name as club_name', 'h.name as hall_name', 'h.building');
    const ics = buildIcs(
      rows.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        description: `${e.club_name}: ${e.summary ?? ''}`,
        location: e.hall_name
          ? `${e.hall_name}${e.building ? `, ${e.building}` : ''}`
          : (e.online_link ?? ''),
        url: `${config.WEB_URL}/events/${e.id}`,
      })),
      { now },
    );
    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="campus-clubs.ics"',
    });
    res.send(ics);
  }),
);
