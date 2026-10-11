import { useMemo } from 'react';
import PortalShell from '../../components/gov/PortalShell';
import { useAuth } from '../../context/AuthContext';
import { useGov } from '../../context/GovContext';
import { adminStats } from '../../store/selectors';

export const adminBase = (user) => `/admin/${user?.adminType === 'events' ? 'events' : 'osa'}`;
export const useAdminBase = () => adminBase(useAuth().user);

export default function AdminLayout() {
  const { user } = useAuth();
  const { state } = useGov();
  const stats = useMemo(() => adminStats(state), [state]);
  const base = adminBase(user);
  const isOsa = user?.adminType === 'osa';
  const nav = [
    { to: `${base}/dashboard`, label: 'Overview', icon: 'LayoutGrid' },
    { to: `${base}/requests`, label: 'Event Requests', icon: 'ClipboardList', count: stats.pendingOnline + stats.readyForApproval + stats.readyToPublish },
    { to: `${base}/physical`, label: 'Hard-copy Checks', icon: 'FileCheck2', count: stats.awaitingPhysical },
    { to: `${base}/promotions`, label: 'Promotion Requests', icon: 'Megaphone', count: stats.pendingPromotions },
    { to: `${base}/club-applications`, label: 'Club Applications', icon: 'UserPlus', count: stats.clubApps },
    { to: `${base}/clubs`, label: 'Club Directory', icon: 'Users' },
    { to: `${base}/reports`, label: 'Reports', icon: 'BarChart3' },
    { to: `${base}/settings`, label: 'Settings', icon: 'Settings' },
  ];
  return (
    <PortalShell
      nav={nav}
      sectionLabel={isOsa ? 'OSA Console' : 'Events Section'}
      footerNote={isOsa ? 'You can grant final approval and decide club applications.' : 'You review and verify requests and publish approved events. Final approval stays with OSA.'}
    />
  );
}
