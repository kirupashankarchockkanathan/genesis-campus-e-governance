import { EVENT_STATUS, FORM_STATUS } from '@ccp/shared';
import { newId } from '../../lib/ids.js';
import { clock } from '../../lib/clock.js';
import { errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { boolFromDb, boolToDb, jsonFromDb, jsonToDb, toDb } from '../../db/helpers.js';
import { activeBookingFor } from '../bookings/bookings.service.js';

export const formDto = (f) => ({
  id: f.id,
  eventId: f.event_id,
  title: f.title,
  description: f.description,
  fields: jsonFromDb(f.fields_json, []),
  status: f.status,
  opensAt: f.opens_at,
  closesAt: f.closes_at,
  publishedAt: f.published_at,
  waitlistEnabled: boolFromDb(f.waitlist_enabled),
});

export const getFormRow = (db, eventId) => db('forms').where({ event_id: eventId }).first();

/** Students only see a published form; drafts need form.manage (checked by the route). */
export async function getForm(db, event, { includeDraft }) {
  const f = await getFormRow(db, event.id);
  if (!f || (f.status === FORM_STATUS.DRAFT && !includeDraft))
    throw errors.notFound('The registration form is not available yet.');
  return formDto(f);
}

/** Create or replace the draft form (FR-FORM-01..03). */
export async function saveForm(db, actor, event, { title, description, fields }) {
  const existing = await getFormRow(db, event.id);
  if (existing && existing.status !== FORM_STATUS.DRAFT) {
    throw errors.invalidState(
      'The form is already published. Fields can only be changed while it is a draft.',
    );
  }
  const now = toDb(clock.now());
  if (existing) {
    await db('forms')
      .where({ id: existing.id })
      .update({ title, description, fields_json: jsonToDb(fields), updated_at: now });
  } else {
    await db('forms').insert({
      id: newId(),
      club_id: event.club_id,
      event_id: event.id,
      purpose: 'event_registration',
      title,
      description,
      fields_json: jsonToDb(fields),
      status: FORM_STATUS.DRAFT,
      created_by: actor.id,
      created_at: now,
      updated_at: now,
    });
  }
  return formDto(await getFormRow(db, event.id));
}

/** Copy a form from an older event of the same club (FR-FORM-03). */
export async function duplicateForm(db, actor, event, fromEventId) {
  const source = await db('forms as f')
    .join('events as e', 'e.id', 'f.event_id')
    .where({ 'f.event_id': fromEventId, 'e.club_id': event.club_id })
    .select('f.*')
    .first();
  if (!source) throw errors.notFound('No form found on that event of your club.');
  return saveForm(db, actor, event, {
    title: source.title,
    description: source.description ?? '',
    fields: jsonFromDb(source.fields_json, []),
  });
}

/** FR-FORM-06: publish after approval; seat limit defaults to the held hall's capacity (spec 5.3 rule 4). */
export async function publishForm(db, actor, event, { maxSeats, closesAt, waitlist } = {}) {
  return db.transaction(async (trx) => {
    const e = await trx('events').where({ id: event.id }).first();
    if (e.status !== EVENT_STATUS.APPROVED || !e.circulated_at) {
      throw errors.invalidState('Registration can be published only after the OSI has approved the event.');
    }
    if (e.ends_at < toDb(clock.now())) throw errors.invalidState('This event has already ended.');
    const now = toDb(clock.now());
    let form = await getFormRow(trx, e.id);
    if (form?.status === FORM_STATUS.PUBLISHED) throw errors.invalidState('Registration is already open.');
    if (form?.status === FORM_STATUS.CLOSED)
      throw errors.invalidState('Registration has been closed. It cannot be reopened.');
    if (!form) {
      // A form with only the profile fields is valid: name, email, roll number, department and year.
      await trx('forms').insert({
        id: newId(),
        club_id: e.club_id,
        event_id: e.id,
        purpose: 'event_registration',
        title: `${e.title}: registration`,
        description: '',
        fields_json: jsonToDb([]),
        status: FORM_STATUS.DRAFT,
        created_by: actor.id,
        created_at: now,
        updated_at: now,
      });
      form = await getFormRow(trx, e.id);
    }

    const booking = await activeBookingFor(trx, e.id);
    const hall = booking ? await trx('halls').where({ id: booking.hall_id }).first() : null;
    const capacity = hall ? Number(hall.capacity) : null;
    const seats = maxSeats ?? e.max_seats ?? capacity ?? Number(e.expected_participants);
    // The Leader may lower the limit, but may only raise it by changing to a bigger hall.
    if (capacity !== null && seats > capacity) {
      throw errors.validation(
        `The seat limit cannot exceed the held hall capacity (${capacity}). Choose a bigger hall to raise it.`,
        [{ path: 'maxSeats', message: `At most ${capacity}` }],
      );
    }
    const closes = closesAt ?? e.registration_deadline;
    if (closes > e.starts_at)
      throw errors.validation('Registration must close before the event starts.', [
        { path: 'closesAt', message: 'Too late' },
      ]);
    if (closes <= now)
      throw errors.validation('The closing time is already in the past.', [
        { path: 'closesAt', message: 'Choose a future time' },
      ]);

    await trx('events').where({ id: e.id }).update({ max_seats: seats, updated_at: now });
    await trx('forms')
      .where({ id: form.id })
      .update({
        status: FORM_STATUS.PUBLISHED,
        opens_at: now,
        closes_at: closes,
        published_at: now,
        waitlist_enabled: boolToDb(Boolean(waitlist)),
        updated_at: now,
      });
    await audit(trx, {
      actorId: actor.id,
      action: 'registration.published',
      entityType: 'event',
      entityId: e.id,
      meta: { seats, closes },
    });
    return formDto(await getFormRow(trx, e.id));
  });
}

export async function closeForm(db, actor, event) {
  const f = await getFormRow(db, event.id);
  if (!f || f.status !== FORM_STATUS.PUBLISHED) throw errors.invalidState('Registration is not open.');
  await db('forms')
    .where({ id: f.id })
    .update({ status: FORM_STATUS.CLOSED, closes_at: toDb(clock.now()), updated_at: toDb(clock.now()) });
  await audit(db, {
    actorId: actor.id,
    action: 'registration.closed',
    entityType: 'event',
    entityId: event.id,
  });
  return formDto(await getFormRow(db, event.id));
}
