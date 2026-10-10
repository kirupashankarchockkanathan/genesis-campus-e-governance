import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { CLUB_ROLE_KEYS, DEFAULT_ROLE_PERMISSIONS, PERMISSION_KEYS } from '@ccp/shared';
import { createTestDb, cleanDb } from '../helpers/db.js';
import { buildTestApp, loginAs, bearer } from '../helpers/app.js';
import { createUser, createClub, addMemberWithRole } from '../factories/index.js';

let knex;
let app;
const API = '/api/v1';
const probe = (token, clubId, permission) =>
  request(app)
    .get(`${API}/_probe/club/${clubId}/${encodeURIComponent(permission)}`)
    .set(bearer(token));

beforeAll(async () => {
  knex = await createTestDb();
  app = buildTestApp(knex);
});
afterAll(async () => knex.destroy());
beforeEach(async () => cleanDb(knex));

describe('authentication and platform roles', () => {
  it('TC-RBAC-01 protected endpoints return 401 without a token', async () => {
    for (const path of ['/me', '/clubs', '/_probe/plain', '/_probe/osi']) {
      const res = await request(app).get(`${API}${path}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('TC-RBAC-02 a student cannot use OSI, Events Authority or club workspace endpoints', async () => {
    const student = await createUser(knex);
    const club = await createClub(knex);
    const t = await loginAs(app, student);
    expect((await request(app).get(`${API}/_probe/osi`).set(bearer(t))).status).toBe(403);
    expect((await request(app).get(`${API}/_probe/events-admin`).set(bearer(t))).status).toBe(403);
    expect((await probe(t, club.id, 'announcement.post')).status).toBe(403);
    expect((await request(app).get(`${API}/clubs/${club.id}/members`).set(bearer(t))).status).toBe(403);
  });

  it('TC-RBAC-03 OSI cannot act as Events Authority and vice versa', async () => {
    const osi = await createUser(knex, { platform_role: 'osi_admin' });
    const ev = await createUser(knex, { platform_role: 'events_admin' });
    const to = await loginAs(app, osi);
    const te = await loginAs(app, ev);
    expect((await request(app).get(`${API}/_probe/events-admin`).set(bearer(to))).status).toBe(403);
    expect((await request(app).get(`${API}/_probe/osi`).set(bearer(te))).status).toBe(403);
    expect((await request(app).get(`${API}/_probe/osi`).set(bearer(to))).status).toBe(200);
  });

  it('TC-RBAC-05 an unknown permission key is denied (deny by default)', async () => {
    const club = await createClub(knex);
    const t = await loginAs(app, club.leader);
    expect((await probe(t, club.id, 'made.up.permission')).status).toBe(403);
  });
});

describe('club scope', () => {
  it('TC-RBAC-04 Leader of Club A has no power in Club B', async () => {
    const a = await createClub(knex);
    const b = await createClub(knex);
    const t = await loginAs(app, a.leader);
    expect((await probe(t, a.id, 'event.submit')).status).toBe(200);
    expect((await probe(t, b.id, 'event.submit')).status).toBe(403);
    expect((await request(app).get(`${API}/clubs/${b.id}/members`).set(bearer(t))).status).toBe(403);
  });

  it('TC-RBAC-09 role changes and removal take effect on the very next request', async () => {
    const club = await createClub(knex);
    const media = await addMemberWithRole(knex, club, 'MEDIA_LEAD');
    const leaderToken = await loginAs(app, club.leader);
    const mediaToken = await loginAs(app, media);
    expect((await probe(mediaToken, club.id, 'announcement.post')).status).toBe(200);

    const changed = await request(app)
      .patch(`${API}/clubs/${club.id}/members/${media.id}`)
      .set(bearer(leaderToken))
      .send({ roleKey: 'MEMBER' });
    expect(changed.status).toBe(200);
    expect((await probe(mediaToken, club.id, 'announcement.post')).status).toBe(403);

    const removed = await request(app)
      .delete(`${API}/clubs/${club.id}/members/${media.id}`)
      .set(bearer(leaderToken));
    expect(removed.status).toBe(200);
    expect((await request(app).get(`${API}/clubs/${club.id}/members`).set(bearer(mediaToken))).status).toBe(
      403,
    );
  });

  it('TC-RBAC-10 table-driven: every club role x every permission matches the matrix', async () => {
    const club = await createClub(knex);
    const tokens = {};
    for (const role of CLUB_ROLE_KEYS) {
      const user = role === 'LEADER' ? club.leader : await addMemberWithRole(knex, club, role);
      tokens[role] = await loginAs(app, user);
    }
    const mismatches = [];
    for (const role of CLUB_ROLE_KEYS) {
      for (const permission of PERMISSION_KEYS) {
        const expected = DEFAULT_ROLE_PERMISSIONS[role].includes(permission) ? 200 : 403;
        const res = await probe(tokens[role], club.id, permission);
        if (res.status !== expected)
          mismatches.push(`${role} / ${permission}: expected ${expected}, got ${res.status}`);
      }
    }
    expect(mismatches).toEqual([]);
  }, 60000);

  it('TC-RBAC-06 only the Leader holds event.submit', async () => {
    const club = await createClub(knex);
    const expectations = { VICE_LEADER: 403, EVENT_COORDINATOR: 403, MEDIA_LEAD: 403, MEMBER: 403 };
    expect((await probe(await loginAs(app, club.leader), club.id, 'event.submit')).status).toBe(200);
    for (const [role, status] of Object.entries(expectations)) {
      const u = await addMemberWithRole(knex, club, role);
      expect((await probe(await loginAs(app, u), club.id, 'event.submit')).status).toBe(status);
    }
  });

  it('TC-RBAC-07 Media Lead: announcement and poster allowed; draft, form, hall request denied', async () => {
    const club = await createClub(knex);
    const t = await loginAs(app, await addMemberWithRole(knex, club, 'MEDIA_LEAD'));
    expect((await probe(t, club.id, 'announcement.post')).status).toBe(200);
    expect((await probe(t, club.id, 'event.poster.upload')).status).toBe(200);
    for (const p of ['event.draft', 'form.manage', 'hall.request'])
      expect((await probe(t, club.id, p)).status).toBe(403);
  });

  it('TC-RBAC-08 Secretary: recruitment and review allowed; member.manage denied', async () => {
    const club = await createClub(knex);
    const t = await loginAs(app, await addMemberWithRole(knex, club, 'SECRETARY'));
    expect((await probe(t, club.id, 'recruitment.manage')).status).toBe(200);
    expect((await probe(t, club.id, 'application.review')).status).toBe(200);
    expect((await probe(t, club.id, 'member.manage')).status).toBe(403);
  });
});

describe('leadership and /me', () => {
  it('TC-RBAC-11 leadership transfer leaves exactly one Leader who can submit events', async () => {
    const club = await createClub(knex);
    const vice = await addMemberWithRole(knex, club, 'VICE_LEADER');
    const leaderToken = await loginAs(app, club.leader);
    const res = await request(app)
      .post(`${API}/clubs/${club.id}/leadership-transfer`)
      .set(bearer(leaderToken))
      .send({ toUserId: vice.id });
    expect(res.status).toBe(200);
    expect((await probe(await loginAs(app, vice), club.id, 'event.submit')).status).toBe(200);
    expect((await probe(leaderToken, club.id, 'event.submit')).status).toBe(403);
    const leaderRole = await knex('club_roles').where({ club_id: club.id, key: 'LEADER' }).first();
    expect(
      await knex('club_members').where({ club_id: club.id, club_role_id: leaderRole.id, status: 'active' }),
    ).toHaveLength(1);
  });

  it('TC-RBAC-12 a Vice Leader cannot transfer leadership or remove the Leader', async () => {
    const club = await createClub(knex);
    const vice = await addMemberWithRole(knex, club, 'VICE_LEADER');
    const member = await addMemberWithRole(knex, club, 'MEMBER');
    const t = await loginAs(app, vice);
    expect(
      (
        await request(app)
          .post(`${API}/clubs/${club.id}/leadership-transfer`)
          .set(bearer(t))
          .send({ toUserId: member.id })
      ).status,
    ).toBe(403);
    expect(
      (await request(app).delete(`${API}/clubs/${club.id}/members/${club.leader.id}`).set(bearer(t))).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`${API}/clubs/${club.id}/members/${club.leader.id}`)
          .set(bearer(t))
          .send({ roleKey: 'MEMBER' })
      ).status,
    ).toBe(403);
  });

  it('TC-RBAC-13 /me lists each club with its own role and permission keys', async () => {
    const a = await createClub(knex, { name: 'Alpha Club' });
    const b = await createClub(knex, { name: 'Beta Club' });
    const user = await addMemberWithRole(knex, a, 'SECRETARY');
    const role = await knex('club_roles').where({ club_id: b.id, key: 'MEDIA_LEAD' }).first();
    await knex('club_members').insert({
      id: 'm2-' + b.id,
      club_id: b.id,
      user_id: user.id,
      club_role_id: role.id,
      status: 'active',
      joined_at: 't',
      added_via: 'direct',
      created_at: 't',
      updated_at: 't',
    });
    const res = await request(app)
      .get(`${API}/me`)
      .set(bearer(await loginAs(app, user)));
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.data.memberships.map((m) => [m.club.name, m]));
    expect(byName['Alpha Club'].roleKey).toBe('SECRETARY');
    expect(byName['Alpha Club'].permissions).toEqual([...DEFAULT_ROLE_PERMISSIONS.SECRETARY].sort());
    expect(byName['Beta Club'].roleKey).toBe('MEDIA_LEAD');
    expect(byName['Beta Club'].permissions).toEqual([...DEFAULT_ROLE_PERMISSIONS.MEDIA_LEAD].sort());
    expect(res.body.data.platformRole).toBe('student');
  });
});

describe('clubs API (FR-CLUB-01, FR-CLUB-04)', () => {
  it('OSI creates a club with six default roles and a Leader; students cannot', async () => {
    const osi = await createUser(knex, { platform_role: 'osi_admin' });
    const leader = await createUser(knex);
    const student = await createUser(knex);
    const body = { name: 'Chess Club', category: 'Other', description: 'Sample', leaderEmail: leader.email };
    expect(
      (
        await request(app)
          .post(`${API}/clubs`)
          .set(bearer(await loginAs(app, student)))
          .send(body)
      ).status,
    ).toBe(403);
    const res = await request(app)
      .post(`${API}/clubs`)
      .set(bearer(await loginAs(app, osi)))
      .send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('chess-club');
    const roles = await knex('club_roles').where({ club_id: res.body.data.id });
    expect(roles).toHaveLength(6);
    const dup = await request(app)
      .post(`${API}/clubs`)
      .set(bearer(await loginAs(app, osi)))
      .send(body);
    expect(dup.status).toBe(409);
  });

  it('lists clubs with search and category filter', async () => {
    const t = await loginAs(app, await createUser(knex));
    await createClub(knex, { name: 'Robotics Club' });
    await createClub(knex, { name: 'Music Club' });
    const all = await request(app).get(`${API}/clubs`).set(bearer(t));
    expect(all.body.data).toHaveLength(2);
    const q = await request(app).get(`${API}/clubs?q=robot`).set(bearer(t));
    expect(q.body.data.map((c) => c.name)).toEqual(['Robotics Club']);
    expect(q.body.data[0].memberCount).toBe(1);
  });
});

describe('API conventions', () => {
  it('health check reports the database; unknown routes return a stable NOT_FOUND error', async () => {
    const h = await request(app).get(`${API}/health`);
    expect(h.body.data).toEqual({ status: 'ok', database: 'up' });
    const nf = await request(app).get(`${API}/nope`);
    expect(nf.status).toBe(404);
    expect(nf.body.error.code).toBe('NOT_FOUND');
  });
  it('security headers are set and CORS refuses other origins', async () => {
    const res = await request(app).get(`${API}/health`).set('Origin', 'http://evil.example');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.example');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
