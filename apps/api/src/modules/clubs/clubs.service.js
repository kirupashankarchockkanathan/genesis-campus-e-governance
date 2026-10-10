import {
  CLUB_ROLE_KEYS,
  CLUB_ROLE_NAMES,
  CLUB_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  MEMBER_ADDED_VIA,
  PLATFORM_ROLES,
  USER_STATUS,
} from '@ccp/shared';
import { newId } from '../../lib/ids.js';
import { clock } from '../../lib/clock.js';
import { errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { boolFromDb, boolToDb, isUniqueViolation, toDb } from '../../db/helpers.js';

export const slugify = (name) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const clubDto = (r) => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  category: r.category,
  tagline: r.tagline,
  description: r.description,
  whyJoin: r.why_join,
  aim: r.aim,
  facultyCoordinator: r.faculty_coordinator,
  meetingInfo: r.meeting_info,
  contactEmail: r.contact_email,
  logoUrl: r.logo_url,
  coverUrl: r.cover_url,
  publicDiscussionEnabled: boolFromDb(r.public_discussion_enabled),
  status: r.status,
  memberCount: r.member_count === undefined ? undefined : Number(r.member_count),
});

/** Insert the six default roles and their permissions (FR-CLUB-04, spec 3.2). Returns { KEY: roleId }. */
export async function createDefaultRoles(trx, clubId) {
  const now = toDb(clock.now());
  const ids = {};
  for (const key of CLUB_ROLE_KEYS) {
    const id = newId();
    ids[key] = id;
    await trx('club_roles').insert({
      id,
      club_id: clubId,
      key,
      name: CLUB_ROLE_NAMES[key],
      is_system: boolToDb(true),
      created_at: now,
      updated_at: now,
    });
    const perms = DEFAULT_ROLE_PERMISSIONS[key].map((permission) => ({ club_role_id: id, permission }));
    if (perms.length) await trx('club_role_permissions').insert(perms);
  }
  return ids;
}

/**
 * Create a club with default roles inside the given transaction.
 * `leaderUserId` is optional only for seed data; the API always supplies one (D5).
 */
export async function insertClub(trx, data, { actorId = null, leaderUserId = null } = {}) {
  const now = toDb(clock.now());
  const id = newId();
  const slug = data.slug ?? slugify(data.name);
  try {
    await trx('clubs').insert({
      id,
      slug,
      name: data.name,
      category: data.category,
      tagline: data.tagline ?? null,
      description: data.description ?? null,
      why_join: data.whyJoin ?? null,
      aim: data.aim ?? null,
      faculty_coordinator: data.facultyCoordinator ?? null,
      meeting_info: data.meetingInfo ?? null,
      contact_email: data.contactEmail ?? null,
      public_discussion_enabled: boolToDb(true),
      status: 'active',
      created_by: actorId,
      created_at: now,
      updated_at: now,
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw errors.conflict('A club with that name already exists.');
    throw err;
  }
  const roleIds = await createDefaultRoles(trx, id);
  if (leaderUserId) {
    await trx('club_members').insert({
      id: newId(),
      club_id: id,
      user_id: leaderUserId,
      club_role_id: roleIds[CLUB_ROLES.LEADER],
      status: 'active',
      joined_at: now,
      added_via: MEMBER_ADDED_VIA.OSI,
      created_at: now,
      updated_at: now,
    });
  }
  return { id, slug, roleIds };
}

export async function createClub(db, actor, input) {
  return db.transaction(async (trx) => {
    const leader = await trx('users').whereRaw('lower(email) = ?', [input.leaderEmail.toLowerCase()]).first();
    if (!leader || leader.status !== USER_STATUS.ACTIVE)
      throw errors.validation('The chosen Leader was not found.');
    if (leader.platform_role !== PLATFORM_ROLES.STUDENT)
      throw errors.validation('The Leader must be a student account.');
    const { id } = await insertClub(trx, input, { actorId: actor.id, leaderUserId: leader.id });
    await audit(trx, {
      actorId: actor.id,
      action: 'club.created',
      entityType: 'club',
      entityId: id,
      meta: { leaderId: leader.id },
    });
    return getClub(trx, id);
  });
}

const memberCountSql = (db) =>
  db('club_members')
    .count('* as c')
    .whereRaw('club_members.club_id = clubs.id')
    .where('club_members.status', 'active')
    .toSQL();

export async function listClubs(db, { q, category, recruiting } = {}, viewerId = null) {
  const sub = memberCountSql(db);
  const query = db('clubs')
    .select('clubs.*', db.raw(`(${sub.sql}) as member_count`, sub.bindings))
    .where('status', 'active')
    .orderBy('name');
  if (category) query.where('category', category);
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    query.where((b) =>
      b.whereRaw('lower(name) like ?', [like]).orWhereRaw('lower(description) like ?', [like]),
    );
  }
  const rows = await query;
  // "Recruiting" badge: an open recruitment whose deadline has not passed (FR-CLUB-01).
  const recruitingIds = new Set(
    await db('recruitments')
      .where({ status: 'open' })
      .where('deadline', '>', toDb(clock.now()))
      .pluck('club_id'),
  );
  const favIds = new Set(
    viewerId ? await db('favorite_clubs').where({ user_id: viewerId }).pluck('club_id') : [],
  );
  const out = rows.map((r) => ({
    ...clubDto(r),
    recruiting: recruitingIds.has(r.id),
    isFavourite: favIds.has(r.id),
  }));
  return recruiting === 'true' ? out.filter((c) => c.recruiting) : out;
}

export async function getClub(db, idOrSlug) {
  const sub = memberCountSql(db);
  const row = await db('clubs')
    .select('clubs.*', db.raw(`(${sub.sql}) as member_count`, sub.bindings))
    .where((b) => b.where('id', idOrSlug).orWhere('slug', idOrSlug))
    .first();
  if (!row) throw errors.notFound('Club not found.');
  return clubDto(row);
}

export async function listRoles(db, clubId) {
  const roles = await db('club_roles').where({ club_id: clubId }).orderBy('name');
  const perms = await db('club_role_permissions').whereIn(
    'club_role_id',
    roles.map((r) => r.id),
  );
  return roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    isSystem: boolFromDb(r.is_system),
    permissions: perms
      .filter((p) => p.club_role_id === r.id)
      .map((p) => p.permission)
      .sort(),
  }));
}
