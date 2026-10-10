import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tabs } from '../../components/gov/Common';
import { PromoStatus } from '../../components/gov/Badges';
import ReasonDialog from '../../components/gov/ReasonDialog';
import { PromotionSummary } from '../../components/gov/RequestSummary';
import { usePortal } from '../../components/gov/PortalShell';
import { EmptyState, Icon, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useGov } from '../../context/GovContext';
import { can, deniedReason } from '../../store/permissions';
import { getClubFrom, getRequest } from '../../store/selectors';
import { useAdminBase } from './AdminLayout';

export default function Promotions() {
  const base = useAdminBase();
  const { user } = useAuth();
  const gov = useGov();
  const { notify } = usePortal();
  const [tab, setTab] = useState('submitted');
  const [dialog, setDialog] = useState(null); // {promo, decision}
  const promos = gov.state.promotions;
  const tabs = [['submitted', 'To review'], ['changes', 'Changes requested'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([key, label]) => ({ key, label, count: promos.filter((p) => p.status === key).length }));
  const list = promos.filter((p) => p.status === tab);
  const allowed = can(user, 'promotion.review');

  const decide = (p, decision, note = '') => {
    const res = gov.reviewPromotion(p.id, { decision, note });
    if (res.ok) { notify({ approve: 'Promotion approved.', changes: 'Changes requested.', reject: 'Promotion rejected.' }[decision]); setDialog(null); } else notify(res.error, 'info');
  };

  return (
    <div>
      <PageHeader eyebrow="Publicity" title="Promotion requests" subtitle="Clubs can ask for dashboard features, poster boards, signage and newsletter coverage for their events." />
      <div className="mb-4"><Tabs tabs={tabs} value={tab} onChange={setTab} /></div>
      {!allowed && <p className="mb-4 text-xs text-ink-soft">{deniedReason('promotion.review')}</p>}
      {list.length === 0 ? <EmptyState icon="Megaphone" title="No promotion requests here" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((p) => {
            const r = getRequest(gov.state, p.requestId);
            return (
              <PromotionSummary key={p.id} promo={p} request={r} club={getClubFrom(gov.state, p.clubId)}>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <PromoStatus status={p.status} />
                  {r && <Link to={`${base}/requests/${r.id}`} className="link-arrow text-[11px]">View event request</Link>}
                  {allowed && p.status === 'submitted' && (
                    <span className="ml-auto flex gap-1.5">
                      <button onClick={() => decide(p, 'approve')} className="btn-primary px-3 py-1.5 text-[11px]"><Icon name="Check" className="h-3.5 w-3.5" /> Approve</button>
                      <button onClick={() => setDialog({ p, decision: 'changes' })} className="btn-ghost px-3 py-1.5 text-[11px]">Request changes</button>
                      <button onClick={() => setDialog({ p, decision: 'reject' })} className="btn-ghost px-3 py-1.5 text-[11px] text-rose-ink">Reject</button>
                    </span>
                  )}
                </div>
              </PromotionSummary>
            );
          })}
        </div>
      )}
      {dialog && (
        <ReasonDialog
          title={dialog.decision === 'reject' ? 'Reject promotion' : 'Request changes'}
          tone={dialog.decision === 'reject' ? 'danger' : 'warn'}
          requireNote
          noteLabel="Message to the club"
          confirmLabel={dialog.decision === 'reject' ? 'Reject' : 'Send'}
          onClose={() => setDialog(null)}
          onConfirm={(_r, note) => decide(dialog.p, dialog.decision, note)}
        />
      )}
    </div>
  );
}
