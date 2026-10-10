import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarContent } from '../Sidebar';
import Topbar from '../Topbar';
import { Icon, Toast } from '../ui';
import { useGov } from '../../context/GovContext';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS, actorKey } from '../../store/permissions';

const PortalCtx = createContext({ notify: () => {} });
export const usePortal = () => useContext(PortalCtx);

/** Generic layout for the Administrator and Club Authority portals. */
export default function PortalShell({ nav, sectionLabel, footerNote }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const { pathname } = useLocation();
  const { storageWarning } = useGov();
  const { user } = useAuth();

  const notify = useCallback((message, tone = 'success') => {
    setToast({ id: Date.now(), message, tone });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  const footer = (
    <div className="m-4 rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-center gap-1.5 text-brand-600">
        <Icon name="ShieldCheck" className="h-4 w-4" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{ROLE_LABELS[actorKey(user)]}</span>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-ink-soft">{footerNote}</p>
    </div>
  );

  return (
    <PortalCtx.Provider value={{ notify }}>
      <div className="min-h-screen bg-canvas">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[251px] overflow-y-auto border-r border-line bg-white lg:block">
          <SidebarContent items={nav} sectionLabel={sectionLabel} footer={footer} />
        </aside>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-brand-900/40" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] overflow-y-auto bg-white shadow-pop animate-pop">
              <button onClick={() => setOpen(false)} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-brand-50" aria-label="Close menu">
                <Icon name="X" className="h-4 w-4" />
              </button>
              <SidebarContent items={nav} sectionLabel={sectionLabel} onNavigate={() => setOpen(false)} footer={footer} />
            </aside>
          </div>
        )}
        <div className="lg:pl-[251px]">
          <Topbar onMenu={() => setOpen(true)} student={false} />
          <main className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-10">
            {storageWarning && (
              <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-[#f0dcb4] bg-amber-soft px-4 py-3 text-xs text-amber-ink">
                <Icon name="AlertTriangle" className="mt-0.5 h-4 w-4 shrink-0" />
                Browser storage is full, so recent changes may not persist after a refresh. Use smaller poster images or reset demo data in Settings.
              </div>
            )}
            <Outlet />
          </main>
          <footer className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-5 text-[9px] font-bold uppercase tracking-[0.14em] text-ink-mute sm:px-6 lg:mx-10 lg:px-0">
            <span>Genesis Campus Connect</span>
            <span>Demo build · sample data · sign-in checked by the server</span>
            <span>AY 2026–27</span>
          </footer>
        </div>
        <Toast toast={toast} />
      </div>
    </PortalCtx.Provider>
  );
}
