import { useMemo, useState } from 'react';
import { Avatar, EmptyState, Icon } from '../ui';
import { Pagination, SearchBox, downloadCsv, usePaged } from './Common';
import { initialsOf } from '../../store/selectors';

export default function MembersTable({ members, clubName = 'club', pageSize = 10 }) {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return members.filter((m) => (role === 'all' || (role === 'lead' ? m.role !== 'Member' : m.role === 'Member')) && (!t || `${m.name} ${m.rollNo} ${m.dept} ${m.email}`.toLowerCase().includes(t)));
  }, [members, q, role]);
  const paged = usePaged(list, pageSize, `${q}|${role}`);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search by name, roll number or department" />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role" className="field w-auto appearance-auto py-2.5">
          <option value="all">All members</option>
          <option value="lead">Leadership & core</option>
          <option value="member">Members</option>
        </select>
        <button
          onClick={() => downloadCsv(`${clubName.replace(/\W+/g, '-').toLowerCase()}-members.csv`, [['Name', 'Roll no', 'Department', 'Year', 'Role', 'Joined', 'Email'], ...list.map((m) => [m.name, m.rollNo, m.dept, m.year, m.role, m.joined, m.email])])}
          className="btn-ghost"
        >
          <Icon name="Download" className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon="SearchX" title="No members match" body="Try a different search or filter." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-canvas text-[10px] font-bold uppercase tracking-wider text-ink-mute">
                <tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Roll no</th><th className="px-4 py-3">Dept · Year</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Joined</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paged.items.map((m) => (
                  <tr key={m.id} className="hover:bg-brand-50/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3"><Avatar initials={initialsOf(m.name)} size="sm" /><div><div className="font-bold text-brand-900">{m.name}</div><div className="text-[10px] text-ink-mute">{m.email}</div></div></div>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{m.rollNo}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{m.dept} · Y{m.year}</td>
                    <td className="px-4 py-2.5"><span className={m.role === 'Member' ? 'text-ink-soft' : 'font-bold text-brand-700'}>{m.role}</span></td>
                    <td className="px-4 py-2.5 text-ink-soft">{m.joined}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...paged} onPage={paged.setPage} />
        </>
      )}
      <p className="mt-3 text-[10px] text-ink-mute">Sample roster generated for the prototype. A backend would supply real membership records.</p>
    </div>
  );
}
