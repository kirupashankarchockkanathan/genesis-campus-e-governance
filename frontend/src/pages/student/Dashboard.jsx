import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, Avatar, StatusPill, useCountdown } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { DASH_UPDATES, TODAY } from '../../data/mockData';
import { useGov } from '../../context/GovContext';
import { cn, dayOf, daysUntil, greeting, monthShort, pad } from '../../utils/helpers';

const WEEK_LABELS = { 12: 'Innovation Sprint', 13: 'Open studio', 14: 'Design & Build', 15: 'Robotics lab', 16: 'Sustainability' };
const TILE_TONES = ['bg-[#e1f0e6]', 'bg-[#ece6f4]', 'bg-[#fbf0dd]', 'bg-[#e6eef9]', 'bg-[#eef1dc]'];
const UPDATE_TONES = { mint: 'bg-brand-50 text-brand-600', amber: 'bg-amber-soft text-amber-ink', sky: 'bg-sky-soft text-sky-ink' };

function StatCard({ icon, tone, value, label, hint, to }) {
  const tones = {
    mint: 'bg-brand-50 text-brand-600',
    amber: 'bg-amber-soft text-amber-ink',
    rose: 'bg-rose-soft text-[#d4574a]',
    sky: 'bg-sky-soft text-sky-ink',
  };
  return (
    <Link to={to} className="card group flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', tones[tone])}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-[26px] font-extrabold leading-none text-brand-900">{value}</div>
        <div className="mt-1.5 text-xs font-bold text-brand-900">{label}</div>
        <div className="text-[10px] text-ink-mute">{hint}</div>
      </div>
    </Link>
  );
}

function FeaturedEvent({ event, registered, onRegister, bookmarked, onBookmark, onShare }) {
  const navigate = useNavigate();
  const { h, m, s } = useCountdown(5 * 3600 + 24 * 60 + 18);
  const full = event.status === 'full' || event.status === 'closed';
  return (
    <article className="card grid overflow-hidden md:grid-cols-[39%_1fr]">
      <div className="relative min-h-[260px] overflow-hidden bg-brand-800 p-5 text-white">
        <div className="hero-grid absolute inset-0" />
        <div className="relative flex items-start justify-between text-[9px] font-bold uppercase tracking-[0.16em] text-brand-200">
          <span>Genesis / Campus</span>
          <span>01 / Build</span>
        </div>
        <div className="absolute left-4 top-[34%] select-none text-[64px] font-extrabold leading-none text-white/10">’26</div>
        <div className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2">
          <div className="absolute -inset-10 rounded-full border border-brand-400/30" />
          <div className="absolute -inset-6 -rotate-12 rounded-[50%] border border-brand-300/40" />
          <div className="relative grid h-[74px] w-[74px] place-items-center rounded-full border border-brand-300/60 bg-brand-700/70">
            <Icon name="Zap" className="h-8 w-8 text-brand-200" fill="currentColor" />
          </div>
        </div>
        <div className="absolute bottom-4 left-5 text-[9px] font-bold uppercase tracking-[0.16em] text-brand-200">{event.category}</div>
        <div className="absolute bottom-4 right-5 text-right text-[22px] font-extrabold leading-[0.95] text-white">
          Make it<br />matter.
        </div>
      </div>

      <div className="flex flex-col p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-brand-50 text-[9px] text-brand-700">{event.organizer[0]}</span>
            {event.organizer}
          </div>
          <StatusPill status={event.status === 'open' ? 'closing' : event.status} label={event.status === 'open' ? 'Closing Soon' : undefined} />
        </div>
        <h3 className="mt-3 text-[26px] font-extrabold leading-tight text-brand-900">{event.title}</h3>
        <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-ink-soft">{event.long}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] font-medium text-brand-900">
          <span className="inline-flex items-center gap-1.5"><Icon name="CalendarDays" className="h-3.5 w-3.5 text-brand-600" /> {event.shortDate} · {event.time}</span>
          <span className="inline-flex items-center gap-1.5"><Icon name="MapPin" className="h-3.5 w-3.5 text-brand-600" /> {event.venue}</span>
        </div>
        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] text-ink-soft">
          <Icon name="Clock3" className="h-3.5 w-3.5 text-brand-600" /> Registration closes <b className="text-brand-900">{event.closes}</b>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-amber-soft px-4 py-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-amber-ink">Time left to register</span>
          <span className="text-base font-extrabold tabular-nums text-brand-900">
            {pad(h)}<span className="text-[10px] font-medium text-ink-soft"> h </span>
            {pad(m)}<span className="text-[10px] font-medium text-ink-soft"> m </span>
            {pad(s)}<span className="text-[10px] font-medium text-ink-soft"> s</span>
          </span>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          {registered ? (
            <button onClick={() => navigate('/student/registrations')} className="btn-primary bg-brand-600 hover:bg-brand-700">
              <Icon name="CheckCircle2" className="h-4 w-4" /> Registered
            </button>
          ) : (
            <button disabled={full} onClick={onRegister} className="btn-primary">
              Register for sprint <Icon name="ArrowRight" className="h-4 w-4" />
            </button>
          )}
          <button onClick={onShare} className="btn-ghost h-[38px] w-[38px] px-0" aria-label="Share event"><Icon name="Share2" /></button>
          <button onClick={onBookmark} className={cn('btn-ghost h-[38px] w-[38px] px-0', bookmarked && 'border-brand-300 bg-brand-50 text-brand-700')} aria-label="Bookmark event" aria-pressed={bookmarked}>
            <Icon name="Bookmark" fill={bookmarked ? 'currentColor' : 'none'} />
          </button>
          <Link to={`/student/events/${event.id}`} className="link-arrow ml-auto">Details <Icon name="ArrowRight" className="h-3.5 w-3.5" /></Link>
        </div>
      </div>
    </article>
  );
}

function NextEventCard({ reg }) {
  const { getEvent } = useGov();
  const ev = reg ? getEvent(reg.eventId) : null;
  if (!ev) {
    return (
      <aside className="card flex flex-col items-center justify-center bg-brand-50/50 p-6 text-center">
        <Icon name="CalendarPlus" className="h-8 w-8 text-brand-500" />
        <div className="mt-3 text-sm font-bold text-brand-900">No confirmed events yet</div>
        <p className="mt-1 text-xs text-ink-soft">Register for something to see it here.</p>
        <Link to="/student/events" className="btn-primary mt-4">Explore events</Link>
      </aside>
    );
  }
  const d = daysUntil(ev);
  return (
    <aside className="card relative overflow-hidden border-brand-100 bg-gradient-to-b from-brand-50 to-brand-50/50 p-6">
      <div className="pointer-events-none absolute -right-1 top-6 select-none text-[84px] font-extrabold leading-none text-brand-200/60 [writing-mode:vertical-rl]">NEXT</div>
      <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-brand-700">
        <Icon name="CheckCircle2" className="h-3.5 w-3.5" /> Your next confirmed event
      </div>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-[40px] font-extrabold leading-none text-brand-900">{dayOf(ev)} {monthShort(ev).charAt(0) + monthShort(ev).slice(1).toLowerCase()}</span>
        <span className="text-[8px] font-bold leading-tight text-ink-soft">{monthShort(ev)}<br />2026</span>
      </div>
      <div className="mt-1 text-lg font-bold text-brand-900">{ev.title}</div>
      <div className="mt-0.5 text-[10px] text-ink-soft">{ev.time} · {ev.venue}</div>
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2 py-1 text-[10px] font-bold text-brand-700">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Registration confirmed
      </div>
      <div className="mt-5 flex items-end justify-between border-t border-brand-100 pt-4">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-soft">Starts in</div>
          <div className="mt-1 text-base font-extrabold text-brand-900">{d <= 0 ? 'Today' : `${d} day${d === 1 ? '' : 's'}`}</div>
        </div>
        <Icon name="CalendarCheck" className="h-6 w-6 text-brand-600" />
      </div>
      <Link to="/student/registrations" className="link-arrow mt-3">View registration details <Icon name="ArrowUpRight" className="h-3.5 w-3.5" /></Link>
    </aside>
  );
}

function EventRow({ event }) {
  return (
    <Link to={`/student/events/${event.id}`} className="card group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className="grid h-12 w-12 shrink-0 place-content-center rounded-xl bg-[#f5e7df] text-center leading-none">
        <div className="text-lg font-extrabold text-brand-900">{dayOf(event)}</div>
        <div className="mt-0.5 text-[8px] font-bold tracking-wider text-[#b5694a]">{monthShort(event)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[9px] font-semibold text-ink-mute">{event.category} · {event.organizer}</div>
        <div className="truncate text-[13px] font-bold text-brand-900">{event.title}</div>
        <div className="mt-0.5 flex items-center gap-3 text-[10px] text-ink-mute">
          <span className="inline-flex items-center gap-1"><Icon name="Clock3" className="h-3 w-3" /> {event.time}</span>
          <span className="inline-flex items-center gap-1 truncate"><Icon name="MapPin" className="h-3 w-3" /> {event.venue}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-3 self-stretch">
        <StatusPill status={event.status} label={event.status === 'open' ? 'Open' : undefined} />
        <span className="mt-auto grid h-7 w-7 place-items-center rounded-lg border border-line text-ink-soft transition group-hover:bg-brand-50"><Icon name="ArrowUpRight" className="h-3.5 w-3.5" /></span>
      </div>
    </Link>
  );
}

function WeekPanel() {
  const navigate = useNavigate();
  const { calendar } = useGov();
  const [offset, setOffset] = useState(0);
  const [mode, setMode] = useState('week');
  const start = 12 + offset * 7; // Monday of the displayed week (October 2026)
  const days = [0, 1, 2, 3, 4].map((i) => {
    const day = start + i;
    const ce = calendar.find((c) => c.date === `2026-10-${pad(day)}`);
    const label = offset === 0 ? WEEK_LABELS[day] : ce?.title;
    return { day, label, wd: ['MON', 'TUE', 'WED', 'THU', 'FRI'][i], ce };
  });
  const inOct = (d) => d >= 1 && d <= 31;
  const range = `${start} – ${start + 6} October`;

  return (
    <section className="card p-5">
      <h2 className="text-lg font-extrabold text-brand-900">This week on campus</h2>
      <p className="text-[11px] text-ink-mute">A quick look at what's happening.</p>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset((o) => Math.max(-1, o - 1))} disabled={offset <= -1} className="grid h-7 w-7 place-items-center rounded-lg border border-line text-ink-soft hover:bg-brand-50 disabled:opacity-40" aria-label="Previous week"><Icon name="ChevronLeft" className="h-3.5 w-3.5" /></button>
          <span className="text-xs font-semibold text-brand-900">{range}</span>
          <button onClick={() => setOffset((o) => Math.min(2, o + 1))} disabled={offset >= 2} className="grid h-7 w-7 place-items-center rounded-lg border border-line text-ink-soft hover:bg-brand-50 disabled:opacity-40" aria-label="Next week"><Icon name="ChevronRight" className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex rounded-lg border border-line bg-canvas p-0.5 text-[10px] font-bold">
          {['week', 'agenda'].map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn('rounded-md px-2.5 py-1 capitalize', mode === m ? 'bg-white text-brand-900 shadow-card' : 'text-ink-mute')}>{m}</button>
          ))}
        </div>
      </div>

      {mode === 'week' ? (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {days.map((d, i) => (
            <button
              key={d.day}
              onClick={() => navigate('/student/calendar')}
              className={cn('rounded-xl p-3 text-left transition hover:-translate-y-0.5 hover:shadow-card', TILE_TONES[i], !inOct(d.day) && 'opacity-50')}
            >
              <div className="text-[8px] font-bold tracking-[0.14em] text-ink-soft">{d.wd}</div>
              <div className="mt-1 text-xl font-extrabold text-brand-900">{inOct(d.day) ? d.day : '—'}</div>
              <div className="mt-1 text-[10px] font-semibold text-brand-800">{d.label || 'No events'}</div>
            </button>
          ))}
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {days.filter((d) => d.label).length === 0 && <li className="p-4 text-center text-xs text-ink-soft">Nothing scheduled this week.</li>}
          {days.filter((d) => d.label).map((d) => (
            <li key={d.day}>
              <button onClick={() => navigate(d.ce?.eventId ? `/student/events/${d.ce.eventId}` : '/student/calendar')} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-50/50">
                <span className="w-10 text-[10px] font-bold text-ink-mute">{d.wd} {d.day}</span>
                <span className="flex-1 text-xs font-bold text-brand-900">{d.label}</span>
                <Icon name="ChevronRight" className="h-4 w-4 text-ink-mute" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Link to="/student/calendar" className="link-arrow mt-4">Open full event calendar <Icon name="ArrowRight" className="h-3.5 w-3.5" /></Link>
    </section>
  );
}

function ClubCircle() {
  const { favorites, toggleFavorite } = useApp();
  const { clubs: CLUBS } = useGov();
  const [q, setQ] = useState('');
  const fav = CLUBS.filter((c) => favorites.includes(c.id)).filter((c) => (c.dashName || c.name).toLowerCase().includes(q.toLowerCase()));
  const suggestion = CLUBS.find((c) => !favorites.includes(c.id));
  return (
    <section className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-brand-900">Your club circle</h2>
          <p className="text-[11px] text-ink-mute">Updates from the communities you follow.</p>
        </div>
        <Link to="/student/clubs" className="link-arrow">Find clubs <Icon name="ArrowRight" className="h-3.5 w-3.5" /></Link>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 focus-within:border-brand-400">
        <Icon name="Search" className="h-3.5 w-3.5 text-ink-mute" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your clubs" className="min-w-0 flex-1 text-[11px] placeholder:text-ink-mute" aria-label="Search your clubs" />
      </div>
      <ul className="mt-2">
        {fav.length === 0 && <li className="py-6 text-center text-xs text-ink-soft">No favourite clubs match.</li>}
        {fav.map((c) => (
          <li key={c.id} className="flex items-center gap-3 border-b border-line/70 py-2.5 last:border-0">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon name={c.icon === 'Cpu' ? 'Code2' : c.icon === 'Sparkles' ? 'Zap' : c.icon} className="h-4 w-4" /></span>
            <Link to="/student/clubs" className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-brand-900">{c.dashName || c.name}</div>
              <div className="text-[10px] text-ink-mute">{c.dashMembers || c.members} members · <span className="text-brand-600">{c.tag}</span></div>
            </Link>
            <button onClick={() => toggleFavorite(c.id)} className="grid h-8 w-8 place-items-center text-[#c9475a] hover:scale-110" aria-label={`Unfavourite ${c.name}`}>
              <Icon name="Heart" className="h-4 w-4" fill="currentColor" />
            </button>
          </li>
        ))}
      </ul>
      {suggestion && (
        <button onClick={() => toggleFavorite(suggestion.id)} className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-brand-200 px-3 py-3 text-left text-[11px] font-semibold text-brand-800 hover:bg-brand-50">
          <Icon name="UserPlus" className="h-3.5 w-3.5 text-ink-soft" /> Add {suggestion.name.split(' ').slice(0, 2).join(' ')} to favorites
          <Icon name="Plus" className="ml-auto h-3.5 w-3.5" />
        </button>
      )}
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const app = useApp();
  const { events: EVENTS, getEvent } = useGov();
  const { registrations, notifications, unreadCount, favorites, bookmarks } = app;
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [showFilter, setShowFilter] = useState(false);

  const upcoming = useMemo(
    () => EVENTS.filter((e) => daysUntil(e) >= 0 && e.status !== 'closed').sort((a, b) => a.date.localeCompare(b.date)),
    [EVENTS]
  );
  const filtered = upcoming.filter((e) => {
    const hit = `${e.title} ${e.organizer} ${e.category}`.toLowerCase().includes(q.toLowerCase());
    const f = filter === 'all' || (filter === 'registered' && app.isRegistered(e.id)) || (filter === 'open' && (e.status === 'open' || e.status === 'closing'));
    return hit && f;
  });
  const featured = filtered[0];
  const rows = filtered.slice(1, 3);

  const confirmed = registrations.filter((r) => r.status === 'confirmed');
  const next = confirmed
    .map((r) => ({ r, e: getEvent(r.eventId) }))
    .filter((x) => x.e && daysUntil(x.e) >= 0)
    .sort((a, b) => a.e.date.localeCompare(b.e.date))[0]?.r;
  const comingUp = confirmed.filter((r) => daysUntil(getEvent(r.eventId)) >= 0).length;

  const share = async (ev) => {
    const url = `${window.location.origin}/student/events/${ev.id}`;
    try {
      await navigator.clipboard.writeText(url);
      app.notify('Event link copied to clipboard.');
    } catch {
      app.notify('Copy this link: ' + url, 'info');
    }
  };

  const latest = notifications.slice(0, 3);
  const dateLine = TODAY.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '');

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="flex flex-wrap items-start justify-between gap-4 animate-fadeUp">
        <div>
          <div className="eyebrow">{dateLine} / Academic year 2026–27</div>
          <h1 className="mt-3 text-[40px] font-extrabold leading-none text-brand-900">{greeting()}, {user.name.split(' ')[0]}.</h1>
          <p className="mt-2.5 text-[13px] text-ink-soft">Your campus, in motion. Find the next thing worth showing up for.</p>
        </div>
        <Link to="/student/profile" className="card hidden items-center gap-3 px-4 py-3 transition hover:shadow-pop sm:flex">
          <Avatar initials={user.initials} />
          <div className="leading-tight">
            <div className="text-xs font-bold text-brand-900">{user.name}</div>
            <div className="text-[10px] text-ink-mute">{user.shortDept} · {user.year}</div>
          </div>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard to="/student/registrations" icon="CalendarCheck2" tone="mint" value={pad(registrations.length)} label="Registrations" hint={`${comingUp} coming up`} />
        <StatCard to="/student/calendar" icon="CalendarClock" tone="amber" value="08" label="Upcoming" hint="across campus" />
        <StatCard to="/student/favorites" icon="Heart" tone="rose" value={pad(favorites.length)} label="Favorite clubs" hint="your shortlist" />
        <StatCard to="/student/notifications" icon="Bell" tone="sky" value={pad(unreadCount)} label="Unread updates" hint="since your last visit" />
      </div>

      {/* Coming up */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
            <div>
              <h2 className="text-xl font-extrabold text-brand-900">Coming up on campus</h2>
              <p className="text-[11px] text-ink-mute">Approved events picked for your week.</p>
            </div>
            <Link to="/student/events" className="link-arrow pb-0.5">Explore all events <Icon name="ArrowRight" className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="relative flex w-full gap-2 sm:w-auto">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 sm:w-[190px] sm:flex-none">
              <Icon name="Search" className="h-3.5 w-3.5 text-ink-mute" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events or clubs" className="min-w-0 flex-1 text-[11px] placeholder:text-ink-mute" aria-label="Search events or clubs" />
            </div>
            <button onClick={() => setShowFilter((v) => !v)} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-[11px] font-medium text-ink-soft sm:w-[130px]" aria-haspopup="listbox">
              <Icon name="Filter" className="h-3.5 w-3.5" />
              {filter === 'all' ? 'All events' : filter === 'open' ? 'Open now' : 'Registered'}
            </button>
            {showFilter && (
              <div className="absolute right-0 top-12 z-20 w-40 overflow-hidden rounded-xl border border-line bg-white shadow-pop animate-pop" role="listbox">
                {[['all', 'All events'], ['open', 'Open now'], ['registered', 'Registered']].map(([v, l]) => (
                  <button key={v} role="option" aria-selected={filter === v} onClick={() => { setFilter(v); setShowFilter(false); }} className={cn('block w-full px-3 py-2.5 text-left text-xs hover:bg-brand-50', filter === v && 'font-bold text-brand-700')}>{l}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {featured ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <FeaturedEvent
              event={featured}
              registered={app.isRegistered(featured.id)}
              onRegister={() => app.register(featured.id)}
              bookmarked={bookmarks.includes(featured.id)}
              onBookmark={() => app.toggleBookmark(featured.id)}
              onShare={() => share(featured)}
            />
            <NextEventCard reg={next} />
            {rows.length > 0 && (
              <div className="grid gap-4 lg:col-span-2 md:grid-cols-2">
                {rows.map((e) => <EventRow key={e.id} event={e} />)}
              </div>
            )}
          </div>
        ) : (
          <div className="card p-10 text-center">
            <Icon name="SearchX" className="mx-auto h-8 w-8 text-ink-mute" />
            <div className="mt-3 text-sm font-bold text-brand-900">No events match your search</div>
            <button onClick={() => { setQ(''); setFilter('all'); }} className="btn-ghost mt-4">Clear filters</button>
          </div>
        )}
      </section>

      {/* Week + club circle */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <WeekPanel />
        <ClubCircle />
      </div>

      {/* Updates + guide */}
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-extrabold text-brand-900">Recent updates</h2>
                <Link to="/student/notifications" className="link-arrow">See all <Icon name="ArrowRight" className="h-3.5 w-3.5" /></Link>
              </div>
              <p className="text-[11px] text-ink-mute">{pad(unreadCount)} unread notifications</p>
            </div>
            <button onClick={app.markAllRead} disabled={unreadCount === 0} className="rounded-md bg-brand-50 px-2.5 py-1 text-[10px] font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50">Mark all read</button>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {latest.map((n, i) => (
              <li key={n.id}>
                <button
                  onClick={() => { app.markRead(n.id); navigate('/student/notifications'); }}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', UPDATE_TONES[DASH_UPDATES[i]?.tone || 'mint'])}><Icon name="Bell" className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold text-brand-900">{n.title}</span>
                    <span className="block truncate text-[10px] text-ink-soft">{n.body}</span>
                    <span className="block text-[9px] text-ink-mute">{n.time}</span>
                  </span>
                  {n.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <button
          onClick={() => navigate('/student/assistant')}
          className="card group relative flex min-h-[160px] items-center gap-4 overflow-hidden border-brand-100 bg-brand-50 p-6 text-left transition hover:shadow-pop"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-800 text-white"><Icon name="Sparkles" className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-brand-700">Your campus guide</span>
            <span className="mt-1 block text-sm font-bold text-brand-900">Not sure where to start?</span>
            <span className="block text-[10px] text-ink-soft">Ask Campus AI about events, clubs, and more.</span>
          </span>
          <Icon name="ArrowUpRight" className="h-4 w-4 text-brand-700 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </div>
    </div>
  );
}
