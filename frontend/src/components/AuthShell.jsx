import { Logo, Icon } from './ui';

/** Two-panel shell shared by role selection, admin type and login screens. */
export default function AuthShell({ children, step, total = 3 }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-800 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="hero-grid absolute inset-0" />
        <div className="absolute -right-32 top-1/3 h-[440px] w-[440px] rounded-full border border-brand-500/30" />
        <div className="absolute -right-12 top-[38%] h-[300px] w-[300px] rounded-full border border-brand-500/30" />
        <div className="absolute right-10 top-[45%] grid h-24 w-24 place-items-center rounded-full bg-brand-500/20 ring-1 ring-brand-300/40">
          <Icon name="Zap" className="h-9 w-9 text-brand-200" />
        </div>
        <div className="relative"><Logo light /></div>
        <div className="relative max-w-md">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-300">GENESIS Hackathon · 2026</div>
          <h2 className="mt-4 text-[40px] font-extrabold leading-[1.05] text-white">
            One campus.<br />One place for every request.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-brand-100/80">
            The Unified Campus E-Governance and Service Request Portal brings events, clubs and approvals together for students, clubs and administrators.
          </p>
        </div>
        <div className="relative text-[10px] font-bold uppercase tracking-[0.16em] text-brand-300">Demo build · Sample data</div>
      </aside>

      <main className="relative flex flex-col bg-canvas">
        <div className="flex items-center justify-between px-6 py-5 lg:px-12">
          <div className="lg:invisible"><Logo /></div>
          {step && (
            <div className="flex items-center gap-1.5" aria-label={`Step ${step} of ${total}`}>
              {Array.from({ length: total }).map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i + 1 <= step ? 'w-8 bg-brand-600' : 'w-4 bg-brand-100'}`} />
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-12 lg:px-12">
          <div className="w-full max-w-[520px] animate-fadeUp">{children}</div>
        </div>
      </main>
    </div>
  );
}
