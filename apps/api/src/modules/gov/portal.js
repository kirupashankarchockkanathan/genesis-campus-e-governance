import { PLATFORM_ROLES } from '@ccp/shared';
import { errors } from '../../lib/errors.js';

export const PORTALS = ['student', 'club', 'osa', 'events'];

const TITLES = new Set(['dr', 'prof', 'mr', 'mrs', 'ms', 'er']);
const initialsOf = (name = '') =>
  name
    .replace(/[^A-Za-z ]/g, '')
    .split(/\s+/)
    .filter((w) => w && !TITLES.has(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'GC';

const ordinal = (n) =>
  `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]} year`;

/** Which portal an account may sign in to. A Club Authority account is not also a student account. */
export async function portalsOf(db, user) {
  if (user.platform_role === PLATFORM_ROLES.OSI_ADMIN) return ['osa'];
  if (user.platform_role === PLATFORM_ROLES.EVENTS_ADMIN) return ['events'];
  if (user.platform_role === PLATFORM_ROLES.STUDENT) {
    return (await db('gov_club_authorities').where({ user_id: user.id }).first()) ? ['club'] : ['student'];
  }
  return [];
}

/** The signed-in person in the shape the web app and the workflow engine expect. Throws if the portal is not theirs. */
export async function portalUser(db, user, portal) {
  if (!PORTALS.includes(portal) || !(await portalsOf(db, user)).includes(portal)) {
    throw errors.forbidden('This account cannot use that portal.');
  }
  const base = {
    id: user.id,
    userId: user.username.toUpperCase(),
    name: user.full_name,
    initials: initialsOf(user.full_name),
    email: user.email,
    department: user.department ?? '',
  };
  if (portal === 'student') {
    return {
      ...base,
      role: 'student',
      shortDept: user.programme ?? '',
      year: user.year_of_study ? ordinal(user.year_of_study) : '',
    };
  }
  if (portal === 'club') {
    const link = await db('gov_club_authorities').where({ user_id: user.id }).first();
    return { ...base, role: 'club', clubId: link.club_id };
  }
  return { ...base, role: 'admin', adminType: portal };
}
