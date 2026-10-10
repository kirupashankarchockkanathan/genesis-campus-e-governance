import { useState } from 'react';
import { Card } from '../../components/gov/Common';
import Modal from '../../components/gov/Modal';
import { usePortal } from '../../components/gov/PortalShell';
import { Icon, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useGov } from '../../context/GovContext';
import { ROLE_LABELS, actorKey } from '../../store/permissions';
import { aiMode } from '../../services/ai';

/** Shared settings page for admin and club portals. */
export default function PortalSettings() {
  const { user } = useAuth();
  const gov = useGov();
  const { notify } = usePortal();
  const [confirm, setConfirm] = useState(false);
  const reset = () => {
    gov.resetAll();
    setConfirm(false);
    notify('Demo data reset to the original sample data.');
  };
  return (
    <div>
      <PageHeader eyebrow="Account" title="Settings" subtitle="Account details and demo data controls." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Signed in as">
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between"><dt className="text-ink-soft">Name</dt><dd className="font-bold text-brand-900">{user.name}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">User ID</dt><dd className="font-bold text-brand-900">{user.userId}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Role</dt><dd className="font-bold text-brand-900">{ROLE_LABELS[actorKey(user)]}</dd></div>
          </dl>
          <p className="mt-4 rounded-xl bg-amber-soft px-3 py-2 text-[11px] text-amber-ink">Sign-in and permissions are checked by the portal server on every action.</p>
        </Card>
        <Card title="AI services"><p className="text-xs text-ink-soft">Mode: <b className="text-brand-900">{aiMode()}</b></p><p className="mt-2 text-[11px] text-ink-mute">The portal API answers with Claude when <code>ANTHROPIC_API_KEY</code> is set on the server, and with built-in rules otherwise. If the API is unreachable the local mock is used.</p></Card>
        <Card title="Demo data" className="lg:col-span-2">
          <p className="text-xs text-ink-soft">All requests, approvals and club changes are stored on the portal server. Reset restores the original sample data for everyone and is only available while the demo accounts are enabled (OSA only).</p>
          <button onClick={() => setConfirm(true)} className="btn-ghost mt-4 text-rose-ink"><Icon name="RotateCcw" className="h-4 w-4" /> Reset demo data</button>
        </Card>
      </div>
      {confirm && <Modal title="Reset demo data?" size="sm" onClose={() => setConfirm(false)} footer={<><button className="btn-ghost" onClick={() => setConfirm(false)}>Cancel</button><button className="btn-primary" onClick={reset}>Reset</button></>}><p className="text-xs text-ink-soft">This removes every request, approval and new club created during the demo.</p></Modal>}
    </div>
  );
}
