import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, PageHeader, StatusPill, EmptyState } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { EVENT_TONES } from '../../data/mockData';
import { useGov } from '../../context/GovContext';
import { cn } from '../../utils/helpers';

const TABS = [
  ['all', 'All events'],
  ['open', 'Open'],
  ['closing', 'Closing soon'],
  ['full', 'Fully booked'],
  ['closed', 'Closed'],
];

function EventCard({ event }) {
  const app = useApp();
  const navigate = useNavigate();
  const registered = app.isRegistered(event.id);
  const fav = app.bookmarks.includes(event.id);
  const canRegister = event.status === 'open' || event.status === 'closing';
  const full = event.status === 'full';
  const closed = event.status === 'closed';

  return (
    <article className="card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
      <Link to={`/student/events/${event.id}`} className={cn('relative block h-[132px] bg-gradient-to-br p-4 text-white', EVENT_TONES[event.tone])} style={event.poster ? { backgroundImage: `linear-gradient(to top, rgba(6,42,37,.85), rgba(6,42,37,.15)), url(${event.poster})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        <div className="hero-grid absolute inset-0 opacity-60" />
        <div className="absolute -right-6 -top-6 h-36 w-36 rounded-full border border-white/20 bg-white/5" />
        <div className="absolute right-10 top-5 h-20 w-20 rotate-12 rounded-lg border border-white/20" />
        <span className="relative grid h-7 w-7 place-items-center rounded-md border border-white/40 text-[9px] font-bold">{event.initials}</span>
        <div className="absolute inset-x-4 bottom-3">
          <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/80">{event.category}</div>
          <div className="text-[19px] font-extrabold leading-tight">{event.title}</div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <StatusPill status={event.status} />
          <button
            onClick={() => app.toggleBookmark(event.id)}
            aria-pressed={fav}
            aria-label={fav ? 'Remove bookmark' : 'Bookmark event'}
            className={cn('grid h-7 w-7 place-items-center rounded-full', fav ? 'text-[#c9475a]' : 'text-ink-mute hover:bg-brand-50')}
          >
            <Icon name="Heart" className="h-4 w-4" fill={fav ? 'currentColor' : 'none'} />
          </button>
        </div>
        <Link to={`/student/events/${event.id}`} className="mt-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-brand-900">{event.title}</h3>
          <Icon name="ArrowRight" className="h-4 w-4 shrink-0 text-ink-soft" />
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-50 text-[8px] font-bold text-brand-700">{event.initials}</span>
          <span className="text-[10px] font-medium text-ink-soft">{event.organizer}</span>
        </div>
        <p className="mt-2.5 min-h-[32px] text-[10px] leading-relaxed text-ink-soft">{event.blurb}</p>

        <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-[10px] text-ink-soft">
          <div className="flex items-center gap-2"><Icon name="CalendarDays" className="h-3.5 w-3.5" /> {event.dateLabel} · {event.time}</div>
          <div className="flex items-center gap-2"><Icon name="MapPin" className="h-3.5 w-3.5" /> {event.venue}</div>
          <div className="flex items-center justify-between gap-2">
            <span className={cn('flex items-center gap-2', full && 'text-rose-ink')}>
              <Icon name="Users" className="h-3.5 w-3.5" />
              {closed ? `${event.attended} attended` : `${event.registered + (registered && event.id === 'innovation-sprint' ? 1 : 0)} / ${event.capacity} registered`}
            </span>
            <span className="text-[9px] text-ink-mute">{canRegister ? `Closes ${event.closes}` : event.closes}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <Link to={`/student/events/${event.id}`} className="link-arrow">View event details <Icon name="ArrowRight" className="h-3.5 w-3.5" /></Link>
          {registered ? (
            <button onClick={() => navigate('/student/registrations')} className="btn-ghost border-brand-200 bg-brand-50 px-3 py-2 text-brand-700">
              <Icon name="Check" className="h-3.5 w-3.5" /> Registered
            </button>
          ) : canRegister ? (
            <button onClick={() => app.register(event.id)} className="btn-primary px-4 py-2">Register</button>
          ) : (
            <button disabled className="rounded-xl bg-[#f1eeee] px-3.5 py-2 text-[10px] font-bold text-ink-mute">{full ? 'Fully booked' : 'Registration closed'}</button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ExploreEvents() {
  const navigate = useNavigate();
  const { events: EVENTS } = useGov();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [category, setCategory] = useState('All categories');
  const [catOpen, setCatOpen] = useState(false);
  const [asc, setAsc] = useState(true);

  const categories = ['All categories', ...Array.from(new Set(EVENTS.map((e) => e.category)))];
  const base = EVENTS.filter((e) => {
    const hit = `${e.title} ${e.organizer} ${e.venue}`.toLowerCase().includes(q.toLowerCase());
    return hit && (category === 'All categories' || e.category === category);
  });
  const counts = useMemo(() => {
    const c = { all: base.length };
    ['open', 'closing', 'full', 'closed'].forEach((s) => (c[s] = base.filter((e) => e.status === s).length));
    return c;
  }, [base]);
  const list = base
    .filter((e) => tab === 'all' || e.status === tab)
    .sort((a, b) => (asc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  // Keep upcoming events first when sorting ascending (past event last)
  if (asc) list.sort((a, b) => Number(a.status === 'closed') - Number(b.status === 'closed'));

  return (
    <div>
      <PageHeader
        eyebrow="Campus life · 2026–27"
        title="Explore events"
        subtitle="Find your next idea, new people, or reason to stay a little longer on campus."
        action={<span className="card inline-flex items-center gap-2 px-3.5 py-2.5 text-[11px] font-bold text-brand-900"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> University-approved events</span>}
      />

      {/* Featured banner */}
      <section className="relative mb-9 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 text-white shadow-card">
        <div className="hero-grid absolute inset-0" />
        <div className="pointer-events-none absolute right-[4%] top-1/2 hidden h-[360px] w-[360px] -translate-y-1/2 rounded-full border border-brand-300/20 md:block" />
        <div className="pointer-events-none absolute right-[8%] top-1/2 hidden h-[260px] w-[260px] -translate-y-1/2 rounded-full border border-dashed border-brand-300/30 md:block" />
        <div className="pointer-events-none absolute right-[13%] top-1/2 hidden h-[160px] w-[160px] -translate-y-1/2 place-items-center rounded-full border border-brand-300/40 bg-brand-700/60 text-center md:grid">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-brand-200">Genesis</div>
            <div className="text-[56px] font-extrabold leading-none text-[#f3c26b]">26</div>
            <div className="text-[7px] font-bold uppercase tracking-[0.2em] text-brand-200">Ideas in motion</div>
          </div>
        </div>
        <div className="pointer-events-none absolute right-[5%] top-[62%] hidden rotate-6 rounded-lg border border-white/20 bg-brand-800/80 px-3 py-2 text-center md:block">
          <div className="text-[8px] font-bold text-brand-200">OCT</div>
          <div className="text-xl font-extrabold leading-none">12</div>
          <div className="text-[7px] font-bold text-brand-200">MON · 10 AM</div>
        </div>
        <div className="relative px-7 py-9 sm:px-9">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-100">
            <span className="text-[#f3c26b]">✳</span> This week on campus
          </div>
          <h2 className="mt-4 max-w-md text-[34px] font-extrabold leading-[1.05] sm:text-[40px]">Make something that moves us forward.</h2>
          <p className="mt-3 max-w-md text-xs leading-relaxed text-brand-100/90">One day, one team, one campus challenge. The GENESIS Innovation Sprint is where student ideas become things people can use.</p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] font-medium">
            <span className="inline-flex items-center gap-1.5"><Icon name="CalendarDays" className="h-3.5 w-3.5" /> 12 October 2026</span>
            <span className="inline-flex items-center gap-1.5"><Icon name="MapPin" className="h-3.5 w-3.5" /> Main Auditorium</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-brand-700">● Registration open</span>
          </div>
          <button onClick={() => navigate('/student/events/innovation-sprint')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-100 px-4 py-2.5 text-xs font-bold text-brand-900 transition hover:bg-white">
            Explore the sprint <Icon name="ArrowRight" className="h-4 w-4" />
          </button>
        </div>
        <div className="relative flex items-center justify-between bg-brand-900/60 px-7 py-2 text-[8px] font-bold uppercase tracking-[0.18em] text-brand-200 sm:px-9">
          <span>01 / Featured event</span>
          <span>Innovation Club · Hackathon</span>
        </div>
      </section>

      <h2 className="text-xl font-extrabold text-brand-900">Approved events</h2>
      <p className="text-[11px] text-ink-mute">Ideas, skills and community — all happening around campus.</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-3 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
          <Icon name="Search" className="h-4 w-4 text-ink-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search event, club or venue" className="min-w-0 flex-1 text-xs placeholder:text-ink-mute" aria-label="Search events" />
        </div>
        <div className="relative">
          <button onClick={() => setCatOpen((v) => !v)} className="flex h-full min-w-[190px] items-center justify-between gap-3 rounded-xl border border-line bg-white px-3.5 py-3 text-xs text-ink-soft" aria-haspopup="listbox">
            <span className="flex items-center gap-2"><Icon name="Filter" className="h-4 w-4" /> {category}</span>
            <Icon name="ChevronDown" className="h-4 w-4 text-brand-900" />
          </button>
          {catOpen && (
            <div role="listbox" className="absolute left-0 top-12 z-20 w-full min-w-[200px] overflow-hidden rounded-xl border border-line bg-white shadow-pop animate-pop">
              {categories.map((c) => (
                <button key={c} role="option" aria-selected={c === category} onClick={() => { setCategory(c); setCatOpen(false); }} className={cn('block w-full px-3.5 py-2.5 text-left text-xs hover:bg-brand-50', c === category && 'font-bold text-brand-700')}>{c}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setAsc((v) => !v)} className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-xs font-semibold text-brand-900">
          <Icon name="ArrowDownUp" className="h-4 w-4" /> Date {asc ? '↑' : '↓'}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn('rounded-lg px-3 py-2 text-[11px] font-semibold transition', tab === id ? 'border border-brand-200 bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-white')}
          >
            {label} <span className="ml-1 rounded bg-white/70 px-1 text-[9px] text-ink-mute">{counts[id]}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-ink-mute">
        <span>{list.length} event{list.length === 1 ? '' : 's'}</span>
        <span>Showing approved, student-facing listings</span>
      </div>

      {list.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="SearchX" title="No events match" body="Try a different search, category or status." action={<button onClick={() => { setQ(''); setTab('all'); setCategory('All categories'); }} className="btn-ghost">Reset filters</button>} />
        </div>
      ) : (
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-white/70 px-4 py-3 text-[10px] text-ink-soft">
        <Icon name="Clock3" className="h-4 w-4 text-brand-600" />
        Registration availability updates as deadlines approach. Places are confirmed only when registration is complete.
      </div>
    </div>
  );
}
