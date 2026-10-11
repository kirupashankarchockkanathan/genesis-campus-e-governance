import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, InfoRow, SearchBox, Tabs } from '../../components/gov/Common';
import { RequestStatus } from '../../components/gov/Badges';
import MembersTable from '../../components/gov/MembersTable';
import { EmptyState, Icon, PageHeader } from '../../components/ui';
import { useGov } from '../../context/GovContext';
import { clubMembers, clubProfile, fmtDate, getClubFrom } from '../../store/selectors';
import { useAdminBase } from './AdminLayout';

export function ClubDirectory() {
  const base = useAdminBase();
  const { state, clubs } = useGov();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const cats = useMemo(() => ['all', ...new Set(clubs.map((c) => c.category))], [clubs]);
  const list = clubs.filter((c) => (cat === 'all' || c.category === cat) && (!q.trim() || `${c.name} ${c.category}`.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <div>
      <PageHeader eyebrow="Directory" title="Clubs" subtitle="Club details, objectives, authorities and members." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search clubs" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category" className="field w-auto appearance-auto py-2.5">{cats.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}</select>
      </div>
      {list.length === 0 ? <EmptyState icon="SearchX" title="No clubs match" /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const p = clubProfile(state, c.id);
            return (
              <Link key={c.id} to={`${base}/clubs/${c.id}`} className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-base font-extrabold text-brand-700">{c.letter}</span>
                  <div className="min-w-0"><div className="truncate text-sm font-extrabold text-brand-900">{c.name}</div><div className="text-[10px] text-ink-mute">{c.category} · {c.members} members</div></div>
                  {c.isNew && <span className="pill ml-auto bg-brand-800 text-white">New</span>}
                </div>
                <p className="mt-3 line-clamp-2 text-[11px] text-ink-soft">{c.blurb}</p>
                <div className="mt-3 text-[10px] text-ink-mute">{p.authorities.slice(0, 2).map((a) => `${a.role}: ${a.name}`).join(' · ')}</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ClubDetail() {
  const { id } = useParams();
  const base = useAdminBase();
  const { state } = useGov();
  const [tab, setTab] = useState('about');
  const club = getClubFrom(state, id);
  const members = useMemo(() => clubMembers(state, id), [state, id]);
  if (!club) return <EmptyState icon="SearchX" title="Club not found" action={<Link to={`${base}/clubs`} className="btn-primary">Back to clubs</Link>} />;
  const p = clubProfile(state, id);
  const reqs = state.requests.filter((r) => r.clubId === id && r.status !== 'draft').sort((a, b) => b.date.localeCompare(a.date));
  const tabs = [{ key: 'about', label: 'About' }, { key: 'authorities', label: 'Authorities', count: p.authorities.length }, { key: 'members', label: 'Members', count: club.members }, { key: 'events', label: 'Events & requests', count: reqs.length }];

  return (
    <div>
      <Link to={`${base}/clubs`} className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-ink-soft hover:text-brand-800"><Icon name="ArrowLeft" className="h-3.5 w-3.5" /> Clubs</Link>
      <PageHeader eyebrow={`${club.category} · Founded ${p.founded}`} title={club.name} subtitle={p.tagline || club.blurb} />
      <div className="mb-5"><Tabs tabs={tabs} value={tab} onChange={setTab} /></div>

      {tab === 'about' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Description"><p className="text-xs leading-relaxed text-ink-soft">{club.blurb}</p>
            <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
              <InfoRow icon="Mail" label="Contact">{p.contactEmail || '—'}</InfoRow>
              <InfoRow icon="Clock3" label="Meets">{p.meeting}</InfoRow>
              <InfoRow icon="MapPin" label="Location">{p.location}</InfoRow>
              <InfoRow icon="Users" label="Members">{club.members}</InfoRow>
            </div></Card>
          <Card title="Objectives">{p.objectives.length ? <ul className="space-y-2">{p.objectives.map((o) => <li key={o} className="flex gap-2 text-xs text-ink-soft"><Icon name="CheckCircle2" className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />{o}</li>)}</ul> : <p className="text-xs text-ink-soft">No objectives recorded.</p>}</Card>
        </div>
      )}
      {tab === 'authorities' && (
        <Card title="Club authorities"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{p.authorities.map((a) => (
          <div key={a.role + a.name} className="rounded-2xl border border-line p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-ink-mute">{a.role}</div><div className="mt-1 text-sm font-extrabold text-brand-900">{a.name}</div><div className="text-[11px] text-ink-soft">{a.email || 'No email on record'}</div></div>
        ))}</div></Card>
      )}
      {tab === 'members' && <Card title="Members"><MembersTable members={members} clubName={club.name} /></Card>}
      {tab === 'events' && (
        reqs.length === 0 ? <EmptyState icon="CalendarDays" title="No event requests yet" /> : (
          <Card pad={false}><ul className="divide-y divide-line">{reqs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1"><Link to={`${base}/requests/${r.id}`} className="text-xs font-extrabold text-brand-900 hover:underline">{r.title}</Link><div className="text-[10px] text-ink-mute">{r.id} · {fmtDate(r.date)} · {r.venue}</div></div>
              <RequestStatus status={r.status} />
            </li>))}</ul></Card>
        )
      )}
    </div>
  );
}
