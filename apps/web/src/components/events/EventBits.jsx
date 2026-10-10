import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { fmtDate, fmtRange } from '../../utils/dates.js';
import { Icon } from '../layout/Icon.jsx';
import { Pill } from '../ui/Pill.jsx';

export const EVENT_STATUS_LABEL = {
  draft: 'Draft',
  submitted: 'Submitted',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export const StatusPill = ({ status }) => <Pill status={status}>{EVENT_STATUS_LABEL[status] ?? status}</Pill>;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Big calendar-style date badge in the portal time zone. */
export function DateBadge({ iso, large = false }) {
  const local = fmtDate(iso).split(' '); // "d MMM yyyy"
  const month = MONTHS.findIndex((m) => m.toLowerCase() === local[1]?.toLowerCase());
  return (
    <span className={`date-badge ${large ? 'date-badge-lg' : ''}`} aria-hidden="true">
      <span className="date-badge-day">{local[0]}</span>
      <span className="date-badge-month">{month >= 0 ? MONTHS[month] : local[1]}</span>
    </span>
  );
}

/** Seats taken versus the limit, as text and a bar (never colour alone). */
export function SeatBar({ event }) {
  if (event.maxSeats === null || event.maxSeats === undefined) {
    return <span className="small muted">{event.registeredCount} registered</span>;
  }
  const pct = Math.min(100, Math.round((event.registeredCount / event.maxSeats) * 100));
  const left = Math.max(0, event.maxSeats - event.registeredCount);
  return (
    <div className="seatbar" role="group" aria-label="Seats">
      <div
        className="seatbar-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={event.maxSeats}
        aria-valuenow={event.registeredCount}
      >
        <span className="seatbar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="small">{left === 0 ? 'Full' : `${left} of ${event.maxSeats} seats left`}</span>
    </div>
  );
}

const isImage = (u) => /\.(png|jpe?g|webp)$/i.test(u ?? '');
const venueOf = (e) =>
  e.hall?.bookingStatus === 'confirmed'
    ? e.hall.name
    : e.mode === 'online'
      ? 'Online'
      : e.mode === 'hybrid'
        ? 'Hybrid'
        : 'Venue to be confirmed';

/** Large event card used in the Events list, club pages and favourites. */
export function EventCard({ event, to }) {
  const href = to ?? `/events/${event.id}`;
  return (
    <article className="event-card-lg">
      <Link to={href} className="event-media" aria-label={`Open ${event.title}`}>
        {isImage(event.posterUrl) ? (
          <img src={event.posterUrl} alt={`Poster of ${event.title}`} loading="lazy" />
        ) : (
          <span className="event-media-fallback" aria-hidden="true">
            {event.type.replace('_', ' ')}
          </span>
        )}
        <DateBadge iso={event.startsAt} />
        <span className="event-type-chip">{event.type.replace('_', ' ')}</span>
      </Link>
      <div className="event-body">
        <p className="event-club">{event.clubName}</p>
        <h2>
          <Link to={href}>{event.title}</Link>
        </h2>
        <p className="event-summary">{event.summary}</p>
        <ul className="event-meta">
          <li>
            <Icon name="clock" size={16} /> {fmtRange(event.startsAt, event.endsAt)}
          </li>
          <li>
            <Icon name="building" size={16} /> {venueOf(event)}
          </li>
        </ul>
        <SeatBar event={event} />
        <div className="row-between event-foot">
          <div className="row">
            <StatusPill status={event.status} />
            {event.myRegistration && (
              <Pill status="registered">
                {event.myRegistration.status === 'waitlisted' ? 'Waitlisted' : 'Registered'}
              </Pill>
            )}
            {event.registrationStatus === 'published' && !event.myRegistration && (
              <Pill status="open">Registration open</Pill>
            )}
          </div>
          <Link className="btn btn-primary" to={href}>
            {event.registrationStatus === 'published' && !event.myRegistration ? 'Register' : 'View details'}
          </Link>
        </div>
      </div>
    </article>
  );
}

/** QR ticket (FR-REG-06). The token is only ever shown to its owner. */
export function QrTicket({ ticket }) {
  return (
    <figure className="ticket">
      <QRCodeSVG
        value={ticket.qrToken}
        size={176}
        includeMargin
        role="img"
        aria-label={`QR ticket for ${ticket.eventTitle}`}
      />
      <figcaption>
        <strong>{ticket.eventTitle}</strong>
        <br />
        <span className="small">
          Ticket code: <code>{ticket.qrToken}</code>
        </span>
      </figcaption>
    </figure>
  );
}

/** Camera scanner with a typed fallback. Scanning twice shows "already checked in" from the API. */
export function QrScanner({ onCode }) {
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState('');
  const scanner = useRef(null);
  const last = useRef({ code: '', at: 0 });

  useEffect(() => {
    if (!cameraOn) return undefined;
    let cancelled = false;
    const s = new Html5Qrcode('qr-reader');
    scanner.current = s;
    s.start(
      { facingMode: 'environment' },
      { fps: 8, qrbox: 220 },
      (text) => {
        // Ignore the same code for 3 seconds so one scan is not reported repeatedly.
        if (text === last.current.code && Date.now() - last.current.at < 3000) return;
        last.current = { code: text, at: Date.now() };
        onCode(text);
      },
      () => {},
    ).catch(
      () =>
        !cancelled &&
        (setError('The camera could not be opened. Type the ticket code instead.'), setCameraOn(false)),
    );
    return () => {
      cancelled = true;
      s.isScanning ? s.stop().catch(() => {}) : null;
    };
  }, [cameraOn, onCode]);

  return (
    <div className="stack">
      <div className="row">
        <button className="btn btn-secondary" onClick={() => setCameraOn((c) => !c)}>
          {cameraOn ? 'Stop camera' : 'Scan with camera'}
        </button>
      </div>
      {cameraOn && <div id="qr-reader" className="qr-reader" />}
      {error && (
        <div className="notice notice-bad" role="alert">
          {error}
        </div>
      )}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) onCode(typed.trim());
          setTyped('');
        }}
      >
        <label className="visually-hidden" htmlFor="ticket-code">
          Ticket code
        </label>
        <input
          id="ticket-code"
          className="input"
          style={{ flex: 1 }}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type the ticket code"
          autoComplete="off"
        />
        <button className="btn btn-primary" type="submit">
          Check in
        </button>
      </form>
    </div>
  );
}

/** Share button: device share sheet if available, plus copy link and WhatsApp (FR-SHARE-01). */
export function ShareButton({ event }) {
  const [copied, setCopied] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const url = `${window.location.origin}/e/${event.id}`;
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text: event.summary, url });
        return;
      } catch {
        /* cancelled: fall through to the links */
      }
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowLink(true); // last resort when the clipboard is blocked: show the link to copy by hand
    }
  };
  return (
    <div className="row">
      {typeof navigator !== 'undefined' && navigator.share && (
        <button className="btn btn-secondary" onClick={share}>
          Share
        </button>
      )}
      <button className="btn btn-secondary" onClick={copy}>
        {copied ? 'Link copied' : 'Copy link'}
      </button>
      <a
        className="btn btn-secondary"
        href={`https://wa.me/?text=${encodeURIComponent(`${event.title} ${url}`)}`}
        target="_blank"
        rel="noreferrer"
      >
        WhatsApp
      </a>
      {showLink && (
        <input
          className="input"
          readOnly
          value={url}
          aria-label="Event link"
          onFocus={(e) => e.target.select()}
        />
      )}
    </div>
  );
}
