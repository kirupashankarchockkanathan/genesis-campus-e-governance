import { useNavigate } from 'react-router-dom';
import { Icon, PageHeader, Toggle } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import { useGov } from '../../context/GovContext';

export default function Settings() {
  const { notify, prefs, setPrefs } = useApp();
  const { logout } = useAuth();
  const gov = useGov();
  const navigate = useNavigate();
  const [compact, setCompact] = useState(false);
  const [reminders, setReminders] = useState(true);

  const reset = () => {
    gov.resetAll().then(() => window.location.assign('/student/dashboard')); // back to this account's starting data
  };

  return (
    <div className="mx-auto max-w-[780px]">
      <PageHeader eyebrow="Account" title="Settings" subtitle="Display, reminders and data controls." />

      <section className="card divide-y divide-line">
        {[
          ['Day-before reminders', 'Get a reminder the day before registered events.', reminders, setReminders],
          ['Compact lists', 'Show denser lists on supported pages (demo toggle).', compact, setCompact],
          ['Email updates', 'Send a copy of important campus updates by email.', prefs.email, (v) => setPrefs((p) => ({ ...p, email: v }))],
        ].map(([t, d, v, set]) => (
          <div key={t} className="flex items-center justify-between gap-4 px-6 py-5">
            <div><div className="text-xs font-bold text-brand-900">{t}</div><div className="text-[10px] text-ink-mute">{d}</div></div>
            <Toggle checked={v} onChange={(x) => { set(x); notify('Setting updated.'); }} label={t} />
          </div>
        ))}
      </section>

      <section className="card mt-5 p-6">
        <h2 className="text-sm font-extrabold text-brand-900">Your data</h2>
        <p className="mt-1 text-[11px] text-ink-soft">Registrations, favourites and read-state are saved to your account. Reset puts your account back to how it started.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={reset} className="btn-ghost"><Icon name="RotateCcw" className="h-4 w-4" /> Reset sample data</button>
          <button onClick={() => { logout(); navigate('/'); }} className="btn-ghost text-rose-ink"><Icon name="LogOut" className="h-4 w-4" /> Sign out</button>
        </div>
      </section>
    </div>
  );
}
