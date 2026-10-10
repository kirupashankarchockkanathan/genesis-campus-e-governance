import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CLUB_CATEGORIES } from '@ccp/shared';
import { useAction, useGet, qs } from '../../api/hooks.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
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

/** Stable cover variant per club so every card keeps its own look (tokens only, no raw colours). */
export const coverOf = (name = '') => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 6;
  return `cover-${h}`;
};
export const initialsOf = (name = '') =>
  name
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

function ClubCard({ club }) {
  return (
    <article className="club-card">
      <div className={`club-cover ${coverOf(club.name)}`}>
        <span className="avatar-xl" aria-hidden="true">
          {initialsOf(club.name)}
        </span>
        {club.recruiting && <span className="ribbon">Recruiting now</span>}
        <span className="club-cover-star">
          <FavouriteStar club={club} />
        </span>
      </div>
      <div className="club-card-body">
        <span className="pill">{club.category}</span>
        <h2>
          <Link to={`/clubs/${club.slug}`}>{club.name}</Link>
        </h2>
        <p className="club-blurb">{club.tagline ?? club.description}</p>
        <div className="club-foot">
          <span className="stat">
            <strong>{club.memberCount}</strong> members
          </span>
          <Link className="btn btn-primary" to={`/clubs/${club.slug}`}>
            View club
          </Link>
        </div>
      </div>
    </article>
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
      <div className="filter-bar" role="search">
        <div className="field" style={{ flex: '1 1 260px' }}>
          <label htmlFor="club-search">Search clubs</label>
          <input
            id="club-search"
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or topic"
          />
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
        <label className="check filter-check">
          <input type="checkbox" checked={recruiting} onChange={(e) => setRecruiting(e.target.checked)} />{' '}
          Recruiting now
        </label>
      </div>
      <QueryState query={query} emptyTitle="No clubs found" emptyText="Try a different search or category.">
        {(clubs) => (
          <>
            <p className="muted" aria-live="polite">
              {clubs.length} {clubs.length === 1 ? 'club' : 'clubs'}
            </p>
            <div className="club-grid">
              {clubs.map((club) => (
                <ClubCard key={club.id} club={club} />
              ))}
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}
