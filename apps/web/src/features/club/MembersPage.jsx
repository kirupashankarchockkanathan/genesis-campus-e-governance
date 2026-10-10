import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { PERMISSION_KEYS, LOCKED_PERMISSIONS } from '@ccp/shared';
import { useAction, useGet } from '../../api/hooks.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ConfirmDialog, Modal } from '../../components/ui/Modal.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { FormField } from '../../components/ui/FormField.jsx';
import { MutationError, QueryState } from '../../components/ui/QueryState.jsx';
import { fmtDate } from '../../utils/dates.js';

export const RoleBadge = ({ name, leader }) => (
  <span className={`pill ${leader ? 'pill-ok' : ''}`}>{name}</span>
);

function RoleEditor({ clubId, roles }) {
  const key = ['club', clubId, 'roles'];
  const [editing, setEditing] = useState(null); // null | 'new' | role
  const [name, setName] = useState('');
  const [perms, setPerms] = useState([]);
  const [del, setDel] = useState(null);
  const done = () => setEditing(null);
  const create = useAction({ invalidate: [key], onSuccess: done });
  const update = useAction({ invalidate: [key], onSuccess: done });
  const remove = useAction({ invalidate: [key, ['club', clubId, 'members']], onSuccess: () => setDel(null) });
  const open = (r) => {
    setEditing(r ?? 'new');
    setName(r?.name ?? '');
    setPerms(r?.permissions ?? []);
  };
  const assignable = PERMISSION_KEYS.filter((p) => !LOCKED_PERMISSIONS.includes(p));
  const save = () =>
    editing === 'new'
      ? create.mutate({ path: `/clubs/${clubId}/roles`, body: { name, permissions: perms } })
      : update.mutate({
          method: 'PATCH',
          path: `/clubs/${clubId}/roles/${editing.id}`,
          body: { name, permissions: perms },
        });
  return (
    <Card className="stack">
      <div className="row-between">
        <h2>Roles</h2>
        <Button onClick={() => open(null)}>New custom role</Button>
      </div>
      <DataTable
        caption="Roles"
        rows={roles}
        columns={[
          {
            key: 'name',
            header: 'Role',
            render: (r) => (
              <span>
                {r.name} {r.isSystem && <span className="muted small">(default)</span>}
              </span>
            ),
          },
          {
            key: 'perms',
            header: 'Permissions',
            render: (r) => (
              <span className="small">{r.permissions.join(', ') || 'Read-only member access'}</span>
            ),
          },
          {
            key: 'act',
            header: '',
            render: (r) =>
              !r.isSystem && (
                <span className="row">
                  <Button variant="secondary" onClick={() => open(r)}>
                    Edit
                  </Button>
                  <Button variant="secondary" onClick={() => setDel(r)}>
                    Delete
                  </Button>
                </span>
              ),
          },
        ]}
      />
      <p className="muted small">
        event.submit, leadership.transfer and role.manage stay with the Leader and cannot be given to other
        roles.
      </p>
      <Modal
        open={Boolean(editing)}
        title={editing === 'new' ? 'New custom role' : 'Edit role'}
        onClose={done}
        footer={
          <>
            <Button variant="secondary" onClick={done}>
              Cancel
            </Button>
            <Button onClick={save} disabled={name.trim().length < 2 || create.isPending || update.isPending}>
              Save role
            </Button>
          </>
        }
      >
        <FormField label="Role name" value={name} onChange={(e) => setName(e.target.value)} />
        <fieldset className="perm-grid">
          <legend>Permissions</legend>
          {assignable.map((p) => (
            <label key={p} className="check">
              <input
                type="checkbox"
                checked={perms.includes(p)}
                onChange={(e) => setPerms(e.target.checked ? [...perms, p] : perms.filter((x) => x !== p))}
              />{' '}
              <code>{p}</code>
            </label>
          ))}
        </fieldset>
        <MutationError mutation={create} />
        <MutationError mutation={update} />
      </Modal>
      <ConfirmDialog
        open={Boolean(del)}
        title={`Delete ${del?.name}?`}
        message="Members of this role must be moved to another role first."
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onCancel={() => setDel(null)}
        onConfirm={() => remove.mutate({ method: 'DELETE', path: `/clubs/${clubId}/roles/${del.id}` })}
      />
      <MutationError mutation={remove} />
    </Card>
  );
}

/** FR-CW-02: members and roles; change roles, remove members, transfer leadership. */
export function MembersPage() {
  const { clubId } = useParams();
  const { can, user, reload } = useAuth();
  const key = ['club', clubId, 'members'];
  const members = useGet(key, `/clubs/${clubId}/members`);
  const roles = useGet(['club', clubId, 'roles'], `/clubs/${clubId}/roles`);
  const [adding, setAdding] = useState({ email: '', roleKey: 'MEMBER' });
  const [removing, setRemoving] = useState(null);
  const [transfer, setTransfer] = useState(null);
  const [demoteTo, setDemoteTo] = useState('VICE_LEADER');
  const change = useAction({ invalidate: [key, ['me'], ['clubs']] });
  const add = useAction({ invalidate: [key], onSuccess: () => setAdding({ email: '', roleKey: 'MEMBER' }) });
  const remove = useAction({ invalidate: [key], onSuccess: () => setRemoving(null) });
  const lead = useAction({
    invalidate: [key],
    onSuccess: () => {
      setTransfer(null);
      reload();
    },
  });
  const manage = can('member.manage', clubId);
  const assignable = (roles.data ?? []).filter((r) => r.key !== 'LEADER');
  return (
    <>
      <PageBanner title="Members and roles" description="Everyone in this club and what they can do." />
      <QueryState query={members} emptyTitle="No members yet">
        {(rows) => (
          <Card className="stack">
            <DataTable
              caption="Members"
              rows={rows}
              rowKey={(m) => m.userId}
              columns={[
                {
                  key: 'name',
                  header: 'Member',
                  render: (m) => (
                    <span>
                      {m.fullName}
                      <br />
                      <span className="muted small">@{m.username}</span>
                    </span>
                  ),
                },
                {
                  key: 'role',
                  header: 'Role',
                  render: (m) =>
                    manage && m.roleKey !== 'LEADER' ? (
                      <>
                        <label className="visually-hidden" htmlFor={`r-${m.userId}`}>
                          Role of {m.fullName}
                        </label>
                        <select
                          id={`r-${m.userId}`}
                          className="select"
                          style={{ maxWidth: 200 }}
                          value={m.roleKey}
                          onChange={(e) =>
                            change.mutate({
                              method: 'PATCH',
                              path: `/clubs/${clubId}/members/${m.userId}`,
                              body: { roleKey: e.target.value },
                            })
                          }
                        >
                          {assignable.map((r) => (
                            <option key={r.key} value={r.key}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <RoleBadge name={m.roleName} leader={m.roleKey === 'LEADER'} />
                    ),
                },
                { key: 'joined', header: 'Joined', render: (m) => fmtDate(m.joinedAt) },
                {
                  key: 'act',
                  header: '',
                  render: (m) => (
                    <span className="row">
                      {manage && m.roleKey !== 'LEADER' && (
                        <Button variant="secondary" onClick={() => setRemoving(m)}>
                          Remove
                        </Button>
                      )}
                      {can('leadership.transfer', clubId) && m.roleKey !== 'LEADER' && (
                        <Button variant="secondary" onClick={() => setTransfer(m)}>
                          Make Leader
                        </Button>
                      )}
                      {m.userId === user.id && m.roleKey !== 'LEADER' && !manage && (
                        <Button variant="secondary" onClick={() => setRemoving(m)}>
                          Leave club
                        </Button>
                      )}
                    </span>
                  ),
                },
              ]}
            />
            <MutationError mutation={change} />
          </Card>
        )}
      </QueryState>
      {manage && (
        <Card>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate({ path: `/clubs/${clubId}/members`, body: adding });
            }}
          >
            <FormField
              label="Add a member by college email"
              type="email"
              value={adding.email}
              onChange={(e) => setAdding({ ...adding, email: e.target.value })}
            />
            <FormField
              label="Role"
              as="select"
              value={adding.roleKey}
              onChange={(e) => setAdding({ ...adding, roleKey: e.target.value })}
            >
              {assignable.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </FormField>
            <Button type="submit" disabled={!adding.email || add.isPending}>
              Add member
            </Button>
          </form>
          <MutationError mutation={add} />
        </Card>
      )}
      {can('role.manage', clubId) && roles.data && <RoleEditor clubId={clubId} roles={roles.data} />}
      <ConfirmDialog
        open={Boolean(removing)}
        title={removing?.userId === user.id ? 'Leave this club?' : `Remove ${removing?.fullName}?`}
        message="They lose access to the club workspace at once."
        confirmLabel={removing?.userId === user.id ? 'Leave' : 'Remove'}
        danger
        busy={remove.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() =>
          remove.mutate({ method: 'DELETE', path: `/clubs/${clubId}/members/${removing.userId}` })
        }
      />
      <MutationError mutation={remove} />
      <Modal
        open={Boolean(transfer)}
        title="Transfer leadership"
        onClose={() => setTransfer(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTransfer(null)}>
              Cancel
            </Button>
            <Button
              disabled={lead.isPending}
              onClick={() =>
                lead.mutate({
                  path: `/clubs/${clubId}/leadership-transfer`,
                  body: { toUserId: transfer.userId, demoteTo },
                })
              }
            >
              Transfer
            </Button>
          </>
        }
      >
        <p>
          {transfer?.fullName} becomes the Leader and the only person who can submit events to the OSI. You
          become:
        </p>
        <FormField
          label="Your new role"
          as="select"
          value={demoteTo}
          onChange={(e) => setDemoteTo(e.target.value)}
        >
          {assignable.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
            </option>
          ))}
        </FormField>
        <MutationError mutation={lead} />
      </Modal>
    </>
  );
}
