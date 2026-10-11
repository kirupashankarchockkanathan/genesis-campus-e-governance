import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, SearchBox, Tabs } from '../../components/gov/Common';
import { OnlineBadge, PhysicalBadge, RequestStatus } from '../../components/gov/Badges';
import { EmptyState, Icon, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useGov } from '../../context/GovContext';
import { fmtDate, requestsForClub } from '../../store/selectors';

const TABS = {
  all: () => true,
  action: (r) => ['draft', 'correction_requested'].includes(r.status),
  review: (r) => r.status === 'submitted',
  approved: (r) => ['approved', 'published'].includes(r.status),
  closed: (r) => ['rejected', 'completed'].includes(r.status),
};

export default function ClubRequests() {
  const { user } = useAuth();
  const { state } = useGov();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const mine = useMemo(() => requestsForClub(state, user.clubId).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), [state, user.clubId]);
  const tabs = [['all', 'All'], ['action', 'Needs action'], ['review', 'In review'], ['approved', 'Approved'], ['closed', 'Rejected / past']].map(([key, label]) => ({ key, label, count: mine.filter(TABS[key]).length }));
  const list = mine.filter(TABS[tab]).filter((r) => !q.trim() || `${r.title} ${r.id}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div>
      <PageHeader eyebrow="Event requests" title="Track your requests" subtitle="Status, hard-copy verification, approval and feedback for every request."
        action={<Link to="/club/requests/new" className="btn-primary"><Icon name="Plus" className="h-4 w-4" /> New request</Link>} />
      <div className="mb-4"><Tabs tabs={tabs} value={tab} onChange={setTab} /></div>
      <div className="mb-4 flex"><SearchBox value={q} onChange={setQ} placeholder="Search your requests" /></div>
      {list.length === 0 ? <EmptyState icon="ClipboardList" title="No requests here" action={<Link to="/club/requests/new" className="btn-primary">Create a request</Link>} /> : (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-canvas text-[10px] font-bold uppercase tracking-wider text-ink-mute"><tr><th className="px-5 py-3">Event</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Online review</th><th className="px-5 py-3">Hard copy</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-line">
                {list.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-5 py-3.5"><Link to={`/club/requests/${r.id}`} className="font-extrabold text-brand-900 hover:underline">{r.title}</Link><div className="text-[10px] text-ink-mute">{r.id} · v{r.version}</div></td>
                    <td className="px-5 py-3.5 text-ink-soft">{r.date ? fmtDate(r.date) : '—'}</td>
                    <td className="px-5 py-3.5">{r.status === 'draft' ? '—' : <OnlineBadge status={r.onlineReview.status} />}</td>
                    <td className="px-5 py-3.5">{r.status === 'draft' ? '—' : <PhysicalBadge status={r.physical.status} />}</td>
                    <td className="px-5 py-3.5"><RequestStatus status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
