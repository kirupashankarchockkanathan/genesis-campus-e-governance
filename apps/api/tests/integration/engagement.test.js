import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestDb, cleanDb } from '../helpers/db.js';
import { buildTestApp, bearer } from '../helpers/app.js';
import {
  API,
  PNG,
  approvedEvent,
  clubWithTeam,
  createHall,
  makeAdmins,
  makeStudent,
} from '../helpers/scenario.js';
import { clock } from '../../src/lib/clock.js';
import { outbox } from '../../src/lib/mailer.js';
import { closeExpired } from '../../src/modules/recruitment/recruitment.service.js';
import { _resetPostingLimit } from '../../src/modules/discussions/discussions.service.js';
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
  outbox.length = 0;
  _resetPostingLimit();
});

const call = (method) => (token, path, body) => {
  const r = request(app);
  return r[method](`${API}${path}`)
    .set(bearer(token))
    .send(body ?? {});
};
const post = call('post');
const patch = call('patch');
const put = call('put');
const get = (token, path) => request(app).get(`${API}${path}`).set(bearer(token));
const del = (token, path) => request(app).delete(`${API}${path}`).set(bearer(token));
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

const recruitmentBody = (over = {}) => ({
  title: 'Autumn recruitment',
  description: 'Join us',
  deadline: inDays(10),
  positions: [{ title: 'Designer', description: 'Posters', openings: 2 }],
  fields: [{ id: 'why', type: 'long_text', label: 'Why do you want to join?', required: true }],
  ...over,
});

async function openRecruitment(ctx, over) {
  const created = await post(
    ctx.tokens.SECRETARY,
    `/clubs/${ctx.club.id}/recruitments`,
    recruitmentBody(over),
  );
  expect(created.status).toBe(201);
  const opened = await post(ctx.tokens.SECRETARY, `/recruitments/${created.body.data.id}/open`);
  expect(opened.status).toBe(200);
  return opened.body.data;
}

describe('recruitment (FR-REC-01..06)', () => {
  it('TC-REC-01 create and open a recruitment with positions: visible to students with a Register option', async () => {
    const ctx = await clubWithTeam(knex, app);
    const s = await makeStudent(knex, app);
    const created = await post(ctx.tokens.SECRETARY, `/clubs/${ctx.club.id}/recruitments`, recruitmentBody());
    expect((await get(s.token, `/clubs/${ctx.club.id}/recruitments`)).body.data).toHaveLength(0); // draft is hidden
    expect((await post(ctx.tokens.SECRETARY, `/recruitments/${created.body.data.id}/open`)).status).toBe(200);
    const list = await get(s.token, `/clubs/${ctx.club.id}/recruitments`);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ acceptingApplications: true, status: 'open' });
    expect(list.body.data[0].positions[0].title).toBe('Designer');
    expect((await get(s.token, '/notifications')).body.data.map((n) => n.type)).toContain(
      'recruitment.opened',
    );
    expect(
      (await post(ctx.tokens.MEDIA_LEAD, `/clubs/${ctx.club.id}/recruitments`, recruitmentBody())).status,
    ).toBe(403);
    expect((await get(ctx.tokens.MEMBER, `/clubs/${ctx.club.id}/recruitments`)).body.data).toHaveLength(1);
  });

  it('TC-REC-02 applying after the deadline or when closed is 409', async () => {
    const ctx = await clubWithTeam(knex, app);
    const s = await makeStudent(knex, app);
    const r = await openRecruitment(ctx);
    clock.set(new Date(Date.now() + 11 * 86400000));
    const late = await post(s.token, `/recruitments/${r.id}/apply`, { answers: { why: 'Because' } });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('REGISTRATION_CLOSED');
    clock.reset();
    await post(ctx.tokens.SECRETARY, `/recruitments/${r.id}/close`);
    expect((await post(s.token, `/recruitments/${r.id}/apply`, { answers: { why: 'Because' } })).status).toBe(
      409,
    );
    expect(await closeExpired(knex)).toBe(0);
  });

  it('TC-REC-03 applying twice is 409; required answers are validated', async () => {
    const ctx = await clubWithTeam(knex, app);
    const s = await makeStudent(knex, app);
    const r = await openRecruitment(ctx);
    expect((await post(s.token, `/recruitments/${r.id}/apply`, { answers: {} })).status).toBe(400);
    expect(
      (await post(s.token, `/recruitments/${r.id}/apply`, { positionId: 'nope', answers: { why: 'x' } }))
        .status,
    ).toBe(400);
    expect(
      (
        await post(s.token, `/recruitments/${r.id}/apply`, {
          positionId: r.positions[0].id,
          answers: { why: 'Because' },
        })
      ).status,
    ).toBe(201);
    const again = await post(s.token, `/recruitments/${r.id}/apply`, { answers: { why: 'Again' } });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_REGISTERED');
  });

  it('TC-REC-04 accepting creates the membership in the same transaction with the chosen role; student notified', async () => {
    const ctx = await clubWithTeam(knex, app);
    const s = await makeStudent(knex, app);
    const r = await openRecruitment(ctx);
    await post(s.token, `/recruitments/${r.id}/apply`, { answers: { why: 'Because' } });
    const apps = await get(ctx.tokens.SECRETARY, `/recruitments/${r.id}/applications`);
    expect(apps.body.data).toHaveLength(1);
    expect(apps.body.data[0].answers.why).toBe('Because');
    expect((await get(ctx.tokens.MEMBER, `/recruitments/${r.id}/applications`)).status).toBe(403);

    const accepted = await patch(ctx.tokens.SECRETARY, `/applications/${apps.body.data[0].id}`, {
      status: 'accepted',
      roleKey: 'MEDIA_LEAD',
    });
    expect(accepted.status).toBe(200);
    const m = await knex('club_members as m')
      .join('club_roles as r', 'r.id', 'm.club_role_id')
      .where({ 'm.club_id': ctx.club.id, 'm.user_id': s.user.id })
      .select('r.key', 'm.added_via')
      .first();
    expect(m).toMatchObject({ key: 'MEDIA_LEAD', added_via: 'recruitment' });
    const types = (await get(s.token, '/notifications')).body.data.map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining(['application.status', 'membership.added']));
    expect((await get(s.token, '/me/clubs')).body.data.map((c) => c.id)).toContain(ctx.club.id); // appears under My Clubs
    // The Leader role can never be given through an application.
    const s2 = await makeStudent(knex, app);
    await post(s2.token, `/recruitments/${r.id}/apply`, { answers: { why: 'Because' } });
    const a2 = (await get(ctx.tokens.SECRETARY, `/recruitments/${r.id}/applications`)).body.data.find(
      (a) => a.user.id === s2.user.id,
    );
    expect(
      (await patch(ctx.tokens.SECRETARY, `/applications/${a2.id}`, { status: 'accepted', roleKey: 'LEADER' }))
        .status,
    ).toBe(403);
    expect(await knex('club_members').where({ user_id: s2.user.id })).toHaveLength(0);
  });

  it('TC-REC-05 reject, shortlist and withdraw give the right statuses and notifications; withdrawn cannot be decided', async () => {
    const ctx = await clubWithTeam(knex, app);
    const a = await makeStudent(knex, app);
    const b = await makeStudent(knex, app);
    const c = await makeStudent(knex, app);
    const r = await openRecruitment(ctx);
    for (const s of [a, b, c])
      await post(s.token, `/recruitments/${r.id}/apply`, { answers: { why: 'Because' } });
    const list = (await get(ctx.tokens.SECRETARY, `/recruitments/${r.id}/applications`)).body.data;
    const idOf = (s) => list.find((x) => x.user.id === s.user.id).id;
    expect(
      (await patch(ctx.tokens.SECRETARY, `/applications/${idOf(a)}`, { status: 'shortlisted' })).status,
    ).toBe(200);
    expect(
      (
        await patch(ctx.tokens.SECRETARY, `/applications/${idOf(b)}`, {
          status: 'rejected',
          note: 'Not this time',
        })
      ).status,
    ).toBe(200);
    expect((await del(c.token, `/recruitments/${r.id}/apply`)).status).toBe(200);
    expect(
      (await patch(ctx.tokens.SECRETARY, `/applications/${idOf(c)}`, { status: 'accepted' })).status,
    ).toBe(409);
    expect(
      (await patch(ctx.tokens.SECRETARY, `/applications/${idOf(b)}`, { status: 'accepted' })).status,
    ).toBe(409); // decided
    expect((await get(b.token, '/notifications')).body.data.some((n) => /rejected/.test(n.body))).toBe(true);
    const activities = (await get(a.token, '/me/activities?scope=current')).body.data;
    expect(activities.applications.map((x) => x.status)).toEqual(['shortlisted']);
    expect((await get(b.token, '/me/activities')).body.data.applications[0]).toMatchObject({
      status: 'rejected',
      decided: true,
    });
    // A student can apply again after withdrawing.
    expect(
      (await post(c.token, `/recruitments/${r.id}/apply`, { answers: { why: 'Changed my mind' } })).status,
    ).toBe(201);
  });

  it('TC-REC-06 auto-accept creates the membership at once', async () => {
    const ctx = await clubWithTeam(knex, app);
    const s = await makeStudent(knex, app);
    const r = await openRecruitment(ctx, { autoAccept: true });
    const res = await post(s.token, `/recruitments/${r.id}/apply`, { answers: { why: 'Because' } });
    expect(res.body.data.status).toBe('accepted');
    expect(
      await knex('club_members').where({ club_id: ctx.club.id, user_id: s.user.id, status: 'active' }),
    ).toHaveLength(1);
  });

  it('TC-REC-07 a student who is already a member cannot apply', async () => {
    const ctx = await clubWithTeam(knex, app);
    const r = await openRecruitment(ctx);
    expect(
      (await post(ctx.tokens.MEMBER, `/recruitments/${r.id}/apply`, { answers: { why: 'x' } })).status,
    ).toBe(409);
  });

  it('closing keeps existing applications; positions cannot change once open; the job closes expired recruitments', async () => {
    const ctx = await clubWithTeam(knex, app);
    const s = await makeStudent(knex, app);
    const r = await openRecruitment(ctx);
    await post(s.token, `/recruitments/${r.id}/apply`, { answers: { why: 'x' } });
    expect(
      (
        await patch(ctx.tokens.SECRETARY, `/recruitments/${r.id}`, {
          positions: [{ title: 'New', openings: 1 }],
        })
      ).status,
    ).toBe(409);
    expect((await patch(ctx.tokens.SECRETARY, `/recruitments/${r.id}`, { title: 'Renamed' })).status).toBe(
      200,
    );
    clock.set(new Date(Date.now() + 11 * 86400000));
    expect(await closeExpired(knex)).toBe(1);
    expect(await knex('applications').where({ recruitment_id: r.id })).toHaveLength(1);
  });

  it('calendar shows the recruitment deadline', async () => {
    const ctx = await clubWithTeam(knex, app);
    const s = await makeStudent(knex, app);
    await openRecruitment(ctx);
    const q = `from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(inDays(30))}`;
    expect(
      (await get(s.token, `/calendar?${q}`)).body.data.filter((i) => i.kind === 'recruitment'),
    ).toHaveLength(1);
  });
});

describe('discussions (FR-DISC-01/02)', () => {
  it('TC-DISC-01 internal discussion is for members only; a student gets 403', async () => {
    const ctx = await clubWithTeam(knex, app);
    const s = await makeStudent(knex, app);
    expect(
      (
        await post(ctx.tokens.MEMBER, `/clubs/${ctx.club.id}/discussions/internal/messages`, {
          body: 'Hello team',
        })
      ).status,
    ).toBe(201);
    expect(
      (await get(ctx.tokens.MEMBER, `/clubs/${ctx.club.id}/discussions/internal/messages`)).body.data,
    ).toHaveLength(1);
    expect((await get(s.token, `/clubs/${ctx.club.id}/discussions/internal/messages`)).status).toBe(403);
    expect(
      (await post(s.token, `/clubs/${ctx.club.id}/discussions/internal/messages`, { body: 'Let me in' }))
        .status,
    ).toBe(403);
    expect((await get(s.token, `/clubs/${ctx.club.id}/discussions/other/messages`)).status).toBe(404);
  });

  it('internal messages are pushed live to members with an open stream', async () => {
    const ctx = await clubWithTeam(knex, app);
    const seen = [];
    const off = subscribe(ctx.team.SECRETARY.id, (data, event) => seen.push({ data, event }));
    await post(ctx.tokens.MEMBER, `/clubs/${ctx.club.id}/discussions/internal/messages`, { body: 'Live!' });
    off();
    expect(seen).toHaveLength(1);
    expect(seen[0].event).toBe('discussion');
    expect(seen[0].data.message.body).toBe('Live!');
  });

  it('public discussion: students ask, moderators remove, anyone reports once; the club can switch it off', async () => {
    const ctx = await clubWithTeam(knex, app);
    const asker = await makeStudent(knex, app);
    const other = await makeStudent(knex, app);
    const admins = await makeAdmins(knex, app);
    const base = `/clubs/${ctx.club.id}/discussions/public/messages`;
    const msg = await post(asker.token, base, { body: 'When do you recruit?' });
    expect(msg.status).toBe(201);
    expect((await get(other.token, base)).body.data).toHaveLength(1);

    expect(
      (await post(other.token, `/discussion-messages/${msg.body.data.id}/report`, { reason: 'spam' })).status,
    ).toBe(201);
    expect((await post(other.token, `/discussion-messages/${msg.body.data.id}/report`, {})).status).toBe(409);
    const reported = await get(ctx.tokens.SECRETARY, `/clubs/${ctx.club.id}/discussions/reported`);
    expect(reported.body.data[0].reportedCount).toBe(1);
    expect((await get(ctx.tokens.MEDIA_LEAD, `/clubs/${ctx.club.id}/discussions/reported`)).status).toBe(403);
    expect((await get(admins.osiToken, '/osi/reports')).body.data).toHaveLength(1);

    expect((await del(other.token, `/discussion-messages/${msg.body.data.id}`)).status).toBe(403);
    expect((await del(ctx.tokens.SECRETARY, `/discussion-messages/${msg.body.data.id}`)).status).toBe(200);
    expect((await get(other.token, base)).body.data).toHaveLength(0); // soft-deleted
    expect((await del(asker.token, `/discussion-messages/${msg.body.data.id}`)).status).toBe(404);

    await patch(ctx.tokens.MEDIA_LEAD, `/clubs/${ctx.club.id}`, { publicDiscussionEnabled: false });
    expect((await post(asker.token, base, { body: 'Anyone there?' })).status).toBe(403);
    expect((await post(admins.osiToken, base, { body: 'x' })).status).toBe(403);
  });

  it('posting too fast is rate limited', async () => {
    const ctx = await clubWithTeam(knex, app);
    const path = `/clubs/${ctx.club.id}/discussions/internal/messages`;
    for (let i = 0; i < 10; i++)
      expect((await post(ctx.tokens.MEMBER, path, { body: `m${i}` })).status).toBe(201);
    expect((await post(ctx.tokens.MEMBER, path, { body: 'one too many' })).status).toBe(429);
  });
});

describe('custom roles and reports (Phase 2)', () => {
  it('the Leader creates a custom role; locked permissions are refused; it takes effect at once', async () => {
    const ctx = await clubWithTeam(knex, app);
    expect(
      (
        await post(ctx.tokens.VICE_LEADER, `/clubs/${ctx.club.id}/roles`, {
          name: 'Treasurer',
          permissions: ['report.view'],
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await post(ctx.tokens.LEADER, `/clubs/${ctx.club.id}/roles`, {
          name: 'Sneaky',
          permissions: ['event.submit'],
        })
      ).status,
    ).toBe(400);
    const created = await post(ctx.tokens.LEADER, `/clubs/${ctx.club.id}/roles`, {
      name: 'Treasurer',
      permissions: ['report.view', 'registration.view'],
    });
    expect(created.status).toBe(201);
    expect(created.body.data.key).toBe('CUSTOM_TREASURER');
    expect(
      (await post(ctx.tokens.LEADER, `/clubs/${ctx.club.id}/roles`, { name: 'Treasurer', permissions: [] }))
        .status,
    ).toBe(409);

    expect(
      (
        await patch(ctx.tokens.LEADER, `/clubs/${ctx.club.id}/members/${ctx.team.MEMBER.id}`, {
          roleKey: 'CUSTOM_TREASURER',
        })
      ).status,
    ).toBe(200);
    expect((await get(ctx.tokens.MEMBER, `/clubs/${ctx.club.id}/reports`)).status).toBe(200);
    await put(ctx.tokens.LEADER, `/clubs/x`, {}); // unknown route: ignored
    expect(
      (
        await patch(ctx.tokens.LEADER, `/clubs/${ctx.club.id}/roles/${created.body.data.id}`, {
          permissions: [],
        })
      ).status,
    ).toBe(200);
    expect((await get(ctx.tokens.MEMBER, `/clubs/${ctx.club.id}/reports`)).status).toBe(403);
    expect(
      (
        await patch(ctx.tokens.LEADER, `/clubs/${ctx.club.id}/roles/${created.body.data.id}`, {
          permissions: ['role.manage'],
        })
      ).status,
    ).toBe(400);

    expect((await del(ctx.tokens.LEADER, `/clubs/${ctx.club.id}/roles/${created.body.data.id}`)).status).toBe(
      409,
    ); // still assigned
    await patch(ctx.tokens.LEADER, `/clubs/${ctx.club.id}/members/${ctx.team.MEMBER.id}`, {
      roleKey: 'MEMBER',
    });
    expect((await del(ctx.tokens.LEADER, `/clubs/${ctx.club.id}/roles/${created.body.data.id}`)).status).toBe(
      200,
    );
    const systemRole = (await get(ctx.tokens.LEADER, `/clubs/${ctx.club.id}/roles`)).body.data.find(
      (r) => r.key === 'SECRETARY',
    );
    expect(
      (await patch(ctx.tokens.LEADER, `/clubs/${ctx.club.id}/roles/${systemRole.id}`, { permissions: [] }))
        .status,
    ).toBe(403);
  });

  it('club reports show members, events, registrations and attendance', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const ev = await approvedEvent(app, ctx, admins, (await createHall(knex)).id);
    await post(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form/publish`);
    const s = await makeStudent(knex, app);
    await post(s.token, `/events/${ev.id}/register`, { answers: {} });
    const token = (await get(s.token, `/me/registrations/${ev.id}/ticket`)).body.data.qrToken;
    await post(ctx.tokens.SECRETARY, `/events/${ev.id}/checkin`, { qrToken: token });
    const rep = await get(ctx.tokens.SECRETARY, `/clubs/${ctx.club.id}/reports`);
    expect(rep.status).toBe(200);
    expect(rep.body.data.members).toBe(6);
    expect(rep.body.data.totals).toMatchObject({ registered: 1, attended: 1, attendanceRate: 100 });
    expect(rep.body.data.events[0]).toMatchObject({ registered: 1, attended: 1 });
    expect((await get(ctx.tokens.MEDIA_LEAD, `/clubs/${ctx.club.id}/reports`)).status).toBe(403);
  });
});

describe('waitlist, teams, files (Phase 2 registration)', () => {
  async function published(over = {}, publish = {}) {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const ev = await approvedEvent(app, ctx, admins, (await createHall(knex)).id, over);
    await put(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form`, {
      title: 'Reg',
      fields: [
        { id: 'team', type: 'team', label: 'Your team', required: false, max: 3 },
        { id: 'cv', type: 'file_upload', label: 'CV', required: false },
      ],
    });
    expect((await post(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form/publish`, publish)).status).toBe(
      200,
    );
    return { ctx, ev };
  }

  it('with the waitlist on, a full event waitlists the student; a cancellation promotes the first one automatically', async () => {
    const { ev } = await published({}, { waitlist: true, maxSeats: 1 });
    const a = await makeStudent(knex, app);
    const b = await makeStudent(knex, app);
    const c = await makeStudent(knex, app);
    expect((await post(a.token, `/events/${ev.id}/register`, { answers: {} })).body.data.status).toBe(
      'registered',
    );
    const wb = await post(b.token, `/events/${ev.id}/register`, { answers: {} });
    expect(wb.body.data.status).toBe('waitlisted');
    await post(c.token, `/events/${ev.id}/register`, { answers: {} });
    expect((await post(b.token, `/events/${ev.id}/register`, { answers: {} })).body.error.code).toBe(
      'ALREADY_REGISTERED',
    );
    expect((await get(b.token, `/me/registrations/${ev.id}/ticket`)).status).toBe(404); // no ticket while waitlisted
    expect((await get(b.token, '/me/activities?scope=current')).body.data.registrations[0].label).toBe(
      'Waitlisted',
    );

    expect((await del(a.token, `/events/${ev.id}/register`)).status).toBe(200);
    expect((await get(b.token, `/events/${ev.id}`)).body.data.myRegistration.status).toBe('registered');
    expect((await get(c.token, `/events/${ev.id}`)).body.data.myRegistration.status).toBe('waitlisted');
    expect((await get(b.token, '/notifications')).body.data.some((n) => n.title === 'A seat opened up')).toBe(
      true,
    );
    expect((await get(b.token, `/me/registrations/${ev.id}/ticket`)).status).toBe(200);
  });

  it('team registration: team name and members by email; unknown or duplicate members are refused', async () => {
    const { ev } = await published();
    const lead = await makeStudent(knex, app);
    const mate = await makeStudent(knex, app);
    const bad = await post(lead.token, `/events/${ev.id}/register`, {
      answers: { team: { teamName: 'Dream', members: ['ghost@campus.example'] } },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details[0].message).toMatch(/Unknown member/);
    expect(
      (
        await post(lead.token, `/events/${ev.id}/register`, {
          answers: { team: { teamName: 'D', members: [] } },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post(lead.token, `/events/${ev.id}/register`, {
          answers: { team: { teamName: 'Dream', members: [lead.user.email] } },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post(lead.token, `/events/${ev.id}/register`, {
          answers: { team: { teamName: 'Dream', members: [mate.user.email, mate.user.email] } },
        })
      ).status,
    ).toBe(400);
    const ok = await post(lead.token, `/events/${ev.id}/register`, {
      answers: { team: { teamName: 'Dream Team', members: [mate.user.email.toUpperCase()] } },
    });
    expect(ok.status).toBe(201);
    const row = await knex('form_responses').where({ user_id: lead.user.id }).first();
    expect(JSON.parse(row.answers_json).team).toEqual({ teamName: 'Dream Team', members: [mate.user.email] });
  });

  it('file upload field: upload first, then submit the URL; bad files are refused', async () => {
    const { ev } = await published();
    const s = await makeStudent(knex, app);
    const bad = await request(app)
      .post(`${API}/uploads/form-file`)
      .set(bearer(s.token))
      .attach('file', Buffer.from('<html></html>'), { filename: 'cv.pdf', contentType: 'application/pdf' });
    expect(bad.status).toBe(415);
    const up = await request(app)
      .post(`${API}/uploads/form-file`)
      .set(bearer(s.token))
      .attach('file', PNG, { filename: 'cv.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    expect(
      (await post(s.token, `/events/${ev.id}/register`, { answers: { cv: 'http://evil.example/x' } })).status,
    ).toBe(400);
    expect(
      (await post(s.token, `/events/${ev.id}/register`, { answers: { cv: up.body.data.url } })).status,
    ).toBe(201);
  });
});

describe('ICS feed and email copies (Phase 2)', () => {
  it('FR-CAL-07 the personal feed contains registered events and is protected by a signed token', async () => {
    const ctx = await clubWithTeam(knex, app);
    const admins = await makeAdmins(knex, app);
    const ev = await approvedEvent(app, ctx, admins, (await createHall(knex)).id);
    await post(ctx.tokens.EVENT_COORDINATOR, `/events/${ev.id}/form/publish`);
    const s = await makeStudent(knex, app);
    const other = await makeStudent(knex, app);
    await post(s.token, `/events/${ev.id}/register`, { answers: {} });
    const feed = await get(s.token, '/me/calendar-feed');
    const url = new URL(feed.body.data.url);
    const res = await request(app).get(`${url.pathname}${url.search}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/calendar/);
    expect(res.text).toContain('BEGIN:VCALENDAR');
    expect(res.text).toContain(`UID:${ev.id}@campus-clubs-portal`);
    expect(res.text.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
    const otherFeed = new URL((await get(other.token, '/me/calendar-feed')).body.data.url);
    expect((await request(app).get(`${otherFeed.pathname}${otherFeed.search}`)).text).not.toContain(ev.id);
    expect((await request(app).get(`${API}/calendar.ics?token=garbage`)).status).toBe(401);
    expect((await request(app).get(`${API}/calendar.ics`)).status).toBe(401);
  });

  it('a user who switched email on for a category also gets an email copy', async () => {
    const ctx = await clubWithTeam(knex, app);
    const s = await makeStudent(knex, app);
    await put(s.token, '/me/notification-preferences', {
      preferences: [{ category: 'club_updates', inApp: true, email: true }],
    });
    await post(s.token, `/clubs/${ctx.club.id}/favourite`);
    await post(ctx.tokens.MEDIA_LEAD, `/clubs/${ctx.club.id}/announcements`, {
      title: 'Big news',
      body: 'Come along',
    });
    await new Promise((r) => setTimeout(r, 50));
    const mail = outbox.find((m) => m.to === s.user.email);
    expect(mail).toBeTruthy();
    expect(mail.subject).toMatch(/Big news/);
  });
});
