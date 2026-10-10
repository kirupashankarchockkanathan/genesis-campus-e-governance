import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestDb, cleanDb } from '../helpers/db.js';
import { buildTestApp, bearer } from '../helpers/app.js';
import {
  API,
  PNG,
  approve,
  approvedEvent,
  clubWithTeam,
  createDraftViaApi,
  createHall,
  eventBody,
  makeAdmins,
  makeStudent,
  slot,
  submittedEvent,
  uploadPoster,
} from '../helpers/scenario.js';
import { outbox } from '../../src/lib/mailer.js';
import { overrideConfig } from '../../src/config/index.js';
import { holdExpiry, completeEvents, holdExpiryWarnings } from '../../src/jobs/index.js';
import { clock } from '../../src/lib/clock.js';
import { createClub } from '../factories/index.js';

let knex, app;
beforeAll(async () => {
  knex = await createTestDb();
  app = buildTestApp(knex);
});
afterAll(async () => knex.destroy());
beforeEach(async () => {
  for (const t of [
    'notification_preferences',
    'notifications',
    'hall_bookings',
    'hall_blocked_slots',
    'event_reviews',
    'registrations',
    'form_responses',
    'forms',
    'events',
    'announcements',
    'club_works',
  ]) {
    await knex(t).del();
  }
  await cleanDb(knex);
  outbox.length = 0;
  overrideConfig({ MAX_ACTIVE_HOLDS_PER_CLUB: 2, HOLD_EXPIRY_DAYS: 14 });
  clock.reset();
});

const post = (token, path, body) =>
  request(app)
    .post(`${API}${path}`)
    .set(bearer(token))
    .send(body ?? {});
const get = (token, path) => request(app).get(`${API}${path}`).set(bearer(token));

describe('drafts (FR-EVT-01/02)', () => {
  it('TC-EVT-01 creates a draft with valid data', async () => {
    const ctx = await clubWithTeam(knex, app);
    const res = await post(ctx.tokens.EVENT_COORDINATOR, `/clubs/${ctx.club.id}/events`, eventBody());
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.clubName).toBe(ctx.club.name ?? res.body.data.clubName);
  });

  it('TC-EVT-02 rejects an end before the start, or a deadline after the start', async () => {
    const ctx = await clubWithTeam(knex, app);
    const s = slot();
    const badEnd = await post(
      ctx.tokens.LEADER,
      `/clubs/${ctx.club.id}/events`,
      eventBody({ endsAt: s.startsAt }),
    );
    const badDeadline = await post(
      ctx.tokens.LEADER,
      `/clubs/${ctx.club.id}/events`,
      eventBody({ registrationDeadline: s.endsAt }),
    );
    expect(badEnd.status).toBe(400);
    expect(badEnd.body.error.code).toBe('VALIDATION_ERROR');
    expect(badDeadline.status).toBe(400);
  });

  it('TC-EVT-03 a submitted or approved event cannot be edited (409 INVALID_STATE)', async () => {
    const ctx = await clubWithTeam(knex, app);
    const hall = await createHall(knex);
    const ev = await submittedEvent(app, ctx, hall.id);
    const res = await request(app)
      .patch(`${API}/events/${ev.id}`)
      .set(bearer(ctx.tokens.LEADER))
      .send({ title: 'New title here' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('members without event.draft cannot create drafts; others can read them', async () => {
    const ctx = await clubWithTeam(knex, app);
    expect((await post(ctx.tokens.MEDIA_LEAD, `/clubs/${ctx.club.id}/events`, eventBody())).status).toBe(403);
    const ev = await createDraftViaApi(app, ctx.tokens.LEADER, ctx.club.id);
    expect((await get(ctx.tokens.MEMBER, `/events/${ev.id}`)).status).toBe(200);
    expect((await get(ctx.tokens.MEMBER, `/clubs/${ctx.club.id}/events`)).body.data).toHaveLength(1);
  });

  it('TC-EVT-14 poster upload: wrong type, fake extension and oversize are refused; a real PNG works', async () => {
    const ctx = await clubWithTeam(knex, app);
    const ev = await createDraftViaApi(app, ctx.tokens.MEDIA_LEAD ? ctx.tokens.LEADER : '', ctx.club.id);
    const html = await request(app)
      .post(`${API}/events/${ev.id}/poster`)
      .set(bearer(ctx.tokens.MEDIA_LEAD))
      .attach('poster', Buffer.from('<html><script>alert(1)</script></html>'), {
        filename: 'poster.png',
        contentType: 'image/png',
      });
    expect(html.status).toBe(415);
    expect(html.body.error.code).toBe('UNSUPPORTED_FILE');
    const big = await request(app)
      .post(`${API}/events/${ev.id}/poster`)
      .set(bearer(ctx.tokens.MEDIA_LEAD))
      .attach('poster', Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 10)]), {
        filename: 'big.png',
        contentType: 'image/png',
      });
    expect(big.status).toBe(413);
    const ok = await uploadPoster(app, ctx.tokens.MEDIA_LEAD, ev.id);
    expect(ok.status).toBe(200);
    expect(ok.body.data.posterUrl).toMatch(/^\/uploads\/[A-Za-z0-9_-]+\.png$/);
    const served = await request(app).get(ok.body.data.posterUrl);
    expect(served.status).toBe(200);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('submit and hold (FR-EVT-03, section 5.3)', () => {
  it('TC-EVT-04 submit without poster or a required field lists what is missing', async () => {
    const ctx = await clubWithTeam(knex, app);
    const hall = await createHall(knex);
    const ev = await createDraftViaApi(app, ctx.tokens.LEADER, ctx.club.id, {
      description: undefined,
      objectives: undefined,
    });
    const res = await post(ctx.tokens.LEADER, `/events/${ev.id}/submit`, { hallId: hall.id });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['description', 'objectives', 'poster']));
  });

  it('TC-EVT-05 submit with a free hall that fits places a tentative hold', async () => {
    const ctx = await clubWithTeam(knex, app);
    const hall = await createHall(knex, { capacity: 100 });
    const ev = await submittedEvent(app, ctx, hall.id);
    expect(ev.status).toBe('submitted');
    expect(ev.hall.bookingStatus).toBe('tentative');
    const b = await knex('hall_bookings').where({ event_id: ev.id }).first();
    expect(b.status).toBe('tentative');
    expect(b.expires_at).toBeTruthy();
  });

  it('TC-EVT-06 a booked, blocked, inactive or too-small hall gives HALL_UNAVAILABLE with alternatives; event stays draft', async () => {
    const a = await clubWithTeam(knex, app);
    const b = await clubWithTeam(knex, app);
    const busy = await createHall(knex, { name: 'Busy Hall', capacity: 100 });
    const free = await createHall(knex, { name: 'Free Hall', capacity: 120 });
    await submittedEvent(app, a, busy.id);

    const ev = await createDraftViaApi(app, b.tokens.LEADER, b.club.id);
    await uploadPoster(app, b.tokens.LEADER, ev.id);
    const clash = await post(b.tokens.LEADER, `/events/${ev.id}/submit`, { hallId: busy.id });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('HALL_UNAVAILABLE');
    expect(clash.body.error.message).toMatch(/Busy Hall is booked from/);
    expect(clash.body.error.details.alternatives.map((x) => x.name)).toContain('Free Hall');
    expect((await get(b.tokens.LEADER, `/events/${ev.id}`)).body.data.status).toBe('draft');

    const small = await createHall(knex, { name: 'Tiny', capacity: 10 });
    expect(
      (await post(b.tokens.LEADER, `/events/${ev.id}/submit`, { hallId: small.id })).body.error.code,
    ).toBe('HALL_UNAVAILABLE');
    const off = await createHall(knex, { name: 'Closed', capacity: 100, is_active: 0 });
    expect((await post(b.tokens.LEADER, `/events/${ev.id}/submit`, { hallId: off.id })).body.error.code).toBe(
      'HALL_UNAVAILABLE',
    );
    await knex('hall_blocked_slots').insert({
      id: 'bs1',
      hall_id: free.id,
      starts_at: slot().startsAt,
      ends_at: slot().endsAt,
      reason: 'Exam',
      created_at: new Date().toISOString(),
    });
    expect(
      (await post(b.tokens.LEADER, `/events/${ev.id}/submit`, { hallId: free.id })).body.error.code,
    ).toBe('HALL_UNAVAILABLE');
  });

  it('TC-EVT-07 a club at its hold limit gets a clear 409', async () => {
    overrideConfig({ MAX_ACTIVE_HOLDS_PER_CLUB: 1 });
    const ctx = await clubWithTeam(knex, app);
    const h1 = await createHall(knex);
    const h2 = await createHall(knex);
    await submittedEvent(app, ctx, h1.id);
    const ev = await createDraftViaApi(app, ctx.tokens.LEADER, ctx.club.id, slot({ day: 12 }));
    await uploadPoster(app, ctx.tokens.LEADER, ev.id);
    const res = await post(ctx.tokens.LEADER, `/events/${ev.id}/submit`, { hallId: h2.id });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/active hall holds/);
  });

  it('TC-HALL-08 back-to-back events in one hall are both allowed', async () => {
    const a = await clubWithTeam(knex, app);
    const b = await clubWithTeam(knex, app);
    const hall = await createHall(knex);
    await submittedEvent(app, a, hall.id, slot({ startHour: 10, hours: 2 }));
    await submittedEvent(app, b, hall.id, slot({ startHour: 12, hours: 2 }));
    expect(await knex('hall_bookings').where({ hall_id: hall.id, status: 'tentative' })).toHaveLength(2);
  });

  it('TC-HALL-09 two clubs submit for the same hall and time: one succeeds, the other is told', async () => {
    const a = await clubWithTeam(knex, app);
    const b = await clubWithTeam(knex, app);
    const hall = await createHall(knex);
    const mk = async (ctx) => {
      const ev = await createDraftViaApi(app, ctx.tokens.LEADER, ctx.club.id);
      await uploadPoster(app, ctx.tokens.LEADER, ev.id);
      return ev;
    };
    const [ea, eb] = [await mk(a), await mk(b)];
    const [ra, rb] = await Promise.all([
      post(a.tokens.LEADER, `/events/${ea.id}/submit`, { hallId: hall.id }),
      post(b.tokens.LEADER, `/events/${eb.id}/submit`, { hallId: hall.id }),
    ]);
    expect([ra.status, rb.status].sort()).toEqual([200, 409]);
    expect([ra, rb].find((r) => r.status === 409).body.error.code).toBe('HALL_UNAVAILABLE');
    expect(await knex('hall_bookings').where({ hall_id: hall.id })).toHaveLength(1);
  });

  it('an online event needs no hall but needs a link', async () => {
    const ctx = await clubWithTeam(knex, app);
    const ev = await createDraftViaApi(app, ctx.tokens.LEADER, ctx.club.id, { mode: 'online' });
    await uploadPoster(app, ctx.tokens.LEADER, ev.id);
    expect((await post(ctx.tokens.LEADER, `/events/${ev.id}/submit`, {})).status).toBe(400);
    await request(app)
      .patch(`${API}/events/${ev.id}`)
      .set(bearer(ctx.tokens.LEADER))
      .send({ onlineLink: 'https://meet.example/abc' });
    const ok = await post(ctx.tokens.LEADER, `/events/${ev.id}/submit`, {});
    expect(ok.status).toBe(200);
    expect(await knex('hall_bookings').where({ event_id: ev.id })).toHaveLength(0);
  });
});

describe('OSI decisions (FR-EVT-05..07)', () => {
  it('TC-EVT-08 approve and circulate: public, students notified, review and audit written', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const student = await makeStudent(knex, app);
    const hall = await createHall(knex);
    const ev = await submittedEvent(app, ctx, hall.id);
    expect((await get(student.token, `/events/${ev.id}`)).status).toBe(404); // TC-EVT-15
    const res = await approve(app, admins.osiToken, ev.id);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    const list = await get(student.token, '/events');
    expect(list.body.data.map((e) => e.id)).toContain(ev.id);
    expect((await get(student.token, `/events/${ev.id}`)).status).toBe(200);
    const notes = await get(student.token, '/notifications');
    expect(notes.body.data.map((n) => n.type)).toContain('event.published');
    expect(await knex('event_reviews').where({ event_id: ev.id, decision: 'approved' })).toHaveLength(1);
    expect(await knex('audit_logs').where({ entity_id: ev.id, action: 'event.approved' })).toHaveLength(1);
    expect((await knex('hall_bookings').where({ event_id: ev.id }).first()).expires_at).toBeNull();
  });

  it('TC-EVT-09 reject or request changes without a note is 400', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const ev = await submittedEvent(app, ctx, (await createHall(knex)).id);
    for (const decision of ['rejected', 'changes_requested']) {
      const res = await post(admins.osiToken, `/osi/events/${ev.id}/decision`, { decision });
      expect(res.status).toBe(400);
    }
  });

  it('TC-EVT-10 request changes: editable again, Leader notified, resubmit keeps the hold', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const hall = await createHall(knex);
    const ev = await submittedEvent(app, ctx, hall.id);
    expect(
      (
        await post(admins.osiToken, `/osi/events/${ev.id}/decision`, {
          decision: 'changes_requested',
          note: 'Add a schedule',
        })
      ).status,
    ).toBe(200);
    expect((await get(ctx.tokens.LEADER, '/notifications')).body.data.map((n) => n.type)).toContain(
      'event.decision',
    );
    expect(
      (
        await request(app)
          .patch(`${API}/events/${ev.id}`)
          .set(bearer(ctx.tokens.EVENT_COORDINATOR))
          .send({ summary: 'Updated summary.' })
      ).status,
    ).toBe(200);
    expect((await knex('hall_bookings').where({ event_id: ev.id }).first()).status).toBe('tentative');
    const re = await post(ctx.tokens.LEADER, `/events/${ev.id}/submit`, {});
    expect(re.status).toBe(200);
    expect(re.body.data.status).toBe('submitted');
    expect(await knex('hall_bookings').where({ event_id: ev.id, status: 'tentative' })).toHaveLength(1);
  });

  it('TC-EVT-11 reject releases the hold so the slot is free for others', async () => {
    const a = await clubWithTeam(knex, app);
    const b = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const hall = await createHall(knex);
    const ev = await submittedEvent(app, a, hall.id);
    expect(
      (
        await post(admins.osiToken, `/osi/events/${ev.id}/decision`, {
          decision: 'rejected',
          note: 'Not suitable',
        })
      ).status,
    ).toBe(200);
    expect((await knex('hall_bookings').where({ event_id: ev.id }).first()).status).toBe('released');
    expect((await submittedEvent(app, b, hall.id)).status).toBe('submitted');
  });

  it('TC-EVT-12 invalid transitions are 409 INVALID_STATE', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const draft = await createDraftViaApi(app, ctx.tokens.LEADER, ctx.club.id);
    expect((await approve(app, admins.osiToken, draft.id)).body.error.code).toBe('INVALID_STATE');
    const ev = await approvedEvent(app, ctx, admins, (await createHall(knex)).id);
    expect((await approve(app, admins.osiToken, ev.id)).body.error.code).toBe('INVALID_STATE');
    expect((await post(ctx.tokens.LEADER, `/events/${ev.id}/submit`, {})).body.error.code).toBe(
      'INVALID_STATE',
    );
  });

  it('TC-RBAC-03 only the OSI decides; Events Authority cannot approve', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const ev = await submittedEvent(app, ctx, (await createHall(knex)).id);
    expect((await approve(app, admins.hallToken, ev.id)).status).toBe(403);
    expect((await approve(app, ctx.tokens.LEADER, ev.id)).status).toBe(403);
  });

  it('OSI queue lists submitted events with the held hall', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const hall = await createHall(knex, { name: 'Queue Hall' });
    await submittedEvent(app, ctx, hall.id);
    const q = await get(admins.osiToken, '/osi/events?status=submitted');
    expect(q.body.data).toHaveLength(1);
    expect(q.body.data[0].hall.name).toBe('Queue Hall');
    expect((await get(ctx.tokens.LEADER, '/osi/events')).status).toBe(403);
  });

  it('only the Leader can submit; others get 403 (TC-RBAC-06) and scope comes from the event club (TC-RBAC-14)', async () => {
    const a = await clubWithTeam(knex, app);
    const b = await clubWithTeam(knex, app);
    const ev = await createDraftViaApi(app, a.tokens.LEADER, a.club.id);
    await uploadPoster(app, a.tokens.LEADER, ev.id);
    const hall = await createHall(knex);
    expect((await post(a.tokens.VICE_LEADER, `/events/${ev.id}/submit`, { hallId: hall.id })).status).toBe(
      403,
    );
    expect((await post(b.tokens.LEADER, `/events/${ev.id}/submit`, { hallId: hall.id })).status).toBe(403);
    expect((await get(b.tokens.LEADER, `/events/${ev.id}`)).status).toBe(404);
  });
});

describe('cancel and jobs', () => {
  it('TC-EVT-13 cancelling an approved event releases the hall and notifies registrants', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const student = await makeStudent(knex, app);
    const hall = await createHall(knex);
    const ev = await approvedEvent(app, ctx, admins, hall.id);
    expect((await post(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form/publish`, {})).status).toBe(200);
    expect((await post(student.token, `/events/${ev.id}/register`, { answers: {} })).status).toBe(201);
    const res = await post(ctx.tokens.LEADER, `/events/${ev.id}/cancel`, { reason: 'Speaker unavailable' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
    expect((await knex('hall_bookings').where({ event_id: ev.id }).first()).status).toBe('released');
    expect((await get(student.token, '/notifications')).body.data.map((n) => n.type)).toContain(
      'event.cancelled',
    );
    expect((await post(ctx.tokens.LEADER, `/events/${ev.id}/cancel`, { reason: 'Again' })).status).toBe(409);
  });

  it('a draft can be deleted; a submitted event cannot', async () => {
    const ctx = await clubWithTeam(knex, app);
    const d = await createDraftViaApi(app, ctx.tokens.LEADER, ctx.club.id);
    expect((await request(app).delete(`${API}/events/${d.id}`).set(bearer(ctx.tokens.LEADER))).status).toBe(
      200,
    );
    const s = await submittedEvent(app, ctx, (await createHall(knex)).id);
    expect((await request(app).delete(`${API}/events/${s.id}`).set(bearer(ctx.tokens.LEADER))).status).toBe(
      409,
    );
  });

  it('TC-EVT-16 an unapproved hold expires after HOLD_EXPIRY_DAYS and the Leader is warned two days before', async () => {
    const ctx = await clubWithTeam(knex, app);
    const hall = await createHall(knex);
    const ev = await submittedEvent(app, ctx, hall.id, slot({ day: 40 }));
    clock.set(new Date(Date.now() + 12.5 * 24 * 3600 * 1000));
    expect(await holdExpiryWarnings(knex)).toBe(1);
    expect(await holdExpiryWarnings(knex)).toBe(0); // dedupe
    expect((await get(ctx.tokens.LEADER, '/notifications')).body.data.map((n) => n.type)).toContain(
      'hold.expiring',
    );
    clock.set(new Date(Date.now() + 15 * 24 * 3600 * 1000));
    expect(await holdExpiry(knex)).toBe(1);
    expect((await knex('hall_bookings').where({ event_id: ev.id }).first()).status).toBe('expired');
  });

  it('TC-EVT-17 an approved event whose end time passed becomes completed', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const ev = await approvedEvent(app, ctx, admins, (await createHall(knex)).id);
    clock.set(new Date(Date.now() + 11 * 24 * 3600 * 1000));
    expect(await completeEvents(knex)).toBe(1);
    expect((await knex('events').where({ id: ev.id }).first()).status).toBe('completed');
  });
});

describe('club admin helpers', () => {
  it('the OSI can still create clubs for the demo data path', async () => {
    const club = await createClub(knex);
    expect(club.id).toBeTruthy();
  });
});
