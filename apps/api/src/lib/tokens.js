import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { errors } from './errors.js';

/** Access token carries only sub and platformRole (spec 11.2). Permissions are read from the DB. */
export const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, platformRole: user.platform_role }, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: config.JWT_ACCESS_TTL,
  });

export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
    // Tokens for other purposes (event stream, calendar feed) share the secret but must never act as a login.
    if (payload.purpose || !payload.platformRole) throw new Error('not an access token');
    return payload;
  } catch {
    throw errors.unauthenticated('Your session has expired. Please log in again.');
  }
}
