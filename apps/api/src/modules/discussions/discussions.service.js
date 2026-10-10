import { PERMISSIONS, PLATFORM_ROLES } from '@ccp/shared';
import { newId } from '../../lib/ids.js';
import { clock } from '../../lib/clock.js';
import { errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { boolFromDb, isUniqueViolation, toDb } from '../../db/helpers.js';
import { activeMemberIds } from '../notifications/notifications.service.js';
import { publish } from '../notifications/hub.js';
import { loadMembership } from '../../middleware/auth.js';

const TITLES = { internal: 'Internal discussion', public: 'Public questions and answers' };

export async function ensureDiscussion(db, clubId, scope) {
  const existing = await db('discussions').where({ club_id: clubId, scope }).first();
  if (existing) return existing;
  const now = toDb(clock.now());
  try {
    await db('discussions').insert({
      id: newId(),
      club_id: clubId,
      scope,
      title: TITLES[scope],
      created_at: now,
      updated_at: now,
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err; // a parallel request created it first
  }
  return db('discussions').where({ club_id: clubId, scope }).first();
}

const dto = (m) => ({
  id: m.id,
  discussionId: m.discussion_id,
  userId: m.user_id,
  authorName: m.author_name,
  body: m.body,
  createdAt: m.created_at,
  reportedCount: Number(m.reported_count ?? 0),
});

/** Soft-deleted messages are excluded from every list (spec 9.3). */
export async function listMessages(db, clubId, scope, { limit = 100 } = {}) {
  const d = await ensureDiscussion(db, clubId, scope);
  const rows = await db('discussion_messages as m')
    .join('users as u', 'u.id', 'm.user_id')
    .where('m.discussion_id', d.id)
    .whereNull('m.deleted_at')
    .select('m.*', 'u.full_name as author_name')
    .orderBy('m.created_at', 'desc')
    .orderBy('m.id', 'desc')
    .limit(limit);
  return rows.reverse().map(dto);
}

// A small posting limit protects against spam (risk list, section 18.1).
const recent = new Map();
export const _resetPostingLimit = () => recent.clear();
function checkRate(userId) {
  const now = clock.now().getTime();
  const list = (recent.get(userId) ?? []).filter((t) => t > now - 60_000);
  if (list.length >= 10) throw errors.rateLimited('You are posting too quickly. Please wait a minute.');
  list.push(now);
  recent.set(userId, list);
}

/** FR-DISC-01/02: internal = active members only; public = students, unless the club switched it off. */
export async function postMessage(db, user, club, scope, body) {
  if (scope === 'public') {
    if (user.platform_role !== PLATFORM_ROLES.STUDENT)
      throw errors.forbidden('Only students can post in the public discussion.');
    if (!boolFromDb(club.public_discussion_enabled))
      throw errors.forbidden('This club has switched off its public discussion.');
  } else if (!(await loadMembership(db, user.id, club.id))) {
    throw errors.forbidden();
  }
  checkRate(user.id);
  const d = await ensureDiscussion(db, club.id, scope);
  const id = newId();
  await db('discussion_messages').insert({
    id,
    discussion_id: d.id,
    user_id: user.id,
    body: body.trim(),
    created_at: toDb(clock.now()),
  });
  const message = dto({
    ...(await db('discussion_messages').where({ id }).first()),
    author_name: user.full_name,
  });
  // Live update: every active member with an open stream sees it at once (FR-DISC-01).
  for (const memberId of await activeMemberIds(db, club.id))
    publish(memberId, { clubId: club.id, scope, message }, 'discussion');
  return message;
}

export async function getMessageContext(db, id) {
  return db('discussion_messages as m')
    .join('discussions as d', 'd.id', 'm.discussion_id')
    .where('m.id', id)
    .whereNull('m.deleted_at')
    .select('m.*', 'd.club_id', 'd.scope')
    .first();
}

/** Author, a member with discussion.moderate, or the OSI (content moderation) may remove a message. */
export async function deleteMessage(db, user, msg) {
  let allowed = msg.user_id === user.id || user.platform_role === PLATFORM_ROLES.OSI_ADMIN;
  if (!allowed) {
    const m = await loadMembership(db, user.id, msg.club_id);
    allowed = Boolean(m?.permissions.includes(PERMISSIONS.DISCUSSION_MODERATE));
  }
  if (!allowed) throw errors.forbidden();
  await db('discussion_messages')
    .where({ id: msg.id })
    .update({ deleted_at: toDb(clock.now()), deleted_by: user.id });
  await audit(db, {
    actorId: user.id,
    action: 'discussion.message_deleted',
    entityType: 'club',
    entityId: msg.club_id,
    meta: { messageId: msg.id },
  });
}

/** Any user can report a message once; the count drives moderation (FR-DISC-02). */
export async function reportMessage(db, user, msg, reason) {
  if (msg.scope === 'internal' && !(await loadMembership(db, user.id, msg.club_id)))
    throw errors.notFound('Message not found.');
  try {
    await db.transaction(async (trx) => {
      await trx('message_reports').insert({
        message_id: msg.id,
        user_id: user.id,
        reason: reason ?? null,
        created_at: toDb(clock.now()),
      });
      await trx('discussion_messages').where({ id: msg.id }).increment('reported_count', 1);
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw errors.conflict('You have already reported this message.');
    throw err;
  }
}

/** Reported, not yet removed messages: for one club (moderators) or all clubs (OSI). */
export async function reportedMessages(db, { clubId } = {}) {
  const q = db('discussion_messages as m')
    .join('discussions as d', 'd.id', 'm.discussion_id')
    .join('users as u', 'u.id', 'm.user_id')
    .join('clubs as c', 'c.id', 'd.club_id')
    .whereNull('m.deleted_at')
    .where('m.reported_count', '>', 0)
    .select('m.*', 'd.club_id', 'd.scope', 'c.name as club_name', 'u.full_name as author_name')
    .orderBy('m.reported_count', 'desc');
  if (clubId) q.where('d.club_id', clubId);
  return (await q).map((m) => ({ ...dto(m), clubId: m.club_id, clubName: m.club_name, scope: m.scope }));
}
