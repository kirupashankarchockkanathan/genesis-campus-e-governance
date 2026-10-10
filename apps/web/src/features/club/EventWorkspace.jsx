import { useCallback, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiBlob, apiUpload } from '../../api/client.js';
import { useAction, useGet } from '../../api/hooks.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { FormField } from '../../components/ui/FormField.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { MutationError, QueryState } from '../../components/ui/QueryState.jsx';
import { Pill } from '../../components/ui/Pill.jsx';
import { FormBuilder, validateFields } from '../../components/forms/FormBuilder.jsx';
import { HallPicker } from '../../components/halls/Halls.jsx';
import { QrScanner, StatusPill } from '../../components/events/EventBits.jsx';
import { fmtDateTime, fmtRange, fromInputValue } from '../../utils/dates.js';
import { EventPlanForm } from './EventPlanForm.jsx';

const EDITABLE = ['draft', 'changes_requested'];
const errMap = (e) =>
  Object.fromEntries(
    (Array.isArray(e?.details) ? e.details : []).filter((d) => d.path).map((d) => [d.path, d.message]),
  );

// ---------- Plan ----------
function PlanTab({ ev, clubId, can }) {
  const [editing, setEditing] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [hallId, setHallId] = useState(ev.hall?.id ?? '');
  const [reason, setReason] = useState('');
  const navigate = useNavigate();
  const inv = [['event', ev.id], ['club', clubId, 'events'], ['events']];
  const save = useAction({ invalidate: inv, onSuccess: () => setEditing(false) });
  const submit = useAction({ invalidate: inv, onSuccess: () => setSubmitOpen(false) });
  const cancel = useAction({ invalidate: inv, onSuccess: () => setCancelOpen(false) });
  const del = useAction({ invalidate: inv, onSuccess: () => navigate(`/club/${clubId}/events`) });
  const release = useAction({ invalidate: inv });
  const editable = EDITABLE.includes(ev.status);
  const canCancel =
    can('event.draft') && ['draft', 'changes_requested', 'submitted', 'approved'].includes(ev.status);
  const needsHall = ev.mode !== 'online';

  return (
    <div className="stack">
      {ev.status === 'changes_requested' && (
        <div className="notice notice-bad" role="status">
          The OSI asked for changes. See the History tab for the note, update the plan and submit again.
        </div>
      )}
      {ev.status === 'submitted' && (
        <div className="notice" role="status">
          Submitted to the OSI. The plan is locked while it is reviewed.
        </div>
      )}
      <Card>
        {editing ? (
          <>
            <EventPlanForm
              initial={ev}
              submitLabel="Save changes"
              busy={save.isPending}
              serverErrors={errMap(save.error)}
              onSubmit={(body) => save.mutate({ method: 'PATCH', path: `/events/${ev.id}`, body })}
            />
            <MutationError mutation={save} />
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel editing
            </Button>
          </>
        ) : (
          <div className="stack">
            <dl className="stack-sm">
              <div>
                <dt className="muted small">Summary</dt>
                <dd>{ev.summary}</dd>
              </div>
              <div>
                <dt className="muted small">When</dt>
                <dd>{fmtRange(ev.startsAt, ev.endsAt)}</dd>
              </div>
              <div>
                <dt className="muted small">Registration deadline</dt>
                <dd>{fmtDateTime(ev.registrationDeadline)}</dd>
              </div>
              <div>
                <dt className="muted small">Mode and size</dt>
                <dd>
                  {ev.mode}, {ev.expectedParticipants} expected
                </dd>
              </div>
              {ev.description && (
                <div>
                  <dt className="muted small">Description</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{ev.description}</dd>
                </div>
              )}
              {ev.objectives && (
                <div>
                  <dt className="muted small">Objectives</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{ev.objectives}</dd>
                </div>
              )}
              {ev.agenda?.length > 0 && (
                <div>
                  <dt className="muted small">Schedule</dt>
                  <dd>
                    <ul>
                      {ev.agenda.map((a, i) => (
                        <li key={i}>
                          {a.time && <strong>{a.time}: </strong>}
                          {a.title}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              {ev.cancelledReason && (
                <div>
                  <dt className="muted small">Cancelled because</dt>
                  <dd>{ev.cancelledReason}</dd>
                </div>
              )}
            </dl>
            <div className="row">
              {editable && can('event.draft') && <Button onClick={() => setEditing(true)}>Edit plan</Button>}
              {editable && can('event.submit') && (
                <Button onClick={() => setSubmitOpen(true)}>Submit to {'OSI'}</Button>
              )}
              {editable && !can('event.submit') && (
                <span className="muted small" title="Only the Leader can submit">
                  Only the Leader can submit to the OSI.
                </span>
              )}
              {canCancel && (
                <Button variant="secondary" onClick={() => setCancelOpen(true)}>
                  Cancel event
                </Button>
              )}
              {ev.status === 'draft' && !ev.submittedAt && can('event.draft') && (
                <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                  Delete draft
                </Button>
              )}
              {ev.status === 'changes_requested' &&
                ev.hall?.bookingStatus === 'tentative' &&
                can('event.submit') && (
                  <Button
                    variant="secondary"
                    onClick={() => release.mutate({ method: 'DELETE', path: `/events/${ev.id}/hall-hold` })}
                  >
                    Release hall hold
                  </Button>
                )}
            </div>
            <MutationError mutation={release} />
          </div>
        )}
      </Card>

      <Modal
        open={submitOpen}
        title="Submit to the OSI"
        onClose={() => setSubmitOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSubmitOpen(false)}>
              Back
            </Button>
            <Button
              disabled={submit.isPending || (needsHall && !hallId)}
              onClick={() =>
                submit.mutate({ path: `/events/${ev.id}/submit`, body: needsHall ? { hallId } : {} })
              }
            >
              {submit.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </>
        }
      >
        <p>
          Submitting locks the plan and places a tentative hold on the hall you choose. The poster,
          description and objectives must be complete.
        </p>
        {needsHall && (
          <HallPicker
            from={ev.startsAt}
            to={ev.endsAt}
            minCapacity={ev.expectedParticipants}
            value={hallId}
            onChange={setHallId}
          />
        )}
        <MutationError mutation={submit} />
        {submit.error?.code === 'HALL_UNAVAILABLE' && submit.error.details?.alternatives?.length > 0 && (
          <p className="small">
            Free alternatives:{' '}
            {submit.error.details.alternatives.map((a) => `${a.name} (${a.capacity})`).join(', ')}
          </p>
        )}
      </Modal>

      <Modal
        open={cancelOpen}
        title="Cancel this event"
        onClose={() => setCancelOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Keep event
            </Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 3 || cancel.isPending}
              onClick={() => cancel.mutate({ path: `/events/${ev.id}/cancel`, body: { reason } })}
            >
              Cancel event
            </Button>
          </>
        }
      >
        <p>Registered students are notified and the hall is released.</p>
        <FormField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <MutationError mutation={cancel} />
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this draft?"
        message="The draft and its form are removed for good."
        confirmLabel="Delete"
        danger
        busy={del.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => del.mutate({ method: 'DELETE', path: `/events/${ev.id}` })}
      />
    </div>
  );
}

// ---------- Poster ----------
function PosterTab({ ev, can }) {
  const qc = useQueryClient();
  const [state, setState] = useState({ busy: false, error: '' });
  const editable = EDITABLE.includes(ev.status) && can('event.poster.upload');
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setState({ busy: true, error: '' });
    try {
      const fd = new FormData();
      fd.append('poster', file);
      await apiUpload(`/events/${ev.id}/poster`, fd);
      qc.invalidateQueries({ queryKey: ['event', ev.id] });
      setState({ busy: false, error: '' });
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  };
  return (
    <Card className="stack">
      {ev.posterUrl ? (
        /\.pdf$/i.test(ev.posterUrl) ? (
          <a href={ev.posterUrl} target="_blank" rel="noreferrer">
            Open the poster (PDF)
          </a>
        ) : (
          <img className="poster" src={ev.posterUrl} alt={`Poster of ${ev.title}`} />
        )
      ) : (
        <p className="muted">No poster yet. A poster is required before submitting.</p>
      )}
      {editable ? (
        <div className="field">
          <label htmlFor="poster-file">
            {ev.posterUrl ? 'Replace the poster' : 'Upload the poster'} (PNG, JPG, WebP or PDF, up to 5 MB)
          </label>
          <input id="poster-file" type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" onChange={upload} />
        </div>
      ) : (
        <p className="muted small" title="Your role or the event status does not allow this">
          {can('event.poster.upload')
            ? 'The poster is locked while the event is under review.'
            : 'Your role cannot upload posters.'}
        </p>
      )}
      {state.busy && <p role="status">Uploading...</p>}
      {state.error && (
        <p className="notice notice-bad" role="alert">
          {state.error}
        </p>
      )}
    </Card>
  );
}

// ---------- Form ----------
function FormTab({ ev, clubId, can }) {
  const key = ['event', ev.id, 'form'];
  const q = useGet(key, `/events/${ev.id}/form`, { retry: false });
  const clubEvents = useGet(['club', clubId, 'events'], `/clubs/${clubId}/events`);
  const [fields, setFields] = useState(null);
  const [title, setTitle] = useState('');
  const [opts, setOpts] = useState({ maxSeats: '', closesAt: '', waitlist: false });
  const [fromEvent, setFromEvent] = useState('');
  const inv = [key, ['event', ev.id]];
  const save = useAction({ invalidate: inv });
  const dup = useAction({ invalidate: inv, onSuccess: () => setFields(null) });
  const publish = useAction({ invalidate: [...inv, ['events'], ['calendar']] });
  const close = useAction({ invalidate: inv });

  const form = q.data;
  const current = fields ?? form?.fields ?? [];
  const draft = !form || form.status === 'draft';
  const manage = can('form.manage');
  const issues = validateFields(current);
  const onSave = () => {
    const clean = current.map((f) =>
      f.options ? { ...f, options: f.options.map((o) => o.trim()).filter(Boolean) } : f,
    );
    save.mutate({
      method: 'PUT',
      path: `/events/${ev.id}/form`,
      body: {
        title: title || form?.title || `${ev.title}: registration`,
        description: form?.description ?? '',
        fields: clean,
      },
    });
  };
  const publishBody = {
    ...(opts.maxSeats && { maxSeats: Number(opts.maxSeats) }),
    ...(opts.closesAt && { closesAt: fromInputValue(opts.closesAt) }),
    waitlist: opts.waitlist,
  };

  return (
    <div className="stack">
      {form && (
        <p>
          Status: <Pill status={form.status === 'published' ? 'open' : form.status}>{form.status}</Pill>{' '}
          {form.closesAt && <span className="muted small">Closes {fmtDateTime(form.closesAt)}</span>}
        </p>
      )}
      {draft && manage ? (
        <>
          <p className="muted">
            Name, college email, roll number, department and year are filled from each student&apos;s profile. Add
            only the extra questions you need.
          </p>
          <FormField
            label="Form title"
            value={title || form?.title || ''}
            placeholder={`${ev.title}: registration`}
            onChange={(e) => setTitle(e.target.value)}
          />
          <FormBuilder fields={current} onChange={setFields} />
          <div className="row">
            <Button onClick={onSave} disabled={save.isPending || issues.length > 0}>
              {save.isPending ? 'Saving...' : 'Save form'}
            </Button>
            {save.isSuccess && (
              <span role="status" className="pill pill-ok">
                Saved
              </span>
            )}
            {clubEvents.data?.filter((e) => e.id !== ev.id).length > 0 && (
              <>
                <label className="visually-hidden" htmlFor="dup-from">
                  Copy the form from
                </label>
                <select
                  id="dup-from"
                  className="select"
                  style={{ maxWidth: 260 }}
                  value={fromEvent}
                  onChange={(e) => setFromEvent(e.target.value)}
                >
                  <option value="">Copy from an older event...</option>
                  {clubEvents.data
                    .filter((e) => e.id !== ev.id)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title}
                      </option>
                    ))}
                </select>
                <Button
                  variant="secondary"
                  disabled={!fromEvent}
                  onClick={() =>
                    dup.mutate({ path: `/events/${ev.id}/form/duplicate`, body: { fromEventId: fromEvent } })
                  }
                >
                  Copy
                </Button>
              </>
            )}
          </div>
          <MutationError mutation={save} />
          <MutationError mutation={dup} />
        </>
      ) : q.isLoading ? (
        <p role="status">Loading...</p>
      ) : form ? (
        <Card>
          <h3>Questions</h3>
          <ul>
            {form.fields.length ? (
              form.fields.map((f) => (
                <li key={f.id}>
                  {f.label}
                  {f.required ? ' *' : ''}
                </li>
              ))
            ) : (
              <li className="muted">Profile fields only</li>
            )}
          </ul>
        </Card>
      ) : (
        <p className="muted">No form yet.</p>
      )}

      {can('registration.publish') && ev.status === 'approved' && (!form || form.status === 'draft') && (
        <Card className="stack">
          <h3>Publish registration</h3>
          <p className="small">
            The seat limit defaults to the held hall&apos;s capacity{ev.hall ? ` (${ev.hall.capacity})` : ''}. You
            can lower it, not raise it above the hall.
          </p>
          <div className="row">
            <FormField
              label="Seat limit (optional)"
              type="number"
              min={1}
              value={opts.maxSeats}
              onChange={(e) => setOpts({ ...opts, maxSeats: e.target.value })}
            />
            <FormField
              label="Closes at (optional)"
              type="datetime-local"
              value={opts.closesAt}
              onChange={(e) => setOpts({ ...opts, closesAt: e.target.value })}
              help="Defaults to the registration deadline"
            />
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={opts.waitlist}
              onChange={(e) => setOpts({ ...opts, waitlist: e.target.checked })}
            />{' '}
            Enable a waitlist when the event is full
          </label>
          <Button
            onClick={() => publish.mutate({ path: `/events/${ev.id}/form/publish`, body: publishBody })}
            disabled={publish.isPending || (draft && issues.length > 0)}
          >
            Publish registration
          </Button>
          <MutationError mutation={publish} />
        </Card>
      )}
      {!ev.status.includes('approved') && form?.status !== 'published' && (
        <p className="muted small">Registration can be published once the OSI approves the event.</p>
      )}
      {can('registration.publish') && form?.status === 'published' && (
        <div className="row">
          <Button
            variant="secondary"
            onClick={() => close.mutate({ path: `/events/${ev.id}/form/close` })}
            disabled={close.isPending}
          >
            Close registration now
          </Button>
          <MutationError mutation={close} />
        </div>
      )}
    </div>
  );
}

// ---------- Registrations and check-in ----------
function RegistrationsTab({ ev, can }) {
  const key = ['event', ev.id, 'registrations'];
  const q = useGet(key, `/events/${ev.id}/registrations`);
  const qc = useQueryClient();
  const [msg, setMsg] = useState(null);
  const canView = can('registration.view');
  const exportCsv = async () => {
    const blob = await apiBlob(`/events/${ev.id}/registrations/export`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registrations-${ev.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const checkin = useAction({
    onSuccess: (r) => {
      setMsg({ ok: true, text: `${r.fullName} checked in.` });
      qc.invalidateQueries({ queryKey: key });
    },
  });
  const onCode = useCallback(
    (code) => {
      checkin.mutate(
        { path: `/events/${ev.id}/checkin`, body: { qrToken: code } },
        { onError: (e) => setMsg({ ok: false, text: e.message }) },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ev.id],
  );
  return (
    <QueryState query={q} isEmpty={() => false}>
      {(d) => (
        <div className="stack">
          <Card>
            <dl className="profile-grid">
              <div>
                <dt className="muted small">Registered</dt>
                <dd>
                  {d.counts.registered}
                  {d.counts.maxSeats ? ` / ${d.counts.maxSeats}` : ''}
                </dd>
              </div>
              <div>
                <dt className="muted small">Attended</dt>
                <dd>{d.counts.attended}</dd>
              </div>
              <div>
                <dt className="muted small">Waitlisted</dt>
                <dd>{d.counts.waitlisted}</dd>
              </div>
              <div>
                <dt className="muted small">Cancelled</dt>
                <dd>{d.counts.cancelled}</dd>
              </div>
              <div>
                <dt className="muted small">Expected</dt>
                <dd>{d.counts.expected}</dd>
              </div>
            </dl>
            {!canView && (
              <p className="muted small">
                You can see counts only. Answers are visible to roles with the registration.view permission.
              </p>
            )}
          </Card>
          {can('checkin.run') && (
            <Card className="stack">
              <h3>Check-in</h3>
              <QrScanner onCode={onCode} />
              {msg && (
                <p
                  className={`notice ${msg.ok ? 'notice-ok' : 'notice-bad'}`}
                  role={msg.ok ? 'status' : 'alert'}
                >
                  {msg.text}
                </p>
              )}
            </Card>
          )}
          {canView && d.items && (
            <Card className="stack">
              <div className="row-between">
                <h3>Registrations</h3>
                <Button variant="secondary" onClick={exportCsv}>
                  Download CSV
                </Button>
              </div>
              <DataTable
                caption="Registrations"
                rows={d.items}
                empty="No registrations yet."
                columns={[
                  { key: 'name', header: 'Name', render: (r) => r.user.fullName },
                  { key: 'roll', header: 'Roll number', render: (r) => r.user.rollNumber },
                  { key: 'dept', header: 'Department', render: (r) => r.user.department },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (r) => <span className="pill">{r.status.replace('_', ' ')}</span>,
                  },
                  {
                    key: 'answers',
                    header: 'Answers',
                    render: (r) =>
                      Object.entries(r.answers)
                        .map(
                          ([k, v]) =>
                            `${d.form?.fields.find((f) => f.id === k)?.label ?? k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`,
                        )
                        .join('; ') || '-',
                  },
                ]}
              />
            </Card>
          )}
        </div>
      )}
    </QueryState>
  );
}

// ---------- Hall ----------
function HallTab({ ev, can }) {
  const [hallId, setHallId] = useState('');
  const regs = useGet(['event', ev.id, 'registrations'], `/events/${ev.id}/registrations`);
  const request = useAction({ invalidate: [['event', ev.id]] });
  const form = useGet(['event', ev.id, 'form'], `/events/${ev.id}/form`, { retry: false });
  const hall = ev.hall;
  const closed = form.data?.status === 'closed';
  const count = regs.data?.counts?.registered ?? 0;
  const hasHallLike = ev.mode !== 'online';
  return (
    <div className="stack">
      <Card className="stack">
        <h3>Hall booking</h3>
        {hall ? (
          <p>
            <strong>{hall.name}</strong>
            {hall.building ? `, ${hall.building}` : ''} (seats {hall.capacity}){' '}
            <span className={`pill ${hall.bookingStatus === 'confirmed' ? 'pill-ok' : 'pill-warn'}`}>
              {hall.bookingStatus}
            </span>
          </p>
        ) : (
          <p className="muted">
            {hasHallLike
              ? 'No active hall booking. If a request was denied you can send a new one once registration is closed.'
              : 'This is an online event.'}
          </p>
        )}
        <p className="small">
          Registered: <strong>{count}</strong>, expected: <strong>{ev.expectedParticipants}</strong>.
          Registrations are not attendance; choose a hall that suits the likely turnout.
        </p>
        {hall?.bookingStatus === 'requested' && (
          <p className="notice" role="status">
            Your final request is with the Events Authority.
          </p>
        )}
      </Card>
      {hasHallLike && ev.status === 'approved' && can('hall.request') && (
        <Card className="stack">
          <h3>Final hall request</h3>
          {!closed && <p className="muted">You can send the final request after registration has closed.</p>}
          {closed && hall?.bookingStatus !== 'requested' && hall?.bookingStatus !== 'confirmed' && (
            <>
              <p className="small">Keep the held hall or choose a better one based on the real count.</p>
              <HallPicker
                from={ev.startsAt}
                to={ev.endsAt}
                minCapacity={Math.max(count, 1)}
                value={hallId || hall?.id || ''}
                onChange={setHallId}
              />
              <Button
                disabled={request.isPending}
                onClick={() =>
                  request.mutate({ path: `/events/${ev.id}/hall-request`, body: hallId ? { hallId } : {} })
                }
              >
                Send final hall request
              </Button>
              <MutationError mutation={request} />
              {request.isSuccess && (
                <p className="notice notice-ok" role="status">
                  Request sent.
                </p>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}

// ---------- History ----------
function HistoryTab({ ev }) {
  const q = useGet(['event', ev.id, 'history'], `/events/${ev.id}/history`);
  return (
    <QueryState query={q} emptyTitle="No history yet">
      {(rows) => (
        <Card>
          <ol className="history">
            {rows.map((r, i) => (
              <li key={i}>
                <strong>{r.action}</strong>{' '}
                <span className="muted small">
                  {r.by ? `by ${r.by}, ` : ''}
                  {fmtDateTime(r.at)}
                </span>
                {r.note && <p>{r.note}</p>}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </QueryState>
  );
}

/** FR-CW-03: Plan, Poster, Form, Registrations, Hall, History. Tabs the role cannot use are hidden or explained. */
export function EventWorkspace() {
  const { clubId, eventId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'plan';
  const { can: canIn } = useAuth();
  const can = (p) => canIn(p, clubId);
  const q = useGet(['event', eventId], `/events/${eventId}`);
  return (
    <QueryState query={q}>
      {(ev) => (
        <>
          <PageBanner
            title={ev.title}
            description={`${fmtRange(ev.startsAt, ev.endsAt)} · ${ev.clubName}`}
            actions={<StatusPill status={ev.status} />}
          />
          <Tabs
            value={tab}
            onChange={(t) => setParams({ tab: t })}
            tabs={[
              { id: 'plan', label: 'Plan' },
              { id: 'poster', label: 'Poster' },
              {
                id: 'form',
                label: 'Form',
                disabled: !can('form.manage') && !can('registration.publish'),
                hint: 'Your role cannot manage forms',
              },
              { id: 'registrations', label: 'Registrations' },
              { id: 'hall', label: 'Hall', hidden: ev.mode === 'online' },
              { id: 'history', label: 'History' },
            ]}
          >
            {tab === 'plan' && <PlanTab ev={ev} clubId={clubId} can={can} />}
            {tab === 'poster' && <PosterTab ev={ev} can={can} />}
            {tab === 'form' && <FormTab ev={ev} clubId={clubId} can={can} />}
            {tab === 'registrations' && <RegistrationsTab ev={ev} can={can} />}
            {tab === 'hall' && <HallTab ev={ev} can={can} />}
            {tab === 'history' && <HistoryTab ev={ev} />}
          </Tabs>
        </>
      )}
    </QueryState>
  );
}
