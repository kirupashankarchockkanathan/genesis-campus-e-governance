import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { AI_SUGGESTIONS } from '../../data/mockData';
import { useGov } from '../../context/GovContext';
import { ASSISTANT_FALLBACK as FALLBACK, askCampusAssistant, aiMode } from '../../services/ai';
import { TODAY_ISO } from '../../store/selectors';
import { cn } from '../../utils/helpers';

export default function CampusAssistant() {
  const { user } = useAuth();
  const { events, clubs } = useGov();
  const first = user.name.split(' ')[0];
  const intro = { id: 'intro', from: 'ai', text: `Hi ${first}! I can help you find approved event listings and point you to published campus guidance. I'll say so when the portal demo doesn't contain enough information to verify an answer.` };
  const [messages, setMessages] = useState([intro]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, typing]);

  const send = (text) => {
    const msg = text.trim();
    if (!msg || typing) return;
    setMessages((m) => [...m, { id: `u${Date.now()}`, from: 'user', text: msg }]);
    setInput('');
    setTyping(true);
    askCampusAssistant(msg, { events, clubs, todayISO: TODAY_ISO })
      .then((r) => setMessages((m) => [...m, { id: `a${Date.now()}`, from: 'ai', text: r.answer, source: r.source }]))
      .catch(() => setMessages((m) => [...m, { id: `a${Date.now()}`, from: 'ai', text: FALLBACK, source: 'local-mock' }]))
      .finally(() => setTyping(false));
  };

  return (
    <div className="mx-auto max-w-[1080px]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">A helpful campus guide</div>
          <h1 className="mt-2 text-3xl font-extrabold text-brand-900">Campus AI Assistant</h1>
          <p className="mt-1.5 text-xs text-ink-soft">Ask about approved events and published campus guidance. Answers here use a small local demo reference set.</p>
        </div>
        <button onClick={() => { setMessages([intro]); setInput(''); }} className="btn-ghost"><Icon name="RotateCcw" className="h-4 w-4" /> New chat</button>
      </div>

      <section className="card overflow-hidden">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon name="Sparkles" className="h-5 w-5" /></span>
            <div><div className="text-sm font-bold text-brand-900">Campus guide</div><div className="flex items-center gap-1.5 text-[9px] text-ink-mute"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Demo references only · {aiMode()}</div></div>
          </div>
          <span className="pill bg-brand-50 text-brand-700"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Student help</span>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_255px]">
          <div className="flex h-[460px] flex-col overflow-y-auto p-5 scroll-thin" aria-live="polite">
            <div className="mb-4 flex items-center gap-3 text-[9px] text-ink-mute"><span className="h-px flex-1 bg-line" /> Today <span className="h-px flex-1 bg-line" /></div>
            <div className="space-y-4">
              {messages.map((m) => (
                <div key={m.id} className={cn('flex gap-3', m.from === 'user' && 'justify-end')}>
                  {m.from === 'ai' && <span className="mt-4 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon name="Bot" className="h-4 w-4" /></span>}
                  <div className={cn('max-w-[80%]', m.from === 'user' && 'text-right')}>
                    <div className="mb-1 text-[8px] font-bold uppercase tracking-wider text-ink-mute">{m.from === 'ai' ? 'Campus AI' : 'You'}</div>
                    <div className={cn('rounded-2xl px-4 py-3 text-xs leading-relaxed', m.from === 'ai' ? 'border border-line bg-canvas text-ink-soft' : 'bg-brand-800 text-white')}>{m.text}</div>
                    {m.from === 'ai' && m.id !== 'intro' && m.text !== FALLBACK && (
                      <Link to="/student/events" className="link-arrow mt-1.5 text-[10px]">Open approved events <Icon name="ArrowUpRight" className="h-3 w-3" /></Link>
                    )}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon name="Bot" className="h-4 w-4" /></span>
                  <div className="flex gap-1 rounded-2xl border border-line bg-canvas px-4 py-3.5">
                    {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${i * 120}ms` }} />)}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <aside className="border-t border-line p-5 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-2 text-[10px] font-bold text-brand-900"><Icon name="MessageCircle" className="h-3.5 w-3.5 text-brand-600" /> Try asking</div>
            <div className="mt-3 space-y-2">
              {AI_SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="flex w-full items-start justify-between gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-left text-[10px] text-ink-soft transition hover:border-brand-300 hover:bg-brand-50">
                  {s} <Icon name="ArrowUpRight" className="mt-0.5 h-3 w-3 shrink-0 text-ink-mute" />
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2.5 rounded-xl bg-brand-50 p-3">
              <Icon name="ShieldCheck" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <div className="text-[9px] leading-relaxed text-ink-soft"><b className="block text-[10px] text-brand-900">Grounded, not guessed.</b>This prototype won't invent availability, event changes, or university regulations.</div>
            </div>
          </aside>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-line p-4">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about events or campus guidance…" className="min-w-0 flex-1 text-xs placeholder:text-ink-mute" aria-label="Message Campus AI" />
              <span className="hidden items-center gap-1 text-[9px] text-ink-mute sm:inline-flex"><Icon name="Clock3" className="h-3 w-3" /> Local demo</span>
            </div>
            <button type="submit" disabled={!input.trim() || typing} className="grid h-11 w-11 place-items-center rounded-xl bg-brand-800 text-white transition hover:bg-brand-900 disabled:bg-brand-200" aria-label="Send"><Icon name="ArrowUp" className="h-4 w-4" /></button>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[9px] text-ink-mute"><Icon name="CircleHelp" className="h-3 w-3" /> AI demo answers aren't official advice. Verify time-sensitive details with the relevant university office.</div>
        </form>
      </section>

      <Link to="/student/events" className="card mt-4 flex items-center gap-4 px-5 py-4 transition hover:shadow-pop">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600"><Icon name="CalendarDays" className="h-4 w-4" /></span>
        <span className="flex-1"><span className="block text-[11px] font-bold text-brand-900">Need a live event status?</span><span className="text-[9px] text-ink-mute">Open the approved event listing to check its published details.</span></span>
        <span className="link-arrow">Explore events <Icon name="ArrowUpRight" className="h-3.5 w-3.5" /></span>
      </Link>
    </div>
  );
}
