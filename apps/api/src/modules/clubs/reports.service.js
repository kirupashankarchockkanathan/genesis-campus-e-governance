import { toDb } from '../../db/helpers.js';
import { clock } from '../../lib/clock.js';

/** Club statistics (report.view): members, events, registrations and attendance. */
export async function clubReport(db, clubId) {
  const count = async (q) => Number((await q.count('* as c').first()).c);
  const members = await count(db('club_members').where({ club_id: clubId, status: 'active' }));
  const byRole = await db('club_members as m')
    .join('club_roles as r', 'r.id', 'm.club_role_id')
    .where({ 'm.club_id': clubId, 'm.status': 'active' })
    .groupBy('r.name')
    .select('r.name')
    .count('* as c');
  const eventsByStatus = await db('events')
    .where({ club_id: clubId })
    .groupBy('status')
    .select('status')
    .count('* as c');
  const perEvent = await db('events as e')
    .where('e.club_id', clubId)
    .whereIn('e.status', ['approved', 'completed'])
    .select('e.id', 'e.title', 'e.starts_at', 'e.status', 'e.max_seats', 'e.expected_participants')
    .orderBy('e.starts_at', 'desc');
  const regs = await db('registrations as r')
    .join('events as e', 'e.id', 'r.event_id')
    .where('e.club_id', clubId)
    .groupBy('r.event_id', 'r.status')
    .select('r.event_id', 'r.status')
    .count('* as c');
  const tally = (eventId, status) =>
    Number(regs.find((x) => x.event_id === eventId && x.status === status)?.c ?? 0);
  const rows = perEvent.map((e) => {
    const registered = tally(e.id, 'registered') + tally(e.id, 'attended') + tally(e.id, 'no_show');
    const attended = tally(e.id, 'attended');
    return {
      eventId: e.id,
      title: e.title,
      startsAt: e.starts_at,
      status: e.status,
      seats: e.max_seats,
      expected: Number(e.expected_participants),
      registered,
      attended,
      noShow: tally(e.id, 'no_show'),
      waitlisted: tally(e.id, 'waitlisted'),
      cancelled: tally(e.id, 'cancelled'),
      attendanceRate: registered ? Math.round((attended / registered) * 100) : null,
    };
  });
  const totalRegistered = rows.reduce((s, r) => s + r.registered, 0);
  const totalAttended = rows.reduce((s, r) => s + r.attended, 0);
  return {
    generatedAt: toDb(clock.now()),
    members,
    membersByRole: byRole.map((r) => ({ role: r.name, count: Number(r.c) })),
    eventsByStatus: Object.fromEntries(eventsByStatus.map((e) => [e.status, Number(e.c)])),
    openRecruitments: await count(db('recruitments').where({ club_id: clubId, status: 'open' })),
    pendingApplications: await count(
      db('applications as a')
        .join('recruitments as r', 'r.id', 'a.recruitment_id')
        .where('r.club_id', clubId)
        .whereIn('a.status', ['submitted', 'shortlisted']),
    ),
    totals: {
      registered: totalRegistered,
      attended: totalAttended,
      attendanceRate: totalRegistered ? Math.round((totalAttended / totalRegistered) * 100) : null,
    },
    events: rows,
  };
}
