import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { qs } from '../../api/hooks.js';
import { fmtTime } from '../../utils/dates.js';
import { QueryState } from '../ui/QueryState.jsx';

const DAY_START = 6; // hours shown on the timeline
const DAY_END = 24;

const hourOf = (iso) => {
  const [h, m] = fmtTime(iso).split(':').map(Number);
  return h + m / 60;
};

/** Free and busy blocks of one hall across the day, plus the selected window (TC-UI-11). */
export function AvailabilityTimeline({ hall, window: win }) {
  const span = DAY_END - DAY_START;
  const pos = (h) => `${Math.max(0, Math.min(100, ((h - DAY_START) / span) * 100))}%`;
  const bar = (startIso, endIso, className, label) => {
    const s = hourOf(startIso);
    const e = hourOf(endIso) || DAY_END; // 00:00 end means midnight
    return (
      <span
        key={startIso + className + label}
        className={`tl-block ${className}`}
        style={{ left: pos(s), width: `calc(${pos(Math.max(e, s + 0.25))} - ${pos(s)})` }}
        title={label}
      >
        <span className="visually-hidden">{label}</span>
      </span>
    );
  };
  return (
    <div
      className="timeline"
      role="img"
      aria-label={`${hall.name}: ${hall.free ? 'free' : 'busy'} for the selected time`}
    >
      <div className="tl-track">
        {hall.busy.map((b) =>
          bar(
            b.startsAt,
            b.endsAt,
            b.type === 'blocked' ? 'tl-blocked' : 'tl-busy',
            `${b.type === 'blocked' ? 'Blocked' : 'Booked'}: ${b.label} ${fmtTime(b.startsAt)}-${fmtTime(b.endsAt)}`,
          ),
        )}
        {win && bar(win.from, win.to, 'tl-window', `Selected ${fmtTime(win.from)}-${fmtTime(win.to)}`)}
      </div>
      <div className="tl-scale" aria-hidden="true">
        <span>{String(DAY_START).padStart(2, '0')}:00</span>
        <span>12:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}

/** Choose a hall that is free for the window and big enough (FR-HALL-03). Free halls are shown first. */
export function HallPicker({ from, to, minCapacity = 0, value, onChange }) {
  const q = useQuery({
    queryKey: ['availability', from, to, minCapacity],
    enabled: Boolean(from && to),
    queryFn: () => api(`/halls/availability${qs({ from, to, minCapacity })}`),
  });
  if (!from || !to)
    return <p className="muted">Set the event date and time first to see which halls are free.</p>;
  return (
    <QueryState
      query={q}
      emptyTitle="No hall is big enough"
      emptyText="Lower the expected number of participants or ask the Events Authority."
    >
      {(halls) => (
        <ul className="hall-list">
          {[...halls]
            .sort((a, b) => Number(b.free) - Number(a.free))
            .map((h) => (
              <li key={h.id} className={`hall-card ${value === h.id ? 'selected' : ''}`}>
                <label className="hall-pick">
                  <input
                    type="radio"
                    name="hall"
                    value={h.id}
                    checked={value === h.id}
                    disabled={!h.free}
                    onChange={() => onChange(h.id)}
                  />
                  <span>
                    <strong>{h.name}</strong>{' '}
                    <span className="muted small">
                      {h.building}, seats {h.capacity}
                    </span>
                    <br />
                    <span className={`pill ${h.free ? 'pill-ok' : 'pill-bad'}`}>
                      {h.free ? 'Free' : 'Busy'}
                    </span>
                  </span>
                </label>
                <AvailabilityTimeline hall={h} window={{ from, to }} />
              </li>
            ))}
        </ul>
      )}
    </QueryState>
  );
}
