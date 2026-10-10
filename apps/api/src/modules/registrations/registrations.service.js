import {
  ERROR_CODES,
  EVENT_STATUS,
  FORM_STATUS,
  PROFILE_FIELDS,
  REGISTRATION_STATUS,
  validateAnswers,
} from '@ccp/shared';
import { newId, randomToken } from '../../lib/ids.js';
import { clock } from '../../lib/clock.js';
import { AppError, errors } from '../../lib/errors.js';
import { jsonFromDb, jsonToDb, toDb } from '../../db/helpers.js';
import { toCsv } from '../../lib/csv.js';
import { notify } from '../notifications/notifications.service.js';
import { formDto } from '../forms/forms.service.js';

const HOLDING = [REGISTRATION_STATUS.REGISTERED, REGISTRATION_STATUS.ATTENDED];

export const registrationDto = (r) => ({
  id: r.id,
  eventId: r.event_id,
  status: r.status,
  registeredAt: r.created_at,
  checkedInAt: r.checked_in_at,
  cancelledAt: r.cancelled_at,
});

export const seatCount = async (db, eventId) =>
  Number(
    (
      await db('registrations')
        .where({ event_id: eventId })
        .whereIn('status', HOLDING)
        .count('* as c')
        .first()
    ).c,
  );

/** FR-REG-01..03, TC-REG-01..07: register inside one transaction so seats can never be oversold. */
export async function register(db, user, eventId, answers) {
  return db.transaction(async (trx) => {
    // Locking the event row serialises concurrent registrations on PostgreSQL (TC-REG-06).
    const e = await trx('events').where({ id: eventId }).forUpdate().first();
    if (!e || ![EVENT_STATUS.APPROVED].includes(e.status) || !e.circulated_at)
      throw errors.notFound('Event not found.');
    const form = await trx('forms').where({ event_id: e.id }).first();
    const now = toDb(clock.now());
    if (
      !form ||
      form.status !== FORM_STATUS.PUBLISHED ||
      (form.closes_at && form.closes_at <= now) ||
      e.starts_at <= now
    ) {
      throw new AppError(ERROR_CODES.REGISTRATION_CLOSED, 'Registration is not open for this event.');
    }
    const existing = await trx('registrations').where({ event_id: e.id, user_id: user.id }).first();
    if (existing && HOLDING.includes(existing.status)) {
      throw new AppError(ERROR_CODES.ALREADY_REGISTERED, 'You are already registered for this event.', {
        registration: registrationDto(existing),
      });
    }
    const fields = jsonFromDb(form.fields_json, []);
    const checked = validateAnswers(fields, answers);
    if (!checked.ok) {
      throw errors.validation(
        'Please correct the highlighted answers.',
        Object.entries(checked.errors).map(([path, message]) => ({ path, message })),
      );
    }
    if (e.max_seats !== null && (await seatCount(trx, e.id)) >= Number(e.max_seats)) {
      throw new AppError(ERROR_CODES.SEATS_FULL, 'This event is full.');
    }

    // One response per (form, user): a student who cancelled and returns replaces the old answers.
    if (existing) await trx('registrations').where({ id: existing.id }).update({ form_response_id: null });
    await trx('form_responses').where({ form_id: form.id, user_id: user.id }).del();
    const responseId = newId();
    await trx('form_responses').insert({
      id: responseId,
      form_id: form.id,
      user_id: user.id,
      answers_json: jsonToDb(checked.value),
      submitted_at: now,
    });

    let id;
    if (existing) {
      id = existing.id;
      await trx('registrations')
        .where({ id })
        .update({
          status: REGISTRATION_STATUS.REGISTERED,
          form_response_id: responseId,
          qr_token: randomToken(24),
          cancelled_at: null,
          checked_in_at: null,
          checked_in_by: null,
          updated_at: now,
        });
    } else {
      id = newId();
      await trx('registrations').insert({
        id,
        event_id: e.id,
        user_id: user.id,
        form_response_id: responseId,
        status: REGISTRATION_STATUS.REGISTERED,
        qr_token: randomToken(24),
        created_at: now,
        updated_at: now,
      });
    }
    await notify(trx, {
      userIds: [user.id],
      type: 'registration.confirmed',
      title: 'Registration confirmed',
      body: `You are registered for "${e.title}". Your QR ticket is on the event page.`,
      route: `/events/${e.id}`,
    });
    return registrationDto(await trx('registrations').where({ id }).first());
  });
}

/** FR-REG-05, TC-REG-07: cancel until the event starts; the seat is freed. */
export async function cancelRegistration(db, user, eventId) {
  const e = await db('events').where({ id: eventId }).first();
  if (!e) throw errors.notFound('Event not found.');
  const r = await db('registrations').where({ event_id: eventId, user_id: user.id }).first();
  if (!r || r.status !== REGISTRATION_STATUS.REGISTERED)
    throw errors.notFound('You have no active registration for this event.');
  if (e.starts_at <= toDb(clock.now()))
    throw errors.invalidState(
      'The event has already started, so the registration can no longer be cancelled.',
    );
  const now = toDb(clock.now());
  await db('registrations')
    .where({ id: r.id })
    .update({ status: REGISTRATION_STATUS.CANCELLED, cancelled_at: now, updated_at: now });
  return registrationDto(await db('registrations').where({ id: r.id }).first());
}

/** GET /me/registrations/:eventId/ticket: only the owner can read the QR token (TC-RBAC-15). */
export async function getTicket(db, user, eventId) {
  const r = await db('registrations as r')
    .join('events as e', 'e.id', 'r.event_id')
    .where({ 'r.event_id': eventId, 'r.user_id': user.id })
    .select('r.*', 'e.title', 'e.starts_at')
    .first();
  if (!r || r.status === REGISTRATION_STATUS.CANCELLED) throw errors.notFound('No ticket for this event.');
  return { ...registrationDto(r), qrToken: r.qr_token, eventTitle: r.title, startsAt: r.starts_at };
}

const profileOf = (u) => ({
  fullName: u.full_name,
  email: u.email,
  rollNumber: u.roll_number,
  department: u.department,
  yearOfStudy: u.year_of_study,
});

async function loadRows(db, event) {
  const form = await db('forms').where({ event_id: event.id }).first();
  const rows = await db('registrations as r')
    .join('users as u', 'u.id', 'r.user_id')
    .leftJoin('form_responses as fr', 'fr.id', 'r.form_response_id')
    .where('r.event_id', event.id)
    .select(
      'r.*',
      'u.full_name',
      'u.email',
      'u.roll_number',
      'u.department',
      'u.year_of_study',
      'fr.answers_json',
    )
    .orderBy('r.created_at');
  return { form, rows };
}

/** Registration list: full answers for registration.view, counts only for other members (TC-RBAC-16). */
export async function listRegistrations(db, event, { canViewAnswers }) {
  const counts = {
    registered: await seatCount(db, event.id),
    cancelled: Number(
      (await db('registrations').where({ event_id: event.id, status: 'cancelled' }).count('* as c').first())
        .c,
    ),
    attended: Number(
      (await db('registrations').where({ event_id: event.id, status: 'attended' }).count('* as c').first()).c,
    ),
    maxSeats: event.max_seats === null ? null : Number(event.max_seats),
    expected: Number(event.expected_participants),
  };
  if (!canViewAnswers) return { counts, items: null };
  const { form, rows } = await loadRows(db, event);
  return {
    counts,
    form: form ? formDto(form) : null,
    items: rows.map((r) => ({
      ...registrationDto(r),
      user: profileOf({
        full_name: r.full_name,
        email: r.email,
        roll_number: r.roll_number,
        department: r.department,
        year_of_study: r.year_of_study,
      }),
      answers: jsonFromDb(r.answers_json, {}),
    })),
  };
}

export async function exportCsv(db, event) {
  const { form, rows } = await loadRows(db, event);
  const fields = form ? jsonFromDb(form.fields_json, []) : [];
  const header = [
    ...PROFILE_FIELDS.map((p) => p.label),
    'Status',
    'Registered at',
    ...fields.map((f) => f.label),
  ];
  const body = rows.map((r) => {
    const p = profileOf({
      full_name: r.full_name,
      email: r.email,
      roll_number: r.roll_number,
      department: r.department,
      year_of_study: r.year_of_study,
    });
    const answers = jsonFromDb(r.answers_json, {});
    return [
      ...PROFILE_FIELDS.map((f) => p[f.key]),
      r.status,
      r.created_at,
      ...fields.map((f) => answers[f.id]),
    ];
  });
  return toCsv([header, ...body]);
}

/** FR-CHECK-01, TC-REG-11: scan a ticket; scanning twice reports "already checked in". */
export async function checkIn(db, actor, event, qrToken) {
  const r = await db('registrations as r')
    .join('users as u', 'u.id', 'r.user_id')
    .where({ 'r.event_id': event.id, 'r.qr_token': qrToken })
    .select('r.*', 'u.full_name', 'u.roll_number')
    .first();
  // A ticket from another event is simply not found for this event.
  if (!r || r.status === REGISTRATION_STATUS.CANCELLED)
    throw errors.notFound('That ticket is not valid for this event.');
  if (r.status === REGISTRATION_STATUS.ATTENDED) {
    throw errors.conflict(`${r.full_name} is already checked in.`, { checkedInAt: r.checked_in_at });
  }
  const now = toDb(clock.now());
  await db('registrations')
    .where({ id: r.id })
    .update({
      status: REGISTRATION_STATUS.ATTENDED,
      checked_in_at: now,
      checked_in_by: actor.id,
      updated_at: now,
    });
  return { registrationId: r.id, fullName: r.full_name, rollNumber: r.roll_number, checkedInAt: now };
}

/** Activities page (FR-ACT-01): current vs past. */
export async function myActivities(db, userId, scope) {
  const now = toDb(clock.now());
  const regs = await db('registrations as r')
    .join('events as e', 'e.id', 'r.event_id')
    .join('clubs as c', 'c.id', 'e.club_id')
    .where('r.user_id', userId)
    .select('r.*', 'e.title', 'e.starts_at', 'e.ends_at', 'e.status as event_status', 'c.name as club_name')
    .orderBy('e.starts_at', 'desc');
  const mapped = regs.map((r) => ({
    ...registrationDto(r),
    eventTitle: r.title,
    clubName: r.club_name,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    eventStatus: r.event_status,
    // Registered but absent events are labelled (D13).
    label:
      r.status === 'no_show'
        ? 'Missed'
        : r.status === 'attended'
          ? 'Attended'
          : r.status === 'cancelled'
            ? 'Cancelled'
            : 'Registered',
  }));
  const upcoming = (r) =>
    r.status === 'registered' && r.endsAt >= now && !['cancelled', 'rejected'].includes(r.eventStatus);
  if (scope === 'current') return { registrations: mapped.filter(upcoming) };
  if (scope === 'past')
    return { registrations: mapped.filter((r) => !upcoming(r) && r.status !== 'cancelled') };
  return { registrations: mapped };
}
