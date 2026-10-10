import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAction, useGet } from '../../api/hooks.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { FormField } from '../../components/ui/FormField.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Pill } from '../../components/ui/Pill.jsx';
import { MutationError, QueryState } from '../../components/ui/QueryState.jsx';
import { FormBuilder, validateFields } from '../../components/forms/FormBuilder.jsx';
import { fromInputValue, fmtDateTime } from '../../utils/dates.js';

function CreateRecruitment({ clubId, onDone }) {
  const [v, setV] = useState({ title: '', description: '', deadline: '', autoAccept: false });
  const [positions, setPositions] = useState([{ title: '', description: '', openings: 1 }]);
  const [fields, setFields] = useState([
    { id: 'why', type: 'long_text', label: 'Why do you want to join?', help: '', required: true },
  ]);
  const create = useAction({ invalidate: [['club', clubId, 'recruitments']], onSuccess: onDone });
  const issues = validateFields(fields);
  const setPos = (i, patch) => setPositions(positions.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const body = {
    title: v.title,
    description: v.description,
    deadline: fromInputValue(v.deadline),
    autoAccept: v.autoAccept,
    positions: positions
      .filter((p) => p.title.trim())
      .map((p) => ({ ...p, openings: Number(p.openings) || 1 })),
    fields: fields.map((f) =>
      f.options ? { ...f, options: f.options.map((o) => o.trim()).filter(Boolean) } : f,
    ),
  };
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ path: `/clubs/${clubId}/recruitments`, body });
      }}
    >
      <FormField label="Title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
      <div className="field">
        <label htmlFor="rec-desc">Description</label>
        <textarea
          id="rec-desc"
          className="input textarea"
          rows={3}
          value={v.description}
          onChange={(e) => setV({ ...v, description: e.target.value })}
        />
      </div>
      <FormField
        label="Application deadline"
        type="datetime-local"
        value={v.deadline}
        onChange={(e) => setV({ ...v, deadline: e.target.value })}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={v.autoAccept}
          onChange={(e) => setV({ ...v, autoAccept: e.target.checked })}
        />{' '}
        Auto-accept every application
      </label>
      <fieldset className="stack">
        <legend>
          <h3>Positions</h3>
        </legend>
        {positions.map((p, i) => (
          <div className="row" key={i}>
            <FormField
              label={`Position ${i + 1} title`}
              value={p.title}
              onChange={(e) => setPos(i, { title: e.target.value })}
            />
            <FormField
              label="Description"
              value={p.description}
              onChange={(e) => setPos(i, { description: e.target.value })}
            />
            <FormField
              label="Openings"
              type="number"
              min={1}
              value={p.openings}
              onChange={(e) => setPos(i, { openings: e.target.value })}
            />
            {positions.length > 1 && (
              <Button variant="secondary" onClick={() => setPositions(positions.filter((_, k) => k !== i))}>
                Remove
              </Button>
            )}
          </div>
        ))}
        <Button
          variant="secondary"
          onClick={() => setPositions([...positions, { title: '', description: '', openings: 1 }])}
        >
          Add a position
        </Button>
      </fieldset>
      <h3>Application form</h3>
      <FormBuilder fields={fields} onChange={setFields} />
      <Button
        type="submit"
        disabled={create.isPending || !v.title || !v.deadline || !body.positions.length || issues.length > 0}
      >
        Create recruitment (draft)
      </Button>
      <MutationError mutation={create} />
    </form>
  );
}

function Applications({ rec, clubId }) {
  const key = ['recruitment', rec.id, 'applications'];
  const q = useGet(key, `/recruitments/${rec.id}/applications`);
  const roles = useGet(['club', clubId, 'roles'], `/clubs/${clubId}/roles`);
  const [roleFor, setRoleFor] = useState({});
  const [note, setNote] = useState('');
  const decide = useAction({ invalidate: [key, ['club', clubId, 'recruitments']] });
  const assignable = (roles.data ?? []).filter((r) => r.key !== 'LEADER');
  return (
    <QueryState query={q} emptyTitle="No applications yet">
      {(rows) => (
        <div className="stack">
          <FormField
            label="Note to the applicant (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <DataTable
            caption="Applications"
            rows={rows}
            columns={[
              {
                key: 'name',
                header: 'Applicant',
                render: (a) => (
                  <span>
                    {a.user.fullName}
                    <br />
                    <span className="muted small">
                      {a.user.rollNumber}, {a.user.department}
                    </span>
                  </span>
                ),
              },
              { key: 'pos', header: 'Position', render: (a) => a.positionTitle ?? 'No preference' },
              {
                key: 'answers',
                header: 'Answers',
                render: (a) =>
                  Object.entries(a.answers)
                    .map(([k, val]) => `${rec.fields.find((f) => f.id === k)?.label ?? k}: ${val}`)
                    .join('; ') || '-',
              },
              {
                key: 'status',
                header: 'Status',
                render: (a) => (
                  <Pill
                    status={
                      a.status === 'accepted' ? 'approved' : a.status === 'rejected' ? 'rejected' : 'pending'
                    }
                  >
                    {a.status}
                  </Pill>
                ),
              },
              {
                key: 'act',
                header: 'Decision',
                render: (a) =>
                  ['submitted', 'shortlisted'].includes(a.status) ? (
                    <div className="row">
                      <label className="visually-hidden" htmlFor={`role-${a.id}`}>
                        Role if accepted
                      </label>
                      <select
                        id={`role-${a.id}`}
                        className="select"
                        style={{ maxWidth: 160 }}
                        value={roleFor[a.id] ?? 'MEMBER'}
                        onChange={(e) => setRoleFor({ ...roleFor, [a.id]: e.target.value })}
                      >
                        {assignable.map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      {a.status === 'submitted' && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            decide.mutate({
                              method: 'PATCH',
                              path: `/applications/${a.id}`,
                              body: { status: 'shortlisted', note: note || undefined },
                            })
                          }
                        >
                          Shortlist
                        </Button>
                      )}
                      <Button
                        onClick={() =>
                          decide.mutate({
                            method: 'PATCH',
                            path: `/applications/${a.id}`,
                            body: {
                              status: 'accepted',
                              roleKey: roleFor[a.id] ?? 'MEMBER',
                              note: note || undefined,
                            },
                          })
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() =>
                          decide.mutate({
                            method: 'PATCH',
                            path: `/applications/${a.id}`,
                            body: { status: 'rejected', note: note || undefined },
                          })
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="muted small">Decided</span>
                  ),
              },
            ]}
          />
          <MutationError mutation={decide} />
        </div>
      )}
    </QueryState>
  );
}

/** FR-REC-01/04/05: manage recruitments and review applications. */
export function ClubRecruitmentPage() {
  const { clubId } = useParams();
  const { can } = useAuth();
  const key = ['club', clubId, 'recruitments'];
  const q = useGet(key, `/clubs/${clubId}/recruitments`);
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const act = useAction({ invalidate: [key] });
  return (
    <>
      <PageBanner
        title="Recruitment"
        description="Open a recruitment, then review the applications."
        actions={
          can('recruitment.manage', clubId) && (
            <Button variant="light" onClick={() => setCreating(true)}>
              New recruitment
            </Button>
          )
        }
      />
      <QueryState
        query={q}
        emptyTitle="No recruitments yet"
        emptyText="Create one to start accepting applications."
      >
        {(rows) => (
          <div className="stack">
            {rows.map((r) => (
              <Card key={r.id} as="article" className="stack">
                <div className="row-between">
                  <h2>{r.title}</h2>
                  <Pill status={r.status === 'open' ? 'open' : r.status === 'closed' ? 'cancelled' : 'draft'}>
                    {r.status}
                  </Pill>
                </div>
                <p className="muted small">
                  Deadline {fmtDateTime(r.deadline)} · {r.applicationCount} application(s)
                  {r.autoAccept ? ' · auto-accept' : ''}
                </p>
                <ul>
                  {r.positions.map((p) => (
                    <li key={p.id}>
                      {p.title} ({p.openings})
                    </li>
                  ))}
                </ul>
                <div className="row">
                  {can('recruitment.manage', clubId) && r.status === 'draft' && (
                    <Button onClick={() => act.mutate({ path: `/recruitments/${r.id}/open` })}>
                      Open for applications
                    </Button>
                  )}
                  {can('recruitment.manage', clubId) && r.status === 'open' && (
                    <Button
                      variant="secondary"
                      onClick={() => act.mutate({ path: `/recruitments/${r.id}/close` })}
                    >
                      Close
                    </Button>
                  )}
                  {can('application.review', clubId) && r.status !== 'draft' && (
                    <Button
                      variant="secondary"
                      onClick={() => setReviewing(reviewing === r.id ? null : r.id)}
                    >
                      {reviewing === r.id ? 'Hide applications' : 'Review applications'}
                    </Button>
                  )}
                </div>
                {reviewing === r.id && <Applications rec={r} clubId={clubId} />}
              </Card>
            ))}
          </div>
        )}
      </QueryState>
      <MutationError mutation={act} />
      <Modal open={creating} title="New recruitment" onClose={() => setCreating(false)}>
        <CreateRecruitment clubId={clubId} onDone={() => setCreating(false)} />
      </Modal>
    </>
  );
}
