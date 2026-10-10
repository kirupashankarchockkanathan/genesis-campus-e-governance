import { Icon } from '../ui';
import { trackerSteps, fmtDateTime } from '../../store/selectors';
import { cn } from '../../utils/helpers';

const STYLE = {
  done: { ring: 'bg-brand-600 text-white', icon: 'Check', text: 'text-brand-800' },
  current: { ring: 'bg-white text-brand-700 ring-2 ring-brand-500', icon: 'Circle', text: 'text-brand-900' },
  warn: { ring: 'bg-amber-soft text-amber-ink ring-2 ring-[#e3a02c]', icon: 'AlertTriangle', text: 'text-amber-ink' },
  failed: { ring: 'bg-rose-soft text-rose-ink ring-2 ring-[#e06052]', icon: 'X', text: 'text-rose-ink' },
  todo: { ring: 'bg-[#eef1ef] text-ink-mute', icon: 'Circle', text: 'text-ink-mute' },
};

/** 5-step progress tracker for an event request. */
export function Tracker({ request }) {
  const steps = trackerSteps(request);
  return (
    <ol className="grid gap-4 sm:grid-cols-5" aria-label="Request progress">
      {steps.map((s, i) => {
        const st = STYLE[s.state];
        return (
          <li key={s.key} className="relative flex items-start gap-3 sm:flex-col sm:items-center sm:text-center">
            {i < steps.length - 1 && (
              <span aria-hidden="true" className={cn('absolute left-[15px] top-8 h-[calc(100%-8px)] w-px sm:left-[calc(50%+22px)] sm:top-[15px] sm:h-px sm:w-[calc(100%-44px)]', s.state === 'done' ? 'bg-brand-400' : 'bg-line')} />
            )}
            <span className={cn('relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full', st.ring)}>
              {s.state === 'current' ? <span className="h-2 w-2 rounded-full bg-brand-600" /> : s.state === 'todo' ? <span className="text-[10px] font-bold">{i + 1}</span> : <Icon name={st.icon} className="h-4 w-4" />}
            </span>
            <span className="min-w-0">
              <span className={cn('block text-[11px] font-bold', st.text)}>{s.label}</span>
              <span className="block text-[10px] text-ink-mute">{s.detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Timeline({ entries = [], empty = 'No activity yet.' }) {
  const list = [...entries].reverse();
  if (list.length === 0) return <p className="text-xs text-ink-soft">{empty}</p>;
  return (
    <ul className="space-y-0">
      {list.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
          {i < list.length - 1 && <span aria-hidden="true" className="absolute left-[5px] top-3 h-full w-px bg-line" />}
          <span className="relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-brand-400 bg-white" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-brand-900">{e.action}</div>
            {e.note && <div className="text-[11px] text-ink-soft">{e.note}</div>}
            <div className="text-[10px] text-ink-mute">{e.by} · {e.role} · {fmtDateTime(e.at)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FeedbackList({ items = [] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-3">
      {[...items].reverse().map((f) => (
        <li key={f.id} className={cn('rounded-2xl border p-4', f.type === 'rejection' ? 'border-[#f1c9c4] bg-rose-soft/60' : 'border-[#f0dcb4] bg-amber-soft/60', f.resolved && 'opacity-60')}>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
            <span className={f.type === 'rejection' ? 'text-rose-ink' : 'text-amber-ink'}>{f.type === 'rejection' ? 'Rejection feedback' : 'Corrections requested'}</span>
            <span className="font-medium text-ink-mute">{f.by} · {fmtDateTime(f.at)}</span>
            {f.resolved && <span className="rounded-full bg-white/80 px-2 py-0.5 text-ink-soft">Addressed in resubmission</span>}
          </div>
          {f.reasons?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {f.reasons.map((r) => <span key={r} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-ink-soft">{r}</span>)}
            </div>
          )}
          {f.note && <p className="mt-2 text-xs leading-relaxed text-brand-900">{f.note}</p>}
        </li>
      ))}
    </ul>
  );
}
