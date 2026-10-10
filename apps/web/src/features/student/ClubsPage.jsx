import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CLUB_CATEGORIES } from '@ccp/shared';
import { useAction, useGet, qs } from '../../api/hooks.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { QueryState } from '../../components/ui/QueryState.jsx';

export function FavouriteStar({ club, onDone }) {
  const { platformRole } = useAuth();
  const act = useAction({ invalidate: [['clubs'], ['favourites'], ['club']], onSuccess: onDone });
  if (platformRole !== 'student') return null;
  const on = club.isFavourite;
  return (
    <button
      className={`star ${on ? 'on' : ''}`}
      aria-pressed={on}
      aria-label={on ? `Remove ${club.name} from favourites` : `Add ${club.name} to favourites`}
      onClick={() => act.mutate({ method: on ? 'DELETE' : 'POST', path: `/clubs/${club.id}/favourite` })}
      disabled={act.isPending}
    >
      <span aria-hidden="true">{on ? '★' : '☆'}</span>
    </button>
  );
}

/** FR-CLUB-01: all active clubs with search, category filter, favourite star and Recruiting badge. */
export function ClubsPage() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [recruiting, setRecruiting] = useState(false);
  const query = useGet(
    ['clubs', { q, category, recruiting }],
    `/clubs${qs({ q, category, recruiting: recruiting ? 'true' : '' })}`,
  );

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
        <label className="check">
          <input type="checkbox" checked={recruiting} onChange={(e) => setRecruiting(e.target.checked)} />{' '}
          Recruiting now
        </label>
      </div>
      <QueryState query={query} emptyTitle="No clubs found" emptyText="Try a different search or category.">
        {(clubs) => (
          <div className="grid-cards">
            {clubs.map((club) => (
              <Card key={club.id} as="article">
                <div className="row-between">
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <Avatar name={club.name} />
                    <div>
                      <h2>
                        <Link to={`/clubs/${club.slug}`}>{club.name}</Link>
                      </h2>
                      <span className="muted small">{club.category}</span>
                    </div>
                  </div>
                  <FavouriteStar club={club} />
                </div>
                <p>{club.tagline ?? club.description}</p>
                <div className="row">
                  <span className="muted small">{club.memberCount} members</span>
                  {club.recruiting && <span className="pill pill-ok">Recruiting</span>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}
