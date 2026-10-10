import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Icon, StatusPill, useCountdown } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { EVENT_TONES } from '../../data/mockData';
import { useGov } from '../../context/GovContext';
import { cn, pad } from '../../utils/helpers';

function Clock({ seconds }) {
  const { h, m, s } = useCountdown(seconds);
  const cell = (v, l) => (
    <div className="text-center">
      <div className="rounded-lg border border-line bg-white px-3 py-2 text-xl font-extrabold tabular-nums text-brand-900 shadow-card">{pad(v)}</div>
      <div className="mt-1 text-[7px] font-bold uppercase tracking-[0.14em] text-ink-mute">{l}</div>
    </div>
  );
  return (
    <div className="flex items-start justify-center gap-2">
      {cell(h, 'Hours')}<span className="pt-2 text-lg font-bold text-ink-mute">:</span>
      {cell(m, 'Minutes')}<span className="pt-2 text-lg font-bold text-ink-mute">:</span>
      {cell(s, 'Seconds')}
    </div>
  );
}

export default function EventDetails() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const app = useApp();
  const { events: EVENTS, getEvent } = useGov();
  const base = getEvent(eventId);
  const [preview, setPreview] = useState(null); // prototype control: override availability

  if (!base) return <Navigate to="/student/events" replace />;
  const event = preview ? { ...base, status: preview } : base;
  const registered = app.isRegistered(event.id);
  const canRegister = event.status === 'open' || event.status === 'closing';
  const remaining = event.capacity - event.registered;
  const pct = Math.min(100, Math.round(((event.registered + (registered ? 1 : 0)) / event.capacity) * 100));

  const share = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      app.notify('Event link copied to clipboard.');
    } catch {
      app.notify(url, 'info');
    }
  };

  const reason = {
    full: 'All places are claimed. Registration is disabled for this event.',
    closed: 'Registration for this event has closed.',
  }[event.status];

  return (
    <div>
      <Link to="/student/events" className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-800 hover:text-brand-600">
        <Icon name="ArrowLeft" className="h-3.5 w-3.5" /> Back to events
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Event details</div>
          <h1 className="mt-2 text-3xl font-extrabold text-brand-900">{event.id === 'innovation-sprint' ? 'Make room for a new idea.' : event.title}</h1>
          <p className="mt-1 text-sm text-ink-soft">Everything you need to know before you join in.</p>
        </div>
        <span className="card inline-flex items-center gap-2 px-3.5 py-2.5 text-[11px] font-bold text-brand-900"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Approved by Student Affairs</span>
      </div>

      {/* Preview switcher */}
      <div className="card mb-5 flex flex-wrap items-center gap-2 px-4 py-2.5">
        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink-mute">Preview event</span>
        {EVENTS.slice(0, 2).map((e) => (
          <button key={e.id} onClick={() => { setPreview(null); navigate(`/student/events/${e.id}`); }} className={cn('rounded-lg px-3 py-1.5 text-[10px] font-bold', e.id === event.id ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-brand-50/60')}>
            {e.id === 'innovation-sprint' ? 'Innovation Sprint' : e.title}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className={cn('relative min-h-[240px] overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-white shadow-card sm:min-h-[265px]', EVENT_TONES[event.tone])} style={event.poster ? { backgroundImage: `linear-gradient(to top, rgba(6,42,37,.8), rgba(6,42,37,.2)), url(${event.poster})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
            <div className="hero-grid absolute inset-0 opacity-50" />
            <div className="absolute -top-10 right-24 h-40 w-40 rounded-full border border-white/20 bg-white/5" />
            <div className="absolute bottom-8 right-14 h-20 w-20 rotate-12 rounded-lg border border-white/20" />
            <div className="relative flex items-start justify-between">
              <span className="rounded-md border border-white/50 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em]">{event.category}</span>
              <StatusPill status={event.status} />
            </div>
            <div className="relative mt-7 flex items-center gap-2 text-[10px] font-bold">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-white/90 text-[8px] text-brand-800">{event.initials}</span>
              {event.organizer}
              <span className="text-white/50">|</span>
              <Icon name="ShieldCheck" className="h-3.5 w-3.5" /> <span className="text-[9px]">Verified organizer</span>
            </div>
            <h2 className="relative mt-3 text-[34px] font-extrabold leading-tight sm:text-[40px]">{event.title}</h2>
            <div className="relative mt-2 text-[11px] text-white/90">Campus ideas, built together.</div>
            <div className="relative text-[8px] font-bold uppercase tracking-[0.18em] text-white/80">Genesis Campus Connect · October · 2026</div>
          </div>

          <section className="card p-6">
            <h3 className="text-base font-extrabold text-brand-900">About this event</h3>
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">{event.about}</p>
            <div className="mt-5 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
              <Info icon="CalendarDays" label="When" value={event.dateLabel} note={event.time} />
              <Info icon="MapPin" label="Where" value={event.venue} note={`GENESIS University · ${event.venueNote}`} />
              <Info icon="Users" label="Who can join" value={event.audience} note={event.audienceNote} />
            </div>
          </section>

          <section className="card flex items-center gap-4 p-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-xs font-extrabold text-brand-700">{event.initials}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-ink-mute">Hosted by</div>
              <div className="text-sm font-extrabold text-brand-900">{event.organizer}</div>
              <div className="text-[10px] text-ink-mute">Student-led community · GENESIS University</div>
            </div>
            <span className="hidden items-center gap-1.5 text-[10px] font-bold text-brand-700 sm:inline-flex"><Icon name="ShieldCheck" className="h-4 w-4" /> Approved event</span>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[0.16em] text-ink-mute">
              Your next step <span className={cn('h-1.5 w-1.5 rounded-full', canRegister ? 'bg-brand-500' : 'bg-ink-mute')} /> {canRegister ? 'Registration live' : 'Registration unavailable'}
            </div>

            {canRegister && !registered && (
              <div className="mt-3 rounded-xl border border-line bg-canvas p-4">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-bold text-brand-900"><Icon name="Clock3" className="h-3.5 w-3.5 text-brand-600" /> Registration closes in</div>
                <Clock seconds={5 * 3600 + 24 * 60 + 15} />
                <div className="mt-3 text-center text-[8px] text-ink-mute">{event.closesLong}</div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-[10px] text-ink-soft">
              <span className="flex items-center gap-2"><Icon name="Users" className="h-3.5 w-3.5" /> Places claimed</span>
              <b className="text-brand-900">{event.registered + (registered ? 1 : 0)} <span className="font-medium text-ink-mute">/ {event.capacity}</span></b>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-50"><div className={cn('h-full rounded-full', event.status === 'full' ? 'bg-[#e06052]' : 'bg-brand-400')} style={{ width: `${event.status === 'full' ? 100 : pct}%` }} /></div>
            <div className="mt-1 text-right text-[8px] text-ink-mute">{event.status === 'full' ? 'No places remaining' : `${remaining - (registered ? 1 : 0)} places remaining`}</div>

            {registered ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
                <Icon name="CheckCircle2" className="h-5 w-5 text-brand-600" />
                <div className="flex-1">
                  <div className="text-[11px] font-bold text-brand-900">You're on the list.</div>
                  <div className="text-[9px] text-ink-soft">Registration confirmed</div>
                </div>
                <button onClick={() => app.cancelRegistration(event.id)} className="text-[10px] font-bold text-rose-ink hover:underline">Cancel</button>
              </div>
            ) : (
              <>
                <button disabled={!canRegister} onClick={() => app.register(event.id)} className="btn-primary mt-4 w-full py-3.5 text-xs">
                  {canRegister ? (<>Register for this event <Icon name="ArrowRight" className="h-4 w-4" /></>) : event.status === 'full' ? 'Fully booked' : 'Registration closed'}
                </button>
                {reason && <p className="mt-2 text-center text-[10px] text-ink-mute">{reason}</p>}
              </>
            )}
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[9px] text-ink-mute"><Icon name="ShieldCheck" className="h-3.5 w-3.5" /> Free to attend · University-approved</div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <button onClick={() => app.toggleBookmark(event.id)} className={cn('btn-ghost py-3', app.bookmarks.includes(event.id) && 'bg-brand-50 text-brand-700')}>
                <Icon name="Heart" className="h-3.5 w-3.5" fill={app.bookmarks.includes(event.id) ? 'currentColor' : 'none'} /> Favorite
              </button>
              <button onClick={share} className="btn-ghost py-3"><Icon name="Share2" className="h-3.5 w-3.5" /> Share / copy link</button>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-line bg-white/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-ink-mute">Prototype controls</div>
                <div className="mt-1 text-[11px] font-bold text-brand-900">Preview availability states</div>
              </div>
              <select
                value={preview || base.status}
                onChange={(e) => setPreview(e.target.value === base.status ? null : e.target.value)}
                className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[10px] font-medium text-ink"
                aria-label="Preview availability state"
              >
                <option value="open">Open</option>
                <option value="closing">Closing soon</option>
                <option value="full">Fully booked</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <p className="mt-2 text-[8px] text-ink-mute">Closed and full events disable registration and keep the reason visible.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Info({ icon, label, value, note }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon name={icon} className="h-4 w-4" /></span>
      <div>
        <div className="text-[8px] font-bold uppercase tracking-[0.16em] text-ink-mute">{label}</div>
        <div className="text-xs font-bold text-brand-900">{value}</div>
        <div className="text-[10px] text-ink-mute">{note}</div>
      </div>
    </div>
  );
}
