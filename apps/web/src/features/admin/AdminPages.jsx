import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { OSI_LABEL, OSI_EXPANSION } from '@ccp/shared';
import { apiWithMeta, publicApi } from '../../api/client.js';
import { useAction, useGet, qs } from '../../api/hooks.js';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { DataTable, Pagination } from '../../components/ui/DataTable.jsx';
import { FormField } from '../../components/ui/FormField.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Pill } from '../../components/ui/Pill.jsx';
import { MutationError, QueryState } from '../../components/ui/QueryState.jsx';
import { fmtDateTime } from '../../utils/dates.js';

const ROLE_LABEL = {
  osi_admin: 'OSI',
  events_admin: 'Events Authority',
  super_admin: 'Super Admin',
  student: 'Student',
};

/** FR-ADMIN-03: create admin accounts (forced password change at first login) and suspend them. */
export function UsersPage() {
  const [role, setRole] = useState('');
  const q = useGet(['admin', 'users', role], `/admin/users${qs({ role })}`);
  const [open, setOpen] = useState(false);
  const empty = { fullName: '', email: '', username: '', role: 'osi_admin', temporaryPassword: '' };
  const [v, setV] = useState(empty);
  const create = useAction({
    invalidate: [['admin', 'users']],
    onSuccess: () => {
      setOpen(false);
      setV(empty);
    },
  });
  const status = useAction({ invalidate: [['admin', 'users']] });
  return (
    <>
      <PageBanner
        title="Users"
        description="Create admin accounts and suspend users."
        actions={
          <Button variant="light" onClick={() => setOpen(true)}>
            Create admin account
          </Button>
        }
      />
      <div className="field" style={{ maxWidth: 260 }}>
        <label htmlFor="role-filter">Show</label>
        <select id="role-filter" className="select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Everyone</option>
          {Object.entries(ROLE_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <QueryState query={q} emptyTitle="No users found">
        {(rows) => (
          <Card>
            <DataTable
              caption="Users"
              rows={rows}
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  render: (u) => (
                    <span>
                      {u.fullName}
                      <br />
                      <span className="muted small">{u.email}</span>
                    </span>
                  ),
                },
                { key: 'role', header: 'Role', render: (u) => ROLE_LABEL[u.platformRole] },
                {
                  key: 'status',
                  header: 'Status',
                  render: (u) => (
                    <Pill status={u.status === 'active' ? 'active' : 'suspended'}>{u.status}</Pill>
                  ),
                },
                {
                  key: 'login',
                  header: 'Last login',
                  render: (u) => (u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'Never'),
                },
                {
                  key: 'act',
                  header: '',
                  render: (u) =>
                    u.platformRole !== 'student' && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          status.mutate({
                            method: 'PATCH',
                            path: `/admin/users/${u.id}`,
                            body: { status: u.status === 'active' ? 'suspended' : 'active' },
                          })
                        }
                      >
                        {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </Button>
                    ),
                },
              ]}
            />
          </Card>
        )}
      </QueryState>
      <MutationError mutation={status} />
      <Modal
        open={open}
        title="Create admin account"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                create.isPending || !v.fullName || !v.email || !v.username || v.temporaryPassword.length < 8
              }
              onClick={() => create.mutate({ path: '/admin/users', body: v })}
            >
              Create account
            </Button>
          </>
        }
      >
        <FormField
          label="Full name"
          value={v.fullName}
          onChange={(e) => setV({ ...v, fullName: e.target.value })}
        />
        <FormField
          label="Email"
          type="email"
          value={v.email}
          onChange={(e) => setV({ ...v, email: e.target.value })}
        />
        <FormField
          label="Username"
          value={v.username}
          onChange={(e) => setV({ ...v, username: e.target.value })}
        />
        <FormField
          label="Role"
          as="select"
          value={v.role}
          onChange={(e) => setV({ ...v, role: e.target.value })}
        >
          <option value="osi_admin">OSI</option>
          <option value="events_admin">Events Authority</option>
          <option value="super_admin">Super Admin</option>
        </FormField>
        <FormField
          label="Temporary password"
          type="password"
          autoComplete="new-password"
          value={v.temporaryPassword}
          onChange={(e) => setV({ ...v, temporaryPassword: e.target.value })}
          help="At least 8 characters. The admin must change it at first login."
        />
        <MutationError mutation={create} />
      </Modal>
    </>
  );
}

/** FR-ADMIN-03: role changes, approvals, hall decisions and suspensions. */
export function AuditPage() {
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['admin', 'audit', entityType, page],
    queryFn: () => apiWithMeta(`/admin/audit-logs${qs({ entityType, page })}`),
  });
  return (
    <>
      <PageBanner title="Audit log" description="Who did what, and when." />
      <div className="field" style={{ maxWidth: 260 }}>
        <label htmlFor="ent">Entity</label>
        <select
          id="ent"
          className="select"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All</option>
          {['event', 'club', 'user', 'hall', 'announcement', 'recruitment', 'application'].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <QueryState query={q} isEmpty={(d) => !d?.data?.length} emptyTitle="No entries">
        {(d) => (
          <>
            <Card>
              <DataTable
                caption="Audit log"
                rows={d.data}
                columns={[
                  { key: 'at', header: 'When', render: (r) => fmtDateTime(r.at) },
                  { key: 'actor', header: 'Who', render: (r) => r.actorName ?? 'System' },
                  { key: 'action', header: 'Action', render: (r) => <code>{r.action}</code> },
                  {
                    key: 'entity',
                    header: 'Entity',
                    render: (r) => `${r.entityType ?? ''} ${r.entityId ? r.entityId.slice(0, 8) : ''}`,
                  },
                ]}
              />
            </Card>
            <Pagination meta={d.meta} onPage={setPage} />
          </>
        )}
      </QueryState>
    </>
  );
}

/** FR-ADMIN-03: system settings. Values are environment-driven; this page shows what is in effect. */
export function SystemSettingsPage() {
  const q = useQuery({ queryKey: ['health'], queryFn: () => publicApi('/health') });
  return (
    <>
      <PageBanner
        title="System settings"
        description="What is in effect. Change values in the server environment."
      />
      <Card className="stack">
        <dl className="stack-sm">
          <div>
            <dt className="muted small">Approving office label</dt>
            <dd>
              {OSI_LABEL}: {OSI_EXPANSION}. Change it in <code>packages/shared/src/constants.js</code>{' '}
              (decision D1).
            </dd>
          </div>
          <div>
            <dt className="muted small">API and database</dt>
            <dd>
              {q.isLoading
                ? 'Checking...'
                : q.data
                  ? `${q.data.status}, database ${q.data.database}`
                  : 'Unavailable'}
            </dd>
          </div>
          <div>
            <dt className="muted small">Hold expiry, hold limit, time zone, allowed email domains</dt>
            <dd>
              Set with <code>HOLD_EXPIRY_DAYS</code>, <code>MAX_ACTIVE_HOLDS_PER_CLUB</code>,{' '}
              <code>APP_TIMEZONE</code> and <code>ALLOWED_EMAIL_DOMAINS</code>.
            </dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
