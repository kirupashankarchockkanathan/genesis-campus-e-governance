import request from 'supertest';
import { newId } from '../../src/lib/ids.js';
import { toDb } from '../../src/db/helpers.js';
import { addMemberWithRole, createClub, createUser } from '../factories/index.js';
import { bearer, loginAs } from './app.js';

export const API = '/api/v1';
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// A 1x1 transparent PNG: the real signature, so the upload check accepts it.
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export async function createHall(knex, over = {}) {
  const now = toDb(new Date());
  const row = {
    id: newId(),
    name: `Hall ${newId().slice(0, 6)}`,
    building: 'Block A',
    floor: '1',
    capacity: 100,
    facilities_json: '[]',
    is_active: 1,
    created_at: now,
    updated_at: now,
    ...over,
  };
  await knex('halls').insert(row);
  return row;
}

/** A club with one user per role, each with a login token. */
export async function clubWithTeam(knex, app, { name } = {}) {
  const club = await createClub(knex, { name });
  const team = { LEADER: club.leader };
  for (const key of ['VICE_LEADER', 'SECRETARY', 'EVENT_COORDINATOR', 'MEDIA_LEAD', 'MEMBER']) {
    team[key] = await addMemberWithRole(knex, club, key);
  }
  const tokens = {};
  for (const [key, user] of Object.entries(team)) tokens[key] = await loginAs(app, user);
  return { club, team, tokens };
}

export async function makeAdmins(knex, app) {
  const osi = await createUser(knex, { platform_role: 'osi_admin' });
  const hallAdmin = await createUser(knex, { platform_role: 'events_admin' });
  const superAdmin = await createUser(knex, { platform_role: 'super_admin' });
  return {
    osi,
    hallAdmin,
    superAdmin,
    osiToken: await loginAs(app, osi),
    hallToken: await loginAs(app, hallAdmin),
    superToken: await loginAs(app, superAdmin),
  };
}

export async function makeStudent(knex, app, over = {}) {
  const user = await createUser(knex, over);
  return { user, token: await loginAs(app, user) };
}

/** ISO strings relative to now; `day` offsets the date so tests can avoid clashing. */
export function slot({ day = 10, startHour = 10, hours = 2 } = {}) {
  const base = new Date(Date.now() + day * DAY);
  base.setUTCHours(startHour, 0, 0, 0);
  const start = base;
  const end = new Date(start.getTime() + hours * HOUR);
  const deadline = new Date(start.getTime() - DAY);
  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    registrationDeadline: deadline.toISOString(),
  };
}

export const eventBody = (over = {}) => ({
  title: 'Intro to Robotics Workshop',
  type: 'workshop',
  summary: 'A hands-on introduction.',
  description: 'Full description of the workshop.',
  objectives: 'Learn the basics.',
  mode: 'offline',
  expectedParticipants: 50,
  ...slot(),
  ...over,
});

export async function createDraftViaApi(app, token, clubId, over = {}) {
  const res = await request(app)
    .post(`${API}/clubs/${clubId}/events`)
    .set(bearer(token))
    .send(eventBody(over));
  if (res.status !== 201) throw new Error(`draft failed ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

export async function uploadPoster(app, token, eventId) {
  return request(app)
    .post(`${API}/events/${eventId}/poster`)
    .set(bearer(token))
    .attach('poster', PNG, { filename: 'poster.png', contentType: 'image/png' });
}

/** Draft with poster, submitted by the Leader with the given hall. */
export async function submittedEvent(app, ctx, hallId, over = {}) {
  const ev = await createDraftViaApi(app, ctx.tokens.LEADER, ctx.club.id, over);
  const up = await uploadPoster(app, ctx.tokens.LEADER, ev.id);
  if (up.status !== 200) throw new Error(`poster failed ${up.status} ${JSON.stringify(up.body)}`);
  const sub = await request(app)
    .post(`${API}/events/${ev.id}/submit`)
    .set(bearer(ctx.tokens.LEADER))
    .send({ hallId });
  if (sub.status !== 200) throw new Error(`submit failed ${sub.status}: ${JSON.stringify(sub.body)}`);
  return sub.body.data;
}

export async function approve(app, osiToken, eventId, circulate = true) {
  return request(app)
    .post(`${API}/osi/events/${eventId}/decision`)
    .set(bearer(osiToken))
    .send({ decision: 'approved', circulate });
}

export async function approvedEvent(app, ctx, admins, hallId, over = {}) {
  const ev = await submittedEvent(app, ctx, hallId, over);
  const res = await approve(app, admins.osiToken, ev.id);
  if (res.status !== 200) throw new Error(`approve failed ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

export async function publishForm(app, ctx, eventId, body = {}) {
  return request(app)
    .post(`${API}/events/${eventId}/form/publish`)
    .set(bearer(ctx.tokens.EVENT_COORDINATOR))
    .send(body);
}
