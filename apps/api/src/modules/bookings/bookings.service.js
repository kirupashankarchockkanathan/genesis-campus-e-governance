import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUS,
  ERROR_CODES,
  PERMISSIONS,
  PLATFORM_ROLES,
} from '@ccp/shared';
import { config } from '../../config/index.js';
import { newId } from '../../lib/ids.js';
import { clock } from '../../lib/clock.js';
import { AppError, errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { toDb } from '../../db/helpers.js';
import {
  activeBookingsOverlapping,
  availability,
  blockedSlotsOverlapping,
  hallDto,
} from '../halls/halls.service.js';
import {
  adminIds,
  membersWithPermission,
  notify,
  registeredStudentIds,
  activeMemberIds,
} from '../notifications/notifications.service.js';

const days = (n) => n * 24 * 3600 * 1000;

const fmt = (iso, opts) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: config.APP_TIMEZONE, ...opts }).format(new Date(iso));
export const fmtTime = (iso) => fmt(iso, { hour: '2-digit', minute: '2-digit', hour12: false });
export const fmtDateTime = (iso) =>
  fmt(iso, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

export const bookingDto = (b) => ({
  id: b.id,
  hallId: b.hall_id,
  hallName: b.hall_name,
  eventId: b.event_id,
  clubId: b.club_id,
  status: b.status,
  startsAt: b.starts_at,
  endsAt: b.ends_at,
  expectedCount: b.expected_count,
  registeredCount: b.registered_count,
  requestedAt: b.requested_at,
  decidedAt: b.decided_at,
  decisionNote: b.decision_note,
  expiresAt: b.expires_at,
});

export const activeBookingFor = (db, eventId) =>
  db('hall_bookings').where({ event_id: eventId }).whereIn('status', ACTIVE_BOOKING_STATUSES).first();

/** Releases every active booking of an event (reject, cancel, hall change). */
export const releaseActiveBookings = (db, eventId, status = BOOKING_STATUS.RELEASED) =>
  db('hall_bookings')
    .where({ event_id: eventId })
    .whereIn('status', ACTIVE_BOOKING_STATUSES)
    .update({ status, updated_at: toDb(clock.now()) });

/**
 * Throws HALL_UNAVAILABLE (with free alternatives) unless the hall is active, big enough and free
 * for the whole window (spec 5.3 rules 1 and 6). Must run inside the booking transaction.
 */
export async function assertHallUsable(db, hallId, { from, to, minCapacity, excludeEventId }) {
  const hall = await db('halls').where({ id: hallId }).forUpdate().first();
  if (!hall) throw errors.notFound('Hall not found.');
  const alternatives = async () =>
    (await availability(db, { from, to, minCapacity }, { excludeEventId }))
      .filter((h) => h.free && h.id !== hallId)
      .map((h) => ({ hallId: h.id, name: h.name, capacity: h.capacity }));
  const fail = async (message) => {
    throw new AppError(ERROR_CODES.HALL_UNAVAILABLE, message, { alternatives: await alternatives() });
  };

  if (!hall.is_active) await fail(`${hall.name} is not available for booking.`);
  if (Number(hall.capacity) < minCapacity) {
    await fail(`${hall.name} seats ${hall.capacity}, which is fewer than the ${minCapacity} needed.`);
  }
  const clash = (await activeBookingsOverlapping(db, hallId, from, to, excludeEventId))[0];
  if (clash)
    await fail(
      `${hall.name} is booked from ${fmtTime(clash.starts_at)} to ${fmtTime(clash.ends_at)} on that day.`,
    );
  const blocked = (await blockedSlotsOverlapping(db, hallId, from, to))[0];
  if (blocked)
    await fail(
      `${hall.name} is blocked from ${fmtTime(blocked.starts_at)} to ${fmtTime(blocked.ends_at)} on that day.`,
    );
  return hall;
}

/** Maps a PostgreSQL exclusion-constraint violation (23P01) to the same domain error. */
export const mapBookingError = (err) => {
  if (err?.code === '23P01') {
    return new AppError(ERROR_CODES.HALL_UNAVAILABLE, 'That hall was just booked by someone else.', {
      alternatives: [],
    });
  }
  return err;
};

async function insertBooking(db, row) {
  const now = toDb(clock.now());
  const id = newId();
  try {
    await db('hall_bookings').insert({ id, created_at: now, updated_at: now, ...row });
  } catch (err) {
    throw mapBookingError(err);
  }
  return id;
}

/** Tentative hold placed in the same transaction as the submission (FR-HALL-04). */
export async function placeHold(trx, { event, hallId }) {
  const hall = await assertHallUsable(trx, hallId, {
    from: event.starts_at,
    to: event.ends_at,
    minCapacity: Number(event.expected_participants),
    excludeEventId: event.id,
  });
  const held = await trx('hall_bookings')
    .where({ club_id: event.club_id, status: BOOKING_STATUS.TENTATIVE })
    .whereNot({ event_id: event.id })
    .count('* as c')
    .first();
  if (Number(held.c) >= config.MAX_ACTIVE_HOLDS_PER_CLUB) {
    throw errors.conflict(
      `Your club already has ${config.MAX_ACTIVE_HOLDS_PER_CLUB} active hall holds. Release one or wait for a decision.`,
    );
  }
  const now = clock.now();
  const id = await insertBooking(trx, {
    hall_id: hallId,
    event_id: event.id,
    club_id: event.club_id,
    status: BOOKING_STATUS.TENTATIVE,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    expected_count: event.expected_participants,
    expires_at: toDb(new Date(now.getTime() + days(config.HOLD_EXPIRY_DAYS))),
  });
  return { id, hall };
}

// ---------- Final hall request (FR-HALL-05, TC-HALL-02..04) ----------

export async function finalRequest(db, actor, event, { hallId }) {
  return db.transaction(async (trx) => {
    const form = await trx('forms').where({ event_id: event.id }).first();
    if (event.status !== 'approved')
      throw errors.invalidState('Only an approved event can request a final hall.');
    if (!form || form.status !== 'closed') {
      throw errors.invalidState('The final hall request can be sent after registration has closed.');
    }
    const current = await activeBookingFor(trx, event.id);
    if (current && current.status !== BOOKING_STATUS.TENTATIVE) {
      throw errors.invalidState(`The hall booking is already ${current.status}.`);
    }
    const count = Number(
      (
        await trx('registrations')
          .where({ event_id: event.id })
          .whereIn('status', ['registered', 'attended'])
          .count('* as c')
          .first()
      ).c,
    );
    // After a denial there is no active booking; fall back to the hall that was last requested.
    const last =
      current ??
      (await trx('hall_bookings').where({ event_id: event.id }).orderBy('created_at', 'desc').first());
    const targetHall = hallId ?? last?.hall_id;
    if (!targetHall) throw errors.validation('Choose a hall for the final request.');
    const now = toDb(clock.now());

    let bookingId;
    if (current && current.hall_id === targetHall) {
      if (Number((await trx('halls').where({ id: targetHall }).first()).capacity) < count) {
        throw new AppError(
          ERROR_CODES.HALL_UNAVAILABLE,
          'That hall is smaller than the number of registrations.',
          {
            alternatives: (
              await availability(
                trx,
                { from: event.starts_at, to: event.ends_at, minCapacity: count },
                { excludeEventId: event.id },
              )
            )
              .filter((h) => h.free)
              .map((h) => ({ hallId: h.id, name: h.name, capacity: h.capacity })),
          },
        );
      }
      await trx('hall_bookings').where({ id: current.id }).update({
        status: BOOKING_STATUS.REQUESTED,
        registered_count: count,
        requested_by: actor.id,
        requested_at: now,
        expires_at: null,
        updated_at: now,
      });
      bookingId = current.id;
    } else {
      // Changing the hall: release the old booking and create the new one in one transaction,
      // repeating the overlap check (spec 5.3 rule 5).
      if (current)
        await trx('hall_bookings')
          .where({ id: current.id })
          .update({ status: BOOKING_STATUS.RELEASED, updated_at: now });
      await assertHallUsable(trx, targetHall, {
        from: event.starts_at,
        to: event.ends_at,
        minCapacity: Math.max(count, 1),
        excludeEventId: event.id,
      });
      bookingId = await insertBooking(trx, {
        hall_id: targetHall,
        event_id: event.id,
        club_id: event.club_id,
        status: BOOKING_STATUS.REQUESTED,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        expected_count: event.expected_participants,
        registered_count: count,
        requested_by: actor.id,
        requested_at: now,
      });
    }
    await audit(trx, {
      actorId: actor.id,
      action: 'hall.requested',
      entityType: 'event',
      entityId: event.id,
      meta: { hallId: targetHall, count },
    });
    await notify(trx, {
      userIds: await adminIds(trx, PLATFORM_ROLES.EVENTS_ADMIN),
      type: 'hall.requested',
      title: 'Final hall request',
      body: `"${event.title}" needs a hall decision (${count} registered).`,
      route: `/events-admin/requests/${bookingId}`,
    });
    return bookingId;
  });
}

// ---------- Events Authority decision (FR-HALL-06/07, TC-HALL-05..07) ----------

export async function decideRequest(db, actor, bookingId, { decision, hallId, note }) {
  return db.transaction(async (trx) => {
    const booking = await trx('hall_bookings').where({ id: bookingId }).first();
    if (!booking) throw errors.notFound('Hall request not found.');
    if (booking.status !== BOOKING_STATUS.REQUESTED)
      throw errors.invalidState('This request has already been decided.');
    const event = await trx('events').where({ id: booking.event_id }).first();
    const now = toDb(clock.now());

    if (decision === 'deny') {
      if (!note?.trim())
        throw errors.validation('Please give a reason for denying the request.', [
          { path: 'note', message: 'A note is required' },
        ]);
      await trx('hall_bookings').where({ id: bookingId }).update({
        status: BOOKING_STATUS.DENIED,
        decided_by: actor.id,
        decided_at: now,
        decision_note: note.trim(),
        updated_at: now,
      });
      await audit(trx, {
        actorId: actor.id,
        action: 'hall.denied',
        entityType: 'event',
        entityId: event.id,
        meta: { note },
      });
      await notify(trx, {
        userIds: await membersWithPermission(trx, event.club_id, PERMISSIONS.HALL_REQUEST),
        type: 'hall.decision',
        title: 'Hall request denied',
        body: `"${event.title}": ${note.trim()}`,
        route: `/club/${event.club_id}/events/${event.id}`,
      });
      return { bookingId, status: BOOKING_STATUS.DENIED };
    }

    let finalId = bookingId;
    if (hallId && hallId !== booking.hall_id) {
      await trx('hall_bookings')
        .where({ id: bookingId })
        .update({ status: BOOKING_STATUS.RELEASED, updated_at: now });
      await assertHallUsable(trx, hallId, {
        from: booking.starts_at,
        to: booking.ends_at,
        minCapacity: Math.max(Number(booking.registered_count ?? 0), 1),
        excludeEventId: event.id,
      });
      finalId = await insertBooking(trx, {
        hall_id: hallId,
        event_id: event.id,
        club_id: event.club_id,
        status: BOOKING_STATUS.CONFIRMED,
        starts_at: booking.starts_at,
        ends_at: booking.ends_at,
        expected_count: booking.expected_count,
        registered_count: booking.registered_count,
        requested_by: booking.requested_by,
        requested_at: booking.requested_at,
        decided_by: actor.id,
        decided_at: now,
        decision_note: note?.trim() || null,
      });
    } else {
      await trx('hall_bookings')
        .where({ id: bookingId })
        .update({
          status: BOOKING_STATUS.CONFIRMED,
          decided_by: actor.id,
          decided_at: now,
          decision_note: note?.trim() || null,
          updated_at: now,
        });
    }
    const confirmedHall = await trx('hall_bookings').where({ id: finalId }).first();
    await trx('events').where({ id: event.id }).update({ hall_id: confirmedHall.hall_id, updated_at: now });
    const hall = await trx('halls').where({ id: confirmedHall.hall_id }).first();
    await audit(trx, {
      actorId: actor.id,
      action: 'hall.approved',
      entityType: 'event',
      entityId: event.id,
      meta: { hallId: hall.id },
    });

    const venue = `${hall.name}${hall.building ? `, ${hall.building}` : ''}`;
    const audience = [
      ...(await registeredStudentIds(trx, event.id)),
      ...(await activeMemberIds(trx, event.club_id)),
    ];
    await notify(trx, {
      userIds: audience,
      type: 'event.venue_confirmed',
      title: 'Venue confirmed',
      body: `"${event.title}" will be held at ${venue} on ${fmtDateTime(event.starts_at)}.`,
      route: `/events/${event.id}`,
    });
    await notify(trx, {
      userIds: await membersWithPermission(trx, event.club_id, PERMISSIONS.HALL_REQUEST),
      type: 'hall.decision',
      title: 'Hall request approved',
      body: `"${event.title}" is confirmed in ${venue}.`,
      route: `/club/${event.club_id}/events/${event.id}`,
    });
    return { bookingId: finalId, status: BOOKING_STATUS.CONFIRMED, hall: hallDto(hall) };
  });
}

/** Events Authority queue (FR-HALL-06) and the holds list: filter by booking status. */
export async function listRequests(db, { status } = {}) {
  const q = db('hall_bookings as b')
    .join('events as e', 'e.id', 'b.event_id')
    .join('clubs as c', 'c.id', 'b.club_id')
    .join('halls as h', 'h.id', 'b.hall_id')
    .select(
      'b.*',
      'e.title as event_title',
      'e.status as event_status',
      'c.name as club_name',
      'h.name as hall_name',
      'h.capacity as hall_capacity',
    )
    .orderBy('b.starts_at');
  if (status) q.whereIn('b.status', status.split(','));
  return (await q).map((b) => ({
    ...bookingDto(b),
    eventTitle: b.event_title,
    eventStatus: b.event_status,
    clubName: b.club_name,
    hallCapacity: Number(b.hall_capacity),
  }));
}

/** Release the hold of a draft/changes-requested event (DELETE /events/:id/hall-hold). */
export async function releaseHold(db, actor, event) {
  return db.transaction(async (trx) => {
    const b = await activeBookingFor(trx, event.id);
    if (!b || b.status !== BOOKING_STATUS.TENTATIVE) throw errors.notFound('There is no hold to release.');
    if (!['changes_requested', 'draft'].includes(event.status)) {
      throw errors.invalidState(
        'The hold of a submitted event cannot be released. Cancel the event instead.',
      );
    }
    await trx('hall_bookings')
      .where({ id: b.id })
      .update({ status: BOOKING_STATUS.RELEASED, updated_at: toDb(clock.now()) });
    await audit(trx, {
      actorId: actor.id,
      action: 'hall.hold_released',
      entityType: 'event',
      entityId: event.id,
    });
  });
}
