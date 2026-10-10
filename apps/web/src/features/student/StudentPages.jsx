import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAction, useGet } from '../../api/hooks.js';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { QueryState } from '../../components/ui/QueryState.jsx';
import { Pill } from '../../components/ui/Pill.jsx';
import { fmtDate, fmtDateTime } from '../../utils/dates.js';
import { FavouriteStar } from './ClubsPage.jsx';

/** FR-FAV-01: favourite clubs with their latest updates. Separate from My Clubs. */
export function FavouritesPage() {
  const q = useGet(['favourites'], '/me/favourites');
  return (
    <>
      <PageBanner title="Favourites" description="Your favourite clubs and what is new with them." />
      <QueryState query={q} emptyTitle="No favourites yet" emptyText="Press the star on a club to follow it.">
        {(list) => (
          <div className="stack">
            {list.map(({ club, announcements, upcomingEvents, recentWork }) => (
              <Card key={club.id} as="article">
                <div className="row-between">
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <Avatar name={club.name} />
                    <h2>
                      <Link to={`/clubs/${club.slug}`}>{club.name}</Link>
                    </h2>
                  </div>
                  <FavouriteStar club={{ ...club, isFavourite: true }} />
                </div>
                <div className="three-col">
                  <section aria-label="Latest announcements">
                    <h3>Announcements</h3>
                    {announcements.length ? (
                      announcements.map((a) => (
                        <p key={a.id}>
                          <strong>{a.title}</strong>
                          <br />
                          <span className="muted small">{fmtDate(a.createdAt)}</span>
                        </p>
                      ))
                    ) : (
                      <p className="muted small">None yet.</p>
                    )}
                  </section>
                  <section aria-label="Upcoming events">
                    <h3>Upcoming events</h3>
                    {upcomingEvents.length ? (
                      upcomingEvents.map((e) => (
                        <p key={e.id}>
                          <Link to={`/events/${e.id}`}>{e.title}</Link>
                          <br />
                          <span className="muted small">{fmtDateTime(e.startsAt)}</span>
                        </p>
                      ))
                    ) : (
                      <p className="muted small">None scheduled.</p>
                    )}
                  </section>
                  <section aria-label="Recent work">
                    <h3>Recent work</h3>
                    {recentWork.length ? (
                      recentWork.map((w) => <p key={w.id}>{w.title}</p>)
                    ) : (
                      <p className="muted small">Nothing added.</p>
                    )}
                  </section>
                </div>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}

const APP_PILL = {
  accepted: 'ok',
  rejected: 'bad',
  submitted: 'warn',
  shortlisted: 'warn',
  withdrawn: 'bad',
};

/** FR-ACT-01: Current, Past (attended, missed, decided) and All registrations. */
export function ActivitiesPage() {
  const [tab, setTab] = useState('current');
  const all = useGet(['activities', 'all'], '/me/activities');
  const data = all.data;
  const regs = data?.registrations ?? [];
  const apps = data?.applications ?? [];
  const now = new Date().toISOString();
  const isCurrent = (r) =>
    ['registered', 'waitlisted'].includes(r.status) &&
    r.endsAt >= now &&
    !['cancelled', 'rejected'].includes(r.eventStatus);
  const current = regs.filter(isCurrent);
  const past = regs.filter((r) => !isCurrent(r) && r.status !== 'cancelled');
  const openApps = apps.filter((a) => !a.decided);
  const decidedApps = apps.filter((a) => a.decided);

  const RegList = ({ rows }) =>
    rows.length === 0 ? (
      <p className="muted">Nothing here.</p>
    ) : (
      <div className="stack">
        {rows.map((r) => (
          <Card key={r.id} as="article">
            <div className="row-between">
              <h3>
                <Link to={`/events/${r.eventId}`}>{r.eventTitle}</Link>
              </h3>
              <Pill
                status={
                  r.status === 'attended'
                    ? 'approved'
                    : r.status === 'no_show'
                      ? 'rejected'
                      : r.status === 'cancelled'
                        ? 'cancelled'
                        : r.status === 'waitlisted'
                          ? 'pending'
                          : 'registered'
                }
              >
                {r.label}
              </Pill>
            </div>
            <p className="muted small">
              {r.clubName} · {fmtDateTime(r.startsAt)}
            </p>
          </Card>
        ))}
      </div>
    );
  const AppList = ({ rows }) =>
    rows.length === 0 ? null : (
      <div className="stack">
        <h3>Applications</h3>
        {rows.map((a) => (
          <Card key={a.id} as="article">
            <div className="row-between">
              <strong>{a.title}</strong>
              <span className={`pill pill-${APP_PILL[a.status] ?? ''}`}>{a.status}</span>
            </div>
            <p className="muted small">
              <Link to={`/clubs/${a.clubSlug}?tab=recruitment`}>{a.clubName}</Link> · applied{' '}
              {fmtDate(a.appliedAt)}
            </p>
          </Card>
        ))}
      </div>
    );

  return (
    <>
      <PageBanner title="Activities" description="Your registrations and applications." />
      <QueryState query={all} isEmpty={() => false}>
        {() => (
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'current', label: `Current (${current.length + openApps.length})` },
              { id: 'past', label: `Past (${past.length + decidedApps.length})` },
              { id: 'all', label: 'All registrations' },
            ]}
          >
            {tab === 'current' && (
              <div className="stack">
                <RegList rows={current} />
                <AppList rows={openApps} />
              </div>
            )}
            {tab === 'past' && (
              <div className="stack">
                <RegList rows={past} />
                <AppList rows={decidedApps} />
              </div>
            )}
            {tab === 'all' && <RegList rows={regs} />}
          </Tabs>
        )}
      </QueryState>
    </>
  );
}

export { useAction };
