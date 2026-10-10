import { PLATFORM_ROLES } from '@ccp/shared';
import { favouriteIds } from '../clubs/clubContent.service.js';

/**
 * Calendar items for a date range (FR-CAL-01..06). Students see approved events of every club;
 * club members also see their own club's private items, OSI sees pending approvals and the
 * Events Authority sees holds and final requests. Time zones are applied in the UI; here every
 * timestamp is UTC (spec 4.14 NFR-05, TC-CAL-06).
 */
export async function calendarItems(db, user, { from, to, filter = 'all' }) {
  const fav = new Set(await favouriteIds(db, user.id));
  const memberOf = new Set(
    await db('club_members').where({ user_id: user.id, status: 'active' }).pluck('club_id'),
  );
  const registered = new Set(
    await db('registrations')
      .where({ user_id: user.id })
      .whereIn('status', ['registered', 'attended'])
      .pluck('event_id'),
  );
  const items = [];

  const overlapping = (q) => q.where('e.starts_at', '<=', to).where('e.ends_at', '>=', from);
  const events = await overlapping(
    db('events as e')
      .join('clubs as c', 'c.id', 'e.club_id')
      .whereIn('e.status', ['approved', 'completed'])
      .whereNotNull('e.circulated_at')
      .select('e.*', 'c.name as club_name'),
  );
  for (const e of events) {
    items.push({
      id: e.id,
      kind: 'event',
      title: e.title,
      clubId: e.club_id,
      clubName: e.club_name,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      status: e.status,
      registered: registered.has(e.id),
      favourite: fav.has(e.club_id),
      mine: memberOf.has(e.club_id),
      private: false,
      route: `/events/${e.id}`,
    });
  }

  // Registration deadlines of events with open registration.
  const deadlines = await db('forms as f')
    .join('events as e', 'e.id', 'f.event_id')
    .join('clubs as c', 'c.id', 'e.club_id')
    .where('f.status', 'published')
    .whereNotNull('f.closes_at')
    .where('f.closes_at', '>=', from)
    .where('f.closes_at', '<=', to)
    .select('e.id as event_id', 'e.title', 'e.club_id', 'c.name as club_name', 'f.closes_at');
  for (const d of deadlines) {
    items.push({
      id: `deadline-${d.event_id}`,
      kind: 'deadline',
      title: `Registration closes: ${d.title}`,
      clubId: d.club_id,
      clubName: d.club_name,
      startsAt: d.closes_at,
      endsAt: d.closes_at,
      status: 'open',
      registered: registered.has(d.event_id),
      favourite: fav.has(d.club_id),
      mine: memberOf.has(d.club_id),
      private: false,
      route: `/events/${d.event_id}`,
    });
  }

  // Recruitment deadlines (Phase 2 table may not exist on older databases).
  if (await db.schema.hasTable('recruitments')) {
    const recs = await db('recruitments as r')
      .join('clubs as c', 'c.id', 'r.club_id')
      .where('r.status', 'open')
      .where('r.deadline', '>=', from)
      .where('r.deadline', '<=', to)
      .select('r.id', 'r.title', 'r.club_id', 'r.deadline', 'c.name as club_name', 'c.slug');
    for (const r of recs) {
      items.push({
        id: `recruitment-${r.id}`,
        kind: 'recruitment',
        title: `Recruitment closes: ${r.title}`,
        clubId: r.club_id,
        clubName: r.club_name,
        startsAt: r.deadline,
        endsAt: r.deadline,
        status: 'open',
        registered: false,
        favourite: fav.has(r.club_id),
        mine: memberOf.has(r.club_id),
        private: false,
        route: `/clubs/${r.slug}`,
      });
    }
  }

  // Club members: their own club's non-public events, marked private (FR-CAL-05).
  if (memberOf.size) {
    const priv = await overlapping(
      db('events as e')
        .join('clubs as c', 'c.id', 'e.club_id')
        .whereIn('e.club_id', [...memberOf])
        .whereIn('e.status', ['draft', 'submitted', 'changes_requested', 'rejected'])
        .select('e.*', 'c.name as club_name'),
    );
    for (const e of priv) {
      items.push({
        id: e.id,
        kind: 'event',
        title: e.title,
        clubId: e.club_id,
        clubName: e.club_name,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        status: e.status,
        registered: false,
        favourite: fav.has(e.club_id),
        mine: true,
        private: true,
        route: `/club/${e.club_id}/events/${e.id}`,
      });
    }
  }

  if (user.platform_role === PLATFORM_ROLES.OSI_ADMIN) {
    const pending = await overlapping(
      db('events as e')
        .join('clubs as c', 'c.id', 'e.club_id')
        .where('e.status', 'submitted')
        .select('e.*', 'c.name as club_name'),
    );
    for (const e of pending) {
      items.push({
        id: e.id,
        kind: 'event',
        title: e.title,
        clubId: e.club_id,
        clubName: e.club_name,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        status: 'pending_approval',
        registered: false,
        favourite: false,
        mine: false,
        private: true,
        route: `/osi/approvals/${e.id}`,
      });
    }
  }
  if (user.platform_role === PLATFORM_ROLES.EVENTS_ADMIN) {
    const bookings = await db('hall_bookings as b')
      .join('events as e', 'e.id', 'b.event_id')
      .join('clubs as c', 'c.id', 'b.club_id')
      .join('halls as h', 'h.id', 'b.hall_id')
      .whereIn('b.status', ['tentative', 'requested'])
      .where('b.starts_at', '<=', to)
      .where('b.ends_at', '>=', from)
      .select('b.*', 'e.title', 'c.name as club_name', 'h.name as hall_name');
    for (const b of bookings) {
      items.push({
        id: `booking-${b.id}`,
        kind: 'hold',
        title: `${b.status === 'requested' ? 'Final request' : 'Hold'}: ${b.title} (${b.hall_name})`,
        clubId: b.club_id,
        clubName: b.club_name,
        startsAt: b.starts_at,
        endsAt: b.ends_at,
        status: b.status,
        registered: false,
        favourite: false,
        mine: false,
        private: true,
        route: `/events-admin/requests/${b.id}`,
      });
    }
  }

  const filtered = items.filter((i) => {
    if (filter === 'registrations') return i.registered;
    if (filter === 'favourites') return i.favourite;
    if (filter === 'clubs') return i.mine;
    return true;
  });
  return filtered.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
