import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Icon } from '../layout/Icon.jsx';

const GREETING =
  'Hi! Ask me about clubs, events, recruitments or how the portal works. I only answer from the portal itself.';

/** Floating assistant (FR-CHAT-01). `clubId` limits answers to one club when opened from a club page. */
export function ChatPanel({ clubId, clubName }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING, sources: [] }]);
  const end = useRef(null);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [messages, open]);

  const send = async (e) => {
    e.preventDefault();
    const question = text.trim();
    if (!question || busy) return;
    setText('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', content: question }]);
    try {
      const r = await api('/chat', {
        method: 'POST',
        body: { message: question, ...(clubId && { clubId }) },
      });
      setMessages((m) => [...m, { role: 'assistant', content: r.answer, sources: r.sources }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: err.message, sources: [], error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="chat-fab"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Ask the assistant"
      >
        <Icon name="chat" size={24} />
        <span className="chat-fab-label">Ask</span>
      </button>
      {open && (
        <section className="chat-panel" aria-label="Assistant">
          <div className="row-between chat-head">
            <h2>{clubName ? `Ask about ${clubName}` : 'Ask the portal'}</h2>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant">
              ×
            </button>
          </div>
          <div className="chat-log" role="log" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg chat-${m.role} ${m.error ? 'chat-error' : ''}`}>
                <p>{m.content}</p>
                {m.sources?.length > 0 && (
                  <p className="small">
                    Sources:{' '}
                    {m.sources.map((s, j) => (
                      <span key={s.route + j}>
                        {j > 0 && ', '}
                        <Link to={s.route} onClick={() => setOpen(false)}>
                          {s.label}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            ))}
            {busy && (
              <p className="muted small" role="status">
                Thinking...
              </p>
            )}
            <div ref={end} />
          </div>
          <form className="chat-form" onSubmit={send}>
            <label className="visually-hidden" htmlFor="chat-input">
              Your question
            </label>
            <input
              id="chat-input"
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              placeholder="Type your question"
              autoComplete="off"
            />
            <button className="btn btn-primary" type="submit" disabled={busy || !text.trim()}>
              Send
            </button>
          </form>
        </section>
      )}
    </>
  );
}
