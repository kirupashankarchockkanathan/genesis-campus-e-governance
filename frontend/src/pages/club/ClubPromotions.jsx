import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PromoStatus } from '../../components/gov/Badges';
import { Field, Select, Textarea } from '../../components/gov/Form';
import Modal from '../../components/gov/Modal';
import { PromotionSummary } from '../../components/gov/RequestSummary';
import { usePortal } from '../../components/gov/PortalShell';
import { EmptyState, Icon, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useGov } from '../../context/GovContext';
import { PROMO_CHANNELS } from '../../data/govData';
import { getClubFrom, getRequest, requestsForClub } from '../../store/selectors';

export default function ClubPromotions() {
  const { user } = useAuth();
  const gov = useGov();
  const { notify } = usePortal();
  const loc = useLocation();
  const [form, setForm] = useState(null); // {id?, requestId, channels, posterSupport, note}
  const club = getClubFrom(gov.state, user.clubId);
  const promos = gov.state.promotions.filter((p) => p.clubId === user.clubId);
  const eligible = requestsForClub(gov.state, user.clubId).filter((r) => !['draft', 'rejected', 'completed'].includes(r.status) && !promos.some((p) => p.requestId === r.id && ['submitted', 'changes'].includes(p.status)));

  useEffect(() => {
    if (loc.state?.requestId) setForm({ requestId: loc.state.requestId, channels: ['dashboard'], posterSupport: false, note: '' });
  }, [loc.state]);

  const toggle = (k) => setForm((f) => ({ ...f, channels: f.channels.includes(k) ? f.channels.filter((c) => c !== k) : [...f.channels, k] }));
  const save = () => {
    const res = form.id ? gov.resubmitPromotion(form.id, form) : gov.createPromotion(form);
    if (res.ok) { notify(form.id ? 'Promotion resubmitted.' : 'Promotion requested.'); setForm(null); } else notify(res.error, 'info');
  };

  return (
    <div>
      <PageHeader eyebrow="Publicity" title="Event promotions" subtitle="Request dashboard features, poster boards, signage and newsletter coverage."
        action={<button disabled={eligible.length === 0} onClick={() => setForm({ requestId: eligible[0].id, channels: ['dashboard'], posterSupport: false, note: '' })} className="btn-primary disabled:opacity-40"><Icon name="Plus" className="h-4 w-4" /> New promotion request</button>} />
      {promos.length === 0 ? <EmptyState icon="Megaphone" title="No promotion requests yet" body="Submit an event request first, then ask for publicity here." /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {promos.map((p) => (
            <PromotionSummary key={p.id} promo={p} request={getRequest(gov.state, p.requestId)} club={club}>
              <div className="mt-3 flex items-center gap-2"><PromoStatus status={p.status} />
                {p.status === 'changes' && <button onClick={() => setForm({ id: p.id, requestId: p.requestId, channels: p.channels, posterSupport: p.posterSupport, note: p.note })} className="btn-primary ml-auto px-3 py-1.5 text-[11px]"><Icon name="Pencil" className="h-3.5 w-3.5" /> Update & resubmit</button>}
              </div>
            </PromotionSummary>
          ))}
        </div>
      )}
      {form && (
        <Modal title={form.id ? 'Update promotion request' : 'Request promotion'} onClose={() => setForm(null)} footer={<><button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn-primary" onClick={save}>{form.id ? 'Resubmit' : 'Send request'}</button></>}>
          <Field label="Event" htmlFor="pr-ev"><Select id="pr-ev" disabled={!!form.id} value={form.requestId} onChange={(e) => setForm({ ...form, requestId: e.target.value })}>
            {(form.id ? [getRequest(gov.state, form.requestId)] : eligible).map((r) => <option key={r.id} value={r.id}>{r.title} ({r.id})</option>)}
          </Select></Field>
          <fieldset className="mt-4 space-y-2"><legend className="mb-1 text-xs font-bold text-brand-900">Channels</legend>
            {PROMO_CHANNELS.map((c) => <label key={c.key} className="flex items-start gap-2 text-[11px] text-ink-soft"><input type="checkbox" className="mt-0.5" checked={form.channels.includes(c.key)} onChange={() => toggle(c.key)} /><span><b className="text-brand-900">{c.label}</b> — {c.hint}</span></label>)}
          </fieldset>
          <label className="mt-3 flex items-center gap-2 text-[11px] text-ink-soft"><input type="checkbox" checked={form.posterSupport} onChange={(e) => setForm({ ...form, posterSupport: e.target.checked })} /> Poster publicity support (printing &amp; placement)</label>
          <Field className="mt-4" label="Note to the Events Section" htmlFor="pr-note"><Textarea id="pr-note" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        </Modal>
      )}
    </div>
  );
}
