import { EVENT_STATUS, PERMISSIONS, PLATFORM_ROLES, canTransitionEvent } from '@ccp/shared';
import { newId } from '../../lib/ids.js';
import { clock } from '../../lib/clock.js';
import { errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { jsonFromDb, jsonToDb, toDb } from '../../db/helpers.js';
import { activeBookingFor, placeHold, releaseActiveBookings } from '../bookings/bookings.service.js';
import {
  activeMemberIds,
  adminIds,
  allStudentIds,
  membersWithPermission,
  notify,
  registeredStudentIds,
} from '../notifications/notifications.service.js';

// ---------- DTOs ----------

/** An approved event whose end time has passed is shown as completed (FR-EVT-09). */
const effectiveStatus = (e) =>
  e.status === EVENT_STATUS.APPROVED && e.ends_at < toDb(clock.now()) ? EVENT_STATUS.COMPLETED : e.status;

export const eventDto = (e, extra = {}) => ({
  id: e.id,
  clubId: e.club_id,
  clubName: e.club_name,
  clubSlug: e.club_slug,
  title: e.title,
  type: e.type,
  summary: e.summary,
  description: e.description,
  objectives: e.objectives,
  agenda: jsonFromDb(e.agenda_json, []),
  facultyCoordinator: e.faculty_coordinator,
  mode: e.mode,
  onlineLink: e.online_link,
  startsAt: e.starts_at,
  endsAt: e.ends_at,
  registrationDeadline: e.registration_deadline,
  expectedParticipants: Number(e.expected_participants),
  maxSeats: e.max_seats === null || e.max_seats === undefined ? null : Number(e.max_seats),
  posterUrl: e.poster_url,
  status: effectiveStatus(e),
  submittedAt: e.submitted_at,
  circulatedAt: e.circulated_at,
  cancelledReason: e.cancelled_reason,
  hallId: e.hall_id,
  ...extra,
});

const baseQuery = (db) =>
  db('events as e')
    .join('clubs as c', 'c.id', 'e.club_id')
    .select('e.*', 'c.name as club_name', 'c.slug as club_slug');

export async function getEventRow(db, id) {
  const e = await baseQuery(db).where('e.id', id).first();
  if (!e) throw errors.notFound('Event not found.');
  return e;
}

/** Adds hall, registration counts and the viewer's own registration to a batch of events. */
export async function decorate(db, rows, viewerId) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const bookings = await db('hall_bookings as b')
    .join('halls as h', 'h.id', 'b.hall_id')
    .whereIn('b.event_id', ids)
    .whereIn('b.status', ['tentative', 'requested', 'confirmed'])
    .select(
      'b.event_id',
      'b.status',
      'b.id as booking_id',
      'h.id as hall_id',
      'h.name',
      'h.building',
      'h.capacity',
    );
  const forms = await db('forms').whereIn('event_id', ids).select('event_id', 'status', 'closes_at');
  const counts = await db('registrations')
    .whereIn('event_id', ids)
    .whereIn('status', ['registered', 'attended'])
    .groupBy('event_id')
    .select('event_id')
    .count('* as c');
  const mine = viewerId
    ? await db('registrations')
        .whereIn('event_id', ids)
        .where({ user_id: viewerId })
        .select('event_id', 'status', 'id')
    : [];
  return rows.map((r) => {
    const b = bookings.find((x) => x.event_id === r.id);
    const f = forms.find((x) => x.event_id === r.id);
    const mineRow = mine.find((x) => x.event_id === r.id);
    return eventDto(r, {
      hall: b
        ? {
            id: b.hall_id,
            name: b.name,
            building: b.building,
            capacity: Number(b.capacity),
            bookingStatus: b.status,
            bookingId: b.booking_id,
          }
        : null,
      registrationStatus: f?.status ?? null,
      registrationClosesAt: f?.closes_at ?? null,
      registeredCount: Number(counts.find((c) => c.event_id === r.id)?.c ?? 0),
      myRegistration: mineRow ? { id: mineRow.id, status: mineRow.status } : null,
    });
  });
}

// ---------- Visibility (FR-EVT-10, TC-EVT-15) ----------

export const isPublic = (e) => ['approved', 'completed'].includes(e.status) && Boolean(e.circulated_at);

export async function canViewEvent(db, user, e) {
  if (isPublic(e)) return true;
  const m = await db('club_members')
    .where({ club_id: e.club_id, user_id: user.id, status: 'active' })
    .first();
  if (m) return true;
  if (user.platform_role === PLATFORM_ROLES.OSI_ADMIN && e.status !== EVENT_STATUS.DRAFT) return true;
  if (user.platform_role === PLATFORM_ROLES.EVENTS_ADMIN && (await activeBookingFor(db, e.id))) return true;
  return false;
}

export async function getEventForViewer(db, user, id) {
  const e = await getEventRow(db, id);
  // A student asking for a non-approved event is told it does not exist (TC-EVT-15).
  if (!(await canViewEvent(db, user, e))) throw errors.notFound('Event not found.');
  return (await decorate(db, [e], user.id))[0];
}

export async function listPublicEvents(db, user, q) {
  const query = baseQuery(db).whereIn('e.status', ['approved', 'completed']).whereNotNull('e.circulated_at');
  if (q.club) query.where((b) => b.where('c.id', q.club).orWhere('c.slug', q.club));
  if (q.type) query.where('e.type', q.type);
  if (q.from) query.where('e.ends_at', '>=', q.from);
  if (q.to) query.where('e.starts_at', '<=', q.to);
  if (q.registered === 'true') {
    query.whereIn(
      'e.id',
      db('registrations')
        .where({ user_id: user.id })
        .whereIn('status', ['registered', 'attended'])
        .select('event_id'),
    );
  }
  const total = Number((await query.clone().clearSelect().count('* as c').first()).c);
  const rows = await query
    .orderBy('e.starts_at')
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);
  return { items: await decorate(db, rows, user.id), meta: { page: q.page, pageSize: q.pageSize, total } };
}

export async function listClubEvents(db, clubId, viewerId) {
  const rows = await baseQuery(db).where('e.club_id', clubId).orderBy('e.starts_at', 'desc');
  return decorate(db, rows, viewerId);
}

export async function osiQueue(db, status = 'submitted') {
  const rows = await baseQuery(db).whereIn('e.status', status.split(',')).orderBy('e.submitted_at');
  return decorate(db, rows, null);
}

export async function eventHistory(db, eventId) {
  const reviews = await db('event_reviews as r')
    .join('users as u', 'u.id', 'r.reviewer_id')
    .where('r.event_id', eventId)
    .select('r.*', 'u.full_name');
  const audits = await db('audit_logs as a')
    .leftJoin('users as u', 'u.id', 'a.actor_id')
    .where({ 'a.entity_type': 'event', 'a.entity_id': eventId })
    .select('a.*', 'u.full_name');
  return [
    ...reviews.map((r) => ({
      at: r.created_at,
      kind: 'review',
      action: `OSI: ${r.decision.replace('_', ' ')}`,
      by: r.full_name,
      note: r.note,
    })),
    ...audits.map((a) => ({
      at: a.created_at,
      kind: 'audit',
      action: a.action,
      by: a.full_name,
      note: jsonFromDb(a.meta_json, {})?.note ?? null,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));
}

// ---------- Drafts ----------

const toRow = (input) => {
  const row = {};
  const map = {
    title: 'title',
    type: 'type',
    summary: 'summary',
    description: 'description',
    objectives: 'objectives',
    facultyCoordinator: 'faculty_coordinator',
    mode: 'mode',
    onlineLink: 'online_link',
    startsAt: 'starts_at',
    endsAt: 'ends_at',
    registrationDeadline: 'registration_deadline',
    expectedParticipants: 'expected_participants',
  };
  for (const [k, col] of Object.entries(map))
    if (input[k] !== undefined) row[col] = input[k] === '' ? null : input[k];
  if (input.agenda !== undefined) row.agenda_json = jsonToDb(input.agenda);
  return row;
};

export async function createDraft(db, actor, clubId, input) {
  const now = toDb(clock.now());
  const id = newId();
  await db('events').insert({
    id,
    club_id: clubId,
    ...toRow(input),
    status: EVENT_STATUS.DRAFT,
    created_by: actor.id,
    created_at: now,
    updated_at: now,
  });
  await audit(db, { actorId: actor.id, action: 'event.created', entityType: 'event', entityId: id });
  return getEventRow(db, id);
}

const EDITABLE = [EVENT_STATUS.DRAFT, EVENT_STATUS.CHANGES_REQUESTED];
const assertEditable = (e) => {
  if (!EDITABLE.includes(e.status)) {
    throw errors.invalidState('A submitted event is locked. Ask the OSI for changes if it must be edited.');
  }
};

export async function updateDraft(db, actor, event, input) {
  assertEditable(event);
  // Re-check the date rules against the merged values, since a partial update may break them.
  const merged = { ...event, ...toRow(input) };
  if (merged.ends_at <= merged.starts_at)
    throw errors.validation('End time must be after the start time.', [
      { path: 'endsAt', message: 'End time must be after the start time' },
    ]);
  if (merged.registration_deadline > merged.starts_at) {
    throw errors.validation('Registration must close before the event starts.', [
      { path: 'registrationDeadline', message: 'Registration must close before the event starts' },
    ]);
  }
  await db('events')
    .where({ id: event.id })
    .update({ ...toRow(input), updated_at: toDb(clock.now()) });
  return getEventRow(db, event.id);
}

export async function setPoster(db, event, posterUrl) {
  assertEditable(event);
  await db('events')
    .where({ id: event.id })
    .update({ poster_url: posterUrl, updated_at: toDb(clock.now()) });
  return getEventRow(db, event.id);
}

export async function deleteDraft(db, actor, event) {
  if (event.status !== EVENT_STATUS.DRAFT || event.submitted_at) {
    throw errors.invalidState(
      'Only a draft that was never submitted can be deleted. Cancel the event instead.',
    );
  }
  await db.transaction(async (trx) => {
    await trx('forms').where({ event_id: event.id }).del();
    await trx('events').where({ id: event.id }).del();
    await audit(trx, { actorId: actor.id, action: 'event.deleted', entityType: 'event', entityId: event.id });
  });
}

// ---------- Submit (FR-EVT-03, section 5.3) ----------

export function missingForSubmit(e, hallId) {
  const missing = [];
  const need = (cond, path, message) => cond || missing.push({ path, message });
  need(e.title?.trim(), 'title', 'Add a title');
  need(e.summary?.trim(), 'summary', 'Add a short summary');
  need(e.description?.trim(), 'description', 'Add the full description');
  need(e.objectives?.trim(), 'objectives', 'Add the objectives');
  need(e.poster_url, 'poster', 'Upload the event poster');
  if (e.mode !== 'offline') need(e.online_link, 'onlineLink', 'Add the online meeting link');
  if (e.mode !== 'online') need(hallId, 'hallId', 'Choose a preferred hall');
  return missing;
}

export async function submitEvent(db, actor, event, { hallId } = {}) {
  return db.transaction(async (trx) => {
    const fresh = await trx('events').where({ id: event.id }).first();
    if (!canTransitionEvent(fresh.status, EVENT_STATUS.SUBMITTED)) {
      throw errors.invalidState(`An event that is ${fresh.status.replace('_', ' ')} cannot be submitted.`);
    }
    const existing = await activeBookingFor(trx, fresh.id);
    const targetHall = hallId ?? existing?.hall_id;
    const missing = missingForSubmit(fresh, targetHall);
    if (missing.length) {
      throw errors.validation(
        `Complete the event before submitting: ${missing.map((m) => m.message.toLowerCase()).join(', ')}.`,
        missing,
      );
    }
    if (fresh.starts_at <= toDb(clock.now())) {
      throw errors.validation('The event must start in the future.', [
        { path: 'startsAt', message: 'Choose a future start time' },
      ]);
    }

    if (fresh.mode !== 'online') {
      if (existing && existing.hall_id === targetHall) {
        await trx('hall_bookings')
          .where({ id: existing.id })
          .update({ updated_at: toDb(clock.now()) }); // resubmit keeps the hold
      } else {
        if (existing) await releaseActiveBookings(trx, fresh.id);
        await placeHold(trx, { event: fresh, hallId: targetHall });
      }
    }
    const now = toDb(clock.now());
    await trx('events')
      .where({ id: fresh.id })
      .update({ status: EVENT_STATUS.SUBMITTED, submitted_by: actor.id, submitted_at: now, updated_at: now });
    await audit(trx, {
      actorId: actor.id,
      action: 'event.submitted',
      entityType: 'event',
      entityId: fresh.id,
      meta: { hallId: targetHall ?? null },
    });
    await notify(trx, {
      userIds: await adminIds(trx, PLATFORM_ROLES.OSI_ADMIN),
      type: 'event.submitted',
      title: 'Event waiting for approval',
      body: `"${fresh.title}" was submitted for approval.`,
      route: `/osi/approvals/${fresh.id}`,
    });
    return fresh.id;
  });
}

// ---------- OSI decision (FR-EVT-05/06, TC-EVT-08..12) ----------

export async function decideEvent(db, actor, eventId, { decision, note, circulate = true }) {
  return db.transaction(async (trx) => {
    const e = await trx('events').where({ id: eventId }).first();
    if (!e) throw errors.notFound('Event not found.');
    const target = {
      approved: EVENT_STATUS.APPROVED,
      rejected: EVENT_STATUS.REJECTED,
      changes_requested: EVENT_STATUS.CHANGES_REQUESTED,
    }[decision];
    if (!canTransitionEvent(e.status, target))
      throw errors.invalidState(`An event that is ${e.status.replace('_', ' ')} cannot be decided.`);
    if (decision !== 'approved' && !note?.trim()) {
      throw errors.validation('Please add a note explaining your decision.', [
        { path: 'note', message: 'A note is required' },
      ]);
    }
    const nowDate = clock.now();
    const now = toDb(nowDate);
    await trx('events')
      .where({ id: e.id })
      .update({
        status: target,
        circulated_at: decision === 'approved' && circulate ? now : null,
        updated_at: now,
      });
    await trx('event_reviews').insert({
      id: newId(),
      event_id: e.id,
      reviewer_id: actor.id,
      decision,
      note: note?.trim() || null,
      created_at: now,
    });
    // Once approved the day-count expiry no longer applies: the hold lives until the final request (spec 5.3 rule 3).
    if (decision === 'approved')
      await trx('hall_bookings').where({ event_id: e.id, status: 'tentative' }).update({ expires_at: null });
    if (decision === 'rejected') await releaseActiveBookings(trx, e.id); // the slot is free for others at once (TC-EVT-11)
    await audit(trx, {
      actorId: actor.id,
      action: `event.${decision}`,
      entityType: 'event',
      entityId: e.id,
      meta: { note: note ?? null },
    });

    const outcome = {
      approved: 'approved',
      rejected: 'rejected',
      changes_requested: 'sent back for changes',
    }[decision];
    await notify(trx, {
      userIds: [e.submitted_by, ...(await membersWithPermission(trx, e.club_id, PERMISSIONS.EVENT_DRAFT))],
      type: 'event.decision',
      title: `Event ${outcome}`,
      body: `"${e.title}" was ${outcome} by the OSI.${note ? ` ${note.trim()}` : ''}`,
      route: `/club/${e.club_id}/events/${e.id}`,
    });
    if (decision === 'approved' && circulate) {
      await notify(trx, {
        userIds: await allStudentIds(trx),
        type: 'event.published',
        title: 'New event',
        body: `${e.title} on ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(e.starts_at))}.`,
        route: `/events/${e.id}`,
      });
    }
    return e.id;
  });
}

// ---------- Cancel (FR-EVT-08, TC-EVT-13) ----------

export async function cancelEvent(db, actor, event, reason) {
  return db.transaction(async (trx) => {
    const e = await trx('events').where({ id: event.id }).first();
    if (!canTransitionEvent(e.status, EVENT_STATUS.CANCELLED)) {
      throw errors.invalidState(`An event that is ${e.status.replace('_', ' ')} cannot be cancelled.`);
    }
    const now = toDb(clock.now());
    await trx('events')
      .where({ id: e.id })
      .update({ status: EVENT_STATUS.CANCELLED, cancelled_reason: reason.trim(), updated_at: now });
    await releaseActiveBookings(trx, e.id);
    await trx('forms')
      .where({ event_id: e.id, status: 'published' })
      .update({ status: 'closed', updated_at: now });
    await audit(trx, {
      actorId: actor.id,
      action: 'event.cancelled',
      entityType: 'event',
      entityId: e.id,
      meta: { note: reason },
    });
    if (e.status === EVENT_STATUS.APPROVED) {
      await notify(trx, {
        userIds: [...(await registeredStudentIds(trx, e.id)), ...(await activeMemberIds(trx, e.club_id))],
        type: 'event.cancelled',
        title: 'Event cancelled',
        body: `"${e.title}" was cancelled: ${reason.trim()}`,
        route: `/events/${e.id}`,
      });
    }
    return e.id;
  });
}
