import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, cleanDb } from '../helpers/db.js';
import { createClub, createUser } from '../factories/index.js';
import { createHall } from '../helpers/scenario.js';
import { newId } from '../../src/lib/ids.js';
import { activeBookingsOverlapping } from '../../src/modules/halls/halls.service.js';
import { notify } from '../../src/modules/notifications/notifications.service.js';
import { jsonFromDb, jsonToDb } from '../../src/db/helpers.js';

let knex;
beforeAll(async () => {
  knex = await createTestDb();
});
afterAll(async () => knex.destroy());
beforeEach(async () => cleanDb(knex));

const iso = (h, m = 0) => new Date(Date.UTC(2030, 0, 1, h, m)).toISOString();
const NOW = new Date().toISOString();

async function seedEvent(over = {}) {
  const club = await createClub(knex);
  const id = newId();
  await knex('events').insert({
    id,
    club_id: club.id,
    title: 'E',
    type: 'workshop',
    mode: 'offline',
    starts_at: iso(10),
    ends_at: iso(12),
    registration_deadline: iso(9),
    expected_participants: 10,
    status: 'draft',
    created_at: NOW,
    updated_at: NOW,
    ...over,
  });
  return { id, club };
}

describe('event, form, registration constraints', () => {
  it('TC-DB-12 end before start, deadline after start, zero participants all fail', async () => {
    await expect(seedEvent({ ends_at: iso(10) })).rejects.toThrow();
    await expect(seedEvent({ ends_at: iso(9) })).rejects.toThrow();
    await expect(seedEvent({ registration_deadline: iso(11) })).rejects.toThrow();
    await expect(seedEvent({ expected_participants: 0 })).rejects.toThrow();
  });

  it('TC-DB-06 invalid status values fail on events, forms, registrations and hall_bookings', async () => {
    await expect(seedEvent({ status: 'weird' })).rejects.toThrow();
    const { id, club } = await seedEvent();
    const form = {
      id: newId(),
      club_id: club.id,
      event_id: id,
      purpose: 'event_registration',
      title: 't',
      fields_json: '[]',
      created_at: NOW,
      updated_at: NOW,
    };
    await expect(knex('forms').insert({ ...form, status: 'weird' })).rejects.toThrow();
    await knex('forms').insert({ ...form, status: 'draft' });
    const u = await createUser(knex);
    await expect(
      knex('registrations').insert({
        id: newId(),
        event_id: id,
        user_id: u.id,
        status: 'weird',
        qr_token: 'q1',
        created_at: NOW,
        updated_at: NOW,
      }),
    ).rejects.toThrow();
    const hall = await createHall(knex);
    await expect(
      knex('hall_bookings').insert({
        id: newId(),
        hall_id: hall.id,
        event_id: id,
        club_id: club.id,
        status: 'weird',
        starts_at: iso(10),
        ends_at: iso(12),
        created_at: NOW,
        updated_at: NOW,
      }),
    ).rejects.toThrow();
  });

  it('TC-DB-09/10 one registration and one form response per user', async () => {
    const { id, club } = await seedEvent();
    const u = await createUser(knex);
    const formId = newId();
    await knex('forms').insert({
      id: formId,
      club_id: club.id,
      event_id: id,
      purpose: 'event_registration',
      title: 't',
      fields_json: '[]',
      status: 'draft',
      created_at: NOW,
      updated_at: NOW,
    });
    const reg = (token) => ({
      id: newId(),
      event_id: id,
      user_id: u.id,
      status: 'registered',
      qr_token: token,
      created_at: NOW,
      updated_at: NOW,
    });
    await knex('registrations').insert(reg('t1'));
    await expect(knex('registrations').insert(reg('t2'))).rejects.toThrow();
    await knex('form_responses').insert({
      id: newId(),
      form_id: formId,
      user_id: u.id,
      answers_json: '{}',
      submitted_at: NOW,
    });
    await expect(
      knex('form_responses').insert({
        id: newId(),
        form_id: formId,
        user_id: u.id,
        answers_json: '{}',
        submitted_at: NOW,
      }),
    ).rejects.toThrow();
  });

  it('TC-DB-18 a form needs exactly one owner and an event has only one form', async () => {
    const { id, club } = await seedEvent();
    const base = {
      club_id: club.id,
      purpose: 'event_registration',
      title: 't',
      fields_json: '[]',
      status: 'draft',
      created_at: NOW,
      updated_at: NOW,
    };
    await expect(
      knex('forms').insert({ id: newId(), ...base, event_id: id, recruitment_id: newId() }),
    ).rejects.toThrow();
    await expect(knex('forms').insert({ id: newId(), ...base })).rejects.toThrow();
    await knex('forms').insert({ id: newId(), ...base, event_id: id });
    await expect(knex('forms').insert({ id: newId(), ...base, event_id: id })).rejects.toThrow();
  });

  it('TC-DB-14 fields_json, answers_json, facilities_json and agenda_json round-trip nested unicode data', async () => {
    const data = [{ id: 'q', label: 'नाम 🎓', options: ['a', 'b'], nested: { x: [1, 2, { y: null }] } }];
    const { id } = await seedEvent({ agenda_json: jsonToDb(data) });
    const row = await knex('events').where({ id }).first();
    expect(jsonFromDb(row.agenda_json)).toEqual(data);
    const hall = await createHall(knex, { facilities_json: jsonToDb(data) });
    expect(jsonFromDb((await knex('halls').where({ id: hall.id }).first()).facilities_json)).toEqual(data);
  });

  it('TC-DB-19 soft-deleted announcements and messages are excluded from default list queries', async () => {
    const club = await createClub(knex);
    const mk = (over) => ({
      id: newId(),
      club_id: club.id,
      author_id: club.leader.id,
      title: 't',
      body: 'b',
      created_at: NOW,
      updated_at: NOW,
      ...over,
    });
    await knex('announcements').insert([mk({}), mk({ deleted_at: NOW })]);
    const { listAnnouncements } = await import('../../src/modules/announcements/announcements.service.js');
    expect(await listAnnouncements(knex, club.id)).toHaveLength(1);
    expect(await knex('announcements').where({ club_id: club.id })).toHaveLength(2); // admin queries can include them
  });
});

describe('hall overlap rule (TC-DB-20)', () => {
  it('overlapping, contained, containing and identical windows conflict; adjacent does not; inactive statuses are ignored', async () => {
    const { id, club } = await seedEvent();
    const hall = await createHall(knex);
    const mk = (status, from, to) => ({
      id: newId(),
      hall_id: hall.id,
      event_id: id,
      club_id: club.id,
      status,
      starts_at: from,
      ends_at: to,
      created_at: NOW,
      updated_at: NOW,
    });
    await knex('hall_bookings').insert(mk('confirmed', iso(10), iso(12)));
    const conflicts = async (from, to) => (await activeBookingsOverlapping(knex, hall.id, from, to)).length;
    expect(await conflicts(iso(11), iso(13))).toBe(1); // overlapping
    expect(await conflicts(iso(10, 30), iso(11))).toBe(1); // contained
    expect(await conflicts(iso(9), iso(13))).toBe(1); // containing
    expect(await conflicts(iso(10), iso(12))).toBe(1); // identical
    expect(await conflicts(iso(12), iso(14))).toBe(0); // adjacent (starts when the other ends)
    expect(await conflicts(iso(8), iso(10))).toBe(0); // adjacent before
    await knex('hall_bookings').del();
    for (const status of ['released', 'denied', 'expired']) {
      await knex('hall_bookings').insert(mk(status, iso(10), iso(12)));
    }
    expect(await conflicts(iso(10), iso(12))).toBe(0);
    for (const status of ['tentative', 'requested']) {
      await knex('hall_bookings').del();
      await knex('hall_bookings').insert(mk(status, iso(10), iso(12)));
      expect(await conflicts(iso(11), iso(12))).toBe(1);
    }
  });

  it('TC-DB-21 two parallel booking transactions for the same hall and time: exactly one succeeds', async () => {
    const a = await seedEvent();
    const b = await seedEvent();
    const hall = await createHall(knex);
    const { assertHallUsable } = await import('../../src/modules/bookings/bookings.service.js');
    const attempt = (ev) =>
      knex.transaction(async (trx) => {
        await assertHallUsable(trx, hall.id, {
          from: iso(10),
          to: iso(12),
          minCapacity: 1,
          excludeEventId: ev.id,
        });
        await trx('hall_bookings').insert({
          id: newId(),
          hall_id: hall.id,
          event_id: ev.id,
          club_id: ev.club.id,
          status: 'tentative',
          starts_at: iso(10),
          ends_at: iso(12),
          created_at: NOW,
          updated_at: NOW,
        });
      });
    const results = await Promise.allSettled([attempt(a), attempt(b)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected');
    expect(failed.reason.code).toBe('HALL_UNAVAILABLE');
  });

  it('TC-DB-22 PostgreSQL only: overlapping active bookings are rejected by the exclusion constraint', async () => {
    if (knex.client.config.client !== 'pg') return; // SQLite relies on the service-layer check
    const a = await seedEvent();
    const b = await seedEvent();
    const hall = await createHall(knex);
    const row = (ev) => ({
      id: newId(),
      hall_id: hall.id,
      event_id: ev.id,
      club_id: ev.club.id,
      status: 'confirmed',
      starts_at: iso(10),
      ends_at: iso(12),
      created_at: NOW,
      updated_at: NOW,
    });
    await knex('hall_bookings').insert(row(a));
    await expect(knex('hall_bookings').insert(row(b))).rejects.toThrow(/no_overlap|exclusion/i);
  });
});

describe('notification constraints', () => {
  it('TC-DB-23 the same user and dedupe key twice fails; rows with a null key are unaffected', async () => {
    const u = await createUser(knex);
    const row = (key) => ({
      id: newId(),
      user_id: u.id,
      category: 'events',
      type: 'event.published',
      title: 't',
      dedupe_key: key,
      created_at: NOW,
    });
    await knex('notifications').insert(row('k1'));
    await expect(knex('notifications').insert(row('k1'))).rejects.toThrow();
    await knex('notifications').insert([row(null), row(null)]);
    expect(await knex('notifications').where({ user_id: u.id })).toHaveLength(3);
    // The service treats a duplicate dedupe key as "already sent".
    expect(
      await notify(knex, { userIds: [u.id], type: 'event.published', title: 't', dedupeKey: 'k1' }),
    ).toHaveLength(0);
    expect(
      await notify(knex, { userIds: [u.id], type: 'event.published', title: 't', dedupeKey: 'k2' }),
    ).toHaveLength(1);
  });
});
