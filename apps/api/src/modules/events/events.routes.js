import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  PERMISSIONS,
  PLATFORM_ROLES,
  checkinSchema,
  eventCancelSchema,
  eventCreateSchema,
  eventListQuery,
  eventSubmitSchema,
  eventUpdateSchema,
  formSaveSchema,
  hallRequestSchema,
  osiDecisionSchema,
  publishRegistrationSchema,
  registerSchema,
  LIMITS,
  ERROR_CODES,
} from '@ccp/shared';
import { getDb } from '../../db/knex.js';
import { AppError, errors } from '../../lib/errors.js';
import { saveUpload } from '../../lib/storage.js';
import {
  loadMembership,
  requireAuth,
  requireClubPermission,
  requirePlatformRole,
} from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as events from './events.service.js';
import * as forms from '../forms/forms.service.js';
import * as regs from '../registrations/registrations.service.js';
import * as bookings from '../bookings/bookings.service.js';
import { myApplications } from '../recruitment/recruitment.service.js';

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const db = (req) => req.app.locals.db ?? getDb();
const auth = requireAuth();

/** Scope always comes from the event's own club, never from the request body (TC-RBAC-14). */
const eventClub = async (req, knex) => {
  req.eventRow = await events.getEventRow(knex, req.params.id).catch(() => null);
  return req.eventRow?.club_id;
};
const clubFromParams = (req) => req.params.id;
const needs = (permission) => requireClubPermission(permission, eventClub);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.POSTER_MAX_BYTES, files: 1 },
});
const studentOnly = (req, _res, next) =>
  req.user.platform_role === PLATFORM_ROLES.STUDENT
    ? next()
    : next(errors.forbidden('Only students can do this.'));

export const eventsRouter = Router();

// ---------- Browse ----------
eventsRouter.get(
  '/events',
  auth,
  validate({ query: eventListQuery }),
  wrap(async (req, res) => {
    const r = await events.listPublicEvents(db(req), req.user, req.validatedQuery);
    res.json({ data: r.items, meta: r.meta });
  }),
);

eventsRouter.get(
  '/events/:id',
  auth,
  wrap(async (req, res) =>
    res.json({ data: await events.getEventForViewer(db(req), req.user, req.params.id) }),
  ),
);

eventsRouter.get(
  '/clubs/:id/events',
  auth,
  requireClubPermission(null, clubFromParams),
  wrap(async (req, res) => res.json({ data: await events.listClubEvents(db(req), req.clubId, req.user.id) })),
);

// ---------- Draft, edit, poster ----------
eventsRouter.post(
  '/clubs/:id/events',
  auth,
  requireClubPermission(PERMISSIONS.EVENT_DRAFT, clubFromParams),
  validate({ body: eventCreateSchema }),
  wrap(async (req, res) => {
    const row = await events.createDraft(db(req), req.actor, req.clubId, req.body);
    res.status(201).json({ data: (await events.decorate(db(req), [row], req.user.id))[0] });
  }),
);

eventsRouter.patch(
  '/events/:id',
  auth,
  needs(PERMISSIONS.EVENT_DRAFT),
  validate({ body: eventUpdateSchema }),
  wrap(async (req, res) => {
    const row = await events.updateDraft(db(req), req.actor, req.eventRow, req.body);
    res.json({ data: (await events.decorate(db(req), [row], req.user.id))[0] });
  }),
);

eventsRouter.delete(
  '/events/:id',
  auth,
  needs(PERMISSIONS.EVENT_DRAFT),
  wrap(async (req, res) => {
    await events.deleteDraft(db(req), req.actor, req.eventRow);
    res.json({ data: { deleted: true } });
  }),
);

eventsRouter.post(
  '/events/:id/poster',
  auth,
  needs(PERMISSIONS.EVENT_POSTER_UPLOAD),
  (req, res, next) =>
    upload.single('poster')(req, res, (err) => {
      if (err?.code === 'LIMIT_FILE_SIZE')
        return next(new AppError(ERROR_CODES.PAYLOAD_TOO_LARGE, 'The poster is larger than 5 MB.'));
      next(err);
    }),
  wrap(async (req, res) => {
    if (!req.file) throw errors.validation('Attach the poster file in the "poster" field.');
    const url = await saveUpload(req.file.buffer);
    const row = await events.setPoster(db(req), req.eventRow, url);
    res.json({ data: (await events.decorate(db(req), [row], req.user.id))[0] });
  }),
);

// ---------- Submit, cancel, history ----------
eventsRouter.post(
  '/events/:id/submit',
  auth,
  needs(PERMISSIONS.EVENT_SUBMIT),
  validate({ body: eventSubmitSchema }),
  wrap(async (req, res) => {
    await events.submitEvent(db(req), req.actor, req.eventRow, req.body);
    res.json({
      data: (
        await events.decorate(db(req), [await events.getEventRow(db(req), req.params.id)], req.user.id)
      )[0],
    });
  }),
);

eventsRouter.post(
  '/events/:id/cancel',
  auth,
  needs(PERMISSIONS.EVENT_DRAFT),
  validate({ body: eventCancelSchema }),
  wrap(async (req, res) => {
    await events.cancelEvent(db(req), req.actor, req.eventRow, req.body.reason);
    res.json({
      data: (
        await events.decorate(db(req), [await events.getEventRow(db(req), req.params.id)], req.user.id)
      )[0],
    });
  }),
);

eventsRouter.delete(
  '/events/:id/hall-hold',
  auth,
  needs(PERMISSIONS.EVENT_SUBMIT),
  wrap(async (req, res) => {
    await bookings.releaseHold(db(req), req.actor, req.eventRow);
    res.json({ data: { released: true } });
  }),
);

// Club members read their event's history; the OSI reads it while reviewing.
const memberOrOsi = (req, res, next) =>
  req.user.platform_role === PLATFORM_ROLES.OSI_ADMIN
    ? next()
    : requireClubPermission(null, eventClub)(req, res, next);
eventsRouter.get(
  '/events/:id/history',
  auth,
  memberOrOsi,
  wrap(async (req, res) => res.json({ data: await events.eventHistory(db(req), req.params.id) })),
);

eventsRouter.post(
  '/events/:id/hall-request',
  auth,
  needs(PERMISSIONS.HALL_REQUEST),
  validate({ body: hallRequestSchema }),
  wrap(async (req, res) => {
    const bookingId = await bookings.finalRequest(db(req), req.actor, req.eventRow, req.body);
    res.status(201).json({ data: { bookingId } });
  }),
);

// ---------- OSI ----------
eventsRouter.get(
  '/osi/events',
  auth,
  requirePlatformRole(PLATFORM_ROLES.OSI_ADMIN),
  wrap(async (req, res) =>
    res.json({ data: await events.osiQueue(db(req), String(req.query.status ?? 'submitted')) }),
  ),
);
eventsRouter.post(
  '/osi/events/:id/decision',
  auth,
  requirePlatformRole(PLATFORM_ROLES.OSI_ADMIN),
  validate({ body: osiDecisionSchema }),
  wrap(async (req, res) => {
    await events.decideEvent(db(req), req.actor, req.params.id, req.body);
    res.json({
      data: (
        await events.decorate(db(req), [await events.getEventRow(db(req), req.params.id)], req.user.id)
      )[0],
    });
  }),
);

// ---------- Public share page (D9, FR-SHARE-01): no personal data ----------
eventsRouter.get(
  '/public/events/:id',
  wrap(async (req, res) => {
    const e = await events.getEventRow(db(req), req.params.id).catch(() => null);
    if (!e || !events.isPublic(e)) throw errors.notFound('Event not found.');
    const [d] = await events.decorate(db(req), [e], null);
    res.json({
      data: {
        id: d.id,
        title: d.title,
        summary: d.summary,
        posterUrl: d.posterUrl,
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        mode: d.mode,
        clubName: d.clubName,
        status: d.status,
        venue: d.hall?.bookingStatus === 'confirmed' ? d.hall.name : null,
      },
    });
  }),
);

// ---------- Registration form ----------
eventsRouter.get(
  '/events/:id/form',
  auth,
  wrap(async (req, res) => {
    const e = await events.getEventRow(db(req), req.params.id).catch(() => null);
    if (!e || !(await events.canViewEvent(db(req), req.user, e))) throw errors.notFound('Event not found.');
    const m = await loadMembership(db(req), req.user.id, e.club_id);
    res.json({
      data: await forms.getForm(db(req), e, {
        includeDraft: Boolean(m?.permissions.includes(PERMISSIONS.FORM_MANAGE)),
      }),
    });
  }),
);
eventsRouter.put(
  '/events/:id/form',
  auth,
  needs(PERMISSIONS.FORM_MANAGE),
  validate({ body: formSaveSchema }),
  wrap(async (req, res) =>
    res.json({ data: await forms.saveForm(db(req), req.actor, req.eventRow, req.body) }),
  ),
);
eventsRouter.post(
  '/events/:id/form/duplicate',
  auth,
  needs(PERMISSIONS.FORM_MANAGE),
  validate({ body: z.object({ fromEventId: z.string().min(1) }) }),
  wrap(async (req, res) =>
    res.json({ data: await forms.duplicateForm(db(req), req.actor, req.eventRow, req.body.fromEventId) }),
  ),
);
eventsRouter.post(
  '/events/:id/form/publish',
  auth,
  needs(PERMISSIONS.REGISTRATION_PUBLISH),
  validate({ body: publishRegistrationSchema }),
  wrap(async (req, res) =>
    res.json({ data: await forms.publishForm(db(req), req.actor, req.eventRow, req.body) }),
  ),
);
eventsRouter.post(
  '/events/:id/form/close',
  auth,
  needs(PERMISSIONS.REGISTRATION_PUBLISH),
  wrap(async (req, res) => res.json({ data: await forms.closeForm(db(req), req.actor, req.eventRow) })),
);

// ---------- Student registration ----------
eventsRouter.post(
  '/events/:id/register',
  auth,
  studentOnly,
  validate({ body: registerSchema }),
  wrap(async (req, res) =>
    res.status(201).json({ data: await regs.register(db(req), req.user, req.params.id, req.body.answers) }),
  ),
);
eventsRouter.delete(
  '/events/:id/register',
  auth,
  studentOnly,
  wrap(async (req, res) =>
    res.json({ data: await regs.cancelRegistration(db(req), req.user, req.params.id) }),
  ),
);
eventsRouter.get(
  '/me/registrations/:eventId/ticket',
  auth,
  studentOnly,
  wrap(async (req, res) => res.json({ data: await regs.getTicket(db(req), req.user, req.params.eventId) })),
);
eventsRouter.get(
  '/me/activities',
  auth,
  wrap(async (req, res) => {
    const scope = ['current', 'past'].includes(String(req.query.scope)) ? String(req.query.scope) : 'all';
    res.json({
      data: {
        ...(await regs.myActivities(db(req), req.user.id, scope)),
        applications: await myApplications(db(req), req.user.id),
      },
    });
  }),
);

// ---------- Registration list, export, check-in ----------
// Any member sees counts; full answers need registration.view (TC-RBAC-16).
eventsRouter.get(
  '/events/:id/registrations',
  auth,
  requireClubPermission(null, eventClub),
  wrap(async (req, res) =>
    res.json({
      data: await regs.listRegistrations(db(req), req.eventRow, {
        canViewAnswers: req.membership.permissions.includes(PERMISSIONS.REGISTRATION_VIEW),
      }),
    }),
  ),
);
eventsRouter.get(
  '/events/:id/registrations/export',
  auth,
  needs(PERMISSIONS.REGISTRATION_VIEW),
  wrap(async (req, res) => {
    const csv = await regs.exportCsv(db(req), req.eventRow);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="registrations-${req.params.id}.csv"`,
    });
    res.send(csv);
  }),
);
eventsRouter.post(
  '/events/:id/checkin',
  auth,
  needs(PERMISSIONS.CHECKIN_RUN),
  validate({ body: checkinSchema }),
  wrap(async (req, res) =>
    res.json({ data: await regs.checkIn(db(req), req.actor, req.eventRow, req.body.qrToken) }),
  ),
);
