import { ADMIN_ROLES, PLATFORM_ROLES } from '@ccp/shared';

// The three entry points on the start screen. Each one is a login of its own and only lets the right kind of
// account in; the server still decides what every account can actually do (spec 0, rule 4).
export const PORTALS = {
  student: {
    id: 'student',
    title: 'Student',
    tagline: 'Find clubs, join events and keep track of everything on campus.',
    bullets: ['Browse every club', 'Register with one click', 'Your calendar and tickets'],
    icon: 'student',
  },
  member: {
    id: 'member',
    title: 'Club Member',
    tagline: 'Run your club: plan events, post announcements and manage your team.',
    bullets: ['Plan and submit events', 'Recruit and review applications', 'Reports and check-in'],
    icon: 'club',
  },
  admin: {
    id: 'admin',
    title: 'Administrator',
    tagline: 'OSI, Events Authority and Super Admin accounts sign in here.',
    bullets: ['Approve event plans', 'Decide hall requests', 'Manage users and audit'],
    icon: 'shield',
  },
};

export const portalFromParam = (v) => (PORTALS[v] ? v : null);

/** Returns a message when the account does not belong in the chosen portal, otherwise null. */
export function portalRefusal(portal, me) {
  const isAdmin = ADMIN_ROLES.includes(me.platformRole);
  if (portal === 'admin' && !isAdmin) {
    return 'This is a student account. Use the Student or Club Member login instead.';
  }
  if (portal !== 'admin' && isAdmin) {
    return 'Administrator accounts sign in through the Administrator login.';
  }
  if (portal === 'member' && me.platformRole === PLATFORM_ROLES.STUDENT && me.memberships.length === 0) {
    return 'This account is not a member of any club yet. Use the Student login, and apply when a club recruits.';
  }
  return null;
}

/** Where each portal lands after login (FR-AUTH-07). A club member on the Student login sees the student side. */
export function portalLanding(portal, me, lastClubId) {
  if (me.platformRole === PLATFORM_ROLES.OSI_ADMIN) return '/osi/approvals';
  if (me.platformRole === PLATFORM_ROLES.EVENTS_ADMIN) return '/events-admin/requests';
  if (me.platformRole === PLATFORM_ROLES.SUPER_ADMIN) return '/admin/users';
  if (portal === 'member' && me.memberships.length) {
    const pick = me.memberships.find((m) => m.club.id === lastClubId) ?? me.memberships[0];
    return `/club/${pick.club.id}`;
  }
  return '/clubs';
}
