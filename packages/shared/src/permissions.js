import { CLUB_ROLES as R } from './roles.js';

// Section 3.3: club-scoped permission keys. Single list used by DB, API and UI.
export const PERMISSIONS = Object.freeze({
  CLUB_PROFILE_EDIT: 'club.profile.edit',
  CLUB_WORKS_MANAGE: 'club.works.manage',
  ANNOUNCEMENT_POST: 'announcement.post',
  ANNOUNCEMENT_DELETE: 'announcement.delete',
  DISCUSSION_MODERATE: 'discussion.moderate',
  RECRUITMENT_MANAGE: 'recruitment.manage',
  APPLICATION_REVIEW: 'application.review',
  MEMBER_MANAGE: 'member.manage',
  LEADERSHIP_TRANSFER: 'leadership.transfer',
  ROLE_MANAGE: 'role.manage',
  EVENT_DRAFT: 'event.draft',
  EVENT_POSTER_UPLOAD: 'event.poster.upload',
  EVENT_SUBMIT: 'event.submit',
  FORM_MANAGE: 'form.manage',
  REGISTRATION_PUBLISH: 'registration.publish',
  REGISTRATION_VIEW: 'registration.view',
  CHECKIN_RUN: 'checkin.run',
  HALL_REQUEST: 'hall.request',
  REPORT_VIEW: 'report.view',
});
export const PERMISSION_KEYS = Object.freeze(Object.values(PERMISSIONS));

// Section 3.5 rule 4: cannot be given to other roles in version 1.
export const LOCKED_PERMISSIONS = Object.freeze([
  PERMISSIONS.EVENT_SUBMIT,
  PERMISSIONS.LEADERSHIP_TRANSFER,
  PERMISSIONS.ROLE_MANAGE,
]);

const P = PERMISSIONS;

// Section 3.4: default permissions per club role.
export const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  [R.LEADER]: Object.freeze([...PERMISSION_KEYS]),
  [R.VICE_LEADER]: Object.freeze(PERMISSION_KEYS.filter((k) => !LOCKED_PERMISSIONS.includes(k))),
  [R.SECRETARY]: Object.freeze([
    P.ANNOUNCEMENT_POST,
    P.ANNOUNCEMENT_DELETE,
    P.DISCUSSION_MODERATE,
    P.RECRUITMENT_MANAGE,
    P.APPLICATION_REVIEW,
    P.FORM_MANAGE,
    P.REGISTRATION_VIEW,
    P.CHECKIN_RUN,
    P.REPORT_VIEW,
  ]),
  [R.EVENT_COORDINATOR]: Object.freeze([
    P.EVENT_DRAFT,
    P.EVENT_POSTER_UPLOAD,
    P.FORM_MANAGE,
    P.REGISTRATION_PUBLISH,
    P.REGISTRATION_VIEW,
    P.CHECKIN_RUN,
  ]),
  [R.MEDIA_LEAD]: Object.freeze([
    P.CLUB_PROFILE_EDIT,
    P.CLUB_WORKS_MANAGE,
    P.ANNOUNCEMENT_POST,
    P.EVENT_POSTER_UPLOAD,
  ]),
  [R.MEMBER]: Object.freeze([]),
});

export function roleHasPermission(roleKey, permission) {
  return (DEFAULT_ROLE_PERMISSIONS[roleKey] ?? []).includes(permission);
}
