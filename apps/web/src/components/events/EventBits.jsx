import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { fmtRange } from '../../utils/dates.js';
import { Card } from '../ui/Card.jsx';
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

/** Card used in the Events list and club pages. */
export function EventCard({ event, to }) {
  return (
    <Card as="article" className="event-card">
      {event.posterUrl && /\.(png|jpe?g|webp)$/i.test(event.posterUrl) && (
        <img className="poster-thumb" src={event.posterUrl} alt={`Poster of ${event.title}`} loading="lazy" />
      )}
      <div className="row-between">
        <h2>
          <Link to={to ?? `/events/${event.id}`}>{event.title}</Link>
        </h2>
        <StatusPill status={event.status} />
      </div>
      <p className="muted small">{event.clubName}</p>
      <p>{event.summary}</p>
      <p className="small">{fmtRange(event.startsAt, event.endsAt)}</p>
      <div className="row">
        <span className="pill">{event.type.replace('_', ' ')}</span>
        {event.myRegistration && (
          <Pill status="registered">
            {event.myRegistration.status === 'waitlisted' ? 'Waitlisted' : 'Registered'}
          </Pill>
        )}
        {event.registrationStatus === 'published' && !event.myRegistration && (
          <Pill status="open">Registration open</Pill>
        )}
      </div>
    </Card>
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
