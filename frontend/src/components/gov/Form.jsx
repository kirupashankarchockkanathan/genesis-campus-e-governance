import { cn } from '../../utils/helpers';

export function Field({ label, htmlFor, error, hint, required, children, className }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-bold text-brand-900">
          {label} {required && <span className="text-rose-ink" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-[10px] text-ink-mute">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-[11px] font-medium text-rose-ink">{error}</p>}
    </div>
  );
}

export function Input({ error, className, ...props }) {
  return <input className={cn('field', error && 'border-[#e8a39b] focus:border-[#e06052] focus:ring-rose-soft', className)} aria-invalid={!!error} {...props} />;
}

export function Textarea({ error, className, rows = 4, ...props }) {
  return <textarea rows={rows} className={cn('field resize-y', error && 'border-[#e8a39b]', className)} aria-invalid={!!error} {...props} />;
}

export function Select({ error, className, children, ...props }) {
  return (
    <select className={cn('field appearance-auto', error && 'border-[#e8a39b]', className)} aria-invalid={!!error} {...props}>
      {children}
    </select>
  );
}
