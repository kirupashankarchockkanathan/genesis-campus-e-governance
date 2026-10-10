export const PLATFORM_ROLES = Object.freeze({
  STUDENT: 'student',
  OSI_ADMIN: 'osi_admin',
  EVENTS_ADMIN: 'events_admin',
  SUPER_ADMIN: 'super_admin',
});
export const PLATFORM_ROLE_LIST = Object.freeze(Object.values(PLATFORM_ROLES));
export const ADMIN_ROLES = Object.freeze([
  PLATFORM_ROLES.OSI_ADMIN,
  PLATFORM_ROLES.EVENTS_ADMIN,
  PLATFORM_ROLES.SUPER_ADMIN,
]);

export const CLUB_ROLES = Object.freeze({
  LEADER: 'LEADER',
  VICE_LEADER: 'VICE_LEADER',
  SECRETARY: 'SECRETARY',
  EVENT_COORDINATOR: 'EVENT_COORDINATOR',
  MEDIA_LEAD: 'MEDIA_LEAD',
  MEMBER: 'MEMBER',
});
export const CLUB_ROLE_KEYS = Object.freeze(Object.values(CLUB_ROLES));
export const CLUB_ROLE_NAMES = Object.freeze({
  LEADER: 'Leader',
  VICE_LEADER: 'Vice Leader',
  SECRETARY: 'Secretary',
  EVENT_COORDINATOR: 'Event Coordinator',
  MEDIA_LEAD: 'Media Lead',
  MEMBER: 'Member',
});
