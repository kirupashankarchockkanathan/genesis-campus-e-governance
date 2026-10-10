import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAction, useGet, qs } from '../../api/hooks.js';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { FormField } from '../../components/ui/FormField.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Pill } from '../../components/ui/Pill.jsx';
import { MutationError, QueryState } from '../../components/ui/QueryState.jsx';
import { AvailabilityTimeline, HallPicker } from '../../components/halls/Halls.jsx';
import { fmtDateTime, fmtRange, fromInputValue } from '../../utils/dates.js';

/** FR-HALL-06: final requests with club, event, date, registered and expected counts. */
export function HallRequestsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const q = useGet(['hall-requests', 'requested'], '/events-admin/hall-requests?status=requested');
  const [open, setOpen] = useState(null);
  const [mode, setMode] = useState('approve');
  const [hallId, setHallId] = useState('');
  const [note, setNote] = useState('');
  const act = useAction({
    invalidate: [['hall-requests'], ['calendar']],
    onSuccess: () => {
      setOpen(null);
      setNote('');
      setHallId('');
      navigate('/events-admin/requests');
    },
  });
  // A notification link opens /events-admin/requests/:id: open that request straight away.
  useEffect(() => {
    if (id && q.data) {
      const r = q.data.find((x) => x.id === id);
      if (r) {
        setOpen(r);
        setHallId(r.hallId);
      }
    }
  }, [id, q.data]);
  const start = (r, m) => {
    setOpen(r);
    setMode(m);
    setHallId(r.hallId);
  };
  return (
    <>
      <PageBanner title="Hall requests" description="Final hall requests waiting for a decision." />
      <QueryState
        query={q}
        emptyTitle="No requests waiting"
        emptyText="Final requests appear after a club's registration closes."
      >
        {(rows) => (
          <Card>
            <DataTable
              caption="Hall requests"
              rows={rows}
              columns={[
                { key: 'club', header: 'Club', render: (r) => r.clubName },
                {
                  key: 'event',
                  header: 'Event',
                  render: (r) => <Link to={`/events/${r.eventId}`}>{r.eventTitle}</Link>,
                },
                { key: 'when', header: 'When', render: (r) => fmtRange(r.startsAt, r.endsAt) },
                {
                  key: 'counts',
                  header: 'Registered / expected',
                  render: (r) => `${r.registeredCount ?? 0} / ${r.expectedCount}`,
                },
                { key: 'hall', header: 'Requested hall', render: (r) => `${r.hallName} (${r.hallCapacity})` },
                {
                  key: 'act',
                  header: 'Decision',
                  render: (r) => (
                    <span className="row">
                      <Button onClick={() => start(r, 'approve')}>Approve</Button>
                      <Button variant="danger" onClick={() => start(r, 'deny')}>
                        Deny
                      </Button>
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        )}
      </QueryState>
      <Modal
        open={Boolean(open)}
        title={mode === 'approve' ? 'Approve hall request' : 'Deny hall request'}
        onClose={() => {
          setOpen(null);
          navigate('/events-admin/requests');
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(null);
                navigate('/events-admin/requests');
              }}
            >
              Back
            </Button>
            <Button
              variant={mode === 'deny' ? 'danger' : 'primary'}
              disabled={act.isPending || (mode === 'deny' && note.trim().length < 3)}
              onClick={() =>
                act.mutate({
                  path: `/events-admin/hall-requests/${open.id}/decision`,
                  body:
                    mode === 'approve'
                      ? {
                          decision: 'approve',
                          ...(hallId !== open.hallId && { hallId }),
                          note: note || undefined,
                        }
                      : { decision: 'deny', note },
                })
              }
            >
              Confirm
            </Button>
          </>
        }
      >
        {open && (
          <>
            <p>
              <strong>{open.eventTitle}</strong> by {open.clubName}: {open.registeredCount ?? 0} registered,{' '}
              {open.expectedCount} expected.
            </p>
            <div className="row" role="group" aria-label="Decision">
              <Button
                variant={mode === 'approve' ? 'primary' : 'secondary'}
                onClick={() => setMode('approve')}
              >
                Approve
              </Button>
              <Button variant={mode === 'deny' ? 'danger' : 'secondary'} onClick={() => setMode('deny')}>
                Deny
              </Button>
            </div>
            {mode === 'approve' && (
              <>
                <p className="small">Keep the requested hall or change it to another free hall that fits.</p>
                <HallPicker
                  from={open.startsAt}
                  to={open.endsAt}
                  minCapacity={Math.max(open.registeredCount ?? 1, 1)}
                  value={hallId}
                  onChange={setHallId}
                />
              </>
            )}
            <div className="field">
              <label htmlFor="dnote">{mode === 'deny' ? 'Reason (required)' : 'Note (optional)'}</label>
              <textarea
                id="dnote"
                className="input textarea"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <MutationError mutation={act} />
          </>
        )}
      </Modal>
    </>
  );
}

/** Tentative holds with their expiry (FR-HALL-04). */
export function HoldsPage() {
  const q = useGet(['hall-requests', 'holds'], '/events-admin/hall-requests?status=tentative');
  return (
    <>
      <PageBanner
        title="Holds"
        description="Tentative hall holds. They expire automatically if the event is not approved in time."
      />
      <QueryState query={q} emptyTitle="No active holds">
        {(rows) => (
          <Card>
            <DataTable
              caption="Tentative holds"
              rows={rows}
              columns={[
                { key: 'club', header: 'Club', render: (r) => r.clubName },
                { key: 'event', header: 'Event', render: (r) => r.eventTitle },
                { key: 'hall', header: 'Hall', render: (r) => r.hallName },
                { key: 'when', header: 'When', render: (r) => fmtRange(r.startsAt, r.endsAt) },
                {
                  key: 'status',
                  header: 'Event status',
                  render: (r) => (
                    <Pill status={r.eventStatus === 'approved' ? 'approved' : 'pending'}>
                      {r.eventStatus.replace('_', ' ')}
                    </Pill>
                  ),
                },
                {
                  key: 'exp',
                  header: 'Expires',
                  render: (r) => (r.expiresAt ? fmtDateTime(r.expiresAt) : 'At event start'),
                },
              ]}
            />
          </Card>
        )}
      </QueryState>
    </>
  );
}

function BlockedSlots({ hall, onClose }) {
  const q = useGet(['hall', hall.id, 'slots'], `/halls/${hall.id}/blocked-slots`);
  const [v, setV] = useState({ startsAt: '', endsAt: '', reason: '' });
  const [warnings, setWarnings] = useState([]);
  const add = useAction({
    invalidate: [['hall', hall.id, 'slots'], ['availability']],
    onSuccess: (r) => {
      setWarnings(r.warnings ?? []);
      setV({ startsAt: '', endsAt: '', reason: '' });
    },
  });
  const del = useAction({ invalidate: [['hall', hall.id, 'slots'], ['availability']] });
  return (
    <Modal open title={`Blocked slots: ${hall.name}`} onClose={onClose}>
      <p className="muted small">
        Block times for classes, maintenance or exams. Existing holds are never changed silently: you will see
        a warning instead.
      </p>
      <QueryState query={q} emptyTitle="No blocked slots">
        {(rows) => (
          <DataTable
            caption="Blocked slots"
            rows={rows}
            columns={[
              { key: 'when', header: 'When', render: (s) => fmtRange(s.startsAt, s.endsAt) },
              { key: 'reason', header: 'Reason', render: (s) => s.reason ?? '' },
              {
                key: 'act',
                header: '',
                render: (s) => (
                  <button
                    className="btn btn-link"
                    onClick={() => del.mutate({ method: 'DELETE', path: `/blocked-slots/${s.id}` })}
                  >
                    Remove
                  </button>
                ),
              },
            ]}
          />
        )}
      </QueryState>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          setWarnings([]);
          add.mutate({
            path: `/halls/${hall.id}/blocked-slots`,
            body: {
              startsAt: fromInputValue(v.startsAt),
              endsAt: fromInputValue(v.endsAt),
              reason: v.reason || undefined,
            },
          });
        }}
      >
        <div className="row">
          <FormField
            label="From"
            type="datetime-local"
            value={v.startsAt}
            onChange={(e) => setV({ ...v, startsAt: e.target.value })}
          />
          <FormField
            label="To"
            type="datetime-local"
            value={v.endsAt}
            onChange={(e) => setV({ ...v, endsAt: e.target.value })}
          />
        </div>
        <FormField label="Reason" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} />
        <Button type="submit" disabled={!v.startsAt || !v.endsAt || add.isPending}>
          Block this time
        </Button>
      </form>
      {warnings.length > 0 && (
        <ul className="notice notice-bad" role="alert">
          {warnings.map((w) => (
            <li key={w.bookingId}>{w.message}</li>
          ))}
        </ul>
      )}
      <MutationError mutation={add} />
    </Modal>
  );
}

/** FR-HALL-01: hall list with name, building, floor, capacity, facilities, active flag. */
export function HallsPage() {
  const q = useGet(['halls'], '/halls');
  const [edit, setEdit] = useState(null);
  const [slots, setSlots] = useState(null);
  const [v, setV] = useState({
    name: '',
    building: '',
    floor: '',
    capacity: 50,
    facilities: '',
    isActive: true,
  });
  const open = (h) => {
    setEdit(h ?? 'new');
    setV(
      h
        ? {
            name: h.name,
            building: h.building ?? '',
            floor: h.floor ?? '',
            capacity: h.capacity,
            facilities: h.facilities.join(', '),
            isActive: h.isActive,
          }
        : { name: '', building: '', floor: '', capacity: 50, facilities: '', isActive: true },
    );
  };
  const save = useAction({ invalidate: [['halls'], ['availability']], onSuccess: () => setEdit(null) });
  const body = {
    ...v,
    capacity: Number(v.capacity),
    facilities: v.facilities
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  };
  return (
    <>
      <PageBanner
        title="Halls"
        description="Manage halls and the times they cannot be booked."
        actions={
          <Button variant="light" onClick={() => open(null)}>
            Add a hall
          </Button>
        }
      />
      <QueryState query={q} emptyTitle="No halls yet">
        {(rows) => (
          <Card>
            <DataTable
              caption="Halls"
              rows={rows}
              columns={[
                { key: 'name', header: 'Hall' },
                {
                  key: 'loc',
                  header: 'Location',
                  render: (h) => [h.building, h.floor].filter(Boolean).join(', '),
                },
                { key: 'cap', header: 'Capacity', render: (h) => h.capacity },
                { key: 'fac', header: 'Facilities', render: (h) => h.facilities.join(', ') },
                {
                  key: 'active',
                  header: 'Status',
                  render: (h) => (
                    <Pill status={h.isActive ? 'active' : 'suspended'}>
                      {h.isActive ? 'Active' : 'Inactive'}
                    </Pill>
                  ),
                },
                {
                  key: 'act',
                  header: '',
                  render: (h) => (
                    <span className="row">
                      <Button variant="secondary" onClick={() => open(h)}>
                        Edit
                      </Button>
                      <Button variant="secondary" onClick={() => setSlots(h)}>
                        Blocked slots
                      </Button>
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        )}
      </QueryState>
      <Modal
        open={Boolean(edit)}
        title={edit === 'new' ? 'Add a hall' : 'Edit hall'}
        onClose={() => setEdit(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button
              disabled={save.isPending || v.name.length < 2 || Number(v.capacity) < 1}
              onClick={() =>
                save.mutate(
                  edit === 'new'
                    ? { path: '/halls', body }
                    : { method: 'PATCH', path: `/halls/${edit.id}`, body },
                )
              }
            >
              Save hall
            </Button>
          </>
        }
      >
        <FormField label="Name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        <div className="row">
          <FormField
            label="Building"
            value={v.building}
            onChange={(e) => setV({ ...v, building: e.target.value })}
          />
          <FormField label="Floor" value={v.floor} onChange={(e) => setV({ ...v, floor: e.target.value })} />
        </div>
        <FormField
          label="Capacity"
          type="number"
          min={1}
          value={v.capacity}
          onChange={(e) => setV({ ...v, capacity: e.target.value })}
        />
        <FormField
          label="Facilities (comma separated)"
          value={v.facilities}
          onChange={(e) => setV({ ...v, facilities: e.target.value })}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={v.isActive}
            onChange={(e) => setV({ ...v, isActive: e.target.checked })}
          />{' '}
          Active (can be booked)
        </label>
        <MutationError mutation={save} />
      </Modal>
      {slots && <BlockedSlots hall={slots} onClose={() => setSlots(null)} />}
    </>
  );
}

/** FR-HALL-03 for the Events Authority: every hall across a time window. */
export function AvailabilityPage() {
  const [w, setW] = useState({ from: '', to: '', minCapacity: 0 });
  const from = fromInputValue(w.from);
  const to = fromInputValue(w.to);
  const ready = Boolean(from && to && to > from);
  const q = useGet(
    ['availability', from, to, w.minCapacity],
    `/halls/availability${qs({ from, to, minCapacity: w.minCapacity })}`,
    { enabled: ready },
  );
  return (
    <>
      <PageBanner title="Availability" description="See which halls are free for a date and time." />
      <Card className="row">
        <FormField
          label="From"
          type="datetime-local"
          value={w.from}
          onChange={(e) => setW({ ...w, from: e.target.value })}
        />
        <FormField
          label="To"
          type="datetime-local"
          value={w.to}
          onChange={(e) => setW({ ...w, to: e.target.value })}
        />
        <FormField
          label="Minimum capacity"
          type="number"
          min={0}
          value={w.minCapacity}
          onChange={(e) => setW({ ...w, minCapacity: e.target.value })}
        />
      </Card>
      {!ready && <p className="muted">Choose a start and end time to see availability.</p>}
      {ready && (
        <QueryState
          query={q}
          isEmpty={(d) => !d?.length}
          emptyTitle="No halls match"
          emptyText="Lower the minimum capacity."
        >
          {(halls) => (
            <ul className="hall-list">
              {halls.map((h) => (
                <li key={h.id} className="hall-card">
                  <strong>{h.name}</strong> <span className="muted small">seats {h.capacity}</span>{' '}
                  <span className={`pill ${h.free ? 'pill-ok' : 'pill-bad'}`}>
                    {h.free ? 'Free' : 'Busy'}
                  </span>
                  <AvailabilityTimeline hall={h} window={{ from, to }} />
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      )}
    </>
  );
}
