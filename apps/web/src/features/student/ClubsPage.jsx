import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CLUB_CATEGORIES } from '@ccp/shared';
import { api } from '../../api/client.js';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

/** FR-CLUB-01: all active clubs with search and category filter. */
export function ClubsPage() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const query = useQuery({
    queryKey: ['clubs', { q, category }],
    queryFn: () => api(`/clubs?${new URLSearchParams({ ...(q && { q }), ...(category && { category }) })}`),
  });

  return (
    <>
      <PageBanner title="Clubs" description="Find a club, see what it does and when it recruits." />
      <div className="row" role="search">
        <div className="field" style={{ flex: '1 1 240px' }}>
          <label htmlFor="club-search">Search clubs</label>
          <input id="club-search" className="input" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="field" style={{ flex: '0 1 220px' }}>
          <label htmlFor="club-category">Category</label>
          <select
            id="club-category"
            className="select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {CLUB_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      {query.isLoading && <Skeleton />}
      {query.isError && <ErrorState error={query.error} onRetry={query.refetch} />}
      {query.data?.length === 0 && (
        <EmptyState title="No clubs found">Try a different search or category.</EmptyState>
      )}
      <div className="grid-cards">
        {query.data?.map((club) => (
          <Card key={club.id} as="article">
            <div className="row">
              <Avatar name={club.name} />
              <div>
                <h2>{club.name}</h2>
                <span className="muted small">{club.category}</span>
              </div>
            </div>
            <p>{club.tagline ?? club.description}</p>
            <p className="muted small">{club.memberCount} members</p>
          </Card>
        ))}
      </div>
    </>
  );
}
