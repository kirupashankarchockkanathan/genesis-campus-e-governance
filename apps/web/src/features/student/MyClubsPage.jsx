import { useAuth } from '../../auth/AuthContext.jsx';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';

export function MyClubsPage() {
  const { memberships } = useAuth();
  return (
    <>
      <PageBanner title="My Clubs" description="Clubs you are a member of, with your role in each." />
      {memberships.length === 0 && (
        <EmptyState title="No memberships yet">Apply to a recruitment to join a club.</EmptyState>
      )}
      <div className="grid-cards">
        {memberships.map((m) => (
          <Card key={m.club.id} as="article">
            <div className="row">
              <Avatar name={m.club.name} />
              <div>
                <h2>{m.club.name}</h2>
                <span className="pill">{m.roleName}</span>
              </div>
            </div>
            <Button to={`/club/${m.club.id}`}>Open workspace</Button>
          </Card>
        ))}
      </div>
    </>
  );
}
