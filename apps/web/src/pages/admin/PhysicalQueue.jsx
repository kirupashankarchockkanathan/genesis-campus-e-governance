import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Tabs } from '../../components/gov/Common';
import { PhysicalBadge } from '../../components/gov/Badges';
import { Field, Input, Textarea } from '../../components/gov/Form';
import Modal from '../../components/gov/Modal';
import { usePortal } from '../../components/gov/PortalShell';
import { EmptyState, Icon, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useGov } from '../../context/GovContext';
import { can, deniedReason } from '../../store/permissions';
import { fmtDate, getClubFrom, TODAY_ISO } from '../../store/selectors';
import { useAdminBase } from './AdminLayout';

export default function PhysicalQueue() {
  const base = useAdminBase();
  const { user } = useAuth();
  const gov = useGov();
  const { notify } = usePortal();
  const [tab, setTab] = useState('pending');
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState({ status: 'verified', receivedOn: TODAY_ISO, refNo: '', note: '' });

  const live = gov.state.requests.filter((r) => ['submitted', 'approved', 'published'].includes(r.status) && !r.legacyEventId);
  const lists = {
    pending: live.filter((r) => r.status === 'submitted' && r.physical.status === 'pending'),
    issue: live.filter((r) => r.status === 'submitted' && r.physical.status === 'issue'),
    verified: live.filter((r) => r.physical.status === 'verified'),
  };
  const tabs = [['pending', 'Awaiting letter'], ['issue', 'Issues'], ['verified', 'Verified']].map(([key, label]) => ({ key, label, count: lists[key].length }));
  const allowed = can(user, 'request.physical');

  const start = (r) => { setTarget(r); setForm({ status: r.physical.status === 'issue' ? 'issue' : 'verified', receivedOn: r.physical.receivedOn || TODAY_ISO, refNo: r.physical.refNo || '', note: r.physical.note || '' }); };
  const save = () => {
    const res = gov.recordPhysical(target.id, form);
    if (res.ok) { notify(form.status === 'verified' ? 'Hard-copy letter verified.' : 'Issue recorded.'); setTarget(null); } else notify(res.error, 'info');
  };

  return (
    <div>
      <PageHeader eyebrow="Verification" title="Hard-copy letter checks" subtitle="Signed permission letters must reach the office on paper. Record them here, separately from the online review." />
      <div className="mb-4"><Tabs tabs={tabs} value={tab} onChange={setTab} /></div>
      {!allowed && <p className="mb-4 text-xs text-ink-soft">{deniedReason('request.physical')}</p>}
      {lists[tab].length === 0 ? <EmptyState icon="FileCheck2" title="Nothing here" body="No requests in this list right now." /> : (
        <Card pad={false}>
          <ul className="divide-y divide-line">
            {lists[tab].map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <Link to={`${base}/requests/${r.id}`} className="text-xs font-extrabold text-brand-900 hover:underline">{r.title}</Link>
                  <div className="text-[10px] text-ink-mute">{r.id} · {getClubFrom(gov.state, r.clubId)?.name} · event {fmtDate(r.date)}</div>
                  {r.physical.refNo && <div className="text-[10px] text-ink-soft">Ref {r.physical.refNo} · received {r.physical.receivedOn ? fmtDate(r.physical.receivedOn) : '—'}</div>}
                  {r.physical.status === 'issue' && <div className="text-[10px] text-amber-ink">Issue: {r.physical.note}</div>}
                </div>
                <PhysicalBadge status={r.physical.status} />
                {allowed && r.status === 'submitted' && <button onClick={() => start(r)} className="btn-ghost px-3 py-1.5 text-[11px]"><Icon name="FileCheck2" className="h-3.5 w-3.5" /> {r.physical.status === 'verified' ? 'Update' : 'Record'}</button>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {target && (
        <Modal title="Record hard-copy check" subtitle={target.title} onClose={() => setTarget(null)} footer={<><button className="btn-ghost" onClick={() => setTarget(null)}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {[['verified', 'Letter verified'], ['issue', 'Issue found']].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={form.status === k} onClick={() => setForm({ ...form, status: k })} className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${form.status === k ? 'border-brand-700 bg-brand-800 text-white' : 'border-line bg-white text-ink-soft'}`}>{l}</button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date received" htmlFor="q-date"><Input id="q-date" type="date" max={TODAY_ISO} value={form.receivedOn} onChange={(e) => setForm({ ...form, receivedOn: e.target.value })} /></Field>
            <Field label="Reference no." htmlFor="q-ref"><Input id="q-ref" value={form.refNo} onChange={(e) => setForm({ ...form, refNo: e.target.value })} placeholder="OSA/HC/2026/…" /></Field>
          </div>
          <Field className="mt-4" label={form.status === 'issue' ? 'Describe the issue' : 'Note (optional)'} htmlFor="q-note"><Textarea id="q-note" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        </Modal>
      )}
    </div>
  );
}
