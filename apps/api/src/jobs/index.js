import { BOOKING_STATUS, EVENT_STATUS, FORM_STATUS, REGISTRATION_STATUS } from '@ccp/shared';
import { clock } from '../lib/clock.js';
import { toDb } from '../db/helpers.js';
import { audit } from '../lib/audit.js';
import { closeExpired as closeExpiredRecruitments } from '../modules/recruitment/recruitment.service.js';
import { notify, registeredStudentIds } from '../modules/notifications/notifications.service.js';

const hours = (n) => n * 3600 * 1000;
const days = (n) => n * 24 * 3600 * 1000;

/** Tentative holds that were not approved in time, or whose event started with no final request, expire (spec 5.3 rule 3). */
export async function holdExpiry(db) {
  const now = toDb(clock.now());
  const due = await db('hall_bookings as b')
    .join('events as e', 'e.id', 'b.event_id')
    .where('b.status', BOOKING_STATUS.TENTATIVE)
    .where((q) => q.where('b.expires_at', '<=', now).orWhere('b.starts_at', '<=', now))
    .select('b.id', 'b.event_id', 'e.title', 'e.club_id');
  for (const b of due) {
    await db('hall_bookings').where({ id: b.id }).update({ status: BOOKING_STATUS.EXPIRED, updated_at: now });
    await audit(db, { action: 'hall.hold_expired', entityType: 'event', entityId: b.event_id });
  }
  return due.length;
}

/** Two days before a hold expires the Leader is warned (TC-EVT-16). */
export async function holdExpiryWarnings(db) {
  const now = clock.now();
  const soon = await db('hall_bookings as b')
    .join('events as e', 'e.id', 'b.event_id')
    .where('b.status', BOOKING_STATUS.TENTATIVE)
    .whereNotNull('b.expires_at')
    .where('b.expires_at', '>', toDb(now))
    .where('b.expires_at', '<=', toDb(new Date(now.getTime() + days(2))))
    .select('b.id', 'e.id as event_id', 'e.title', 'e.club_id', 'e.submitted_by');
  let sent = 0;
  for (const b of soon) {
    const created = await notify(db, {
      userIds: [b.submitted_by],
      type: 'hold.expiring',
      title: 'Hall hold expiring',
      body: `The hall hold for "${b.title}" expires within two days unless the event is approved.`,
      route: `/club/${b.club_id}/events/${b.event_id}`,
      dedupeKey: `hold.expiring:${b.id}`,
    });
    sent += created.length;
  }
  return sent;
}

/** Registration closes automatically at its closing time (FR-REG-04, TC-REG-08). */
export async function closeRegistrations(db) {
  const now = toDb(clock.now());
  return db('forms')
    .where({ status: FORM_STATUS.PUBLISHED })
    .whereNotNull('closes_at')
    .where('closes_at', '<=', now)
    .update({ status: FORM_STATUS.CLOSED, updated_at: now });
}

/** Approved events whose end time passed become completed (FR-EVT-09, TC-EVT-17). */
export async function completeEvents(db) {
  const now = toDb(clock.now());
  return db('events')
    .where({ status: EVENT_STATUS.APPROVED })
    .where('ends_at', '<=', now)
    .update({ status: EVENT_STATUS.COMPLETED, updated_at: now });
}

/** Registered students who were not checked in become no_show after the event (TC-REG-12). */
export async function markNoShows(db) {
  const now = toDb(clock.now());
  const ended = db('events')
    .where('ends_at', '<=', now)
    .whereIn('status', [EVENT_STATUS.APPROVED, EVENT_STATUS.COMPLETED])
    .select('id');
  return db('registrations')
    .where({ status: REGISTRATION_STATUS.REGISTERED })
    .whereIn('event_id', ended)
    .update({ status: REGISTRATION_STATUS.NO_SHOW, updated_at: now });
}

/** 24-hour reminders. The dedupe key makes repeated runs safe (TC-NOTIF-05). */
export async function sendReminders(db) {
  const now = clock.now();
  const events = await db('events')
    .where({ status: EVENT_STATUS.APPROVED })
    .where('starts_at', '>', toDb(now))
    .where('starts_at', '<=', toDb(new Date(now.getTime() + hours(24))));
  let sent = 0;
  for (const e of events) {
    const created = await notify(db, {
      userIds: await registeredStudentIds(db, e.id),
      type: 'event.reminder_24h',
      title: 'Event tomorrow',
      body: `"${e.title}" starts within 24 hours.`,
      route: `/events/${e.id}`,
      dedupeKey: `event.reminder_24h:${e.id}`,
    });
    sent += created.length;
  }
  return sent;
}

/** Retention: read notifications older than 180 days (spec 11.5). */
export async function pruneNotifications(db) {
  const cutoff = toDb(new Date(clock.now().getTime() - days(180)));
  return db('notifications').whereNotNull('read_at').where('created_at', '<', cutoff).del();
}

export async function runAllJobs(db) {
  return {
    holdsExpired: await holdExpiry(db),
    holdWarnings: await holdExpiryWarnings(db),
    registrationsClosed: await closeRegistrations(db),
    recruitmentsClosed: await closeExpiredRecruitments(db),
    eventsCompleted: await completeEvents(db),
    noShows: await markNoShows(db),
    reminders: await sendReminders(db),
  };
}
