import { Link, useParams } from 'react-router-dom';
import { useGet } from '../../api/hooks.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { QueryState } from '../../components/ui/QueryState.jsx';
import { StatusPill } from '../../components/events/EventBits.jsx';
import { fmtDate, fmtDateTime } from '../../utils/dates.js';

/** FR-CW-01: upcoming events, event statuses, open recruitment, latest announcements and pending tasks for this member. */
export function ClubDashboard() {
  const { clubId } = useParams();
  const { membershipFor, can } = useAuth();
  const m = membershipFor(clubId);
  const events = useGet(['club', clubId, 'events'], `/clubs/${clubId}/events`);
  const anns = useGet(['club', clubId, 'announcements'], `/clubs/${clubId}/announcements`);
  const recs = useGet(['club', clubId, 'recruitments'], `/clubs/${clubId}/recruitments`);

  // Pending tasks come from what this role can act on.
  const list = events.data ?? [];
  const tasks = [];
  for (const e of list) {
    if (e.status === 'changes_requested' && can('event.draft', clubId))
      tasks.push({
        text: `Update "${e.title}": the OSI asked for changes`,
        to: `/club/${clubId}/events/${e.id}`,
      });
    if (e.status === 'draft' && can('event.submit', clubId))
      tasks.push({ text: `Submit "${e.title}" to the OSI`, to: `/club/${clubId}/events/${e.id}` });
    if (e.status === 'approved' && !e.registrationStatus && can('registration.publish', clubId))
      tasks.push({
        text: `Publish registration for "${e.title}"`,
        to: `/club/${clubId}/events/${e.id}?tab=form`,
      });
    if (
      e.status === 'approved' &&
      e.registrationStatus === 'closed' &&
      e.hall?.bookingStatus === 'tentative' &&
      can('hall.request', clubId)
    )
      tasks.push({
        text: `Send the final hall request for "${e.title}"`,
        to: `/club/${clubId}/events/${e.id}?tab=hall`,
      });
  }
  const openRec = (recs.data ?? []).filter((r) => r.status === 'open');
  for (const r of openRec) {
    if (r.applicationCount > 0 && can('application.review', clubId))
      tasks.push({
        text: `${r.applicationCount} application(s) for "${r.title}"`,
        to: `/club/${clubId}/recruitment`,
      });
  }

  return (
    <>
      <PageBanner title={m.club.name} description={`You are signed in as ${m.roleName}.`} />
      <div className="two-col">
        <div className="stack">
          <Card>
            <h2>Pending tasks</h2>
            {tasks.length === 0 ? (
              <p className="muted">Nothing needs your attention.</p>
            ) : (
              <ul>
                {tasks.map((t, i) => (
                  <li key={i}>
                    <Link to={t.to}>{t.text}</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2>Upcoming and recent events</h2>
            <QueryState
              query={events}
              emptyTitle="No events yet"
              emptyText="Create a draft from Add an event."
            >
              {(rows) => (
                <ul className="stack-sm">
                  {rows.slice(0, 6).map((e) => (
                    <li key={e.id} className="row-between">
                      <span>
                        <Link to={`/club/${clubId}/events/${e.id}`}>{e.title}</Link>{' '}
                        <span className="muted small">{fmtDateTime(e.startsAt)}</span>
                      </span>
                      <StatusPill status={e.status} />
                    </li>
                  ))}
                </ul>
              )}
            </QueryState>
          </Card>
        </div>
        <div className="stack">
          <Card>
            <h2>Open recruitment</h2>
            {openRec.length === 0 ? (
              <p className="muted">No open recruitment.</p>
            ) : (
              <ul>
                {openRec.map((r) => (
                  <li key={r.id}>
                    {r.title} <span className="muted small">closes {fmtDate(r.deadline)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2>Latest announcements</h2>
            <QueryState query={anns} emptyTitle="No announcements">
              {(rows) => (
                <ul>
                  {rows.slice(0, 4).map((a) => (
                    <li key={a.id}>
                      <strong>{a.title}</strong> <span className="muted small">{fmtDate(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </QueryState>
          </Card>
          <Card>
            <h2>What your role can do</h2>
            {m.permissions.length === 0 ? (
              <p className="muted">
                Members can read the workspace and take part in the internal discussion.
              </p>
            ) : (
              <ul className="chips-list">
                {m.permissions.map((p) => (
                  <li key={p}>
                    <code>{p}</code>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
