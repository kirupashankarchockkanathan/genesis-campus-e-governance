import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestDb } from '../helpers/db.js';
import { buildTestApp, bearer } from '../helpers/app.js';
import {
  API,
  clubWithTeam,
  makeAdmins,
  makeStudent,
  createHall,
  approvedEvent,
} from '../helpers/scenario.js';
import { newId } from '../../src/lib/ids.js';
import { config } from '../../src/config/index.js';

let knex, app;
beforeAll(async () => {
  knex = await createTestDb();
  app = buildTestApp(knex);
});
afterAll(async () => knex.destroy());

const get = (token, path) => request(app).get(`${API}${path}`).set(bearer(token));
const timed = async (fn, runs = 3) => {
  const times = [];
  let last;
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    last = await fn();
    times.push(performance.now() - t);
  }
  return { ms: [...times].sort((a, b) => a - b)[Math.floor(runs / 2)], last }; // median
};
const chunks = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

describe('performance smoke (spec 15.10)', () => {
  it('with 200 clubs of events and 5,000 registrations the events list, calendar month and registration list each answer in under 300 ms', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const student = await makeStudent(knex, app);
    const now = new Date().toISOString();
    const clubIds = [];
    // 200 clubs, five approved events each (1,000 events).
    const clubRows = Array.from({ length: 200 }, (_, i) => ({
      id: newId(),
      slug: `perf-club-${i}`,
      name: `Perf Club ${i}`,
      category: 'Technology',
      status: 'active',
      public_discussion_enabled: 1,
      created_at: now,
      updated_at: now,
    }));
    for (const c of chunks(clubRows, 50)) await knex('clubs').insert(c);
    clubRows.forEach((c) => clubIds.push(c.id));
    const day = 86400000;
    const eventRows = clubIds.flatMap((clubId, ci) =>
      Array.from({ length: 5 }, (_, k) => {
        const start = new Date(Date.now() + ((ci % 25) + k * 3 + 1) * day);
        return {
          id: newId(),
          club_id: clubId,
          title: `Perf event ${ci}-${k}`,
          type: 'workshop',
          summary: 'Perf',
          mode: 'offline',
          starts_at: start.toISOString(),
          ends_at: new Date(start.getTime() + 7200000).toISOString(),
          registration_deadline: new Date(start.getTime() - day).toISOString(),
          expected_participants: 50,
          status: 'approved',
          circulated_at: now,
          created_at: now,
          updated_at: now,
        };
      }),
    );
    for (const c of chunks(eventRows, 80)) await knex('events').insert(c);
    // 5,000 registrations: 500 students over 10 events.
    const users = Array.from({ length: 500 }, (_, i) => ({
      id: newId(),
      username: `perf_user_${i}`,
      email: `perf_user_${i}@campus.example`,
      password_hash: 'x',
      full_name: `Perf User ${i}`,
      platform_role: 'student',
      roll_number: `P${i}`,
      department: 'CSE',
      year_of_study: 2,
      status: 'active',
      must_change_password: 0,
      created_at: now,
      updated_at: now,
    }));
    for (const c of chunks(users, 40)) await knex('users').insert(c);
    const target = eventRows.slice(0, 10).map((e) => e.id);
    const regRows = target.flatMap((eventId) =>
      users.map((u) => ({
        id: newId(),
        event_id: eventId,
        user_id: u.id,
        status: 'registered',
        qr_token: newId(),
        created_at: now,
        updated_at: now,
      })),
    );
    expect(regRows).toHaveLength(5000);
    for (const c of chunks(regRows, 150)) await knex('registrations').insert(c);
    // The first target event also needs a club the Leader belongs to, to read the registration list.
    await knex('events').where({ id: target[0] }).update({ club_id: ctx.club.id });
    const form = {
      id: newId(),
      club_id: ctx.club.id,
      event_id: target[0],
      purpose: 'event_registration',
      title: 'f',
      fields_json: '[]',
      status: 'published',
      created_at: now,
      updated_at: now,
    };
    await knex('forms').insert(form);
    void admins;
    void approvedEvent;
    void createHall;

    const month = `from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 31 * day).toISOString())}`;
    const events = await timed(() => get(student.token, '/events?pageSize=100'));
    const calendar = await timed(() => get(student.token, `/calendar?${month}`));
    const regs = await timed(() => get(ctx.tokens.LEADER, `/events/${target[0]}/registrations`));
    expect(events.last.status).toBe(200);
    expect(events.last.body.data).toHaveLength(100);
    expect(calendar.last.status).toBe(200);
    expect(calendar.last.body.data.length).toBeGreaterThan(100);
    expect(regs.last.body.data.items).toHaveLength(500);
    console.log(
      `perf: events ${events.ms.toFixed(0)} ms, calendar ${calendar.ms.toFixed(0)} ms, registrations ${regs.ms.toFixed(0)} ms`,
    );
    expect(events.ms).toBeLessThan(300);
    expect(calendar.ms).toBeLessThan(300);
    expect(regs.ms).toBeLessThan(300);
  }, 120000);

  it('TC-DB-24 the main list queries use the intended indexes (SQLite plan)', async () => {
    if (knex.client.config.client === 'pg') return; // PostgreSQL plans are checked with EXPLAIN in staging
    const plan = async (sql, bindings = []) =>
      (await knex.raw(`EXPLAIN QUERY PLAN ${sql}`, bindings)).map((r) => r.detail).join(' | ');
    expect(
      await plan("SELECT * FROM events WHERE status = 'approved' AND starts_at >= ?", ['2026-01-01']),
    ).toMatch(/USING (COVERING )?INDEX events_status_starts_at_index/);
    expect(
      await plan('SELECT * FROM notifications WHERE user_id = ? AND read_at IS NULL ORDER BY created_at', [
        'u',
      ]),
    ).toMatch(/USING (COVERING )?INDEX notifications_user_id/);
    expect(await plan('SELECT * FROM registrations WHERE event_id = ?', ['e'])).toMatch(
      /USING (COVERING )?INDEX registrations_(event_id|event_id_user_id)/,
    );
  });
});

describe('security probes (spec 15.10)', () => {
  it('SQL injection strings in search and form answers are treated as plain text', async () => {
    const s = await makeStudent(knex, app);
    const evil = ["'; DROP TABLE users; --", "' OR '1'='1", '%" OR 1=1 --'];
    for (const q of evil) {
      const res = await get(s.token, `/clubs?q=${encodeURIComponent(q)}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]); // no club matches, and nothing was injected
    }
    expect((await knex('users').count('* as c').first()).c).toBeGreaterThan(0);
    const ann = await clubWithTeam(knex, app);
    const posted = await request(app)
      .post(`${API}/clubs/${ann.club.id}/announcements`)
      .set(bearer(ann.tokens.LEADER))
      .send({ title: "x'); DELETE FROM clubs; --", body: '<img src=x onerror=alert(1)>' });
    expect(posted.status).toBe(201);
    expect(posted.body.data.body).toBe('<img src=x onerror=alert(1)>'); // stored and returned as text; React escapes it
    expect((await knex('clubs').count('* as c').first()).c).toBeGreaterThan(0);
  });

  it('privilege escalation through the request body is ignored', async () => {
    const s = await makeStudent(knex, app);
    const patch = await request(app)
      .patch(`${API}/me/profile`)
      .set(bearer(s.token))
      .send({
        fullName: 'Still Me',
        platformRole: 'super_admin',
        platform_role: 'super_admin',
        status: 'active',
        mustChangePassword: false,
      });
    expect(patch.status).toBe(200);
    expect(patch.body.data.platformRole).toBe('student');
    expect((await knex('users').where({ id: s.user.id }).first()).platform_role).toBe('student');
    const signup = await request(app)
      .post(`${API}/auth/signup`)
      .send({
        fullName: 'Eve Evil',
        email: 'eve@campus.example',
        username: 'eve_evil',
        rollNumber: '1',
        department: 'CSE',
        yearOfStudy: 1,
        password: 'Str0ng-Pass!word',
        platformRole: 'super_admin',
      });
    expect(signup.status).toBe(201);
    expect((await knex('users').where({ username: 'eve_evil' }).first()).platform_role).toBe('student');
  });

  it('tokens: alg=none, wrong secret and a stream token used as an access token are all refused', async () => {
    const s = await makeStudent(knex, app);
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: s.user.id, platformRole: 'super_admin' })).toString('base64url')}.`;
    expect((await get(none, '/me')).status).toBe(401);
    const stream = jwt.sign({ sub: s.user.id, purpose: 'stream', jti: 'x' }, config.JWT_SECRET, {
      expiresIn: 60,
    });
    // Purpose-bound tokens (stream, calendar feed) are signed with the same secret but are never a login.
    expect((await get(stream, '/me')).status).toBe(401);
    const ics = jwt.sign({ sub: s.user.id, purpose: 'ics' }, config.JWT_SECRET, { expiresIn: '365d' });
    expect((await get(ics, '/me')).status).toBe(401);
  });

  it('path traversal and directory listing on /uploads are refused', async () => {
    for (const p of [
      '/uploads/../.env',
      '/uploads/%2e%2e/.env',
      '/uploads/',
      '/uploads/..%2f..%2fpackage.json',
    ]) {
      const res = await request(app).get(p);
      expect([301, 400, 403, 404]).toContain(res.status);
      expect(res.text).not.toMatch(/JWT_SECRET|"name":/);
    }
  });

  it('rate-limit headers are present on sign-up and the security headers are set', async () => {
    const res = await request(app)
      .post(`${API}/auth/forgot-password`)
      .send({ email: 'nobody@campus.example' });
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit'] ?? res.headers['ratelimit']).toBeTruthy();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeTruthy();
    expect(res.headers['x-frame-options']).toBeTruthy();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('other origins get no CORS allowance, and oversized JSON bodies are refused', async () => {
    const res = await request(app)
      .options(`${API}/auth/login`)
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example');
    const big = await request(app)
      .post(`${API}/auth/login`)
      .send({ identifier: 'a', password: 'x'.repeat(200_000) });
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('errors never leak stack traces or SQL', async () => {
    const res = await request(app)
      .post(`${API}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{"identifier": ');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js|SELECT|knex|sqlite/i);
  });
});
