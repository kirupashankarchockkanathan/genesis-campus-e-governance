import { useEffect, useState } from 'react';
import { ICONS } from './icons';
import { STATUS_META } from '../data/mockData';
import { cn } from '../utils/helpers';

/** Render a lucide icon by name (keeps mock data serialisable). */
export function Icon({ name, className = 'h-4 w-4', ...rest }) {
  const Cmp = ICONS[name] || ICONS.Circle;
  return <Cmp className={className} strokeWidth={1.75} {...rest} />;
}

export function StatusPill({ status, label }) {
  const m = STATUS_META[status] || STATUS_META.open;
  return (
    <span className={cn('pill', m.cls)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {label || m.label}
    </span>
  );
}

export function Logo({ light = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-900 ring-1 ring-brand-700">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#4fd1a5" strokeWidth="2.4" strokeLinecap="round">
          <path d="M7 19l3-14M12 19l3-14M17 19l3-14" transform="translate(-2 0)" />
        </svg>
      </div>
      <div className="leading-none">
        <div className={cn('text-[15px] font-extrabold tracking-wide', light ? 'text-white' : 'text-brand-900')}>GENESIS</div>
        <div className={cn('mt-1 text-[8px] font-bold uppercase tracking-[0.2em]', light ? 'text-brand-200' : 'text-brand-600')}>
          Campus Connect
        </div>
      </div>
    </div>
  );
}

export function Avatar({ initials, size = 'md' }) {
  const s = size === 'lg' ? 'h-16 w-16 text-xl' : size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs';
  return (
    <div className={cn('grid shrink-0 place-items-center rounded-full bg-brand-100 font-extrabold text-brand-800', s)}>
      {initials}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 animate-fadeUp">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="mt-2 text-3xl font-extrabold text-brand-900 sm:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Live countdown to a Date. Falls back to a fixed demo duration. */
export function useCountdown(initialSeconds) {
  const [left, setLeft] = useState(initialSeconds);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return { h, m, s };
}

export function EmptyState({ icon = 'Inbox', title, body, action }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-bold text-brand-900">{title}</div>
      {body && <p className="mt-1 max-w-sm text-xs text-ink-soft">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  const tone = toast.tone === 'info' ? 'bg-ink text-white' : 'bg-brand-800 text-white';
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
      <div key={toast.id} className={cn('pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold shadow-pop animate-fadeUp', tone)}>
        <Icon name={toast.tone === 'info' ? 'Info' : 'CheckCircle2'} className="h-4 w-4 text-brand-200" />
        {toast.message}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-brand-500' : 'bg-[#dfe7e3]')}
    >
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}
