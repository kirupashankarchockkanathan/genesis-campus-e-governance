// What each portal may see of the governance state. The server decides; the UI only renders what it receives.

const LIVE = ['submitted', 'approved'];

/** The public part of an event request: what students see once it is published. */
const publicRequest = (r) => ({
  id: r.id,
  clubId: r.clubId,
  title: r.title,
  category: r.category,
  description: r.description,
  date: r.date,
  startTime: r.startTime,
  endTime: r.endTime,
  venue: r.venue,
  capacity: r.capacity,
  regDeadline: r.regDeadline,
  regDeadlineTime: r.regDeadlineTime,
  audience: r.audience,
  poster: r.poster ? { name: r.poster.name, size: r.poster.size, dataUrl: r.poster.dataUrl ?? null } : null,
  status: r.status,
  legacyEventId: r.legacyEventId,
});

/** Another club's pending request shows only its slot, so venue clashes can still be flagged. */
const slotOnly = (r) => ({
  id: r.id,
  clubId: r.clubId,
  title: 'Another club’s request',
  category: r.category,
  date: r.date,
  startTime: r.startTime,
  endTime: r.endTime,
  venue: r.venue,
  status: r.status,
});

const isPublic = (r) => r.status === 'published' || r.status === 'completed';

export function viewFor(state, portal, { clubId } = {}) {
  const shared = {
    version: state.version,
    clock: state.clock,
    counters: state.counters,
    newClubs: state.newClubs,
    clubOverrides: state.clubOverrides,
    broadcasts: state.broadcasts,
    catalog: state.catalog,
    registrationCounts: state.registrationCounts ?? {},
  };
  if (portal === 'osa' || portal === 'events')
    return { ...shared, ...pick(state, ['requests', 'promotions', 'clubApplications', 'activity']) };
  if (portal === 'club') {
    return {
      ...shared,
      requests: state.requests
        .map((r) => {
          if (r.clubId === clubId) return r;
          if (isPublic(r)) return publicRequest(r);
          return LIVE.includes(r.status) ? slotOnly(r) : null;
        })
        .filter(Boolean),
      promotions: state.promotions.filter((p) => p.clubId === clubId),
      clubApplications: [],
      activity: state.activity.filter((a) => a.clubId === clubId),
    };
  }
  // student
  return {
    ...shared,
    requests: state.requests.filter(isPublic).map(publicRequest),
    promotions: [],
    clubApplications: [],
    activity: [],
  };
}

function pick(obj, keys) {
  return Object.fromEntries(keys.map((k) => [k, obj[k]]));
}
