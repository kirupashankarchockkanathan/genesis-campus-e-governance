import { ACTIVE_BOOKING_STATUSES } from '@ccp/shared';
import { newId } from '../../lib/ids.js';
import { clock } from '../../lib/clock.js';
import { errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { boolFromDb, boolToDb, isUniqueViolation, jsonFromDb, jsonToDb, toDb } from '../../db/helpers.js';

export const hallDto = (h) => ({
  id: h.id,
  name: h.name,
  building: h.building,
  floor: h.floor,
  capacity: Number(h.capacity),
  facilities: jsonFromDb(h.facilities_json, []),
  isActive: boolFromDb(h.is_active),
});

export const listHalls = async (db, { activeOnly = false } = {}) => {
  const q = db('halls').orderBy('name');
  if (activeOnly) q.where({ is_active: boolToDb(true) });
  return (await q).map(hallDto);
};

export async function getHall(db, id) {
  const h = await db('halls').where({ id }).first();
  if (!h) throw errors.notFound('Hall not found.');
  return h;
}

export async function createHall(db, actor, input) {
  const now = toDb(clock.now());
  const id = newId();
  try {
    await db('halls').insert({
      id,
      name: input.name,
      building: input.building ?? null,
      floor: input.floor ?? null,
      capacity: input.capacity,
      facilities_json: jsonToDb(input.facilities ?? []),
      is_active: boolToDb(input.isActive ?? true),
      created_at: now,
      updated_at: now,
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw errors.conflict('A hall with that name already exists.');
    throw err;
  }
  await audit(db, { actorId: actor.id, action: 'hall.created', entityType: 'hall', entityId: id });
  return hallDto(await getHall(db, id));
}

export async function updateHall(db, actor, id, input) {
  await getHall(db, id);
  const patch = { updated_at: toDb(clock.now()) };
  if (input.name !== undefined) patch.name = input.name;
  if (input.building !== undefined) patch.building = input.building;
  if (input.floor !== undefined) patch.floor = input.floor;
  if (input.capacity !== undefined) patch.capacity = input.capacity;
  if (input.facilities !== undefined) patch.facilities_json = jsonToDb(input.facilities);
  if (input.isActive !== undefined) patch.is_active = boolToDb(input.isActive);
  try {
    await db('halls').where({ id }).update(patch);
  } catch (err) {
    if (isUniqueViolation(err)) throw errors.conflict('A hall with that name already exists.');
    throw err;
  }
  await audit(db, {
    actorId: actor.id,
    action: 'hall.updated',
    entityType: 'hall',
    entityId: id,
    meta: input,
  });
  return hallDto(await getHall(db, id));
}

// ---------- Overlap rule (spec 5.3 rule 6) ----------
// A and B conflict when A.starts < B.ends AND B.starts < A.ends. Adjacent windows do not conflict.

export const activeBookingsOverlapping = (db, hallId, from, to, excludeEventId) => {
  const q = db('hall_bookings as b')
    .join('events as e', 'e.id', 'b.event_id')
    .join('clubs as c', 'c.id', 'b.club_id')
    .where('b.hall_id', hallId)
    .whereIn('b.status', ACTIVE_BOOKING_STATUSES)
    .where('b.starts_at', '<', to)
    .where('b.ends_at', '>', from)
    .select('b.*', 'e.title as event_title', 'c.name as club_name');
  if (excludeEventId) q.whereNot('b.event_id', excludeEventId);
  return q;
};

export const blockedSlotsOverlapping = (db, hallId, from, to) =>
  db('hall_blocked_slots').where({ hall_id: hallId }).where('starts_at', '<', to).where('ends_at', '>', from);

// ---------- Blocked slots (FR-HALL-02) ----------

export async function addBlockedSlot(db, actor, hallId, input) {
  await getHall(db, hallId);
  const id = newId();
  await db('hall_blocked_slots').insert({
    id,
    hall_id: hallId,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    reason: input.reason ?? null,
    created_by: actor.id,
    created_at: toDb(clock.now()),
  });
  // TC-HALL-10: an existing hold or booking is never silently changed; the caller is warned instead.
  const clashes = await activeBookingsOverlapping(db, hallId, input.startsAt, input.endsAt);
  await audit(db, {
    actorId: actor.id,
    action: 'hall.slot_blocked',
    entityType: 'hall',
    entityId: hallId,
    meta: { slotId: id },
  });
  return {
    slot: { id, hallId, startsAt: input.startsAt, endsAt: input.endsAt, reason: input.reason ?? null },
    warnings: clashes.map((b) => ({
      bookingId: b.id,
      eventId: b.event_id,
      eventTitle: b.event_title,
      clubName: b.club_name,
      status: b.status,
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      message: `${b.club_name} already has a ${b.status} booking for "${b.event_title}" in this window. It was not changed.`,
    })),
  };
}

export async function deleteBlockedSlot(db, actor, id) {
  const slot = await db('hall_blocked_slots').where({ id }).first();
  if (!slot) throw errors.notFound('Blocked slot not found.');
  await db('hall_blocked_slots').where({ id }).del();
  await audit(db, {
    actorId: actor.id,
    action: 'hall.slot_unblocked',
    entityType: 'hall',
    entityId: slot.hall_id,
  });
}

export const listBlockedSlots = async (db, hallId) =>
  (await db('hall_blocked_slots').where({ hall_id: hallId }).orderBy('starts_at')).map((s) => ({
    id: s.id,
    hallId: s.hall_id,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    reason: s.reason,
  }));

// ---------- Availability (FR-HALL-03) ----------

/** Halls that are free for the whole window, plus the busy blocks of every hall in the window. */
export async function availability(db, { from, to, minCapacity = 0 }, { excludeEventId } = {}) {
  const halls = await db('halls')
    .where({ is_active: boolToDb(true) })
    .where('capacity', '>=', minCapacity)
    .orderBy('name');
  const out = [];
  for (const h of halls) {
    const bookings = await activeBookingsOverlapping(db, h.id, from, to, excludeEventId);
    const blocked = await blockedSlotsOverlapping(db, h.id, from, to);
    out.push({
      ...hallDto(h),
      free: bookings.length === 0 && blocked.length === 0,
      busy: [
        ...bookings.map((b) => ({
          type: 'booking',
          status: b.status,
          startsAt: b.starts_at,
          endsAt: b.ends_at,
          label: `${b.club_name}: ${b.event_title}`,
        })),
        ...blocked.map((s) => ({
          type: 'blocked',
          startsAt: s.starts_at,
          endsAt: s.ends_at,
          label: s.reason || 'Blocked',
        })),
      ].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    });
  }
  return out;
}
