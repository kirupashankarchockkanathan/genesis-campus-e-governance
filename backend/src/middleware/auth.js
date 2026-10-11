import { USER_STATUS } from '@gcc/shared';
import { getDb } from '../db/knex.js';
import { errors } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

/**
 * Verifies the access token and loads the user (rejects suspended users).
 * Until a forced password change is done only routes marked `allowMustChange` work.
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

/** Admin permissions are by platform role. */
export const requirePlatformRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(errors.unauthenticated());
    if (!roles.includes(req.user.platform_role)) return next(errors.forbidden());
    next();
  };
