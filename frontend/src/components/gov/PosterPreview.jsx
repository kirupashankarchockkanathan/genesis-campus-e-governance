import { CATEGORY_TONE } from '../../data/govData';
import { fmtDate } from '../../store/selectors';
import { cn } from '../../utils/helpers';

const GRAD = {
  emerald: 'from-brand-700 to-brand-900', olive: 'from-[#6b7a2c] to-[#3f4a17]', green: 'from-[#2f7d4a] to-[#14472a]', teal: 'from-[#1b7f86] to-[#0d4a50]',
  rust: 'from-[#b5562b] to-[#6e2c12]', plum: 'from-[#7a4ea0] to-[#43245f]',
};

/** Uploaded poster if present, otherwise a generated placeholder. */
export default function PosterPreview({ request, className, large = false }) {
  if (request.poster?.dataUrl) {
    return <img src={request.poster.dataUrl} alt={`Poster for ${request.title}`} className={cn('w-full rounded-2xl object-cover', large ? 'max-h-[420px]' : 'h-full', className)} />;
  }
  const tone = GRAD[CATEGORY_TONE[request.category]] || GRAD.emerald;
  return (
    <div className={cn('relative flex min-h-[140px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white', tone, large && 'min-h-[260px] p-6', className)} role="img" aria-label={`Generated poster preview for ${request.title}`}>
      <div className="hero-grid absolute inset-0 opacity-20" />
      <span className="relative text-[9px] font-bold uppercase tracking-[0.18em] text-white/70">{request.category}</span>
      <div className="relative">
        <div className={cn('font-extrabold leading-tight', large ? 'text-3xl' : 'text-base')}>{request.title}</div>
        <div className="mt-1 text-[10px] text-white/75">{request.date ? fmtDate(request.date) : 'Date TBD'} · {request.venue || 'Venue TBD'}</div>
      </div>
      {!request.poster && <span className="relative mt-2 text-[9px] text-white/60">{request.poster === null ? 'No poster uploaded — auto-generated preview' : ''}</span>}
    </div>
  );
}
