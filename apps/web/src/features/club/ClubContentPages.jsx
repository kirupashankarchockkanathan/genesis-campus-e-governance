import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CLUB_CATEGORIES } from '@ccp/shared';
import { useAction, useGet } from '../../api/hooks.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { FormField } from '../../components/ui/FormField.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { MutationError, QueryState } from '../../components/ui/QueryState.jsx';
import { PermissionGate } from '../../app/guards/guards.jsx';
import { fmtDate, fmtDateTime } from '../../utils/dates.js';

// ---------- Announcements (FR-ANN-01/02) ----------
export function ClubAnnouncementsPage() {
  const { clubId } = useParams();
  const { can, user } = useAuth();
  const key = ['club', clubId, 'announcements'];
  const q = useGet(key, `/clubs/${clubId}/announcements`);
  const [form, setForm] = useState({ title: '', body: '' });
  const [deleting, setDeleting] = useState(null);
  const post = useAction({ invalidate: [key], onSuccess: () => setForm({ title: '', body: '' }) });
  const pin = useAction({ invalidate: [key] });
  const remove = useAction({ invalidate: [key], onSuccess: () => setDeleting(null) });
  const manage = can('announcement.delete', clubId);
  return (
    <>
      <PageBanner
        title="Announcements"
        description="Post updates for students and members. Pinned posts stay on top."
      />
      <Card>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            post.mutate({ path: `/clubs/${clubId}/announcements`, body: form });
          }}
        >
          <FormField
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <div className="field">
            <label htmlFor="ann-body">Message</label>
            <textarea
              id="ann-body"
              className="input textarea"
              rows={4}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={!form.title.trim() || !form.body.trim() || post.isPending}>
            Post announcement
          </Button>
          <MutationError mutation={post} />
        </form>
      </Card>
      <QueryState query={q} emptyTitle="No announcements yet">
        {(rows) => (
          <div className="stack">
            {rows.map((a) => (
              <Card key={a.id} as="article">
                <div className="row-between">
                  <h3>{a.title}</h3>
                  {a.isPinned && <span className="pill">Pinned</span>}
                </div>
                <p style={{ whiteSpace: 'pre-wrap' }}>{a.body}</p>
                <p className="muted small">
                  {a.authorName}, {fmtDateTime(a.createdAt)}
                </p>
                <div className="row">
                  {manage && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        pin.mutate({
                          method: 'PATCH',
                          path: `/announcements/${a.id}`,
                          body: { isPinned: !a.isPinned },
                        })
                      }
                    >
                      {a.isPinned ? 'Unpin' : 'Pin'}
                    </Button>
                  )}
                  {(manage || (a.authorId === user.id && can('announcement.post', clubId))) && (
                    <Button variant="secondary" onClick={() => setDeleting(a.id)}>
                      Delete
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
      <MutationError mutation={pin} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this announcement?"
        message="It will disappear for everyone."
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => remove.mutate({ method: 'DELETE', path: `/announcements/${deleting}` })}
      />
    </>
  );
}

// ---------- Internal discussion with live updates (FR-DISC-01) ----------
export function ClubDiscussionPage() {
  const { clubId } = useParams();
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const key = ['club', clubId, 'internal-discussion'];
  const q = useGet(key, `/clubs/${clubId}/discussions/internal/messages`);
  const [text, setText] = useState('');
  const end = useRef(null);
  const post = useAction({ onSuccess: () => setText('') });
  const remove = useAction({ invalidate: [key] });
  // Live updates arrive over the notification stream as a window event.
  useEffect(() => {
    const onMsg = (e) => {
      if (e.detail?.clubId === clubId && e.detail.scope === 'internal') {
        qc.setQueryData(key, (old = []) =>
          old.some((m) => m.id === e.detail.message.id) ? old : [...old, e.detail.message],
        );
      }
    };
    window.addEventListener('ccp:discussion', onMsg);
    return () => window.removeEventListener('ccp:discussion', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, qc]);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [q.data]);
  const send = (e) => {
    e.preventDefault();
    post.mutate(
      { path: `/clubs/${clubId}/discussions/internal/messages`, body: { body: text } },
      {
        onSuccess: (m) =>
          qc.setQueryData(key, (old = []) => (old.some((x) => x.id === m.id) ? old : [...old, m])),
      },
    );
  };
  return (
    <>
      <PageBanner title="Discussion" description="Internal chat for active members of this club." />
      <Card className="stack">
        <QueryState query={q} emptyTitle="No messages yet" emptyText="Say hello to the team.">
          {(rows) => (
            <ul className="msg-list stack" aria-live="polite" aria-label="Messages">
              {rows.map((m) => (
                <li key={m.id} className={`msg ${m.userId === user.id ? 'mine' : ''}`}>
                  <span className="small muted">
                    {m.authorName}, {fmtDateTime(m.createdAt)}
                  </span>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{m.body}</p>
                  {(m.userId === user.id || can('discussion.moderate', clubId)) && (
                    <button
                      className="btn btn-link"
                      onClick={() =>
                        remove.mutate({ method: 'DELETE', path: `/discussion-messages/${m.id}` })
                      }
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
              <li ref={end} />
            </ul>
          )}
        </QueryState>
        <form className="row" onSubmit={send}>
          <label className="visually-hidden" htmlFor="msg">
            Message
          </label>
          <input
            id="msg"
            className="input"
            style={{ flex: 1 }}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message"
            autoComplete="off"
          />
          <Button type="submit" disabled={!text.trim() || post.isPending}>
            Send
          </Button>
        </form>
        <MutationError mutation={post} />
      </Card>
    </>
  );
}

// ---------- Club profile and Our work (FR-CLUB-05) ----------
export function ClubProfilePage() {
  const { clubId } = useParams();
  const { can } = useAuth();
  const club = useGet(['club', clubId], `/clubs/${clubId}`);
  const worksKey = ['club', clubId, 'works'];
  const works = useGet(worksKey, `/clubs/${clubId}/works`);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState(null);
  const [work, setWork] = useState({ title: '', description: '', happenedOn: '', linkUrl: '' });
  const save = useAction({
    invalidate: [['club'], ['clubs']],
    onSuccess: () => {
      setSaved(true);
      setDraft(null);
    },
  });
  const addWork = useAction({
    invalidate: [worksKey],
    onSuccess: () => setWork({ title: '', description: '', happenedOn: '', linkUrl: '' }),
  });
  const delWork = useAction({ invalidate: [worksKey] });
  const c = club.data;
  const v =
    draft ??
    (c && {
      tagline: c.tagline ?? '',
      description: c.description ?? '',
      whyJoin: c.whyJoin ?? '',
      aim: c.aim ?? '',
      meetingInfo: c.meetingInfo ?? '',
      contactEmail: c.contactEmail ?? '',
      facultyCoordinator: c.facultyCoordinator ?? '',
      category: c.category,
      publicDiscussionEnabled: c.publicDiscussionEnabled,
    });
  const set = (k) => (e) => {
    setSaved(false);
    setDraft({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  };
  return (
    <>
      <PageBanner title="Club profile" description="What students see on your club page." />
      <QueryState query={club}>
        {() => (
          <div className="stack">
            <PermissionGate
              permission="club.profile.edit"
              clubId={clubId}
              fallback={<p className="notice">Your role cannot edit the club page.</p>}
            >
              <Card>
                <form
                  className="stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const body = { ...v };
                    for (const k of ['contactEmail']) if (!body[k]) delete body[k];
                    save.mutate({ method: 'PATCH', path: `/clubs/${clubId}`, body });
                  }}
                >
                  <FormField label="Tagline" value={v.tagline} onChange={set('tagline')} />
                  <FormField label="Category" as="select" value={v.category} onChange={set('category')}>
                    {CLUB_CATEGORIES.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </FormField>
                  {[
                    ['description', 'About'],
                    ['whyJoin', 'Why join'],
                    ['aim', 'Aim'],
                    ['meetingInfo', 'Meeting information'],
                  ].map(([k, l]) => (
                    <div className="field" key={k}>
                      <label htmlFor={`cp-${k}`}>{l}</label>
                      <textarea
                        id={`cp-${k}`}
                        className="input textarea"
                        rows={3}
                        value={v[k]}
                        onChange={set(k)}
                      />
                    </div>
                  ))}
                  <FormField
                    label="Contact email"
                    type="email"
                    value={v.contactEmail}
                    onChange={set('contactEmail')}
                  />
                  <FormField
                    label="Faculty coordinator"
                    value={v.facultyCoordinator}
                    onChange={set('facultyCoordinator')}
                  />
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={v.publicDiscussionEnabled}
                      onChange={set('publicDiscussionEnabled')}
                    />{' '}
                    Allow the public discussion on the club page
                  </label>
                  <Button type="submit" disabled={!draft || save.isPending}>
                    Save club page
                  </Button>
                  {saved && (
                    <p className="notice notice-ok" role="status">
                      Saved.
                    </p>
                  )}
                  <MutationError mutation={save} />
                </form>
              </Card>
            </PermissionGate>
            <Card className="stack">
              <h2>Our work</h2>
              <QueryState query={works} emptyTitle="Nothing added yet">
                {(rows) => (
                  <DataTable
                    caption="Our work"
                    rows={rows}
                    columns={[
                      { key: 'title', header: 'Title' },
                      {
                        key: 'date',
                        header: 'Date',
                        render: (w) => (w.happenedOn ? fmtDate(w.happenedOn) : ''),
                      },
                      {
                        key: 'act',
                        header: '',
                        render: (w) =>
                          can('club.works.manage', clubId) && (
                            <button
                              className="btn btn-link"
                              onClick={() =>
                                delWork.mutate({ method: 'DELETE', path: `/clubs/${clubId}/works/${w.id}` })
                              }
                            >
                              Remove
                            </button>
                          ),
                      },
                    ]}
                  />
                )}
              </QueryState>
              <PermissionGate permission="club.works.manage" clubId={clubId}>
                <form
                  className="stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addWork.mutate({
                      path: `/clubs/${clubId}/works`,
                      body: {
                        title: work.title,
                        description: work.description || undefined,
                        happenedOn: work.happenedOn || undefined,
                        linkUrl: work.linkUrl || undefined,
                      },
                    });
                  }}
                >
                  <h3>Add an entry</h3>
                  <FormField
                    label="Title"
                    value={work.title}
                    onChange={(e) => setWork({ ...work, title: e.target.value })}
                  />
                  <FormField
                    label="Description"
                    value={work.description}
                    onChange={(e) => setWork({ ...work, description: e.target.value })}
                  />
                  <div className="row">
                    <FormField
                      label="Date"
                      type="date"
                      value={work.happenedOn}
                      onChange={(e) => setWork({ ...work, happenedOn: e.target.value })}
                    />
                    <FormField
                      label="Link"
                      type="url"
                      value={work.linkUrl}
                      onChange={(e) => setWork({ ...work, linkUrl: e.target.value })}
                    />
                  </div>
                  <Button type="submit" disabled={work.title.trim().length < 2 || addWork.isPending}>
                    Add entry
                  </Button>
                  <MutationError mutation={addWork} />
                </form>
              </PermissionGate>
            </Card>
          </div>
        )}
      </QueryState>
    </>
  );
}

// ---------- Reports ----------
export function ClubReportsPage() {
  const { clubId } = useParams();
  const q = useGet(['club', clubId, 'reports'], `/clubs/${clubId}/reports`);
  return (
    <>
      <PageBanner title="Reports" description="Members, registrations and attendance." />
      <QueryState query={q} isEmpty={() => false}>
        {(r) => (
          <div className="stack">
            <Card>
              <dl className="profile-grid">
                <div>
                  <dt className="muted small">Members</dt>
                  <dd>{r.members}</dd>
                </div>
                <div>
                  <dt className="muted small">Registrations</dt>
                  <dd>{r.totals.registered}</dd>
                </div>
                <div>
                  <dt className="muted small">Attended</dt>
                  <dd>{r.totals.attended}</dd>
                </div>
                <div>
                  <dt className="muted small">Attendance rate</dt>
                  <dd>{r.totals.attendanceRate === null ? '-' : `${r.totals.attendanceRate}%`}</dd>
                </div>
                <div>
                  <dt className="muted small">Open recruitments</dt>
                  <dd>{r.openRecruitments}</dd>
                </div>
                <div>
                  <dt className="muted small">Pending applications</dt>
                  <dd>{r.pendingApplications}</dd>
                </div>
              </dl>
            </Card>
            <Card className="stack">
              <h2>Events</h2>
              <DataTable
                caption="Event statistics"
                rows={r.events}
                empty="No approved events yet."
                rowKey={(e) => e.eventId}
                columns={[
                  { key: 'title', header: 'Event' },
                  { key: 'date', header: 'Date', render: (e) => fmtDate(e.startsAt) },
                  { key: 'reg', header: 'Registered' },
                  { key: 'att', header: 'Attended', render: (e) => e.attended },
                  { key: 'ns', header: 'No-show', render: (e) => e.noShow },
                  {
                    key: 'rate',
                    header: 'Attendance',
                    render: (e) => (e.attendanceRate === null ? '-' : `${e.attendanceRate}%`),
                  },
                ]}
              />
              <div className="bars" role="img" aria-label="Registered versus attended per event">
                {r.events.map((e) => (
                  <div key={e.eventId} className="bar-row">
                    <span className="small">{e.title}</span>
                    <span className="bar" style={{ width: `${Math.min(100, e.registered * 4)}%` }}>
                      {e.registered} registered
                    </span>
                    <span className="bar bar-alt" style={{ width: `${Math.min(100, e.attended * 4)}%` }}>
                      {e.attended} attended
                    </span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h2>Members by role</h2>
              <ul>
                {r.membersByRole.map((m) => (
                  <li key={m.role}>
                    {m.role}: {m.count}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </QueryState>
    </>
  );
}
