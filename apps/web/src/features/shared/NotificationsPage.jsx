import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiWithMeta } from '../../api/client.js';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Pagination } from '../../components/ui/DataTable.jsx';
import { QueryState } from '../../components/ui/QueryState.jsx';
import { fmtDateTime } from '../../utils/dates.js';

/** "See all" from the bell panel. */
export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['notifications', 'all', page],
    queryFn: () => apiWithMeta(`/notifications?page=${page}`),
  });
  return (
    <>
      <PageBanner title="Notifications" description="Everything that happened, newest first." />
      <QueryState query={q} isEmpty={(d) => !d?.data?.length} emptyTitle="No notifications yet">
        {(d) => (
          <>
            <div className="stack">
              {d.data.map((n) => (
                <Card key={n.id} as="article">
                  <div className="row-between">
                    <strong>{n.title}</strong>
                    <span className="muted small">{fmtDateTime(n.createdAt)}</span>
                  </div>
                  <p>{n.body}</p>
                  {n.route && <Link to={n.route}>Open</Link>}
                </Card>
              ))}
            </div>
            <Pagination meta={d.meta} onPage={setPage} />
          </>
        )}
      </QueryState>
    </>
  );
}
