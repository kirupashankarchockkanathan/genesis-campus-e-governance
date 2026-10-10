const freeze = (o) => Object.freeze(o);
const list = (o) => Object.freeze(Object.values(o));

export const USER_STATUS = freeze({ ACTIVE: 'active', SUSPENDED: 'suspended' });
export const CLUB_STATUS = freeze({ ACTIVE: 'active', INACTIVE: 'inactive' });
export const MEMBER_STATUS = freeze({ ACTIVE: 'active', LEFT: 'left', REMOVED: 'removed' });
export const MEMBER_ADDED_VIA = freeze({ RECRUITMENT: 'recruitment', DIRECT: 'direct', OSI: 'osi' });

export const EVENT_STATUS = freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  CHANGES_REQUESTED: 'changes_requested',
  REJECTED: 'rejected',
  APPROVED: 'approved',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});
export const FORM_STATUS = freeze({ DRAFT: 'draft', PUBLISHED: 'published', CLOSED: 'closed' });
export const BOOKING_STATUS = freeze({
  TENTATIVE: 'tentative',
  REQUESTED: 'requested',
  CONFIRMED: 'confirmed',
  DENIED: 'denied',
  RELEASED: 'released',
  EXPIRED: 'expired',
});
export const ACTIVE_BOOKING_STATUSES = freeze([
  BOOKING_STATUS.TENTATIVE,
  BOOKING_STATUS.REQUESTED,
  BOOKING_STATUS.CONFIRMED,
]);
export const REGISTRATION_STATUS = freeze({
  REGISTERED: 'registered',
  CANCELLED: 'cancelled',
  ATTENDED: 'attended',
  NO_SHOW: 'no_show',
  WAITLISTED: 'waitlisted',
});
export const RECRUITMENT_STATUS = freeze({ DRAFT: 'draft', OPEN: 'open', CLOSED: 'closed' });
export const APPLICATION_STATUS = freeze({
  SUBMITTED: 'submitted',
  SHORTLISTED: 'shortlisted',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
});
export const AUTH_TOKEN_TYPE = freeze({ VERIFY_EMAIL: 'verify_email', RESET_PASSWORD: 'reset_password' });

export const EVENT_STATUS_LIST = list(EVENT_STATUS);
export const FORM_STATUS_LIST = list(FORM_STATUS);
export const BOOKING_STATUS_LIST = list(BOOKING_STATUS);
export const REGISTRATION_STATUS_LIST = list(REGISTRATION_STATUS);
export const RECRUITMENT_STATUS_LIST = list(RECRUITMENT_STATUS);
export const APPLICATION_STATUS_LIST = list(APPLICATION_STATUS);
export const USER_STATUS_LIST = list(USER_STATUS);
export const CLUB_STATUS_LIST = list(CLUB_STATUS);
export const MEMBER_STATUS_LIST = list(MEMBER_STATUS);
export const MEMBER_ADDED_VIA_LIST = list(MEMBER_ADDED_VIA);
export const AUTH_TOKEN_TYPE_LIST = list(AUTH_TOKEN_TYPE);

// Section 5.1 allowed event transitions. Anything else is 409 INVALID_STATE.
export const EVENT_TRANSITIONS = freeze({
  draft: ['submitted', 'cancelled'],
  submitted: ['changes_requested', 'rejected', 'approved', 'cancelled'],
  changes_requested: ['submitted', 'cancelled'],
  approved: ['completed', 'cancelled'],
  rejected: [],
  completed: [],
  cancelled: [],
});
export const canTransitionEvent = (from, to) => (EVENT_TRANSITIONS[from] ?? []).includes(to);
