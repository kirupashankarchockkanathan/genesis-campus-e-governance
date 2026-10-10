import { useEffect, useRef } from 'react';
import { Icon } from '../ui';
import { cn } from '../../utils/helpers';

export default function Modal({ title, subtitle, onClose, children, footer, size = 'md' }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const width = { sm: 'max-w-[420px]', md: 'max-w-[560px]', lg: 'max-w-[760px]' }[size];
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-brand-900/50 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={cn('relative my-6 w-full rounded-3xl bg-white shadow-pop outline-none animate-pop', width)}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="text-lg font-extrabold text-brand-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11px] text-ink-soft">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-brand-50" aria-label="Close dialog">
            <Icon name="X" className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-canvas/60 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
