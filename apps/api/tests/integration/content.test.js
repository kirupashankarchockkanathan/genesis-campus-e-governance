import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestDb, cleanDb } from '../helpers/db.js';
import { buildTestApp, bearer, loginAs } from '../helpers/app.js';
import {
  API,
  approvedEvent,
  clubWithTeam,
  createDraftViaApi,
  createHall,
  makeAdmins,
  makeStudent,
  slot,
  submittedEvent,
} from '../helpers/scenario.js';
import { createUser, TEST_PASSWORD } from '../factories/index.js';
import { clock } from '../../src/lib/clock.js';
import { config } from '../../src/config/index.js';
import { notify } from '../../src/modules/notifications/notifications.service.js';
import { _resetStreamTokens } from '../../src/modules/notifications/notifications.routes.js';
import { subscribe } from '../../src/modules/notifications/hub.js';

let knex, app;
beforeAll(async () => {
  knex = await createTestDb();
  app = buildTestApp(knex);
});
afterAll(async () => knex.destroy());
beforeEach(async () => {
  await cleanDb(knex);
  clock.reset();
  _resetStreamTokens();
});

const send = (method) => (token, path, body) => {
  const r = request(app);
  return r[method](`${API}${path}`)
    .set(bearer(token))
    .send(body ?? {});
};
const post = send('post');
const patch = send('patch');
const put = send('put');
const del = (token, path) => request(app).delete(`${API}${path}`).set(bearer(token));
const get = (token, path) => request(app).get(`${API}${path}`).set(bearer(token));
const range = (from, to) =>
  `from=${encodeURIComponent(new Date(from).toISOString())}&to=${encodeURIComponent(new Date(to).toISOString())}`;
const DAY = 24 * 3600 * 1000;

describe('announcements (FR-ANN-01/02, TC-ANN-01)', () => {
  it('permissions follow the matrix; newest first with pinned on top; soft delete hides', async () => {
    const ctx = await clubWithTeam(knex, app);
    const student = await makeStudent(knex, app);
    expect(
      (await post(student.token, `/clubs/${ctx.club.id}/announcements`, { title: 'Hello', body: 'Hi' }))
        .status,
    ).toBe(403);
    expect(
      (
        await post(ctx.tokens.EVENT_COORDINATOR, `/clubs/${ctx.club.id}/announcements`, {
          title: 'Hello',
          body: 'Hi',
        })
      ).status,
    ).toBe(403);
    const a = await post(ctx.tokens.MEDIA_LEAD, `/clubs/${ctx.club.id}/announcements`, {
      title: 'First',
      body: 'one',
    });
    expect(a.status).toBe(201);
    clock.advance(1000);
    const b = await post(ctx.tokens.SECRETARY, `/clubs/${ctx.club.id}/announcements`, {
      title: 'Second',
      body: 'two',
    });
    await new Promise((r) => setTimeout(r, 5));
    let list = (await get(student.token, `/clubs/${ctx.club.id}/announcements`)).body.data;
    expect(list.map((x) => x.title)).toEqual(['Second', 'First']);

    expect(
      (await patch(ctx.tokens.MEDIA_LEAD, `/announcements/${a.body.data.id}`, { isPinned: true })).status,
    ).toBe(403); // pin needs announcement.delete
    expect(
      (await patch(ctx.tokens.SECRETARY, `/announcements/${a.body.data.id}`, { isPinned: true })).status,
    ).toBe(200);
    list = (await get(student.token, `/clubs/${ctx.club.id}/announcements`)).body.data;
    expect(list.map((x) => x.title)).toEqual(['First', 'Second']);
    expect(
      (await patch(ctx.tokens.MEDIA_LEAD, `/announcements/${a.body.data.id}`, { body: 'edited own' })).status,
    ).toBe(200);
    expect(
      (await patch(ctx.tokens.MEDIA_LEAD, `/announcements/${b.body.data.id}`, { body: 'not mine' })).status,
    ).toBe(403);

    expect((await del(ctx.tokens.MEMBER, `/announcements/${b.body.data.id}`)).status).toBe(403);
    expect((await del(ctx.tokens.SECRETARY, `/announcements/${b.body.data.id}`)).status).toBe(200);
    expect((await get(student.token, `/clubs/${ctx.club.id}/announcements`)).body.data).toHaveLength(1);
    expect(await knex('announcements').count('* as c').first()).toMatchObject({ c: 2 }); // soft delete keeps the row
  });

  it('scripts in announcement text are stored and returned as plain text', async () => {
    const ctx = await clubWithTeam(knex, app);
    const res = await post(ctx.tokens.LEADER, `/clubs/${ctx.club.id}/announcements`, {
      title: 'XSS?',
      body: '<script>alert(1)</script>',
    });
    expect(res.body.data.body).toBe('<script>alert(1)</script>');
  });

  it('TC-NOTIF-01 posting notifies favourite followers and members of that club only', async () => {
    const ctx = await clubWithTeam(knex, app);
    const other = await clubWithTeam(knex, app);
    const follower = await makeStudent(knex, app);
    const stranger = await makeStudent(knex, app);
    await post(follower.token, `/clubs/${ctx.club.id}/favourite`);
    await post(ctx.tokens.MEDIA_LEAD, `/clubs/${ctx.club.id}/announcements`, {
      title: 'News',
      body: 'Details',
    });
    const has = async (t) =>
      (await get(t, '/notifications')).body.data.some((n) => n.type === 'announcement.posted');
    expect(await has(follower.token)).toBe(true);
    expect(await has(ctx.tokens.MEMBER)).toBe(true);
    expect(await has(stranger.token)).toBe(false);
    expect(await has(other.tokens.MEMBER)).toBe(false);
  });
});

describe('club profile, works, favourites (FR-CLUB-03/05, TC-FAV-01)', () => {
  it('club.profile.edit edits About; club.works.manage manages Our work; students cannot', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    expect((await patch(ctx.tokens.MEDIA_LEAD, `/clubs/${ctx.club.id}`, { aim: 'A new aim' })).status).toBe(
      200,
    );
    expect((await patch(ctx.tokens.SECRETARY, `/clubs/${ctx.club.id}`, { aim: 'No' })).status).toBe(403);
    expect((await patch(admins.osiToken, `/clubs/${ctx.club.id}`, { tagline: 'OSI edit' })).status).toBe(200);
    const detail = await get(ctx.tokens.MEMBER, `/clubs/${ctx.club.id}`);
    expect(detail.body.data).toMatchObject({ aim: 'A new aim', tagline: 'OSI edit' });

    const w = await post(ctx.tokens.MEDIA_LEAD, `/clubs/${ctx.club.id}/works`, {
      title: 'Won the national cup',
      happenedOn: '2026-03-04',
    });
    expect(w.status).toBe(201);
    expect((await post(ctx.tokens.SECRETARY, `/clubs/${ctx.club.id}/works`, { title: 'No' })).status).toBe(
      403,
    );
    expect(
      (
        await patch(ctx.tokens.MEDIA_LEAD, `/clubs/${ctx.club.id}/works/${w.body.data.id}`, {
          title: 'Won the cup',
        })
      ).body.data.title,
    ).toBe('Won the cup');
    expect((await get(ctx.tokens.MEMBER, `/clubs/${ctx.club.id}/works`)).body.data).toHaveLength(1);
    expect((await del(ctx.tokens.MEDIA_LEAD, `/clubs/${ctx.club.id}/works/${w.body.data.id}`)).status).toBe(
      200,
    );
  });

  it('favourite and unfavourite are idempotent; /me/favourites shows updates', async () => {
    const ctx = await clubWithTeam(knex, app);
    const s = await makeStudent(knex, app);
    for (let i = 0; i < 2; i++)
      expect((await post(s.token, `/clubs/${ctx.club.id}/favourite`)).status).toBe(200);
    expect((await get(s.token, `/clubs/${ctx.club.id}`)).body.data.isFavourite).toBe(true);
    await post(ctx.tokens.LEADER, `/clubs/${ctx.club.id}/announcements`, { title: 'Latest', body: 'x' });
    const fav = await get(s.token, '/me/favourites');
    expect(fav.body.data).toHaveLength(1);
    expect(fav.body.data[0].announcements[0].title).toBe('Latest');
    for (let i = 0; i < 2; i++)
      expect((await del(s.token, `/clubs/${ctx.club.id}/favourite`)).status).toBe(200);
    expect((await get(s.token, '/me/favourites')).body.data).toHaveLength(0);
    expect((await get(ctx.tokens.LEADER, '/me/clubs')).body.data[0].roleKey).toBe('LEADER');
  });
});

describe('calendar (FR-CAL-01..06)', () => {
  it('TC-CAL-01/02 students see approved events of every club and never drafts or submitted events', async () => {
    const a = await clubWithTeam(knex, app);
    const b = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const student = await makeStudent(knex, app);
    const hall = await createHall(knex);
    const approvedA = await approvedEvent(app, a, admins, hall.id);
    await createDraftViaApi(app, b.tokens.LEADER, b.club.id, slot({ day: 11 }));
    await submittedEvent(app, b, (await createHall(knex)).id, slot({ day: 12 }));
    const res = await get(student.token, `/calendar?${range(Date.now(), Date.now() + 30 * DAY)}`);
    expect(res.status).toBe(200);
    const titles = res.body.data.filter((i) => i.kind === 'event');
    expect(titles.map((i) => i.id)).toEqual([approvedA.id]);
    expect(titles.every((i) => !i.private)).toBe(true);
  });

  it('TC-CAL-03 registered and favourite flags; filters work', async () => {
    const a = await clubWithTeam(knex, app);
    const b = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const s = await makeStudent(knex, app);
    const hall = await createHall(knex);
    const evA = await approvedEvent(app, a, admins, hall.id);
    const evB = await approvedEvent(app, b, admins, (await createHall(knex)).id, slot({ day: 12 }));
    await post(a.tokens.EVENT_COORDINATOR, `/events/${evA.id}/form/publish`);
    await post(s.token, `/events/${evA.id}/register`, { answers: {} });
    await post(s.token, `/clubs/${b.club.id}/favourite`);
    const q = range(Date.now(), Date.now() + 30 * DAY);
    const all = (await get(s.token, `/calendar?${q}`)).body.data.filter((i) => i.kind === 'event');
    expect(all.find((i) => i.id === evA.id)).toMatchObject({ registered: true, favourite: false });
    expect(all.find((i) => i.id === evB.id)).toMatchObject({ registered: false, favourite: true });
    expect(
      (await get(s.token, `/calendar?${q}&filter=registrations`)).body.data
        .filter((i) => i.kind === 'event')
        .map((i) => i.id),
    ).toEqual([evA.id]);
    expect(
      (await get(s.token, `/calendar?${q}&filter=favourites`)).body.data
        .filter((i) => i.kind === 'event')
        .map((i) => i.id),
    ).toEqual([evB.id]);
    expect((await get(s.token, `/calendar?${q}&filter=clubs`)).body.data).toHaveLength(0);
    // TC-CAL-07 registration deadline appears as a deadline item
    expect(all.length).toBe(2);
    const deadlines = (await get(s.token, `/calendar?${q}`)).body.data.filter((i) => i.kind === 'deadline');
    expect(deadlines).toHaveLength(1);
  });

  it('TC-CAL-04/05 members also see private club items; OSI sees pending approvals; Events Authority sees holds', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const hall = await createHall(knex);
    await createDraftViaApi(app, ctx.tokens.LEADER, ctx.club.id, slot({ day: 11 }));
    const sub = await submittedEvent(app, ctx, hall.id);
    const q = range(Date.now(), Date.now() + 30 * DAY);
    const mine = (await get(ctx.tokens.MEMBER, `/calendar?${q}`)).body.data;
    expect(mine.filter((i) => i.private)).toHaveLength(2);
    expect(mine.filter((i) => i.private).every((i) => i.mine)).toBe(true);
    const osi = (await get(admins.osiToken, `/calendar?${q}`)).body.data;
    expect(osi.find((i) => i.id === sub.id)).toMatchObject({ status: 'pending_approval' });
    const hallCal = (await get(admins.hallToken, `/calendar?${q}`)).body.data;
    expect(hallCal.some((i) => i.kind === 'hold')).toBe(true);
  });

  it('TC-CAL-06 an event at 00:30 and one at 23:30 IST fall on the correct local day (UTC in the API)', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const day = new Date(Date.now() + 10 * DAY);
    const s1 = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 19, 0)); // 00:30 IST next day
    const s2 = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 18, 0)); // 23:30 IST same day
    const hall1 = await createHall(knex);
    const hall2 = await createHall(knex);
    const mkEv = (start, hall) => ({
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 1800 * 1000).toISOString(),
      registrationDeadline: new Date(start.getTime() - DAY).toISOString(),
      hall,
    });
    const e1 = mkEv(s1);
    const e2 = mkEv(s2);
    const ev1 = await approvedEvent(app, ctx, admins, hall1.id, {
      startsAt: e1.startsAt,
      endsAt: e1.endsAt,
      registrationDeadline: e1.registrationDeadline,
    });
    const ev2 = await approvedEvent(app, ctx, admins, hall2.id, {
      startsAt: e2.startsAt,
      endsAt: e2.endsAt,
      registrationDeadline: e2.registrationDeadline,
    });
    const s = await makeStudent(knex, app);
    const items = (
      await get(s.token, `/calendar?${range(Date.now(), Date.now() + 30 * DAY)}`)
    ).body.data.filter((i) => i.kind === 'event');
    const local = (iso) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: config.APP_TIMEZONE }).format(new Date(iso));
    const d1 = local(items.find((i) => i.id === ev1.id).startsAt);
    const d2 = local(items.find((i) => i.id === ev2.id).startsAt);
    expect(d1).not.toBe(d2);
    expect(new Date(d1).getTime() - new Date(d2).getTime()).toBe(DAY);
  });
});

describe('notifications (FR-NOTIF-01..05)', () => {
  it('TC-NOTIF-02/03 category switched off skips in-app copy except mandatory ones; unread count, read, read-all', async () => {
    const s = await makeStudent(knex, app);
    await put(s.token, '/me/notification-preferences', {
      preferences: [
        { category: 'events', inApp: false },
        { category: 'my_activity', inApp: false },
      ],
    });
    await notify(knex, { userIds: [s.user.id], type: 'event.published', title: 'Event', route: '/events/1' });
    await notify(knex, {
      userIds: [s.user.id],
      type: 'registration.confirmed',
      title: 'Confirmed',
      route: '/events/1',
    });
    await notify(knex, {
      userIds: [s.user.id],
      type: 'recruitment.opened',
      title: 'Recruiting',
      route: '/clubs/x',
    });
    const list = (await get(s.token, '/notifications')).body.data;
    expect(list.map((n) => n.type).sort()).toEqual(['recruitment.opened', 'registration.confirmed']);
    expect((await get(s.token, '/notifications/unread-count')).body.data.count).toBe(2);
    expect((await post(s.token, `/notifications/${list[0].id}/read`)).status).toBe(200);
    expect((await get(s.token, '/notifications/unread-count')).body.data.count).toBe(1);
    await post(s.token, '/notifications/read-all');
    expect((await get(s.token, '/notifications/unread-count')).body.data.count).toBe(0);
    const prefs = (await get(s.token, '/me/notification-preferences')).body.data;
    expect(prefs.find((p) => p.category === 'my_activity')).toMatchObject({ inApp: true, mandatory: true });
    expect(prefs.find((p) => p.category === 'events').inApp).toBe(false);
  });

  it('TC-NOTIF-04 a user cannot read or mark another user notification', async () => {
    const a = await makeStudent(knex, app);
    const b = await makeStudent(knex, app);
    const [row] = await notify(knex, { userIds: [a.user.id], type: 'recruitment.opened', title: 'x' });
    expect((await post(b.token, `/notifications/${row.id}/read`)).status).toBe(404);
    expect((await get(b.token, '/notifications')).body.data).toHaveLength(0);
  });

  it('TC-NOTIF-06 stream token: refused when expired, reused or forged', async () => {
    const s = await makeStudent(knex, app);
    const tokenRes = await post(s.token, '/notifications/stream-token');
    expect(tokenRes.status).toBe(200);
    const { token } = tokenRes.body.data;
    const expired = jwt.sign({ sub: s.user.id, purpose: 'stream', jti: 'j1' }, config.JWT_SECRET, {
      expiresIn: -5,
    });
    const wrongPurpose = jwt.sign({ sub: s.user.id, jti: 'j2' }, config.JWT_SECRET, { expiresIn: 60 });
    expect((await request(app).get(`${API}/notifications/stream?token=${expired}`)).status).toBe(401);
    expect((await request(app).get(`${API}/notifications/stream?token=${wrongPurpose}`)).status).toBe(401);
    expect((await request(app).get(`${API}/notifications/stream?token=garbage`)).status).toBe(401);
    expect((await request(app).get(`${API}/notifications/stream`)).status).toBe(401);
    expect(token).toBeTruthy();
  });

  it('TC-NOTIF-07 a notification is pushed to a subscribed stream immediately', async () => {
    const s = await makeStudent(knex, app);
    const received = [];
    const off = subscribe(s.user.id, (n) => received.push(n));
    const t0 = Date.now();
    await notify(knex, {
      userIds: [s.user.id],
      type: 'recruitment.opened',
      title: 'Live',
      route: '/clubs/x',
    });
    off();
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ title: 'Live', route: '/clubs/x', read: false });
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});

describe('public page, profile and admin (TC-SHARE-01, TC-PROF-01)', () => {
  it('TC-SHARE-01 public event page has no personal data and 404s for non-approved events', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const hall = await createHall(knex);
    const sub = await submittedEvent(app, ctx, hall.id);
    expect((await request(app).get(`${API}/public/events/${sub.id}`)).status).toBe(404);
    await post(admins.osiToken, `/osi/events/${sub.id}/decision`, { decision: 'approved' });
    const res = await request(app).get(`${API}/public/events/${sub.id}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual([
      'clubName',
      'endsAt',
      'id',
      'mode',
      'posterUrl',
      'startsAt',
      'status',
      'summary',
      'title',
      'venue',
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/email|roll|@campus/);
  });

  it('TC-PROF-01 a student edits allowed profile fields; username and email stay', async () => {
    const s = await makeStudent(knex, app);
    const res = await patch(s.token, '/me/profile', {
      fullName: 'New Name',
      department: 'ECE',
      yearOfStudy: 3,
      phone: '9999999999',
      username: 'hacker',
      email: 'x@campus.example',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      fullName: 'New Name',
      department: 'ECE',
      yearOfStudy: 3,
      phone: '9999999999',
      username: s.user.username,
      email: s.user.email,
    });
  });

  it('Super Admin creates admin accounts (forced password change), suspends them, and reads the audit log', async () => {
    const admins = await makeAdmins(knex, app);
    const s = await makeStudent(knex, app);
    expect((await get(s.token, '/admin/users')).status).toBe(403);
    expect((await get(admins.osiToken, '/admin/audit-logs')).status).toBe(403);
    const created = await post(admins.superToken, '/admin/users', {
      fullName: 'New OSI',
      email: 'newosi@campus.example',
      username: 'new_osi',
      role: 'osi_admin',
      temporaryPassword: 'Temp-Passw0rd-1',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.mustChangePassword).toBe(true);
    expect(
      (
        await post(admins.superToken, '/admin/users', {
          fullName: 'Dup',
          email: 'newosi@campus.example',
          username: 'dupe_x',
          role: 'osi_admin',
          temporaryPassword: 'Temp-Passw0rd-1',
        })
      ).status,
    ).toBe(409);
    const login = await request(app)
      .post(`${API}/auth/login`)
      .send({ identifier: 'new_osi', password: 'Temp-Passw0rd-1' });
    expect(login.body.data.user.mustChangePassword).toBe(true);
    const sus = await patch(admins.superToken, `/admin/users/${created.body.data.id}`, {
      status: 'suspended',
    });
    expect(sus.body.data.status).toBe('suspended');
    expect((await get(login.body.data.accessToken, '/me')).status).toBe(401);
    expect(
      (await patch(admins.superToken, `/admin/users/${admins.superAdmin.id}`, { status: 'suspended' }))
        .status,
    ).toBe(403);
    const audit = await get(admins.superToken, '/admin/audit-logs?entityType=user');
    expect(audit.body.data.map((a) => a.action)).toEqual(
      expect.arrayContaining(['admin.created', 'admin.suspended']),
    );
    expect((await get(admins.superToken, '/admin/users?role=osi_admin')).body.data.length).toBeGreaterThan(0);
  });

  it('role changes are written to the audit log (spec 3.5 rule 8)', async () => {
    const ctx = await clubWithTeam(knex, app);
    await patch(ctx.tokens.LEADER, `/clubs/${ctx.club.id}/members/${ctx.team.MEMBER.id}`, {
      roleKey: 'SECRETARY',
    });
    expect(await knex('audit_logs').where({ action: 'member.role_changed' })).toHaveLength(1);
    const u = await createUser(knex);
    expect(await loginAs(app, u, TEST_PASSWORD)).toBeTruthy();
  });
});
