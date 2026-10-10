import { PERMISSIONS, PLATFORM_ROLES } from '@ccp/shared';

// Pure functions so the sidebar can be tested for each role (TC-UI-03).

const STUDENT_BASE = [
  { to: '/clubs', label: 'Clubs', icon: 'clubs' },
  { to: '/events', label: 'Events', icon: 'events' },
  { to: '/favourites', label: 'Favourites', icon: 'star' },
];
const STUDENT_TAIL = [
  { to: '/activities', label: 'Activities', icon: 'activity' },
  { to: '/profile', label: 'Profile', icon: 'user' },
  { to: '/settings', label: 'Settings', icon: 'gear' },
];

export function studentNav(memberships) {
  return [
    ...STUDENT_BASE,
    ...(memberships.length ? [{ to: '/my-clubs', label: 'My Clubs', icon: 'group' }] : []),
    ...STUDENT_TAIL,
  ];
}

/** Club workspace sidebar: extra items appear only when the role allows (spec 4.11, 6.2). */
export function clubNav(clubId, permissions) {
  const has = (p) => permissions.includes(p);
  const base = `/club/${clubId}`;
  return [
    { to: '/my-clubs', label: 'My Clubs', icon: 'group' },
    { to: `${base}/events`, label: 'Events', icon: 'events' },
    ...(has(PERMISSIONS.EVENT_DRAFT)
      ? [{ to: `${base}/events/new`, label: 'Add an event', icon: 'plus' }]
      : []),
    ...(has(PERMISSIONS.ANNOUNCEMENT_POST)
      ? [{ to: `${base}/announcements`, label: 'Announcements', icon: 'megaphone' }]
      : []),
    ...(has(PERMISSIONS.RECRUITMENT_MANAGE) || has(PERMISSIONS.APPLICATION_REVIEW)
      ? [{ to: `${base}/recruitment`, label: 'Recruitment', icon: 'user' }]
      : []),
    { to: `${base}/members`, label: 'Members and roles', icon: 'group' },
    ...(has(PERMISSIONS.REGISTRATION_VIEW)
      ? [{ to: `${base}/registrations`, label: 'Registrations', icon: 'list' }]
      : []),
    ...(has(PERMISSIONS.REPORT_VIEW) ? [{ to: `${base}/reports`, label: 'Reports', icon: 'chart' }] : []),
    { to: `${base}/discussion`, label: 'Discussion', icon: 'chat' },
    { to: `${base}/profile`, label: 'Profile', icon: 'user' },
    { to: '/settings', label: 'Settings', icon: 'gear' },
    { to: '/clubs', label: 'Student view', icon: 'swap' },
  ];
}

const OSI_NAV = [
  { to: '/osi/approvals', label: 'Approvals', icon: 'check' },
  { to: '/osi/clubs', label: 'Clubs', icon: 'clubs' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/osi/reports', label: 'Reports', icon: 'chart' },
  { to: '/profile', label: 'Profile', icon: 'user' },
  { to: '/settings', label: 'Settings', icon: 'gear' },
];
const EVENTS_NAV = [
  { to: '/events-admin/requests', label: 'Hall requests', icon: 'list' },
  { to: '/events-admin/holds', label: 'Holds', icon: 'clock' },
  { to: '/events-admin/halls', label: 'Halls', icon: 'building' },
  { to: '/events-admin/availability', label: 'Availability', icon: 'calendar' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/profile', label: 'Profile', icon: 'user' },
  { to: '/settings', label: 'Settings', icon: 'gear' },
];
const SUPER_NAV = [
  { to: '/admin/users', label: 'Users', icon: 'group' },
  { to: '/admin/audit', label: 'Audit log', icon: 'list' },
  { to: '/admin/settings', label: 'Settings', icon: 'gear' },
];

/** Builds the sidebar for the current location and user. */
export function sidebarFor({ platformRole, memberships, clubId }) {
  if (platformRole === PLATFORM_ROLES.OSI_ADMIN) return OSI_NAV;
  if (platformRole === PLATFORM_ROLES.EVENTS_ADMIN) return EVENTS_NAV;
  if (platformRole === PLATFORM_ROLES.SUPER_ADMIN) return SUPER_NAV;
  const membership = clubId && memberships.find((m) => m.club.id === clubId);
  if (membership) return clubNav(clubId, membership.permissions);
  return studentNav(memberships);
}

const LAST_CLUB_KEY = 'ccp:lastClub';
export const rememberClub = (clubId) => {
  try {
    localStorage.setItem(LAST_CLUB_KEY, clubId);
  } catch {
    /* storage may be unavailable */
  }
};
const recallClub = () => {
  try {
    return localStorage.getItem(LAST_CLUB_KEY);
  } catch {
    return null;
  }
};

const PORTAL_KEY = 'ccp:portal';
/** The login the user chose on the start screen; a club member who used the Student login lands on the student side. */
export const rememberPortal = (portal) => {
  try {
    sessionStorage.setItem(PORTAL_KEY, portal);
  } catch {
    /* storage may be unavailable */
  }
};
const recallPortal = () => {
  try {
    return sessionStorage.getItem(PORTAL_KEY);
  } catch {
    return null;
  }
};

/** FR-AUTH-07: where to land after login. */
export function landingPath({ platformRole, memberships }) {
  if (platformRole === PLATFORM_ROLES.OSI_ADMIN) return '/osi/approvals';
  if (platformRole === PLATFORM_ROLES.EVENTS_ADMIN) return '/events-admin/requests';
  if (platformRole === PLATFORM_ROLES.SUPER_ADMIN) return '/admin/users';
  if (memberships.length && recallPortal() !== 'student') {
    const last = recallClub();
    const pick = memberships.find((m) => m.club.id === last) ?? memberships[0];
    return `/club/${pick.club.id}`;
  }
  return '/clubs';
}
