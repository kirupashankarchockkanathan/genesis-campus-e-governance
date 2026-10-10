import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';

/** Members and roles, read-only for now. Editing roles arrives in Phase 1 (FR-CW-02). */
export function MembersPage() {
  const { clubId } = useParams();
  const query = useQuery({
    queryKey: ['club-members', clubId],
    queryFn: () => api(`/clubs/${clubId}/members`),
  });
  return (
    <>
      <PageBanner title="Members and roles" description="Everyone in this club and what they do." />
      {query.isLoading && <Skeleton />}
      {query.isError && <ErrorState error={query.error} onRetry={query.refetch} />}
      {query.data?.length === 0 && <EmptyState title="No members yet" />}
      <div className="grid-cards">
        {query.data?.map((m) => (
          <Card key={m.userId} as="article">
            <div className="row">
              <Avatar name={m.fullName} />
              <div>
                <h2>{m.fullName}</h2>
                <span className="pill">{m.roleName}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
