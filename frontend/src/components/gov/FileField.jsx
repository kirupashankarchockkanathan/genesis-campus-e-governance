import { useRef, useState } from 'react';
import { Icon } from '../ui';
import { fmtSize } from '../../store/selectors';
import { cn } from '../../utils/helpers';

const MAX_IMG = 700 * 1024; // keep data URLs small enough for localStorage
const MAX_DOC = 10 * 1024 * 1024;

/**
 * Prototype file picker. Documents store metadata only (no real upload);
 * images are read as data URLs so posters can be previewed.
 * value: { name, size, uploadedAt, dataUrl? } | null
 */
export default function FileField({ label, hint, value, onChange, accept, image = false, required, error, id }) {
  const ref = useRef(null);
  const [localError, setLocalError] = useState('');

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLocalError('');
    if (image) {
      if (!file.type.startsWith('image/')) return setLocalError('Choose an image file (PNG or JPG).');
      if (file.size > MAX_IMG) return setLocalError(`Image is ${fmtSize(file.size)}; please use one under ${fmtSize(MAX_IMG)}.`);
      const reader = new FileReader();
      reader.onload = () => onChange({ name: file.name, size: file.size, uploadedAt: new Date().toISOString(), dataUrl: reader.result });
      reader.onerror = () => setLocalError('Could not read that file.');
      reader.readAsDataURL(file);
    } else {
      if (file.size > MAX_DOC) return setLocalError('File is larger than 10 MB.');
      onChange({ name: file.name, size: file.size, uploadedAt: new Date().toISOString() });
    }
  };

  const msg = localError || error;
  return (
    <div>
      <div className={cn('flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3', msg ? 'border-[#e8a39b]' : 'border-line')}>
        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', value ? 'bg-brand-50 text-brand-600' : 'bg-[#f1eeee] text-ink-mute')}>
          <Icon name={value ? 'FileCheck2' : image ? 'Image' : 'FileText'} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-brand-900">{label} {required && <span className="text-rose-ink">*</span>}</div>
          <div className="truncate text-[10px] text-ink-mute">{value ? `${value.name} · ${fmtSize(value.size)}` : hint || 'No file chosen'}</div>
        </div>
        {value?.dataUrl && <img src={value.dataUrl} alt="" className="h-9 w-9 rounded-md object-cover" />}
        <input ref={ref} id={id} type="file" accept={accept || (image ? 'image/*' : '.pdf,.doc,.docx,.xlsx,.png,.jpg')} onChange={pick} className="sr-only" aria-label={label} />
        <div className="flex gap-1.5">
          <button type="button" onClick={() => ref.current?.click()} className="btn-ghost px-3 py-1.5 text-[11px]">
            <Icon name="Upload" className="h-3.5 w-3.5" /> {value ? 'Replace' : 'Choose file'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-rose-soft hover:text-rose-ink" aria-label={`Remove ${label}`}>
              <Icon name="Trash2" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {msg && <p role="alert" className="mt-1 text-[11px] font-medium text-rose-ink">{msg}</p>}
    </div>
  );
}
