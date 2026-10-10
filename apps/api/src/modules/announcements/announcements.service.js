import { PERMISSIONS } from '@ccp/shared';
import { newId } from '../../lib/ids.js';
import { clock } from '../../lib/clock.js';
import { errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { boolFromDb, boolToDb, toDb } from '../../db/helpers.js';
import { activeMemberIds, favouriteFollowerIds, notify } from '../notifications/notifications.service.js';

const dto = (a) => ({
  id: a.id,
  clubId: a.club_id,
  title: a.title,
  body: a.body,
  imageUrl: a.image_url,
  isPinned: boolFromDb(a.is_pinned),
  authorId: a.author_id,
  authorName: a.author_name,
  createdAt: a.created_at,
});

/** Newest first, pinned on top; soft-deleted rows are always excluded (FR-ANN-02, TC-DB-19). */
export async function listAnnouncements(db, clubId, { limit } = {}) {
  const q = db('announcements as a')
    .join('users as u', 'u.id', 'a.author_id')
    .where('a.club_id', clubId)
    .whereNull('a.deleted_at')
    .select('a.*', 'u.full_name as author_name')
    .orderBy('a.is_pinned', 'desc')
    .orderBy('a.created_at', 'desc');
  if (limit) q.limit(limit);
  return (await q).map(dto);
}

export async function getAnnouncementRow(db, id) {
  const a = await db('announcements').where({ id }).whereNull('deleted_at').first();
  if (!a) throw errors.notFound('Announcement not found.');
  return a;
}

export async function postAnnouncement(db, actor, clubId, input) {
  return db.transaction(async (trx) => {
    const now = toDb(clock.now());
    const id = newId();
    await trx('announcements').insert({
      id,
      club_id: clubId,
      author_id: actor.id,
      title: input.title,
      body: input.body,
      image_url: input.imageUrl ?? null,
      is_pinned: boolToDb(false),
      created_at: now,
      updated_at: now,
    });
    const club = await trx('clubs').where({ id: clubId }).first();
    const audience = [...(await favouriteFollowerIds(trx, clubId)), ...(await activeMemberIds(trx, clubId))];
    await notify(trx, {
      userIds: audience.filter((u) => u !== actor.id),
      type: 'announcement.posted',
      title: `${club.name}: ${input.title}`,
      body: input.body.slice(0, 160),
      route: `/clubs/${club.slug}`,
    });
    return dto({ ...(await trx('announcements').where({ id }).first()), author_name: actor.fullName });
  });
}

/**
 * Own announcements can be edited with announcement.post; pinning and deleting need
 * announcement.delete (spec 10.3, TC-ANN-01).
 */
export async function updateAnnouncement(db, actor, membership, row, input) {
  const perms = membership.permissions;
  const isOwn = row.author_id === actor.id;
  const patch = { updated_at: toDb(clock.now()) };
  if (input.title !== undefined || input.body !== undefined || input.imageUrl !== undefined) {
    if (
      !(isOwn && perms.includes(PERMISSIONS.ANNOUNCEMENT_POST)) &&
      !perms.includes(PERMISSIONS.ANNOUNCEMENT_DELETE)
    )
      throw errors.forbidden();
    if (input.title !== undefined) patch.title = input.title;
    if (input.body !== undefined) patch.body = input.body;
    if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;
  }
  if (input.isPinned !== undefined) {
    if (!perms.includes(PERMISSIONS.ANNOUNCEMENT_DELETE)) throw errors.forbidden();
    patch.is_pinned = boolToDb(input.isPinned);
  }
  await db('announcements').where({ id: row.id }).update(patch);
  return dto({ ...(await db('announcements').where({ id: row.id }).first()), author_name: actor.fullName });
}

export async function deleteAnnouncement(db, actor, membership, row) {
  const isOwn = row.author_id === actor.id;
  if (
    !membership.permissions.includes(PERMISSIONS.ANNOUNCEMENT_DELETE) &&
    !(isOwn && membership.permissions.includes(PERMISSIONS.ANNOUNCEMENT_POST))
  ) {
    throw errors.forbidden();
  }
  await db('announcements')
    .where({ id: row.id })
    .update({ deleted_at: toDb(clock.now()) });
  await audit(db, {
    actorId: actor.id,
    action: 'announcement.deleted',
    entityType: 'announcement',
    entityId: row.id,
  });
}
