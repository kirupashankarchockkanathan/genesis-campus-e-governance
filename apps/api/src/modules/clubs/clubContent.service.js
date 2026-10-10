import { newId } from '../../lib/ids.js';
import { clock } from '../../lib/clock.js';
import { errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { boolToDb, toDb } from '../../db/helpers.js';
import { listAnnouncements } from '../announcements/announcements.service.js';
import { getClub } from './clubs.service.js';

const workDto = (w) => ({
  id: w.id,
  clubId: w.club_id,
  title: w.title,
  description: w.description,
  linkUrl: w.link_url,
  imageUrl: w.image_url,
  happenedOn: w.happened_on,
});

export const listWorks = async (db, clubId) =>
  (
    await db('club_works')
      .where({ club_id: clubId })
      .orderBy('happened_on', 'desc')
      .orderBy('created_at', 'desc')
  ).map(workDto);

export async function addWork(db, actor, clubId, input) {
  const id = newId();
  const now = toDb(clock.now());
  await db('club_works').insert({
    id,
    club_id: clubId,
    title: input.title,
    description: input.description ?? null,
    link_url: input.linkUrl || null,
    image_url: input.imageUrl ?? null,
    happened_on: input.happenedOn ?? null,
    created_by: actor.id,
    created_at: now,
    updated_at: now,
  });
  return workDto(await db('club_works').where({ id }).first());
}

export async function updateWork(db, clubId, workId, input) {
  const w = await db('club_works').where({ id: workId, club_id: clubId }).first();
  if (!w) throw errors.notFound('Entry not found.');
  const patch = { updated_at: toDb(clock.now()) };
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.linkUrl !== undefined) patch.link_url = input.linkUrl || null;
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;
  if (input.happenedOn !== undefined) patch.happened_on = input.happenedOn;
  await db('club_works').where({ id: workId }).update(patch);
  return workDto(await db('club_works').where({ id: workId }).first());
}

export async function deleteWork(db, clubId, workId) {
  const n = await db('club_works').where({ id: workId, club_id: clubId }).del();
  if (!n) throw errors.notFound('Entry not found.');
}

/** FR-CLUB-05: club description, why join, aim, contact, meeting info. */
export async function updateClub(db, actor, clubId, input) {
  const map = {
    tagline: 'tagline',
    description: 'description',
    whyJoin: 'why_join',
    aim: 'aim',
    facultyCoordinator: 'faculty_coordinator',
    meetingInfo: 'meeting_info',
    contactEmail: 'contact_email',
    foundedYear: 'founded_year',
    category: 'category',
  };
  const patch = { updated_at: toDb(clock.now()) };
  for (const [k, col] of Object.entries(map)) if (input[k] !== undefined) patch[col] = input[k];
  if (input.publicDiscussionEnabled !== undefined)
    patch.public_discussion_enabled = boolToDb(input.publicDiscussionEnabled);
  await db('clubs').where({ id: clubId }).update(patch);
  await audit(db, { actorId: actor.id, action: 'club.updated', entityType: 'club', entityId: clubId });
  return getClub(db, clubId);
}

// ---------- Favourites (FR-CLUB-03, FR-FAV-01) ----------

export async function setFavourite(db, userId, clubId, on) {
  const exists = await db('favorite_clubs').where({ user_id: userId, club_id: clubId }).first();
  if (on && !exists)
    await db('favorite_clubs').insert({ user_id: userId, club_id: clubId, created_at: toDb(clock.now()) });
  if (!on && exists) await db('favorite_clubs').where({ user_id: userId, club_id: clubId }).del();
  return { favourite: on };
}

export const favouriteIds = (db, userId) => db('favorite_clubs').where({ user_id: userId }).pluck('club_id');

/** Favourite clubs with their latest announcements, upcoming events and recent work. */
export async function myFavourites(db, userId) {
  const ids = await favouriteIds(db, userId);
  const now = toDb(clock.now());
  const out = [];
  for (const id of ids) {
    const club = await getClub(db, id);
    out.push({
      club,
      announcements: await listAnnouncements(db, id, { limit: 3 }),
      upcomingEvents: (
        await db('events')
          .where({ club_id: id })
          .whereIn('status', ['approved'])
          .whereNotNull('circulated_at')
          .where('ends_at', '>=', now)
          .orderBy('starts_at')
          .limit(3)
      ).map((e) => ({ id: e.id, title: e.title, startsAt: e.starts_at })),
      recentWork: (await listWorks(db, id)).slice(0, 2),
    });
  }
  return out.sort((a, b) => a.club.name.localeCompare(b.club.name));
}

export async function myClubs(db, userId) {
  const rows = await db('club_members as m')
    .join('clubs as c', 'c.id', 'm.club_id')
    .join('club_roles as r', 'r.id', 'm.club_role_id')
    .where({ 'm.user_id': userId, 'm.status': 'active' })
    .select('c.id', 'c.slug', 'c.name', 'c.category', 'r.key as role_key', 'r.name as role_name')
    .orderBy('c.name');
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category,
    roleKey: r.role_key,
    roleName: r.role_name,
  }));
}
