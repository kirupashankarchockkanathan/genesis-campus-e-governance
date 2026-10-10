import { useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Card } from '../../components/ui/Card.jsx';

/** Club dashboard shell (FR-CW-01). Event, recruitment and task widgets arrive with their modules in Phase 1/2. */
export function ClubDashboard() {
  const { clubId } = useParams();
  const { membershipFor } = useAuth();
  const m = membershipFor(clubId);
  return (
    <>
      <PageBanner title={m.club.name} description={`You are signed in as ${m.roleName}.`} />
      <Card>
        <h2>What your role can do</h2>
        {m.permissions.length === 0 ? (
          <p className="muted">Members can read the workspace and take part in the internal discussion.</p>
        ) : (
          <ul>
            {m.permissions.map((p) => (
              <li key={p}>
                <code>{p}</code>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
