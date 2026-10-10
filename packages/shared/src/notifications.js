// Section 12.1: notification types, categories and which categories can never be switched off.
export const NOTIFICATION_CATEGORIES = Object.freeze([
  'events',
  'recruitment',
  'club_updates',
  'my_activity',
  'approvals',
  'system',
]);

export const NOTIFICATION_TYPES = Object.freeze({
  EVENT_PUBLISHED: 'event.published',
  RECRUITMENT_OPENED: 'recruitment.opened',
  ANNOUNCEMENT_POSTED: 'announcement.posted',
  REGISTRATION_CONFIRMED: 'registration.confirmed',
  EVENT_REMINDER_24H: 'event.reminder_24h',
  EVENT_UPDATED: 'event.updated',
  EVENT_CANCELLED: 'event.cancelled',
  EVENT_VENUE_CONFIRMED: 'event.venue_confirmed',
  APPLICATION_STATUS: 'application.status',
  MEMBERSHIP_ADDED: 'membership.added',
  ROLE_CHANGED: 'role.changed',
  EVENT_SUBMITTED: 'event.submitted',
  EVENT_DECISION: 'event.decision',
  HALL_REQUESTED: 'hall.requested',
  HALL_DECISION: 'hall.decision',
  HOLD_EXPIRING: 'hold.expiring',
  ADMIN_ACCOUNT_CREATED: 'admin.account_created',
});

export const NOTIFICATION_CATEGORY_OF = Object.freeze({
  'event.published': 'events',
  'recruitment.opened': 'recruitment',
  'announcement.posted': 'club_updates',
  'registration.confirmed': 'my_activity',
  'event.reminder_24h': 'events',
  'event.updated': 'events',
  'event.cancelled': 'events',
  'event.venue_confirmed': 'events',
  'application.status': 'my_activity',
  'membership.added': 'my_activity',
  'role.changed': 'my_activity',
  'event.submitted': 'approvals',
  'event.decision': 'approvals',
  'hall.requested': 'approvals',
  'hall.decision': 'approvals',
  'hold.expiring': 'approvals',
  'admin.account_created': 'system',
});

/** These categories cannot be fully switched off for in-app delivery. */
export const MANDATORY_CATEGORIES = Object.freeze(['my_activity', 'approvals', 'system']);

export const CATEGORY_LABELS = Object.freeze({
  events: 'New and updated events',
  recruitment: 'Recruitments',
  club_updates: 'Club announcements',
  my_activity: 'My activity (registrations, applications, roles)',
  approvals: 'Approvals and hall decisions',
  system: 'System messages',
});
