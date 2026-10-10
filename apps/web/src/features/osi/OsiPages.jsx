import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CLUB_CATEGORIES, OSI_LABEL } from '@ccp/shared';
import { useAction, useGet } from '../../api/hooks.js';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { FormField } from '../../components/ui/FormField.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { MutationError, QueryState } from '../../components/ui/QueryState.jsx';
import { StatusPill } from '../../components/events/EventBits.jsx';
import { fmtDateTime, fmtRange } from '../../utils/dates.js';

/** FR-ADMIN-01: approvals queue with the held hall and expected numbers. */
export function ApprovalsPage() {
  const q = useGet(['osi', 'queue'], '/osi/events?status=submitted');
  return (
    <>
      <PageBanner
        title="Approvals"
        description={`Event plans waiting for a decision from the ${OSI_LABEL}.`}
      />
      <QueryState query={q} emptyTitle="Nothing to review" emptyText="Submitted events will appear here.">
        {(rows) => (
          <Card>
            <DataTable
              caption="Events waiting for approval"
              rows={rows}
              columns={[
                {
                  key: 'title',
                  header: 'Event',
                  render: (e) => <Link to={`/osi/approvals/${e.id}`}>{e.title}</Link>,
                },
                { key: 'club', header: 'Club', render: (e) => e.clubName },
                { key: 'when', header: 'When', render: (e) => fmtDateTime(e.startsAt) },
                { key: 'size', header: 'Expected', render: (e) => e.expectedParticipants },
                {
                  key: 'hall',
                  header: 'Held hall',
                  render: (e) =>
                    e.hall ? `${e.hall.name} (${e.hall.capacity})` : e.mode === 'online' ? 'Online' : 'None',
                },
                { key: 'at', header: 'Submitted', render: (e) => fmtDateTime(e.submittedAt) },
              ]}
            />
          </Card>
        )}
      </QueryState>
    </>
  );
}

/** FR-EVT-05: the full plan, poster and the three decisions. A note is required for changes and rejection. */
export function ApprovalReviewPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const q = useGet(['event', eventId], `/events/${eventId}`);
  const history = useGet(['event', eventId, 'history'], `/events/${eventId}/history`, { retry: false });
  const [decision, setDecision] = useState(null);
  const [note, setNote] = useState('');
  const [circulate, setCirculate] = useState(true);
  const act = useAction({
    invalidate: [['osi'], ['event', eventId], ['events'], ['calendar']],
    onSuccess: () => navigate('/osi/approvals'),
  });
  const needsNote = decision && decision !== 'approved';
  return (
    <QueryState query={q}>
      {(ev) => (
        <>
          <PageBanner
            title={ev.title}
            description={`${ev.clubName} · ${fmtRange(ev.startsAt, ev.endsAt)}`}
            actions={<StatusPill status={ev.status} />}
          />
          <div className="two-col">
            <Card className="stack">
              <h2>Plan</h2>
              <dl className="stack-sm">
                <div>
                  <dt className="muted small">Type and mode</dt>
                  <dd>
                    {ev.type.replace('_', ' ')}, {ev.mode}
                  </dd>
                </div>
                <div>
                  <dt className="muted small">Summary</dt>
                  <dd>{ev.summary}</dd>
                </div>
                <div>
                  <dt className="muted small">Description</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{ev.description}</dd>
                </div>
                <div>
                  <dt className="muted small">Objectives</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{ev.objectives}</dd>
                </div>
                {ev.agenda?.length > 0 && (
                  <div>
                    <dt className="muted small">Schedule</dt>
                    <dd>
                      <ul>
                        {ev.agenda.map((a, i) => (
                          <li key={i}>
                            {a.time} {a.title}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="muted small">Expected participants</dt>
                  <dd>{ev.expectedParticipants}</dd>
                </div>
                <div>
                  <dt className="muted small">Registration deadline</dt>
                  <dd>{fmtDateTime(ev.registrationDeadline)}</dd>
                </div>
                <div>
                  <dt className="muted small">Faculty coordinator</dt>
                  <dd>{ev.facultyCoordinator ?? 'None'}</dd>
                </div>
                <div>
                  <dt className="muted small">Held hall</dt>
                  <dd>
                    {ev.hall
                      ? `${ev.hall.name}, ${ev.hall.building ?? ''} (seats ${ev.hall.capacity}, ${ev.hall.bookingStatus})`
                      : ev.mode === 'online'
                        ? 'Online event'
                        : 'None'}
                  </dd>
                </div>
              </dl>
              {ev.status === 'submitted' ? (
                <div className="row">
                  <Button onClick={() => setDecision('approved')}>Approve and circulate</Button>
                  <Button variant="secondary" onClick={() => setDecision('changes_requested')}>
                    Request changes
                  </Button>
                  <Button variant="danger" onClick={() => setDecision('rejected')}>
                    Reject
                  </Button>
                </div>
              ) : (
                <p className="notice">This event is {ev.status.replace('_', ' ')}; no decision is pending.</p>
              )}
            </Card>
            <div className="stack">
              {ev.posterUrl &&
                (/\.pdf$/i.test(ev.posterUrl) ? (
                  <a className="btn btn-secondary" href={ev.posterUrl} target="_blank" rel="noreferrer">
                    Open poster (PDF)
                  </a>
                ) : (
                  <img className="poster" src={ev.posterUrl} alt={`Poster of ${ev.title}`} />
                ))}
              <Card>
                <h2>Review history</h2>
                {history.data?.length ? (
                  <ol className="history">
                    {history.data.map((r, i) => (
                      <li key={i}>
                        <strong>{r.action}</strong> <span className="muted small">{fmtDateTime(r.at)}</span>
                        {r.note && <p>{r.note}</p>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted">No earlier decisions.</p>
                )}
              </Card>
            </div>
          </div>
          <Modal
            open={Boolean(decision)}
            title={
              {
                approved: 'Approve and circulate',
                changes_requested: 'Request changes',
                rejected: 'Reject this event',
              }[decision] ?? ''
            }
            onClose={() => setDecision(null)}
            footer={
              <>
                <Button variant="secondary" onClick={() => setDecision(null)}>
                  Back
                </Button>
                <Button
                  variant={decision === 'rejected' ? 'danger' : 'primary'}
                  disabled={act.isPending || (needsNote && note.trim().length < 3)}
                  onClick={() =>
                    act.mutate({
                      path: `/osi/events/${ev.id}/decision`,
                      body: { decision, note: note || undefined, circulate },
                    })
                  }
                >
                  Confirm
                </Button>
              </>
            }
          >
            {decision === 'approved' && (
              <label className="check">
                <input type="checkbox" checked={circulate} onChange={(e) => setCirculate(e.target.checked)} />{' '}
                Circulate the poster to all students and calendars now
              </label>
            )}
            {decision === 'rejected' && <p>The hall hold is released straight away.</p>}
            {decision === 'changes_requested' && (
              <p>The club can edit and submit again; the hall hold is kept.</p>
            )}
            <div className="field">
              <label htmlFor="note">{needsNote ? 'Note for the club (required)' : 'Note (optional)'}</label>
              <textarea
                id="note"
                className="input textarea"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <MutationError mutation={act} />
          </Modal>
        </>
      )}
    </QueryState>
  );
}

/** FR-CLUB-04 / D5: the OSI creates clubs and assigns the first Leader. */
export function OsiClubsPage() {
  const q = useGet(['clubs', {}], '/clubs');
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: '', category: CLUB_CATEGORIES[0], description: '', leaderEmail: '' });
  const [editing, setEditing] = useState(null);
  const create = useAction({
    invalidate: [['clubs']],
    onSuccess: () => {
      setOpen(false);
      setV({ name: '', category: CLUB_CATEGORIES[0], description: '', leaderEmail: '' });
    },
  });
  const edit = useAction({ invalidate: [['clubs'], ['club']] });
  return (
    <>
      <PageBanner
        title="Clubs"
        description="Create clubs and assign their first Leader."
        actions={
          <Button variant="light" onClick={() => setOpen(true)}>
            New club
          </Button>
        }
      />
      <QueryState query={q} emptyTitle="No clubs yet">
        {(rows) => (
          <Card>
            <DataTable
              caption="Clubs"
              rows={rows}
              columns={[
                { key: 'name', header: 'Club', render: (c) => <Link to={`/clubs/${c.slug}`}>{c.name}</Link> },
                { key: 'cat', header: 'Category', render: (c) => c.category },
                { key: 'members', header: 'Members', render: (c) => c.memberCount },
                { key: 'rec', header: 'Recruiting', render: (c) => (c.recruiting ? 'Yes' : 'No') },
                {
                  key: 'act',
                  header: '',
                  render: (c) => (
                    <Button variant="secondary" onClick={() => setEditing(c)}>
                      Edit contact
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        )}
      </QueryState>
      <Modal
        open={open}
        title="New club"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={create.isPending || v.name.length < 2 || !v.leaderEmail}
              onClick={() => create.mutate({ path: '/clubs', body: v })}
            >
              Create club
            </Button>
          </>
        }
      >
        <FormField label="Club name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        <FormField
          label="Category"
          as="select"
          value={v.category}
          onChange={(e) => setV({ ...v, category: e.target.value })}
        >
          {CLUB_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </FormField>
        <div className="field">
          <label htmlFor="club-desc">Description</label>
          <textarea
            id="club-desc"
            className="input textarea"
            rows={3}
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
          />
        </div>
        <FormField
          label="First Leader (student college email)"
          type="email"
          value={v.leaderEmail}
          onChange={(e) => setV({ ...v, leaderEmail: e.target.value })}
          help="The student must already have an account"
        />
        <MutationError mutation={create} />
      </Modal>
      <EditContact club={editing} onClose={() => setEditing(null)} edit={edit} />
    </>
  );
}

function EditContact({ club, onClose, edit }) {
  const [tagline, setTagline] = useState('');
  const [contact, setContact] = useState('');
  return (
    <Modal
      open={Boolean(club)}
      title={club ? `Edit ${club.name}` : ''}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={edit.isPending}
            onClick={() =>
              edit.mutate(
                {
                  method: 'PATCH',
                  path: `/clubs/${club.id}`,
                  body: { ...(tagline && { tagline }), ...(contact && { contactEmail: contact }) },
                },
                { onSuccess: onClose },
              )
            }
          >
            Save
          </Button>
        </>
      }
    >
      <FormField
        label="Tagline"
        value={tagline}
        onChange={(e) => setTagline(e.target.value)}
        placeholder={club?.tagline ?? ''}
      />
      <FormField
        label="Contact email"
        type="email"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder={club?.contactEmail ?? ''}
      />
      <MutationError mutation={edit} />
    </Modal>
  );
}

/** Content reports: reported messages from every club's public discussion (spec 6.3, Phase 3). */
export function OsiReportsPage() {
  const q = useGet(['osi', 'reports'], '/osi/reports');
  const remove = useAction({ invalidate: [['osi', 'reports']] });
  return (
    <>
      <PageBanner title="Reports" description="Messages reported by students in public club discussions." />
      <QueryState query={q} emptyTitle="No reported messages" emptyText="Reported content will appear here.">
        {(rows) => (
          <Card>
            <DataTable
              caption="Reported messages"
              rows={rows}
              columns={[
                { key: 'club', header: 'Club', render: (m) => m.clubName },
                { key: 'author', header: 'Author', render: (m) => m.authorName },
                { key: 'body', header: 'Message', render: (m) => m.body },
                { key: 'n', header: 'Reports', render: (m) => m.reportedCount },
                {
                  key: 'act',
                  header: '',
                  render: (m) => (
                    <Button
                      variant="danger"
                      onClick={() =>
                        remove.mutate({ method: 'DELETE', path: `/discussion-messages/${m.id}` })
                      }
                    >
                      Remove message
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        )}
      </QueryState>
      <MutationError mutation={remove} />
    </>
  );
}
