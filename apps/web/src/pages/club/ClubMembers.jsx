import { useMemo } from 'react';
import { Card } from '../../components/gov/Common';
import MembersTable from '../../components/gov/MembersTable';
import { PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useGov } from '../../context/GovContext';
import { clubMembers, getClubFrom } from '../../store/selectors';

export default function ClubMembers() {
  const { user } = useAuth();
  const { state } = useGov();
  const club = getClubFrom(state, user.clubId);
  const members = useMemo(() => clubMembers(state, user.clubId), [state, user.clubId]);
  return (
    <div>
      <PageHeader eyebrow={club?.name} title="Members" subtitle={`${members.length} members in your club.`} />
      <Card><MembersTable members={members} clubName={club?.name} /></Card>
    </div>
  );
}
