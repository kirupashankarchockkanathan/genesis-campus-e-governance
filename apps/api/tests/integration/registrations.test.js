import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestDb, cleanDb } from '../helpers/db.js';
import { buildTestApp, bearer } from '../helpers/app.js';
import {
  API,
  approvedEvent,
  clubWithTeam,
  createDraftViaApi,
  createHall,
  makeAdmins,
  makeStudent,
  slot,
} from '../helpers/scenario.js';
import { clock } from '../../src/lib/clock.js';
import { markNoShows, sendReminders } from '../../src/jobs/index.js';
import { csvCell } from '../../src/lib/csv.js';

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
const put = (token, path, body) =>
  request(app)
    .put(`${API}${path}`)
    .set(bearer(token))
    .send(body ?? {});
const get = (token, path) => request(app).get(`${API}${path}`).set(bearer(token));

const FIELDS = [
  {
    id: 'team_pref',
    type: 'single_choice',
    label: 'Team preference',
    required: true,
    options: ['Solo', 'Team'],
  },
  { id: 'laptop', type: 'dropdown', label: 'Laptop', required: false, options: ['Yes', 'No'] },
  { id: 'age', type: 'number', label: 'Age', required: false, min: 16, max: 60 },
  { id: 'consent', type: 'consent', label: 'I agree to the code of conduct', required: true },
];

async function openEvent(over = {}, hallCap = 100) {
  const ctx = await clubWithTeam(knex, app);
  const admins = await makeAdmins(knex, app);
  const hall = await createHall(knex, { capacity: hallCap });
  const ev = await approvedEvent(app, ctx, admins, hall.id, over);
  return { ctx, admins, hall, ev };
}

describe('forms (FR-FORM-01..06)', () => {
  it('TC-FORM-01 every field type is saved and returned unchanged', async () => {
    const { ctx, ev } = await openEvent();
    const all = [
      { id: 'a', type: 'short_text', label: 'A', help: '', required: false },
      { id: 'b', type: 'long_text', label: 'B', help: '', required: false },
      { id: 'c', type: 'number', label: 'C', help: '', required: false },
      { id: 'd', type: 'email', label: 'D', help: '', required: false },
      { id: 'e', type: 'phone', label: 'E', help: '', required: false },
      { id: 'f', type: 'single_choice', label: 'F', help: '', required: false, options: ['x', 'y'] },
      { id: 'g', type: 'dropdown', label: 'G', help: '', required: false, options: ['x', 'y'] },
      { id: 'h', type: 'multi_choice', label: 'H', help: '', required: false, options: ['x', 'y'] },
      { id: 'i', type: 'date', label: 'I', help: '', required: false },
      { id: 'j', type: 'consent', label: 'J', help: '', required: true },
    ];
    const res = await put(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form`, {
      title: 'Registration',
      fields: all,
    });
    expect(res.status).toBe(200);
    const back = await get(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form`);
    expect(back.body.data.fields).toEqual(all);
  });

  it('TC-FORM-02 duplicate ids, an empty label or a one-option choice are 400', async () => {
    const { ctx, ev } = await openEvent();
    const t = ctx.tokens.EVENT_COORDINATOR;
    const bad = [
      [
        { id: 'a', type: 'short_text', label: 'A' },
        { id: 'a', type: 'short_text', label: 'B' },
      ],
      [{ id: 'a', type: 'short_text', label: '' }],
      [{ id: 'a', type: 'dropdown', label: 'A', options: ['only'] }],
    ];
    for (const fields of bad)
      expect((await put(t, `/events/${ev.id}/form`, { title: 'T', fields })).status).toBe(400);
  });

  it('TC-FORM-03 publishing before approval is 409', async () => {
    const ctx = await clubWithTeam(knex, app);
    const ev = await createDraftViaApi(app, ctx.tokens.LEADER, ctx.club.id);
    const res = await post(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form/publish`);
    expect(res.status).toBe(409);
  });

  it('TC-FORM-04/05 publishing sets seats to the held hall capacity; raising above it is 400; lowering is fine', async () => {
    const { ctx, ev } = await openEvent({}, 80);
    const raise = await post(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form/publish`, {
      maxSeats: 500,
    });
    expect(raise.status).toBe(400);
    const res = await post(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form/publish`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect((await get(ctx.tokens.MEMBER, `/events/${ev.id}`)).body.data.maxSeats).toBe(80);

    const second = await openEvent({}, 80);
    const lower = await post(second.ctx.tokens.EVENT_COORDINATOR, `/events/${second.ev.id}/form/publish`, {
      maxSeats: 30,
    });
    expect(lower.status).toBe(200);
    expect((await get(second.ctx.tokens.MEMBER, `/events/${second.ev.id}`)).body.data.maxSeats).toBe(30);
  });

  it('a published form cannot be replaced; a form can be duplicated from an older event of the same club', async () => {
    const { ctx, ev } = await openEvent();
    await put(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form`, { title: 'Reg', fields: FIELDS });
    await post(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form/publish`);
    expect(
      (await put(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form`, { title: 'Reg', fields: [] })).status,
    ).toBe(409);
    const next = await createDraftViaApi(app, ctx.tokens.LEADER, ctx.club.id, slot({ day: 30 }));
    const dup = await post(ctx.tokens.EVENT_COORDINATOR, `/events/${next.id}/form/duplicate`, {
      fromEventId: ev.id,
    });
    expect(dup.status).toBe(200);
    expect(dup.body.data.fields).toHaveLength(FIELDS.length);
    expect(
      (await put(ctx.tokens.MEDIA_LEAD, `/events/${next.id}/form`, { title: 'x', fields: [] })).status,
    ).toBe(403);
  });

  it('students cannot read a draft form', async () => {
    const { ctx, ev } = await openEvent();
    await put(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form`, { title: 'Reg', fields: FIELDS });
    const s = await makeStudent(knex, app);
    expect((await get(s.token, `/events/${ev.id}/form`)).status).toBe(404);
    await post(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form/publish`);
    expect((await get(s.token, `/events/${ev.id}/form`)).status).toBe(200);
  });
});

describe('registration (FR-REG-01..07)', () => {
  const ready = async (over, cap) => {
    const o = await openEvent(over, cap);
    await put(o.ctx.tokens.EVENT_COORDINATOR, `/events/${o.ev.id}/form`, { title: 'Reg', fields: FIELDS });
    await post(o.ctx.tokens.EVENT_COORDINATOR, `/events/${o.ev.id}/form/publish`);
    return o;
  };
  const good = { team_pref: 'Solo', laptop: 'Yes', consent: true };

  it('TC-REG-01 a student registers with valid answers and gets a QR token and a notification', async () => {
    const { ev } = await ready();
    const s = await makeStudent(knex, app);
    const res = await post(s.token, `/events/${ev.id}/register`, { answers: good });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('registered');
    const ticket = await get(s.token, `/me/registrations/${ev.id}/ticket`);
    expect(ticket.body.data.qrToken).toHaveLength(32);
    expect((await get(s.token, '/notifications')).body.data.map((n) => n.type)).toContain(
      'registration.confirmed',
    );
    expect((await get(s.token, `/events/${ev.id}`)).body.data.myRegistration.status).toBe('registered');
  });

  it('TC-REG-02 missing required answer, wrong type, out-of-range number and unknown option give 400 with field errors', async () => {
    const { ev } = await ready();
    const s = await makeStudent(knex, app);
    const cases = [
      [{ laptop: 'Yes', consent: true }, 'team_pref'],
      [{ team_pref: 'Solo', consent: false }, 'consent'],
      [{ ...good, age: 5 }, 'age'],
      [{ ...good, age: 'abc' }, 'age'],
      [{ ...good, team_pref: 'Duo' }, 'team_pref'],
    ];
    for (const [answers, field] of cases) {
      const res = await post(s.token, `/events/${ev.id}/register`, { answers });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.path)).toContain(field);
    }
  });

  it('TC-REG-03 before publish, after close, or after the event started gives REGISTRATION_CLOSED', async () => {
    const o = await openEvent();
    const s = await makeStudent(knex, app);
    const before = await post(s.token, `/events/${o.ev.id}/register`, { answers: {} });
    expect(before.status).toBe(409);
    expect(before.body.error.code).toBe('REGISTRATION_CLOSED');
    await post(o.ctx.tokens.EVENT_COORDINATOR, `/events/${o.ev.id}/form/publish`);
    await post(o.ctx.tokens.EVENT_COORDINATOR, `/events/${o.ev.id}/form/close`);
    expect((await post(s.token, `/events/${o.ev.id}/register`, { answers: {} })).body.error.code).toBe(
      'REGISTRATION_CLOSED',
    );
  });

  it('TC-REG-04 a second registration is ALREADY_REGISTERED', async () => {
    const { ev } = await ready();
    const s = await makeStudent(knex, app);
    await post(s.token, `/events/${ev.id}/register`, { answers: good });
    const again = await post(s.token, `/events/${ev.id}/register`, { answers: good });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_REGISTERED');
    expect(again.body.error.details.registration.status).toBe('registered');
  });

  it('TC-REG-05 a full event gives SEATS_FULL', async () => {
    const { ctx, ev } = await ready();
    await knex('events').where({ id: ev.id }).update({ max_seats: 1 });
    const a = await makeStudent(knex, app);
    const b = await makeStudent(knex, app);
    expect((await post(a.token, `/events/${ev.id}/register`, { answers: good })).status).toBe(201);
    const full = await post(b.token, `/events/${ev.id}/register`, { answers: good });
    expect(full.body.error.code).toBe('SEATS_FULL');
    expect(ctx.club.id).toBeTruthy();
  });

  it('TC-REG-06 30 students race for 10 seats: exactly 10 succeed', async () => {
    const { ev } = await ready();
    await knex('events').where({ id: ev.id }).update({ max_seats: 10 });
    const students = [];
    for (let i = 0; i < 30; i++) students.push(await makeStudent(knex, app));
    const results = await Promise.all(
      students.map((s) => post(s.token, `/events/${ev.id}/register`, { answers: good })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(10);
    expect(results.filter((r) => r.body.error?.code === 'SEATS_FULL')).toHaveLength(20);
    expect(await knex('registrations').where({ event_id: ev.id, status: 'registered' })).toHaveLength(10);
  }, 60000);

  it('TC-REG-07 cancelling frees the seat and the student can register again', async () => {
    const { ev } = await ready();
    await knex('events').where({ id: ev.id }).update({ max_seats: 1 });
    const a = await makeStudent(knex, app);
    const b = await makeStudent(knex, app);
    await post(a.token, `/events/${ev.id}/register`, { answers: good });
    expect((await post(b.token, `/events/${ev.id}/register`, { answers: good })).status).toBe(409);
    expect((await request(app).delete(`${API}/events/${ev.id}/register`).set(bearer(a.token))).status).toBe(
      200,
    );
    expect((await post(b.token, `/events/${ev.id}/register`, { answers: good })).status).toBe(201);
    expect((await request(app).delete(`${API}/events/${ev.id}/register`).set(bearer(b.token))).status).toBe(
      200,
    );
    expect((await post(a.token, `/events/${ev.id}/register`, { answers: good })).status).toBe(201);
    expect(await knex('registrations').where({ event_id: ev.id, user_id: a.user.id })).toHaveLength(1);
  });

  it('only students register: admin accounts are refused, club members (who are students) may register', async () => {
    const { ctx, admins, ev } = await ready();
    expect((await post(admins.osiToken, `/events/${ev.id}/register`, { answers: good })).status).toBe(403);
    expect((await post(ctx.tokens.MEMBER, `/events/${ev.id}/register`, { answers: good })).status).toBe(201);
  });

  it('TC-REG-09 registration.view sees answers; another member sees counts only (TC-RBAC-16)', async () => {
    const { ctx, ev } = await ready();
    const s = await makeStudent(knex, app);
    await post(s.token, `/events/${ev.id}/register`, { answers: good });
    const full = await get(ctx.tokens.SECRETARY, `/events/${ev.id}/registrations`);
    expect(full.body.data.items[0].answers.team_pref).toBe('Solo');
    expect(full.body.data.items[0].user.rollNumber).toBeTruthy();
    const counts = await get(ctx.tokens.MEMBER, `/events/${ev.id}/registrations`);
    expect(counts.status).toBe(200);
    expect(counts.body.data.items).toBeNull();
    expect(counts.body.data.counts.registered).toBe(1);
    expect((await get(ctx.tokens.MEMBER, `/events/${ev.id}/registrations/export`)).status).toBe(403);
    expect((await get(s.token, `/events/${ev.id}/registrations`)).status).toBe(403);
  });

  it('TC-RBAC-15 a student cannot read another student ticket', async () => {
    const { ev } = await ready();
    const a = await makeStudent(knex, app);
    const b = await makeStudent(knex, app);
    await post(a.token, `/events/${ev.id}/register`, { answers: good });
    expect((await get(b.token, `/me/registrations/${ev.id}/ticket`)).status).toBe(404);
  });

  it('TC-REG-10 CSV export has the right columns and neutralises formulas', async () => {
    const { ctx, ev } = await ready();
    const s = await makeStudent(knex, app, { full_name: '=HYPERLINK("http://evil","x")' });
    await post(s.token, `/events/${ev.id}/register`, { answers: good });
    const res = await get(ctx.tokens.LEADER, `/events/${ev.id}/registrations/export`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toBe(
      'Name,College email,Roll number,Department,Year,Status,Registered at,Team preference,Laptop,Age,I agree to the code of conduct',
    );
    expect(lines[1]).toContain(String.raw`"'=HYPERLINK(""http://evil"",""x"")"`);
    for (const c of ['=1', '+1', '-1', '@x']) expect(csvCell(c).startsWith("'")).toBe(true);
    expect(csvCell('a,b')).toBe('"a,b"');
  });

  it('TC-REG-11 check-in: valid, invalid, already used and another event QR', async () => {
    const { ctx, ev } = await ready();
    const other = await ready();
    const s = await makeStudent(knex, app);
    await post(s.token, `/events/${ev.id}/register`, { answers: good });
    const s2 = await makeStudent(knex, app);
    await post(s2.token, `/events/${other.ev.id}/register`, { answers: good });
    const token = (await get(s.token, `/me/registrations/${ev.id}/ticket`)).body.data.qrToken;
    const otherToken = (await get(s2.token, `/me/registrations/${other.ev.id}/ticket`)).body.data.qrToken;

    expect((await post(ctx.tokens.SECRETARY, `/events/${ev.id}/checkin`, { qrToken: token })).status).toBe(
      200,
    );
    const twice = await post(ctx.tokens.SECRETARY, `/events/${ev.id}/checkin`, { qrToken: token });
    expect(twice.status).toBe(409);
    expect(twice.body.error.message).toMatch(/already checked in/);
    expect(
      (await post(ctx.tokens.SECRETARY, `/events/${ev.id}/checkin`, { qrToken: 'not-a-real-token-xx' }))
        .status,
    ).toBe(404);
    expect(
      (await post(ctx.tokens.SECRETARY, `/events/${ev.id}/checkin`, { qrToken: otherToken })).status,
    ).toBe(404);
    expect((await post(ctx.tokens.MEDIA_LEAD, `/events/${ev.id}/checkin`, { qrToken: token })).status).toBe(
      403,
    );
  });

  it('TC-REG-12 after the event, registered students who did not check in become no_show; Activities shows Past', async () => {
    const { ctx, ev } = await ready();
    const present = await makeStudent(knex, app);
    const absent = await makeStudent(knex, app);
    await post(present.token, `/events/${ev.id}/register`, { answers: good });
    await post(absent.token, `/events/${ev.id}/register`, { answers: good });
    const tok = (await get(present.token, `/me/registrations/${ev.id}/ticket`)).body.data.qrToken;
    await post(ctx.tokens.SECRETARY, `/events/${ev.id}/checkin`, { qrToken: tok });

    const current = await get(absent.token, '/me/activities?scope=current');
    expect(current.body.data.registrations).toHaveLength(1);
    clock.set(new Date(Date.now() + 11 * 24 * 3600 * 1000));
    expect(await markNoShows(knex)).toBe(1);
    const pastAbsent = await get(absent.token, '/me/activities?scope=past');
    expect(pastAbsent.body.data.registrations[0].label).toBe('Missed');
    const pastPresent = await get(present.token, '/me/activities?scope=past');
    expect(pastPresent.body.data.registrations[0].label).toBe('Attended');
    expect((await get(absent.token, '/me/activities?scope=current')).body.data.registrations).toHaveLength(0);
  });

  it('TC-NOTIF-05 the reminder job run three times sends one reminder per registered student', async () => {
    const { ev } = await ready(slot({ day: 3 }));
    const s = await makeStudent(knex, app);
    await post(s.token, `/events/${ev.id}/register`, { answers: good });
    clock.set(new Date(Date.now() + 2.5 * 24 * 3600 * 1000));
    for (let i = 0; i < 3; i++) await sendReminders(knex);
    const reminders = (await get(s.token, '/notifications')).body.data.filter(
      (n) => n.type === 'event.reminder_24h',
    );
    expect(reminders).toHaveLength(1);
  });
});
