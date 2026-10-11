import { useState } from 'react';
import Modal from './Modal';
import { Field, Textarea } from './Form';
import { Icon } from '../ui';
import { cn } from '../../utils/helpers';

/**
 * Collects structured reasons + a note. Used for corrections, rejections and
 * "request changes" so the club always receives actionable feedback.
 */
export default function ReasonDialog({
  title,
  subtitle,
  reasons = [],
  noteLabel = 'Message to the club',
  notePlaceholder = 'Explain what needs to change…',
  confirmLabel = 'Send',
  tone = 'warn', // 'warn' | 'danger' | 'primary'
  requireNote = false,
  requireReason = false,
  onConfirm,
  onClose,
}) {
  const [picked, setPicked] = useState([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const toggle = (r) => setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
  const submit = () => {
    if (requireReason && picked.length === 0) return setError('Select at least one reason.');
    if (requireNote && !note.trim()) return setError('A written explanation is required.');
    if (!requireNote && !requireReason && picked.length === 0 && !note.trim()) return setError('Add a reason or a note.');
    setError('');
    onConfirm(picked, note.trim());
  };
  const btn = { warn: 'bg-[#b9791c] hover:bg-[#a16a16]', danger: 'bg-[#c0392b] hover:bg-[#a93226]', primary: 'bg-brand-800 hover:bg-brand-900' }[tone];

  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} className={cn('inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white transition active:scale-[0.98]', btn)}>{confirmLabel}</button>
        </>
      }
    >
      {reasons.length > 0 && (
        <fieldset className="mb-4">
          <legend className="mb-2 text-xs font-bold text-brand-900">Reasons {requireReason && <span className="text-rose-ink">*</span>}</legend>
          <div className="flex flex-wrap gap-2">
            {reasons.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggle(r)}
                aria-pressed={picked.includes(r)}
                className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition', picked.includes(r) ? 'border-brand-700 bg-brand-800 text-white' : 'border-line bg-white text-ink-soft hover:bg-brand-50')}
              >
                {picked.includes(r) && <Icon name="Check" className="h-3 w-3" />} {r}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <Field label={noteLabel} htmlFor="reason-note" required={requireNote}>
        <Textarea id="reason-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={notePlaceholder} />
      </Field>
      {error && <p role="alert" className="mt-2 text-[11px] font-medium text-rose-ink">{error}</p>}
    </Modal>
  );
}
