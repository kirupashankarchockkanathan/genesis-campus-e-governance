import { PERMISSION_KEYS, USER_STATUS } from '@ccp/shared';
import { getDb } from '../db/knex.js';
import { errors } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

/**
 * Verifies the access token and loads the user (rejects suspended users).
 * Until a forced password change is done only routes marked `allowMustChange` work (spec 11.3).
 */
export const requireAuth =
  ({ allowMustChange = false } = {}) =>
  async (req, _res, next) => {
    try {
      const header = req.get('authorization') ?? '';
      const [scheme, token] = header.split(' ');
      if (scheme !== 'Bearer' || !token) throw errors.unauthenticated();
      const payload = verifyAccessToken(token);
      const user = await (req.app.locals.db ?? getDb())('users').where({ id: payload.sub }).first();
      if (!user || user.status !== USER_STATUS.ACTIVE) throw errors.unauthenticated();
      if (Number(user.must_change_password) === 1 && !allowMustChange) {
        throw errors.forbidden('You must change your password before continuing.', {
          reason: 'PASSWORD_CHANGE_REQUIRED',
        });
      }
      req.user = user;
      req.actor = { id: user.id, platformRole: user.platform_role };
      next();
    } catch (err) {
      next(err);
    }
  };

/** Admin permissions are by platform role (spec 3.5 rule 7). */
export const requirePlatformRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(errors.unauthenticated());
    if (!roles.includes(req.user.platform_role)) return next(errors.forbidden());
    next();
  };

/** Active membership + role permission lookup, read fresh on every request (spec 3.5 rule 5). */
export async function loadMembership(db, userId, clubId) {
  const m = await db('club_members as m')
    .join('club_roles as r', 'r.id', 'm.club_role_id')
    .where({ 'm.user_id': userId, 'm.club_id': clubId, 'm.status': 'active' })
    .select('m.club_role_id', 'r.key as role_key', 'r.name as role_name')
    .first();
  if (!m) return null;
  const perms = await db('club_role_permissions').where({ club_role_id: m.club_role_id }).pluck('permission');
  return { roleKey: m.role_key, roleName: m.role_name, permissions: perms };
}

/**
 * Deny by default (spec 3.5 rule 1). `resolveClubId(req, db)` returns the club that owns the resource,
 * never a club id taken from the request body (rule 2, TC-RBAC-14).
 * Pass `null` as permission to require only an active membership.
 */
export const requireClubPermission = (permission, resolveClubId = (req) => req.params.clubId) => {
  return async (req, _res, next) => {
    try {
      if (!req.user) throw errors.unauthenticated();
      if (permission !== null && !PERMISSION_KEYS.includes(permission)) throw errors.forbidden();
      const db = req.app.locals.db ?? getDb();
      const clubId = await resolveClubId(req, db);
      if (!clubId) throw errors.notFound('Club not found.');
      const membership = await loadMembership(db, req.user.id, clubId);
      if (!membership || (permission !== null && !membership.permissions.includes(permission)))
        throw errors.forbidden();
      req.clubId = clubId;
      req.membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
};
