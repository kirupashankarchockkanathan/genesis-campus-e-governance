import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/http';
import { Icon } from './ui';
import { cn } from '../utils/helpers';

const SUGGESTIONS = {
  student: ['What is GDSC for?', 'I like music, which clubs suit me?', 'Which clubs are there for AI?', 'How do I register for an event?'],
  club: ['What is the status of my requests?', 'How does event approval work?', 'What documents do I need?'],
  admin: ['What is waiting for review?', 'What needs OSA approval?', 'How do I publish an event?'],
};
const GREETING = 'Hi! I can tell you what each club is for, suggest clubs for your interests, and explain events and how the portal works.';

/** Small floating chat available to every signed-in role. Answers come from the portal API (Claude when a key is set). */
export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: GREETING },
  ]);
  const end = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    end.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages, open, busy]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    setMessages([{ role: 'assistant', content: GREETING }]);
  }, [user?.userId]);

  // Students have the full-page Campus AI Assistant, so the popup is for club authorities and administrators.
  if (!user || user.role === 'student') return null;
  const kind = user.role === 'admin' ? 'admin' : user.role;

  const send = async (raw) => {
    const message = (raw ?? text).trim();
    if (!message || busy) return;
    const history = messages.filter((m, i) => i > 0).slice(-8);
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setText('');
    setBusy(true);
    try {
      const res = await api('/ai/chat', { method: 'POST', body: { message, history } });
      setMessages((m) => [...m, { role: 'assistant', content: res.answer, engine: res.engine }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: e.message || 'Sorry, I could not answer that right now.', error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[65] flex flex-col items-end gap-3">
      {open && (
        <section
          role="dialog"
          aria-label="Chat assistant"
          className="flex h-[480px] max-h-[calc(100vh-110px)] w-[340px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-pop animate-pop"
        >
          <header className="flex items-center gap-3 bg-brand-600 px-4 py-3 text-white">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15"><Icon name="Bot" className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">GENESIS Assistant</div>
              <div className="text-[10px] text-white/80">Clubs, events and the portal</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15">
              <Icon name="X" className="h-4 w-4" />
            </button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-canvas px-3 py-3 scroll-thin" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed',
                    m.role === 'user' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-line bg-white text-ink',
                    m.error && 'border-[#e8a39b] text-rose-ink'
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start" role="status" aria-label="Assistant is typing">
                <div className="flex gap-1 rounded-2xl rounded-bl-md border border-line bg-white px-3.5 py-3">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-mute" style={{ animationDelay: `${d * 120}ms` }} />
                  ))}
                </div>
              </div>
            )}
            {messages.length === 1 && !busy && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS[kind].map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={end} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-line bg-white p-2.5"
          >
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              aria-label="Message"
              maxLength={800}
              className="min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 py-2.5 text-xs placeholder:text-ink-mute focus:border-brand-400"
            />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Send message" className="btn-primary px-3 py-2.5 disabled:opacity-50">
              <Icon name="Send" className="h-4 w-4" />
            </button>
          </form>
        </section>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat' : 'Open chat assistant'}
        aria-expanded={open}
        className="grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-white shadow-pop transition hover:scale-105 hover:bg-brand-700"
      >
        <Icon name={open ? 'X' : 'MessageCircle'} className="h-6 w-6" />
      </button>
    </div>
  );
}
