import { useState } from 'react';
import { EVENT_TYPES } from '@ccp/shared';
import { useQuery } from '@tanstack/react-query';
import { apiWithMeta } from '../../api/client.js';
import { qs } from '../../api/hooks.js';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Pagination } from '../../components/ui/DataTable.jsx';
import { QueryState } from '../../components/ui/QueryState.jsx';
import { EventCard } from '../../components/events/EventBits.jsx';
import { useGet } from '../../api/hooks.js';

/** All approved events with filters: club, type, date, registered (spec 6.1). */
export function EventsPage() {
  const [club, setClub] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [registered, setRegistered] = useState(false);
  const [page, setPage] = useState(1);
  const clubs = useGet(['clubs', {}], '/clubs');
  const params = {
    club,
    type,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : '',
    registered: registered ? 'true' : '',
    page,
  };
  const q = useQuery({ queryKey: ['events', params], queryFn: () => apiWithMeta(`/events${qs(params)}`) });

  return (
    <>
      <PageBanner title="Events" description="Every approved event on campus." />
      <div className="filter-bar" role="search">
        <div className="field">
          <label htmlFor="ev-club">Club</label>
          <select
            id="ev-club"
            className="select"
            value={club}
            onChange={(e) => {
              setClub(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All clubs</option>
            {(clubs.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ev-type">Type</label>
          <select
            id="ev-type"
            className="select"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ev-from">From date</label>
          <input
            id="ev-from"
            className="input"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={registered}
            onChange={(e) => {
              setRegistered(e.target.checked);
              setPage(1);
            }}
          />{' '}
          Registered by me
        </label>
      </div>
      <QueryState
        query={q}
        isEmpty={(d) => !d?.data?.length}
        emptyTitle="No events found"
        emptyText="Try different filters."
      >
        {(d) => (
          <>
            <div className="event-grid">
              {d.data.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
            <Pagination meta={d.meta} onPage={setPage} />
          </>
        )}
      </QueryState>
    </>
  );
}
