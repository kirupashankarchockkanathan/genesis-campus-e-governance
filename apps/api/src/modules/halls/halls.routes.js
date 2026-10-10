import { Router } from 'express';
import {
  PERMISSIONS,
  PLATFORM_ROLES,
  availabilityQuery,
  blockedSlotSchema,
  hallDecisionSchema,
  hallSchema,
  hallUpdateSchema,
} from '@ccp/shared';
import { getDb } from '../../db/knex.js';
import { errors } from '../../lib/errors.js';
import { requireAuth, requirePlatformRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as halls from './halls.service.js';
import * as bookings from '../bookings/bookings.service.js';

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const db = (req) => req.app.locals.db ?? getDb();
const auth = requireAuth();
const eventsAdmin = requirePlatformRole(PLATFORM_ROLES.EVENTS_ADMIN);

export const hallsRouter = Router();

hallsRouter.get(
  '/halls',
  auth,
  wrap(async (req, res) => res.json({ data: await halls.listHalls(db(req)) })),
);

// Free halls and busy blocks: Events Authority, or a member whose role can draft, submit or request a hall (spec 10.3).
hallsRouter.get(
  '/halls/availability',
  auth,
  validate({ query: availabilityQuery }),
  wrap(async (req, res) => {
    if (req.user.platform_role !== PLATFORM_ROLES.EVENTS_ADMIN) {
      const allowed = await db(req)('club_members as m')
        .join('club_role_permissions as p', 'p.club_role_id', 'm.club_role_id')
        .where({ 'm.user_id': req.user.id, 'm.status': 'active' })
        .whereIn('p.permission', [
          PERMISSIONS.EVENT_DRAFT,
          PERMISSIONS.EVENT_SUBMIT,
          PERMISSIONS.HALL_REQUEST,
        ])
        .first();
      if (!allowed) throw errors.forbidden();
    }
    res.json({ data: await halls.availability(db(req), req.validatedQuery) });
  }),
);

hallsRouter.post(
  '/halls',
  auth,
  eventsAdmin,
  validate({ body: hallSchema }),
  wrap(async (req, res) =>
    res.status(201).json({ data: await halls.createHall(db(req), req.actor, req.body) }),
  ),
);
hallsRouter.patch(
  '/halls/:id',
  auth,
  eventsAdmin,
  validate({ body: hallUpdateSchema }),
  wrap(async (req, res) =>
    res.json({ data: await halls.updateHall(db(req), req.actor, req.params.id, req.body) }),
  ),
);
hallsRouter.get(
  '/halls/:id/blocked-slots',
  auth,
  eventsAdmin,
  wrap(async (req, res) => res.json({ data: await halls.listBlockedSlots(db(req), req.params.id) })),
);
hallsRouter.post(
  '/halls/:id/blocked-slots',
  auth,
  eventsAdmin,
  validate({ body: blockedSlotSchema }),
  wrap(async (req, res) =>
    res.status(201).json({ data: await halls.addBlockedSlot(db(req), req.actor, req.params.id, req.body) }),
  ),
);
hallsRouter.delete(
  '/blocked-slots/:id',
  auth,
  eventsAdmin,
  wrap(async (req, res) => {
    await halls.deleteBlockedSlot(db(req), req.actor, req.params.id);
    res.json({ data: { deleted: true } });
  }),
);

// Queue and holds, and the decision (spec 10.3).
hallsRouter.get(
  '/events-admin/hall-requests',
  auth,
  eventsAdmin,
  wrap(async (req, res) =>
    res.json({
      data: await bookings.listRequests(db(req), {
        status: req.query.status ? String(req.query.status) : undefined,
      }),
    }),
  ),
);
hallsRouter.post(
  '/events-admin/hall-requests/:id/decision',
  auth,
  eventsAdmin,
  validate({ body: hallDecisionSchema }),
  wrap(async (req, res) =>
    res.json({ data: await bookings.decideRequest(db(req), req.actor, req.params.id, req.body) }),
  ),
);
