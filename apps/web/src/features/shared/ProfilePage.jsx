import { useAuth } from '../../auth/AuthContext.jsx';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Card } from '../../components/ui/Card.jsx';

/** Read-only profile for now; editing and participation counts come in Phase 1 (FR-PROF-01). */
export function ProfilePage() {
  const { user, memberships } = useAuth();
  const rows = [
    ['Full name', user.fullName],
    ['Username', user.username],
    ['College email', user.email],
    ['Roll number', user.rollNumber],
    ['Department', user.department],
    ['Year', user.yearOfStudy],
  ];
  return (
    <>
      <PageBanner title="Profile" description="Your academic details and club roles." />
      <Card>
        <dl className="stack-sm">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="muted small">{k}</dt>
              <dd style={{ margin: 0 }}>{v ?? '-'}</dd>
            </div>
          ))}
        </dl>
      </Card>
      {memberships.length > 0 && (
        <Card>
          <h2>Clubs joined</h2>
          <ul>
            {memberships.map((m) => (
              <li key={m.club.id}>
                {m.club.name}: {m.roleName}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
