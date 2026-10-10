import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarContent, STUDENT_NAV } from './Sidebar';
import Topbar from './Topbar';
import { Icon, Toast } from './ui';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

function ConfirmationModal() {
  const { confirmation, closeConfirmation } = useApp();
  const navigate = useNavigate();
  if (!confirmation) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-brand-900/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Registration confirmed">
      <div className="relative w-full max-w-[440px] rounded-3xl bg-white p-8 text-center shadow-pop animate-pop">
        <button onClick={closeConfirmation} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-brand-50" aria-label="Close">
          <Icon name="X" className="h-4 w-4" />
        </button>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-brand-200 bg-brand-50 text-brand-600">
          <Icon name="Check" className="h-6 w-6" />
        </div>
        <div className="eyebrow mt-4 text-ink-soft">You're in</div>
        <h2 className="mt-1 text-2xl font-extrabold text-brand-900">Registration confirmed.</h2>
        <p className="mx-auto mt-2 max-w-[320px] text-xs leading-relaxed text-ink-soft">
          Your place for <b className="text-brand-900">{confirmation.title}</b> is reserved. We've added it to your registrations.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3 rounded-xl border border-line bg-canvas px-4 py-3 text-[11px] text-ink-soft">
          <Icon name="CalendarDays" className="h-4 w-4 text-brand-600" /> {confirmation.dateLabel} · {confirmation.time}
          <Icon name="MapPin" className="h-4 w-4 text-brand-600" /> {confirmation.venue}
        </div>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={closeConfirmation} className="btn-primary px-8">Done</button>
          <button onClick={() => { closeConfirmation(); navigate('/student/registrations'); }} className="btn-ghost">View registrations</button>
        </div>
        <p className="mt-4 text-[10px] text-ink-mute">Saved to your account</p>
      </div>
    </div>
  );
}

export default function StudentLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { toast } = useApp();

  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[251px] border-r border-line bg-white lg:block">
        <SidebarContent items={STUDENT_NAV} sectionLabel="Student Portal" />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-brand-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-pop animate-pop">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-brand-50" aria-label="Close menu">
              <Icon name="X" className="h-4 w-4" />
            </button>
            <SidebarContent items={STUDENT_NAV} sectionLabel="Student Portal" onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-[251px]">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-7 sm:px-6 lg:px-[60px]">
          <Outlet />
        </main>
        <footer className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-5 text-[9px] font-bold uppercase tracking-[0.14em] text-ink-mute sm:px-6 lg:mx-[60px] lg:px-0">
          <span>Genesis Campus Connect</span>
          <span>Made for curious minds ✳</span>
          <span>AY 2026–27</span>
        </footer>
      </div>

      <ConfirmationModal />
      <Toast toast={toast} />
    </div>
  );
}
