import { useState } from 'react';
import { Icon, PageHeader, EmptyState } from '../../components/ui';
import ClubCard from '../../components/ClubCard';
import ClubModal from '../../components/ClubModal';
import { useGov } from '../../context/GovContext';
import { useApp } from '../../context/AppContext';
import { cn } from '../../utils/helpers';

export default function ClubsDirectory() {
  const { favorites } = useApp();
  const { clubs: CLUBS } = useGov();
  const CATS = ['All clubs', ...Array.from(new Set(CLUBS.map((c) => c.category)))];
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All clubs');
  const [favOnly, setFavOnly] = useState(false);
  const [open, setOpen] = useState(null);

  const list = CLUBS.filter((c) => {
    const hit = `${c.name} ${c.category} ${c.blurb} ${c.tag}`.toLowerCase().includes(q.toLowerCase());
    return hit && (cat === 'All clubs' || c.category === cat) && (!favOnly || favorites.includes(c.id));
  });

  return (
    <div>
      <PageHeader
        eyebrow="Find your people"
        title="Clubs directory"
        subtitle="Explore student-led communities, projects, and approved events across campus."
        action={<span className="card inline-flex items-center gap-2 px-3.5 py-2.5 text-[11px] font-bold text-brand-900"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> {CLUBS.length} active communities</span>}
      />

      <section className="relative mb-8 overflow-hidden rounded-3xl bg-brand-900 px-8 py-9 text-white shadow-card">
        <div className="hero-grid absolute inset-0" />
        <div className="pointer-events-none absolute right-[6%] top-1/2 hidden h-[250px] w-[330px] -translate-y-1/2 md:block">
          <div className="absolute inset-0 rounded-[50%] border border-brand-400/30" />
          <div className="absolute inset-4 rotate-[-18deg] rounded-[50%] border border-brand-300/30" />
          <div className="absolute left-1/2 top-1/2 grid h-[86px] w-[86px] -translate-x-1/2 -translate-y-1/2 rotate-45 place-items-center rounded-3xl bg-brand-500/70 ring-1 ring-brand-300/40">
            <Icon name="Users" className="h-9 w-9 -rotate-45 text-white" />
          </div>
          <span className="absolute -left-12 top-[40%] text-[8px] font-bold tracking-[0.2em] text-brand-300">IDEAS</span>
          <span className="absolute -bottom-1 right-2 text-[8px] font-bold tracking-[0.2em] text-brand-300">TOGETHER</span>
          <span className="absolute right-6 top-2 text-[#f3c26b]">✳</span>
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-brand-100"><Icon name="Sparkles" className="h-3.5 w-3.5" /> Community spotlight</div>
          <h2 className="mt-4 max-w-md text-[36px] font-extrabold leading-[1.05]">Curiosity has a place here.</h2>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-brand-100/90">Meet the people making campus more inventive, more connected, and more alive.</p>
          <button onClick={() => setOpen(CLUBS[0])} className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-white hover:text-brand-200">
            Discover a community <Icon name="ArrowRight" className="h-4 w-4" />
          </button>
        </div>
      </section>

      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-brand-900">Explore communities</h2>
          <p className="text-[10px] text-ink-mute">{list.length} communit{list.length === 1 ? 'y' : 'ies'} to get curious about</p>
        </div>
        <button onClick={() => setFavOnly((v) => !v)} aria-pressed={favOnly} className={cn('btn-ghost', favOnly && 'border-brand-300 bg-brand-50 text-brand-800')}>
          <Icon name="Heart" className="h-4 w-4" fill={favOnly ? 'currentColor' : 'none'} /> Favorites only
          <span className="rounded-full bg-brand-50 px-1.5 text-[9px] text-brand-700">{favorites.length}</span>
        </button>
      </div>

      <div className="card mb-5 p-4">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3.5 py-3 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
          <Icon name="Search" className="h-4 w-4 text-ink-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, interest, or mission" className="min-w-0 flex-1 bg-transparent text-xs placeholder:text-ink-mute" aria-label="Search clubs" />
          <span className="hidden items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.16em] text-ink-mute sm:inline-flex"><Icon name="SlidersHorizontal" className="h-3.5 w-3.5" /> Category</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={cn('rounded-full border px-3.5 py-1.5 text-[10px] font-bold transition', cat === c ? 'border-brand-800 bg-brand-800 text-white' : 'border-line bg-white text-ink-soft hover:bg-brand-50')}>{c}</button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon="SearchX" title="No communities found" body="Try another search or clear your filters." action={<button onClick={() => { setQ(''); setCat('All clubs'); setFavOnly(false); }} className="btn-ghost">Clear filters</button>} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => <ClubCard key={c.id} club={c} onView={setOpen} />)}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-white/70 px-4 py-3 text-[10px] text-ink-soft">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-soft text-[#d4574a]"><Icon name="Heart" className="h-4 w-4" /></span>
        <span><b className="text-brand-900">Favorites are just a bookmark.</b> Saving a club helps you find it again; it does not enroll you or imply official membership.</span>
        <span className="ml-auto hidden text-[8px] font-bold uppercase tracking-[0.16em] text-ink-mute md:block">Your space to explore</span>
      </div>

      <ClubModal club={open} onClose={() => setOpen(null)} />
    </div>
  );
}
