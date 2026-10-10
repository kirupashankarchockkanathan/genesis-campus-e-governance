import { useMemo } from 'react';
import { Card, StatCard, downloadCsv } from '../../components/gov/Common';
import { Icon, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useGov } from '../../context/GovContext';
import { can, deniedReason } from '../../store/permissions';
import { adminStats, fmtDate, fmtDateTime, getClubFrom } from '../../store/selectors';
import { REQUEST_STATUS } from '../../components/gov/Badges';

function Bars({ data, color = 'bg-brand-500' }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="flex items-center gap-3 text-[11px]">
          <span className="w-36 shrink-0 truncate text-ink-soft">{d.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#f1eeee]"><span className={`block h-full rounded-full ${color}`} style={{ width: `${(d.value / max) * 100}%` }} /></span>
          <span className="w-6 text-right font-bold text-brand-900">{d.value}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const { state } = useGov();
  const s = useMemo(() => adminStats(state), [state]);
  const reqs = state.requests.filter((r) => r.status !== 'draft');

  const byStatus = Object.entries(REQUEST_STATUS).filter(([k]) => k !== 'draft').map(([k, v]) => ({ label: v.label, value: reqs.filter((r) => r.status === k).length }));
  const byCategory = [...new Set(reqs.map((r) => r.category))].map((c) => ({ label: c, value: reqs.filter((r) => r.category === c).length })).sort((a, b) => b.value - a.value);
  const byClub = [...new Set(reqs.map((r) => r.clubId))].map((c) => ({ label: getClubFrom(state, c)?.name || c, value: reqs.filter((r) => r.clubId === c).length })).sort((a, b) => b.value - a.value).slice(0, 6);
  const apps = ['submitted', 'correction_requested', 'approved', 'rejected'].map((k) => ({ label: { submitted: 'Awaiting decision', correction_requested: 'Corrections', approved: 'Approved', rejected: 'Rejected' }[k], value: state.clubApplications.filter((a) => a.status === k).length }));

  if (!can(user, 'reports.view')) return <p className="text-sm text-ink-soft">{deniedReason('reports.view')}</p>;

  const exportRequests = () => downloadCsv('event-requests.csv', [
    ['Request', 'Title', 'Club', 'Category', 'Date', 'Venue', 'Status', 'Online review', 'Hard copy', 'Approved by', 'Published'],
    ...reqs.map((r) => [r.id, r.title, getClubFrom(state, r.clubId)?.name, r.category, r.date, r.venue, r.status, r.onlineReview.status, r.physical.status, r.approval?.by || '', r.publication?.at || '']),
  ]);

  return (
    <div>
      <PageHeader eyebrow="Insights" title="Reports" subtitle="Live figures from the prototype’s sample data."
        action={<button onClick={exportRequests} className="btn-primary"><Icon name="Download" className="h-4 w-4" /> Export requests (CSV)</button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total requests" value={reqs.length} icon="ClipboardList" />
        <StatCard label="Published events" value={s.published} icon="PartyPopper" />
        <StatCard label="Active clubs" value={s.clubs} icon="Users" tone="sky" />
        <StatCard label="Rejected / returned" value={s.rejected + s.corrections} icon="AlertTriangle" tone="amber" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Requests by status"><Bars data={byStatus} /></Card>
        <Card title="Requests by category"><Bars data={byCategory} color="bg-[#4a73c4]" /></Card>
        <Card title="Most active clubs"><Bars data={byClub} color="bg-[#8a5bb0]" /></Card>
        <Card title="Club applications"><Bars data={apps} color="bg-[#e3a02c]" /></Card>
      </div>
      <Card className="mt-6" title="Audit log" subtitle="Most recent actions" pad={false}>
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs">
          <thead className="bg-canvas text-[10px] font-bold uppercase tracking-wider text-ink-mute"><tr><th className="px-5 py-3">When</th><th className="px-5 py-3">Who</th><th className="px-5 py-3">Action</th></tr></thead>
          <tbody className="divide-y divide-line">{state.activity.slice(0, 15).map((a) => (
            <tr key={a.id}><td className="whitespace-nowrap px-5 py-2.5 text-ink-soft">{fmtDateTime(a.at)}</td><td className="px-5 py-2.5 font-bold text-brand-900">{a.by} <span className="font-normal text-ink-mute">({a.role})</span></td><td className="px-5 py-2.5 text-ink-soft">{a.text}</td></tr>
          ))}</tbody></table></div>
      </Card>
      <p className="mt-3 text-[10px] text-ink-mute">Report date range: sample data to {fmtDate('2026-10-10')}.</p>
    </div>
  );
}
