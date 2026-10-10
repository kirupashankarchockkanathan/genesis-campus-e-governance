import { Icon } from './ui';
import { CLUB_TONES } from '../data/mockData';
import { cn } from '../utils/helpers';
import { useApp } from '../context/AppContext';

export default function ClubCard({ club, onView }) {
  const { favorites, toggleFavorite } = useApp();
  const fav = favorites.includes(club.id);
  const tone = CLUB_TONES[club.tone];
  return (
    <article className="card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className={cn('relative h-[106px] overflow-hidden', tone.bg)}>
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'radial-gradient(rgba(26,26,26,0.12) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
        <div className="absolute -left-4 top-6 h-24 w-44 rotate-[-12deg] rounded-[50%] border border-ink/10" />
        <span className={cn('pointer-events-none absolute -right-1 top-1 select-none text-[78px] font-extrabold leading-none', tone.letter)}>{club.letter}</span>
        <span className="absolute left-3.5 top-3.5 rounded-lg bg-white/90 px-2.5 py-1 text-[9px] font-bold text-brand-900">{club.category}</span>
        <button
          onClick={() => toggleFavorite(club.id)}
          aria-pressed={fav}
          aria-label={fav ? `Remove ${club.name} from favourites` : `Save ${club.name} to favourites`}
          className={cn('absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white shadow-card transition hover:scale-110', fav ? 'text-[#c9475a]' : 'text-ink-soft')}
        >
          <Icon name="Heart" className="h-4 w-4" fill={fav ? 'currentColor' : 'none'} />
        </button>
        <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-white shadow-card">
          <Icon name={club.icon} className={cn('h-5 w-5', tone.icon)} />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-extrabold text-brand-900">{club.name}</h3>
          {club.featured && <span className="mt-0.5 text-[7px] font-bold tracking-[0.16em] text-brand-600">FEATURED</span>}
        </div>
        <p className="mt-1.5 min-h-[44px] text-[10px] leading-relaxed text-ink-soft">{club.blurb}</p>
        <div className="mt-3 flex items-center gap-5 border-t border-line pt-3 text-[10px] text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><Icon name="Users" className="h-3.5 w-3.5" /> <b className="text-brand-900">{club.members}</b> members</span>
          <span className="inline-flex items-center gap-1.5"><Icon name="CalendarDays" className="h-3.5 w-3.5" /> <b className="text-brand-900">{club.upcoming}</b> upcoming</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="inline-flex items-center gap-1.5 text-[9px] text-ink-mute">
            <Icon name="Bookmark" className="h-3 w-3" fill={fav ? 'currentColor' : 'none'} /> {fav ? 'Saved · not a member' : 'Public community'}
          </span>
          <button onClick={() => onView(club)} className="link-arrow">View club <Icon name="ArrowRight" className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </article>
  );
}
