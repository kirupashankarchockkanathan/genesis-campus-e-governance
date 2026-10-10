import {
  MANDATORY_CATEGORIES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_OF,
  PLATFORM_ROLES,
  USER_STATUS,
} from '@ccp/shared';
import { newId } from '../../lib/ids.js';
import { clock } from '../../lib/clock.js';
import { errors } from '../../lib/errors.js';
import { boolFromDb, boolToDb, isUniqueViolation, jsonFromDb, jsonToDb, toDb } from '../../db/helpers.js';
import { publish } from './hub.js';
import { config } from '../../config/index.js';
import { sendMail } from '../../lib/mailer.js';
import { logger } from '../../lib/logger.js';

export const notificationDto = (r) => ({
  id: r.id,
  category: r.category,
  type: r.type,
  title: r.title,
  body: r.body,
  route: jsonFromDb(r.data_json, {})?.route ?? null,
  data: jsonFromDb(r.data_json, {}),
  read: Boolean(r.read_at),
  readAt: r.read_at,
  createdAt: r.created_at,
});

/**
 * Creates one notification per recipient (section 12). `db` may be a transaction.
 * Skips users whose preference for the category is off (mandatory categories always deliver)
 * and silently ignores duplicates when `dedupeKey` is set (reminders can run repeatedly).
 */
export async function notify(
  db,
  { userIds, type, title, body = '', route = null, data = {}, dedupeKey = null },
) {
  const category = NOTIFICATION_CATEGORY_OF[type];
  if (!category) throw new Error(`Unknown notification type: ${type}`);
  const recipients = [...new Set(userIds.filter(Boolean))];
  if (!recipients.length) return [];

  const off = MANDATORY_CATEGORIES.includes(category)
    ? new Set()
    : new Set(
        (
          await db('notification_preferences')
            .whereIn('user_id', recipients)
            .where({ category, in_app: boolToDb(false) })
        ).map((p) => p.user_id),
      );

  const created = [];
  const now = toDb(clock.now());
  for (const userId of recipients) {
    if (off.has(userId)) continue;
    const row = {
      id: newId(),
      user_id: userId,
      category,
      type,
      title,
      body,
      data_json: jsonToDb({ route, ...data }),
      dedupe_key: dedupeKey,
      read_at: null,
      created_at: now,
    };
    try {
      // A savepoint keeps a duplicate-key error from poisoning an enclosing PostgreSQL transaction.
      if (dedupeKey && db.isTransaction) {
        await db.transaction((sp) => sp('notifications').insert(row));
      } else {
        await db('notifications').insert(row);
      }
    } catch (err) {
      if (dedupeKey && isUniqueViolation(err)) continue;
      throw err;
    }
    created.push(row);
  }
  // Push after the rows exist. Inside a transaction the push is slightly early, which is harmless:
  // the client only uses it to show a toast and bump the badge.
  for (const row of created) publish(row.user_id, notificationDto(row));
  await emailCopies(db, category, created);
  return created;
}

/** Email copies for users who switched email on for the category (FR-NOTIF-05, Phase 2). Failures never break the caller. */
async function emailCopies(db, category, rows) {
  if (!rows.length) return;
  const wanted = await db('notification_preferences as p')
    .join('users as u', 'u.id', 'p.user_id')
    .whereIn(
      'p.user_id',
      rows.map((r) => r.user_id),
    )
    .where({ 'p.category': category, 'p.email': boolToDb(true) })
    .select('u.id', 'u.email');
  for (const w of wanted) {
    const row = rows.find((r) => r.user_id === w.id);
    const route = jsonFromDb(row.data_json, {})?.route;
    const link = route ? `\n\n${config.WEB_URL}${route}` : '';
    sendMail({ to: w.email, subject: row.title, text: `${row.body}${link}` }).catch((err) =>
      logger.warn({ err }, 'notification email failed'),
    );
  }
}

// ---------- Audiences ----------

export const allStudentIds = (db) =>
  db('users').where({ platform_role: PLATFORM_ROLES.STUDENT, status: USER_STATUS.ACTIVE }).pluck('id');

export const adminIds = (db, role) =>
  db('users').where({ platform_role: role, status: USER_STATUS.ACTIVE }).pluck('id');

export const activeMemberIds = (db, clubId) =>
  db('club_members').where({ club_id: clubId, status: 'active' }).pluck('user_id');

/** Active members of the club whose role holds the given permission. */
export const membersWithPermission = (db, clubId, permission) =>
  db('club_members as m')
    .join('club_role_permissions as p', 'p.club_role_id', 'm.club_role_id')
    .where({ 'm.club_id': clubId, 'm.status': 'active', 'p.permission': permission })
    .pluck('m.user_id');

export const favouriteFollowerIds = (db, clubId) =>
  db('favorite_clubs').where({ club_id: clubId }).pluck('user_id');

export const registeredStudentIds = (db, eventId) =>
  db('registrations')
    .where({ event_id: eventId })
    .whereIn('status', ['registered', 'attended'])
    .pluck('user_id');

// ---------- Reading ----------

export async function listNotifications(db, userId, { page = 1, pageSize = 20 } = {}) {
  const base = db('notifications').where({ user_id: userId });
  const total = Number((await base.clone().count('* as c').first()).c);
  const rows = await base
    .clone()
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { items: rows.map(notificationDto), meta: { page, pageSize, total } };
}

export async function unreadCount(db, userId) {
  const r = await db('notifications').where({ user_id: userId }).whereNull('read_at').count('* as c').first();
  return Number(r.c);
}

/** Another user's notification is reported as missing (TC-NOTIF-04). */
export async function markRead(db, userId, id) {
  const updated = await db('notifications')
    .where({ id, user_id: userId })
    .whereNull('read_at')
    .update({ read_at: toDb(clock.now()) });
  if (!updated && !(await db('notifications').where({ id, user_id: userId }).first())) {
    throw errors.notFound('Notification not found.');
  }
}

export const markAllRead = (db, userId) =>
  db('notifications')
    .where({ user_id: userId })
    .whereNull('read_at')
    .update({ read_at: toDb(clock.now()) });

// ---------- Preferences (FR-NOTIF-05) ----------

export async function getPreferences(db, userId) {
  const rows = await db('notification_preferences').where({ user_id: userId });
  return NOTIFICATION_CATEGORIES.map((category) => {
    const r = rows.find((x) => x.category === category);
    return {
      category,
      inApp: r ? boolFromDb(r.in_app) : true,
      email: r ? boolFromDb(r.email) : false,
      mandatory: MANDATORY_CATEGORIES.includes(category),
    };
  });
}

export async function setPreferences(db, userId, preferences) {
  await db.transaction(async (trx) => {
    for (const p of preferences) {
      if (!NOTIFICATION_CATEGORIES.includes(p.category))
        throw errors.validation(`Unknown category: ${p.category}`);
      const inApp = MANDATORY_CATEGORIES.includes(p.category) ? true : p.inApp;
      await trx('notification_preferences').where({ user_id: userId, category: p.category }).del();
      await trx('notification_preferences').insert({
        user_id: userId,
        category: p.category,
        in_app: boolToDb(inApp),
        email: boolToDb(p.email ?? false),
      });
    }
  });
  return getPreferences(db, userId);
}
