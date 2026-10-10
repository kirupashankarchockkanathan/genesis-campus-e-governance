import { useEffect, useState } from 'react';
import { Icon } from '../ui';
import { cn } from '../../utils/helpers';

export function Card({ title, subtitle, action, children, className, pad = true }) {
  return (
    <section className={cn('card', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-extrabold text-brand-900">{title}</h2>
            {subtitle && <p className="text-[11px] text-ink-soft">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, icon, tone = 'green', hint, onClick }) {
  const tones = { green: 'bg-brand-50 text-brand-600', amber: 'bg-amber-soft text-amber-ink', rose: 'bg-rose-soft text-rose-ink', sky: 'bg-sky-soft text-sky-ink', plum: 'bg-plum-soft text-plum-ink' };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cn('card flex items-center gap-4 p-5 text-left', onClick && 'transition hover:-translate-y-0.5 hover:shadow-pop')}>
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', tones[tone])}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-extrabold leading-none text-brand-900">{value}</span>
        <span className="mt-1 block text-[11px] font-semibold text-ink-soft">{label}</span>
        {hint && <span className="block text-[10px] text-ink-mute">{hint}</span>}
      </span>
    </Tag>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="scroll-thin flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition', value === t.key ? 'bg-brand-800 text-white' : 'text-ink-soft hover:bg-brand-50')}
        >
          {t.label}
          {t.count != null && <span className={cn('rounded-full px-1.5 text-[10px]', value === t.key ? 'bg-white/20' : 'bg-[#f1eeee]')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
      <Icon name="Search" className="h-4 w-4 text-ink-mute" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="min-w-0 flex-1 bg-transparent text-xs text-ink placeholder:text-ink-mute" />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search" className="text-ink-mute hover:text-ink">
          <Icon name="X" className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function Pagination({ page, pages, onPage, total, pageSize }) {
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 pt-4 text-[11px] text-ink-soft">
      <span>{from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="btn-ghost px-2.5 py-1.5 disabled:opacity-40" aria-label="Previous page"><Icon name="ChevronLeft" className="h-3.5 w-3.5" /></button>
        <span className="px-2 font-bold text-brand-900">{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="btn-ghost px-2.5 py-1.5 disabled:opacity-40" aria-label="Next page"><Icon name="ChevronRight" className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

/** Small hook for client-side pagination. */
export function usePaged(list, pageSize = 10, resetKey = '') {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [resetKey]);
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const safe = Math.min(page, pages);
  return { page: safe, pages, setPage, items: list.slice((safe - 1) * pageSize, safe * pageSize), total: list.length, pageSize };
}

export function InfoRow({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {icon && <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />}
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-mute">{label}</div>
        <div className="text-xs font-semibold text-brand-900">{children}</div>
      </div>
    </div>
  );
}

export function downloadCsv(filename, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
