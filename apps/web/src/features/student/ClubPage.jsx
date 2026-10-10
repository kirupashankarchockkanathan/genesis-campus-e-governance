import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAction, useGet } from '../../api/hooks.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { QueryState, MutationError } from '../../components/ui/QueryState.jsx';
import { FormRenderer } from '../../components/forms/FormRenderer.jsx';
import { EventCard } from '../../components/events/EventBits.jsx';
import { fmtDate, fmtDateTime } from '../../utils/dates.js';
import { FavouriteStar, coverOf, initialsOf } from './ClubsPage.jsx';
import { PublicDiscussion } from './PublicDiscussion.jsx';

function About({ club }) {
  return (
    <div className="stack">
      {club.description && (
        <section className="card feature-card">
          <h2>About {club.name}</h2>
          <p className="lead">{club.description}</p>
        </section>
      )}
      <div className="info-grid">
        {club.whyJoin && (
          <section className="card info-card">
            <span className="info-icon" aria-hidden="true">
              ★
            </span>
            <h3>Why join</h3>
            <p>{club.whyJoin}</p>
          </section>
        )}
        {club.aim && (
          <section className="card info-card">
            <span className="info-icon" aria-hidden="true">
              ◎
            </span>
            <h3>Our aim</h3>
            <p>{club.aim}</p>
          </section>
        )}
        {club.meetingInfo && (
          <section className="card info-card">
            <span className="info-icon" aria-hidden="true">
              ◷
            </span>
            <h3>When we meet</h3>
            <p>{club.meetingInfo}</p>
          </section>
        )}
        {(club.contactEmail || club.facultyCoordinator) && (
          <section className="card info-card">
            <span className="info-icon" aria-hidden="true">
              ✉
            </span>
            <h3>Get in touch</h3>
            {club.contactEmail && (
              <p>
                <a href={`mailto:${club.contactEmail}`}>{club.contactEmail}</a>
              </p>
            )}
            {club.facultyCoordinator && (
              <p className="muted">Faculty coordinator: {club.facultyCoordinator}</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Work({ club }) {
  const q = useGet(['club', club.id, 'works'], `/clubs/${club.id}/works`);
  return (
    <QueryState
      query={q}
      emptyTitle="Nothing here yet"
      emptyText="This club has not added past projects yet."
    >
      {(works) => (
        <div className="grid-cards">
          {works.map((w) => (
            <Card key={w.id} as="article">
              <h3>{w.title}</h3>
              {w.happenedOn && <p className="muted small">{fmtDate(w.happenedOn)}</p>}
              <p>{w.description}</p>
              {w.linkUrl && (
                <a href={w.linkUrl} target="_blank" rel="noreferrer">
                  Read more
                </a>
              )}
            </Card>
          ))}
        </div>
      )}
    </QueryState>
  );
}

function Announcements({ club }) {
  const q = useGet(['club', club.id, 'announcements'], `/clubs/${club.id}/announcements`);
  return (
    <QueryState query={q} emptyTitle="No announcements" emptyText="Nothing has been posted yet.">
      {(list) => (
        <div className="stack">
          {list.map((a) => (
            <Card key={a.id} as="article">
              <div className="row-between">
                <h3>{a.title}</h3>
                {a.isPinned && <span className="pill">Pinned</span>}
              </div>
              <p style={{ whiteSpace: 'pre-wrap' }}>{a.body}</p>
              <p className="muted small">
                {a.authorName}, {fmtDateTime(a.createdAt)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </QueryState>
  );
}

function Events({ club }) {
  const q = useGet(['events', { club: club.id }], `/events?club=${club.id}&pageSize=50`);
  // /events returns { data, meta }; useGet unwraps data.
  return (
    <QueryState query={q} emptyTitle="No upcoming events" emptyText="Approved events will appear here.">
      {(events) => (
        <div className="event-grid">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </QueryState>
  );
}

function Recruitment({ club }) {
  const q = useGet(['club', club.id, 'recruitments'], `/clubs/${club.id}/recruitments`);
  const { user } = useAuth();
  const [applying, setApplying] = useState(null);
  const [pos, setPos] = useState('');
  const apply = useAction({
    invalidate: [['club', club.id, 'recruitments'], ['activities']],
    onSuccess: () => setApplying(null),
  });
  const withdraw = useAction({ invalidate: [['club', club.id, 'recruitments'], ['activities']] });
  const open = (q.data ?? []).filter((r) => r.acceptingApplications);
  return (
    <QueryState
      query={{ ...q, data: open }}
      emptyTitle="No open recruitment"
      emptyText="This club is not recruiting right now."
    >
      {(list) => (
        <div className="stack">
          {list.map((r) => (
            <Card key={r.id} as="article">
              <h3>{r.title}</h3>
              <p>{r.description}</p>
              <p className="small">Apply before {fmtDateTime(r.deadline)}</p>
              <ul>
                {r.positions.map((p) => (
                  <li key={p.id}>
                    <strong>{p.title}</strong> ({p.openings} {p.openings === 1 ? 'opening' : 'openings'}){' '}
                    {p.description && `: ${p.description}`}
                  </li>
                ))}
              </ul>
              {r.myApplication ? (
                <div className="row">
                  <span className={`pill ${r.myApplication.status === 'accepted' ? 'pill-ok' : ''}`}>
                    Your application: {r.myApplication.status}
                  </span>
                  {['submitted', 'shortlisted'].includes(r.myApplication.status) && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        withdraw.mutate({ method: 'DELETE', path: `/recruitments/${r.id}/apply` })
                      }
                    >
                      Withdraw
                    </Button>
                  )}
                </div>
              ) : applying === r.id ? (
                <div className="stack">
                  <div className="field">
                    <label htmlFor={`pos-${r.id}`}>Position</label>
                    <select
                      id={`pos-${r.id}`}
                      className="select"
                      onChange={(e) => setPos(e.target.value)}
                      value={pos}
                    >
                      <option value="">No preference</option>
                      {r.positions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <FormRenderer
                    fields={r.fields}
                    profile={{
                      fullName: user.fullName,
                      email: user.email,
                      rollNumber: user.rollNumber,
                      department: user.department,
                      yearOfStudy: user.yearOfStudy,
                    }}
                    submitLabel="Submit application"
                    busy={apply.isPending}
                    onSubmit={(answers) =>
                      apply.mutate({
                        path: `/recruitments/${r.id}/apply`,
                        body: { answers, ...(pos && { positionId: pos }) },
                      })
                    }
                  />
                  <MutationError mutation={apply} />
                </div>
              ) : (
                <Button onClick={() => setApplying(r.id)}>Register</Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </QueryState>
  );
}

/** FR-CLUB-02: About, Our work, Announcements, Discussion, Events, Recruitment. */
export function ClubPage() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'about';
  const q = useGet(['club', slug], `/clubs/${slug}`);
  const { memberships } = useAuth();
  const member = q.data && memberships.find((m) => m.club.id === q.data.id);
  const upcoming = useGet(
    ['events', { club: q.data?.id, hero: true }],
    `/events?club=${q.data?.id}&pageSize=50`,
    { enabled: Boolean(q.data) },
  );
  const recs = useGet(['club', q.data?.id, 'recruitments'], `/clubs/${q.data?.id}/recruitments`, {
    enabled: Boolean(q.data),
  });
  const recruiting = (recs.data ?? []).some((r) => r.acceptingApplications);
  return (
    <QueryState query={q}>
      {(club) => (
        <>
          <header className="club-hero">
            <div className={`club-hero-cover ${coverOf(club.name)}`} />
            <div className="club-hero-main">
              <span className="avatar-xxl" aria-hidden="true">
                {initialsOf(club.name)}
              </span>
              <div className="club-hero-text">
                <span className="pill">{club.category}</span>
                <h1>{club.name}</h1>
                {club.tagline && <p className="lead">{club.tagline}</p>}
                <ul className="hero-stats" aria-label="Club facts">
                  <li>
                    <strong>{club.memberCount}</strong> members
                  </li>
                  <li>
                    <strong>{upcoming.data?.length ?? 0}</strong> upcoming events
                  </li>
                  {recruiting && (
                    <li>
                      <span className="pill pill-ok">Recruiting now</span>
                    </li>
                  )}
                </ul>
              </div>
              <div className="club-hero-actions">
                <FavouriteStar club={club} />
                {member && <Button to={`/club/${club.id}`}>Open workspace</Button>}
                {!member && recruiting && (
                  <Button onClick={() => setParams({ tab: 'recruitment' })}>Join this club</Button>
                )}
              </div>
            </div>
          </header>
          <Tabs
            value={tab}
            onChange={(t) => setParams({ tab: t })}
            tabs={[
              { id: 'about', label: 'About' },
              { id: 'work', label: 'Our work' },
              { id: 'announcements', label: 'Announcements' },
              { id: 'discussion', label: 'Discussion', hidden: !club.publicDiscussionEnabled },
              { id: 'events', label: 'Events' },
              { id: 'recruitment', label: 'Recruitment' },
            ]}
          >
            {tab === 'about' && <About club={club} />}
            {tab === 'work' && <Work club={club} />}
            {tab === 'announcements' && <Announcements club={club} />}
            {tab === 'discussion' && <PublicDiscussion club={club} />}
            {tab === 'events' && <Events club={club} />}
            {tab === 'recruitment' && <Recruitment club={club} />}
          </Tabs>
          <p className="small">
            <Link to="/clubs">Back to all clubs</Link>
          </p>
        </>
      )}
    </QueryState>
  );
}
