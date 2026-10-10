import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { APP_NAME } from '@ccp/shared';
import { publicApi } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Button } from '../components/ui/Button.jsx';
import { QueryState } from '../components/ui/QueryState.jsx';
import { fmtRange } from '../utils/dates.js';

/** D9: public read-only page with title, poster, date, venue and club. No personal data; registering needs a login. */
export function PublicEventPage() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const q = useQuery({ queryKey: ['public-event', id], queryFn: () => publicApi(`/public/events/${id}`) });
  return (
    <main className="public-page">
      <header className="public-head">
        <Link to="/" className="brand-inline">
          {APP_NAME}
        </Link>
      </header>
      <QueryState query={q}>
        {(ev) => (
          <article className="card stack">
            <h1>{ev.title}</h1>
            <p className="muted">{ev.clubName}</p>
            {ev.posterUrl && /\.(png|jpe?g|webp)$/i.test(ev.posterUrl) && (
              <img className="poster" src={ev.posterUrl} alt={`Poster of ${ev.title}`} />
            )}
            <p>{ev.summary}</p>
            <dl className="stack-sm">
              <div>
                <dt className="muted small">When</dt>
                <dd>{fmtRange(ev.startsAt, ev.endsAt)}</dd>
              </div>
              <div>
                <dt className="muted small">Venue</dt>
                <dd>{ev.venue ?? (ev.mode === 'online' ? 'Online' : 'To be confirmed')}</dd>
              </div>
            </dl>
            {isAuthenticated ? (
              <Button to={`/events/${ev.id}`}>Open event to register</Button>
            ) : (
              <div className="stack-sm">
                <p>Log in to register for this event.</p>
                <Button to="/login" state={{ from: `/events/${ev.id}` }}>
                  Log in to register
                </Button>
              </div>
            )}
          </article>
        )}
      </QueryState>
    </main>
  );
}
