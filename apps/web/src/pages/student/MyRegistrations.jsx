import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, PageHeader } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { useGov } from '../../context/GovContext';
import { cn, dayOf, daysUntil, monthShort } from '../../utils/helpers';

export default function MyRegistrations() {
  const navigate = useNavigate();
  const app = useApp();
  const { getEvent } = useGov();
  const [emptyPreview, setEmptyPreview] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [menu, setMenu] = useState(false);

  const items = (emptyPreview ? [] : app.registrations)
    .filter((r) => r.status === 'confirmed')
    .map((r) => ({ ...r, event: getEvent(r.eventId) }))
    .filter((r) => r.event)
    .sort((a, b) => a.event.date.localeCompare(b.event.date));

  const selected = items.find((i) => i.eventId === selectedId) || items[0];

  return (
    <div>
      <PageHeader
        eyebrow="Your campus plans"
        title="My Registrations"
        subtitle="Everything you've signed up for, all in one place."
        action={<Link to="/student/calendar" className="btn-ghost"><Icon name="CalendarDays" className="h-4 w-4" /> Browse calendar</Link>}
      />

      <section className="relative mb-8 overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 to-brand-100/50 px-7 py-8">
        <div className="absolute -right-4 bottom-0 text-brand-200/70"><Icon name="CalendarDays" className="h-28 w-28" strokeWidth={1} /></div>
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-brand-700"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Your next campus moment</div>
            <h2 className="mt-4 text-[28px] font-extrabold text-brand-900">{items.length ? 'Your October is taking shape.' : 'Your calendar is open.'}</h2>
            <p className="mt-1 text-xs text-ink-soft">{items.length ? `${['Zero', 'One', 'Two', 'Three', 'Four', 'Five'][Math.min(items.length, 5)]} good reason${items.length === 1 ? '' : 's'} to get out and meet your campus.` : 'Find something worth showing up for.'}</p>
          </div>
          <div className="border-l border-brand-200 pl-6 text-center">
            <div className="text-4xl font-extrabold text-brand-900">{String(items.length).padStart(2, '0')}</div>
            <div className="text-[10px] text-ink-soft">upcoming events</div>
          </div>
        </div>
      </section>

      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-brand-900">Upcoming events</h2>
          <p className="text-[10px] text-ink-mute">Your confirmed place is saved. We'll see you there.</p>
        </div>
        <button onClick={() => setEmptyPreview((v) => !v)} className="link-arrow">{emptyPreview ? 'Show registrations' : 'Preview empty state'}</button>
      </div>

      {items.length === 0 ? (
        <div className="card grid place-items-center px-6 py-14 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Icon name="TicketX" className="h-6 w-6" /></div>
          <div className="mt-4 text-base font-extrabold text-brand-900">No registrations yet</div>
          <p className="mt-1 max-w-sm text-xs text-ink-soft">When you register for an approved event it will appear here with its reference and reminders.</p>
          <button onClick={() => navigate('/student/events')} className="btn-primary mt-5">Explore events <Icon name="ArrowRight" className="h-4 w-4" /></button>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            {items.map((r) => {
              const e = r.event;
              const d = daysUntil(e);
              const active = selected?.eventId === r.eventId;
              return (
                <article key={r.eventId} className={cn('card overflow-hidden transition', active && 'border-brand-300 ring-1 ring-brand-200')}>
                  <button
                    onClick={() => { setSelectedId(r.eventId); setExpanded(expanded === r.eventId ? null : r.eventId); }}
                    className="flex w-full items-start gap-4 p-4 text-left"
                    aria-expanded={expanded === r.eventId}
                  >
                    <span className="grid h-12 w-12 shrink-0 place-content-center rounded-xl bg-[#f3eadd] text-center leading-none">
                      <span className="text-[8px] font-bold tracking-wider text-ink-soft">{monthShort(e)}</span>
                      <span className="mt-0.5 text-xl font-extrabold text-brand-900">{dayOf(e)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[9px] text-ink-mute">{e.category} · {e.organizer}</span>
                      <span className="block text-sm font-extrabold text-brand-900">{e.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[10px] text-ink-mute">
                        <span className="inline-flex items-center gap-1"><Icon name="Clock3" className="h-3 w-3" /> {e.time}</span>
                        <span className="inline-flex items-center gap-1"><Icon name="MapPin" className="h-3 w-3" /> {e.venue}{e.venueNote && e.venueNote.startsWith('Block') ? ` · ${e.venueNote}` : ''}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="pill bg-brand-50 text-brand-700"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Confirmed</span>
                      <Icon name="ChevronDown" className={cn('h-4 w-4 text-ink-mute transition', expanded === r.eventId && 'rotate-180')} />
                    </span>
                  </button>
                  {expanded === r.eventId && (
                    <div className="border-t border-line bg-canvas/50 px-4 py-3 text-[11px] text-ink-soft animate-fadeUp">
                      {e.summary} <Link to={`/student/events/${e.id}`} className="font-bold text-brand-700 hover:underline">View event page</Link>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[10px]">
                    <span className="inline-flex items-center gap-1.5 text-ink-soft"><Icon name="Timer" className="h-3.5 w-3.5 text-amber-ink" /> Starts in <b className="text-amber-ink">{d <= 0 ? 'today' : `${d} day${d === 1 ? '' : 's'}`}</b></span>
                    <span className="text-[9px] text-ink-mute">REF <b className="text-ink-soft">{r.ref}</b></span>
                  </div>
                </article>
              );
            })}
          </div>

          {selected && (
            <aside className="card p-6 lg:sticky lg:top-24">
              <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-brand-700"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Registration confirmed</div>
              <h3 className="mt-3 text-lg font-extrabold text-brand-900">{selected.event.title}</h3>
              <div className="text-[10px] text-ink-mute">Hosted by {selected.event.organizer}</div>
              <p className="mt-3 border-b border-line pb-4 text-[10px] leading-relaxed text-ink-soft">{selected.event.summary} Your check-in QR will be available on event day.</p>
              <ul className="mt-4 space-y-3.5">
                <Detail icon="CalendarDays" title={new Date(selected.event.date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} sub={`${selected.event.time} – ${selected.event.endTime}`} />
                <Detail icon="MapPin" title={selected.event.venue} sub="Campus map & directions available" />
                <Detail icon="Ticket" title={selected.ref} sub="Your registration reference" />
              </ul>
              <div className="relative mt-5 flex gap-2">
                <button onClick={() => app.notify('Added to your calendar (demo).')} className="btn-primary flex-1 py-3"><Icon name="CalendarPlus" className="h-4 w-4" /> Add to calendar</button>
                <button onClick={() => setMenu((v) => !v)} className="btn-ghost h-[42px] w-[42px] px-0" aria-label="More actions" aria-haspopup="menu"><Icon name="Ellipsis" className="h-4 w-4" /></button>
                {menu && (
                  <div role="menu" className="absolute bottom-12 right-0 z-10 w-48 overflow-hidden rounded-xl border border-line bg-white shadow-pop animate-pop">
                    <button role="menuitem" onClick={() => { setMenu(false); navigate(`/student/events/${selected.eventId}`); }} className="block w-full px-3.5 py-2.5 text-left text-xs hover:bg-brand-50">View event page</button>
                    <button role="menuitem" onClick={() => { setMenu(false); app.cancelRegistration(selected.eventId); setSelectedId(null); }} className="block w-full px-3.5 py-2.5 text-left text-xs text-rose-ink hover:bg-rose-soft">Cancel registration</button>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[9px] text-ink-mute"><Icon name="Check" className="h-3 w-3 text-brand-600" /> A reminder will arrive the day before.</div>
            </aside>
          )}
        </div>
      )}

      <section className="card mt-8 overflow-hidden">
        <button onClick={() => setHistoryOpen((v) => !v)} className="flex w-full items-center justify-between px-6 py-5 text-left" aria-expanded={historyOpen}>
          <span>
            <span className="block text-base font-extrabold text-brand-900">Registration history</span>
            <span className="text-[10px] text-ink-mute">Past campus moments and attendance.</span>
          </span>
          <Icon name="ChevronUp" className={cn('h-4 w-4 text-ink-soft transition', !historyOpen && 'rotate-180')} />
        </button>
        {historyOpen && (
          <div className="overflow-x-auto px-6 pb-5 scroll-thin">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="text-[8px] font-bold uppercase tracking-[0.16em] text-ink-mute">
                  <th className="py-3 font-bold">Event</th><th className="py-3 font-bold">Organizer</th><th className="py-3 font-bold">Date</th><th className="py-3 font-bold">Status</th><th />
                </tr>
              </thead>
              <tbody>
                {app.history.map((h) => (
                  <tr key={h.id} className="border-t border-line text-[10px] text-ink-soft">
                    <td className="py-3.5"><span className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-600"><Icon name="CalendarDays" className="h-3.5 w-3.5" /></span><b className="text-brand-900">{h.title}</b></span></td>
                    <td>{h.organizer}</td>
                    <td>{h.date}</td>
                    <td><span className={cn('pill', h.status === 'Attended' ? 'bg-brand-50 text-brand-700' : 'bg-[#eef1ef] text-ink-soft')}><span className={cn('h-1.5 w-1.5 rounded-full', h.status === 'Attended' ? 'bg-brand-500' : 'bg-ink-mute')} /> {h.status}</span></td>
                    <td className="text-right">{h.status === 'Attended' && <button onClick={() => app.notify('Certificate download is not enabled in this demo.', 'info')} className="text-ink-mute hover:text-brand-700" aria-label="Download certificate"><Icon name="Download" className="h-4 w-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Detail({ icon, title, sub }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 text-brand-600"><Icon name={icon} className="h-4 w-4" /></span>
      <div><div className="text-[11px] font-bold text-brand-900">{title}</div><div className="text-[9px] text-ink-mute">{sub}</div></div>
    </li>
  );
}
