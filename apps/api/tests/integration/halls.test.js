import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestDb, cleanDb } from '../helpers/db.js';
import { buildTestApp, bearer } from '../helpers/app.js';
import {
  API,
  approvedEvent,
  clubWithTeam,
  createHall,
  makeAdmins,
  makeStudent,
  slot,
  submittedEvent,
} from '../helpers/scenario.js';
import { clock } from '../../src/lib/clock.js';
import { closeRegistrations } from '../../src/jobs/index.js';

let knex, app;
beforeAll(async () => {
  knex = await createTestDb();
  app = buildTestApp(knex);
});
afterAll(async () => knex.destroy());
beforeEach(async () => {
  await cleanDb(knex);
  clock.reset();
});

const post = (token, path, body) =>
  request(app)
    .post(`${API}${path}`)
    .set(bearer(token))
    .send(body ?? {});
const get = (token, path) => request(app).get(`${API}${path}`).set(bearer(token));

describe('hall management (FR-HALL-01/02)', () => {
  it('only the Events Authority manages halls; capacity must be above zero', async () => {
    const admins = await makeAdmins(knex, app);
    const ctx = await clubWithTeam(knex, app);
    expect((await post(ctx.tokens.LEADER, '/halls', { name: 'X Hall', capacity: 50 })).status).toBe(403);
    expect((await post(admins.osiToken, '/halls', { name: 'X Hall', capacity: 50 })).status).toBe(403);
    expect((await post(admins.hallToken, '/halls', { name: 'Zero Hall', capacity: 0 })).status).toBe(400);
    const ok = await post(admins.hallToken, '/halls', {
      name: 'New Hall',
      capacity: 80,
      facilities: ['Projector'],
    });
    expect(ok.status).toBe(201);
    expect((await post(admins.hallToken, '/halls', { name: 'New Hall', capacity: 80 })).status).toBe(409);
    const upd = await request(app)
      .patch(`${API}/halls/${ok.body.data.id}`)
      .set(bearer(admins.hallToken))
      .send({ capacity: 90, isActive: false });
    expect(upd.body.data).toMatchObject({ capacity: 90, isActive: false });
    expect((await get(ctx.tokens.MEMBER, '/halls')).body.data.length).toBe(1);
  });

  it('TC-HALL-01 availability returns only free halls with enough capacity, plus busy blocks', async () => {
    const admins = await makeAdmins(knex, app);
    const a = await clubWithTeam(knex, app);
    const busy = await createHall(knex, { name: 'Busy', capacity: 100 });
    const blocked = await createHall(knex, { name: 'Blocked', capacity: 100 });
    const small = await createHall(knex, { name: 'Small', capacity: 20 });
    const free = await createHall(knex, { name: 'Free', capacity: 100 });
    await submittedEvent(app, a, busy.id);
    const s = slot();
    await post(admins.hallToken, `/halls/${blocked.id}/blocked-slots`, {
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      reason: 'Exam',
    });
    const q = `/halls/availability?from=${encodeURIComponent(s.startsAt)}&to=${encodeURIComponent(s.endsAt)}&minCapacity=50`;
    const res = await get(a.tokens.EVENT_COORDINATOR, q);
    expect(res.status).toBe(200);
    const names = Object.fromEntries(res.body.data.map((h) => [h.name, h.free]));
    expect(names).toEqual({ Busy: false, Blocked: false, Free: true });
    expect(res.body.data.find((h) => h.name === 'Busy').busy[0].type).toBe('booking');
    expect(small.id).toBeTruthy();
    expect((await get(a.tokens.MEMBER, q)).status).toBe(403);
    expect((await get(admins.hallToken, q)).status).toBe(200);
  });

  it('TC-HALL-10 blocking over an existing hold returns a warning and does not change the booking', async () => {
    const admins = await makeAdmins(knex, app);
    const ctx = await clubWithTeam(knex, app);
    const hall = await createHall(knex);
    await submittedEvent(app, ctx, hall.id);
    const s = slot();
    const res = await post(admins.hallToken, `/halls/${hall.id}/blocked-slots`, {
      startsAt: s.startsAt,
      endsAt: s.endsAt,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.warnings).toHaveLength(1);
    expect((await knex('hall_bookings').where({ hall_id: hall.id }).first()).status).toBe('tentative');
    const del = await request(app)
      .delete(`${API}/blocked-slots/${res.body.data.slot.id}`)
      .set(bearer(admins.hallToken));
    expect(del.status).toBe(200);
  });
});

async function readyForFinalRequest(ctx, admins, hallId, over = {}) {
  const ev = await approvedEvent(app, ctx, admins, hallId, over);
  expect((await post(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form/publish`, {})).status).toBe(200);
  return ev;
}

describe('final hall request and decision (FR-HALL-05..07)', () => {
  it('TC-HALL-02 a final request before registration closed is 409', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const hall = await createHall(knex);
    const ev = await readyForFinalRequest(ctx, admins, hall.id);
    const res = await post(ctx.tokens.LEADER, `/events/${ev.id}/hall-request`, {});
    expect(res.status).toBe(409);
  });

  it('TC-HALL-03/05 keep the hall: request created with the real count; approval confirms and notifies', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const s1 = await makeStudent(knex, app);
    const s2 = await makeStudent(knex, app);
    const hall = await createHall(knex, { name: 'Seminar A', capacity: 100 });
    const ev = await readyForFinalRequest(ctx, admins, hall.id);
    await post(s1.token, `/events/${ev.id}/register`, { answers: {} });
    await post(s2.token, `/events/${ev.id}/register`, { answers: {} });
    await post(ctx.tokens.LEADER, `/events/${ev.id}/form/close`);

    const req = await post(ctx.tokens.VICE_LEADER, `/events/${ev.id}/hall-request`, {});
    expect(req.status).toBe(201);
    const b = await knex('hall_bookings').where({ id: req.body.data.bookingId }).first();
    expect(b).toMatchObject({ status: 'requested', registered_count: 2 });
    expect((await post(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/hall-request`, {})).status).toBe(403);
    expect((await get(admins.hallToken, '/notifications')).body.data.map((n) => n.type)).toContain(
      'hall.requested',
    );

    const queue = await get(admins.hallToken, '/events-admin/hall-requests?status=requested');
    expect(queue.body.data).toHaveLength(1);
    expect(queue.body.data[0]).toMatchObject({
      clubName: expect.any(String),
      registeredCount: 2,
      expectedCount: 50,
    });

    const dec = await post(admins.hallToken, `/events-admin/hall-requests/${b.id}/decision`, {
      decision: 'approve',
    });
    expect(dec.status).toBe(200);
    expect((await knex('hall_bookings').where({ id: b.id }).first()).status).toBe('confirmed');
    expect((await knex('events').where({ id: ev.id }).first()).hall_id).toBe(hall.id);
    expect((await get(s1.token, '/notifications')).body.data.map((n) => n.type)).toContain(
      'event.venue_confirmed',
    );
    expect((await get(ctx.tokens.LEADER, '/notifications')).body.data.map((n) => n.type)).toContain(
      'hall.decision',
    );
    expect(
      (await post(admins.hallToken, `/events-admin/hall-requests/${b.id}/decision`, { decision: 'approve' }))
        .status,
    ).toBe(409);
  });

  it('TC-HALL-04 changing the hall releases the old booking and creates the new one in one go', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const big = await createHall(knex, { name: 'Big', capacity: 200 });
    const alt = await createHall(knex, { name: 'Alt', capacity: 120 });
    const ev = await readyForFinalRequest(ctx, admins, big.id);
    await post(ctx.tokens.LEADER, `/events/${ev.id}/form/close`);
    const res = await post(ctx.tokens.LEADER, `/events/${ev.id}/hall-request`, { hallId: alt.id });
    expect(res.status).toBe(201);
    const rows = await knex('hall_bookings').where({ event_id: ev.id }).orderBy('created_at');
    expect(rows.map((r) => [r.hall_id, r.status])).toEqual(
      expect.arrayContaining([
        [big.id, 'released'],
        [alt.id, 'requested'],
      ]),
    );
    // The released hall is free again for someone else.
    const other = await clubWithTeam(knex, app);
    expect((await submittedEvent(app, other, big.id)).status).toBe('submitted');
  });

  it('TC-HALL-06/07 denial needs a note; the club is notified and may request again', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const hall = await createHall(knex);
    const ev = await readyForFinalRequest(ctx, admins, hall.id);
    await post(ctx.tokens.LEADER, `/events/${ev.id}/form/close`);
    const { body } = await post(ctx.tokens.LEADER, `/events/${ev.id}/hall-request`, {});
    expect(
      (
        await post(admins.hallToken, `/events-admin/hall-requests/${body.data.bookingId}/decision`, {
          decision: 'deny',
        })
      ).status,
    ).toBe(400);
    const denied = await post(
      admins.hallToken,
      `/events-admin/hall-requests/${body.data.bookingId}/decision`,
      { decision: 'deny', note: 'Maintenance that day' },
    );
    expect(denied.status).toBe(200);
    expect(
      (await get(ctx.tokens.LEADER, '/notifications')).body.data.some(
        (n) => n.type === 'hall.decision' && /Maintenance/.test(n.body),
      ),
    ).toBe(true);
    const again = await post(ctx.tokens.LEADER, `/events/${ev.id}/hall-request`, {});
    expect(again.status).toBe(201);
  });

  it('TC-RBAC-03 the OSI cannot decide hall requests', async () => {
    const admins = await makeAdmins(knex, app);
    expect(
      (await post(admins.osiToken, '/events-admin/hall-requests/x/decision', { decision: 'approve' })).status,
    ).toBe(403);
    expect((await get(admins.osiToken, '/events-admin/hall-requests')).status).toBe(403);
  });

  it('registration closes at its closing time (TC-REG-08) and the hold list is visible to the Events Authority', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const hall = await createHall(knex);
    const ev = await readyForFinalRequest(ctx, admins, hall.id, slot({ day: 20 }));
    const holds = await get(admins.hallToken, '/events-admin/hall-requests?status=tentative');
    expect(holds.body.data).toHaveLength(1);
    clock.set(new Date(Date.now() + 19.5 * 24 * 3600 * 1000));
    expect(await closeRegistrations(knex)).toBe(1);
    expect((await get(ctx.tokens.LEADER, `/events/${ev.id}`)).body.data.registrationStatus).toBe('closed');
  });
});
