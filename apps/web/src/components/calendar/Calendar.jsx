import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addMonths, format, getDay, getDaysInMonth } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { qs } from '../../api/hooks.js';
import { dayKey, fmtTime, monthRange, todayLocalKey } from '../../utils/dates.js';
import { QueryState } from '../ui/QueryState.jsx';

export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'registrations', label: 'My registrations' },
  { id: 'favourites', label: 'Favourite clubs' },
  { id: 'clubs', label: 'My clubs' },
];

// Marking uses shape and text as well as colour (FR-CAL-03, NFR-03).
export function itemMarker(i) {
  if (i.kind === 'deadline') return { shape: '◔', cls: 'chip-deadline', tag: 'Deadline' };
  if (i.kind === 'recruitment') return { shape: '◆', cls: 'chip-recruit', tag: 'Recruitment' };
  if (i.kind === 'hold') return { shape: '▣', cls: 'chip-private', tag: 'Hold' };
  if (i.private) return { shape: '▢', cls: 'chip-private', tag: 'Private' };
  if (i.registered) return { shape: '●', cls: 'chip-registered', tag: 'Registered' };
  if (i.favourite) return { shape: '★', cls: 'chip-fav', tag: 'Favourite' };
  return { shape: '○', cls: 'chip-plain', tag: '' };
}

export function Legend() {
  const rows = [
    ['●', 'Registered'],
    ['○', 'Event'],
    ['★', 'Favourite club'],
    ['◔', 'Registration deadline'],
    ['◆', 'Recruitment deadline'],
    ['▢', 'Private club item'],
  ];
  return (
    <ul className="legend" aria-label="Legend">
      {rows.map(([s, t]) => (
        <li key={t}>
          <span aria-hidden="true">{s}</span> {t}
        </li>
      ))}
    </ul>
  );
}

function Chip({ item }) {
  const m = itemMarker(item);
  return (
    <Link to={item.route} className={`chip ${m.cls}`} title={`${item.title}${m.tag ? ` (${m.tag})` : ''}`}>
      <span aria-hidden="true">{m.shape} </span>
      <span className="chip-time">{fmtTime(item.startsAt)}</span> {item.title}
      {m.tag && <span className="visually-hidden"> ({m.tag})</span>}
    </Link>
  );
}

/** Agenda list: used on phones and below the grid for the selected day. */
export function AgendaList({ items, empty = 'Nothing on this day.' }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="agenda">
      {items.map((i) => (
        <li key={i.id + i.kind}>
          <Chip item={i} />
          <span className="muted small"> {i.clubName}</span>
        </li>
      ))}
    </ul>
  );
}

export function MonthGrid({ year, month, items, selected, onSelect }) {
  const byDay = useMemo(() => {
    const m = {};
    for (const i of items) (m[dayKey(i.startsAt)] ??= []).push(i);
    return m;
  }, [items]);
  const lead = (getDay(new Date(year, month, 1)) + 6) % 7; // week starts on Monday
  const days = getDaysInMonth(new Date(year, month, 1));
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, k) => k + 1)];
  const today = todayLocalKey();
  return (
    <div className="month" role="grid" aria-label={format(new Date(year, month, 1), 'MMMM yyyy')}>
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
        <div key={d} role="columnheader" className="month-head">
          {d}
        </div>
      ))}
      {cells.map((d, i) => {
        if (!d) return <div key={`b${i}`} className="month-cell blank" role="gridcell" />;
        const key = format(new Date(year, month, d), 'yyyy-MM-dd');
        const list = byDay[key] ?? [];
        return (
          <div
            key={key}
            role="gridcell"
            className={`month-cell ${key === today ? 'today' : ''} ${key === selected ? 'selected' : ''}`}
            onClick={() => onSelect(key)}
          >
            <button
              className="day-num"
              onClick={() => onSelect(key)}
              aria-label={`${format(new Date(year, month, d), 'd MMMM')}, ${list.length} items`}
            >
              {d}
            </button>
            {list.slice(0, 3).map((it) => (
              <Chip key={it.id + it.kind} item={it} />
            ))}
            {list.length > 3 && <span className="muted small">+{list.length - 3} more</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Calendar page body: month grid on large screens, compact month plus agenda on phones (FR-CAL-06). */
export function CalendarView() {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(todayLocalKey());
  const range = monthRange(cursor.year, cursor.month);
  const query = useQuery({
    queryKey: ['calendar', cursor, filter],
    queryFn: () => api(`/calendar${qs({ ...range, filter })}`),
  });
  const shift = (n) => {
    const d = addMonths(new Date(cursor.year, cursor.month, 1), n);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };
  const today = () => {
    const n = new Date();
    setCursor({ year: n.getFullYear(), month: n.getMonth() });
    setSelected(todayLocalKey());
  };
  const items = query.data ?? [];
  const dayItems = items.filter((i) => dayKey(i.startsAt) === selected);

  return (
    <div className="stack">
      <div className="row-between">
        <div className="row" role="group" aria-label="Month">
          <button className="btn btn-secondary" onClick={() => shift(-1)} aria-label="Previous month">
            ‹
          </button>
          <h2 aria-live="polite">{format(new Date(cursor.year, cursor.month, 1), 'MMMM yyyy')}</h2>
          <button className="btn btn-secondary" onClick={() => shift(1)} aria-label="Next month">
            ›
          </button>
          <button className="btn btn-secondary" onClick={today}>
            Today
          </button>
        </div>
        <div className="row chips" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`filter-chip ${filter === f.id ? 'on' : ''}`}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <Legend />
      <QueryState query={{ ...query, data: [0] }} isEmpty={() => false}>
        {() => (
          <>
            <div className="calendar-grid-only">
              <MonthGrid
                year={cursor.year}
                month={cursor.month}
                items={items}
                selected={selected}
                onSelect={setSelected}
              />
            </div>
            <div className="calendar-compact">
              <MonthGrid
                year={cursor.year}
                month={cursor.month}
                items={[]}
                selected={selected}
                onSelect={setSelected}
              />
            </div>
            <section aria-label={`Items on ${selected}`} className="card">
              <h3>{selected}</h3>
              <AgendaList items={dayItems} />
            </section>
            <section aria-label="Agenda for the whole month" className="calendar-compact">
              <h3>This month</h3>
              <AgendaList items={items} empty="Nothing this month." />
            </section>
          </>
        )}
      </QueryState>
    </div>
  );
}
