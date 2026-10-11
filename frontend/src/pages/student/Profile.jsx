import { useState } from 'react';
import { Icon, Avatar, Toggle } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { cn } from '../../utils/helpers';

const ALL_INTERESTS = ['Hackathons', 'Workshops', 'Robotics', 'Design', 'Sustainability', 'Cultural', 'Sports', 'Data Science'];

export default function Profile() {
  const { user } = useAuth();
  const { prefs, setPrefs, notify } = useApp();
  const [editing, setEditing] = useState(false);

  const setPref = (k, v) => setPrefs((p) => ({ ...p, [k]: v }));
  const toggleInterest = (i) =>
    setPrefs((p) => ({ ...p, interests: p.interests.includes(i) ? p.interests.filter((x) => x !== i) : [...p.interests, i] }));

  const rows = [
    ['User', 'Department', user.department, 'Read-only'],
    ['ShieldCheck', 'Academic year', `${user.year.replace('year', 'Year')} · 2026–27`, ''],
    ['Mail', 'University email', user.email, 'Read-only'],
  ];

  const switches = [
    ['inApp', 'In-app notifications', 'Registration confirmations and event updates'],
    ['email', 'Email updates', 'A copy of important campus updates'],
    ['deadlines', 'Event changes & deadlines', 'Venue changes, cancellations, and registration reminders'],
    ['news', 'Club & university news', 'Approved updates from clubs and the university'],
  ];

  return (
    <div className="mx-auto max-w-[1080px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Account & preferences</div>
          <h1 className="mt-2 text-3xl font-extrabold text-brand-900">My profile</h1>
          <p className="mt-1.5 text-xs text-ink-soft">Manage your interests and how campus updates reach you.</p>
        </div>
        <button onClick={() => { setEditing((v) => !v); if (editing) notify('Preferences saved.'); }} className="btn-primary px-4 py-3">
          <Icon name={editing ? 'Check' : 'SlidersHorizontal'} className="h-4 w-4" /> {editing ? 'Save preferences' : 'Edit preferences'}
        </button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <section className="card p-6">
          <div className="flex items-center gap-5 border-b border-line pb-5">
            <Avatar initials={user.initials} size="lg" />
            <div>
              <span className="pill bg-brand-50 text-brand-700"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Student account</span>
              <div className="mt-1.5 text-xl font-extrabold text-brand-900">{user.name}</div>
              <div className="text-[11px] text-ink-soft">{user.department}</div>
            </div>
          </div>
          <ul>
            {rows.map(([icon, label, value, tag]) => (
              <li key={label} className="flex items-center gap-3 border-b border-line py-4 last:border-0">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon name={icon} className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><div className="text-[9px] text-ink-mute">{label}</div><div className="truncate text-xs font-bold text-brand-900">{value}</div></div>
                {tag && <span className="text-[8px] text-ink-mute">{tag}</span>}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2.5 rounded-xl bg-canvas p-3 text-[9px] leading-relaxed text-ink-soft">
            <Icon name="Lock" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-mute" />
            Your university identity and department are managed by the institution and can't be changed here.
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-extrabold text-brand-900">Interests</h2>
          <p className="text-[10px] text-ink-mute">Choose what you'd like to discover around campus.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(editing ? ALL_INTERESTS : prefs.interests).map((i) => {
              const on = prefs.interests.includes(i);
              return (
                <button
                  key={i}
                  disabled={!editing}
                  onClick={() => toggleInterest(i)}
                  aria-pressed={on}
                  className={cn('rounded-full border px-4 py-2 text-[10px] font-bold transition', on ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-line bg-white text-ink-soft hover:bg-brand-50/60', !editing && 'cursor-default')}
                >
                  {editing && on && '✓ '}{i}
                </button>
              );
            })}
          </div>
          <p className="mt-3 border-b border-line pb-5 text-[9px] text-ink-mute">{editing ? 'Tap to add or remove interests, then save.' : 'Used to personalize event suggestions. You can update these any time.'}</p>

          <div className="mt-5 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon name="Bell" className="h-4 w-4" /></span>
            <div><div className="text-xs font-bold text-brand-900">Notification settings</div><div className="text-[9px] text-ink-mute">Choose which student-facing updates you want.</div></div>
          </div>
          <ul className="mt-3">
            {switches.map(([k, t, d]) => (
              <li key={k} className="flex items-center justify-between gap-4 border-t border-line py-4 first:border-0">
                <div><div className="text-[11px] font-bold text-brand-900">{t}</div><div className="text-[9px] text-ink-mute">{d}</div></div>
                <Toggle checked={prefs[k]} onChange={(v) => setPref(k, v)} label={t} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card mt-5 flex flex-wrap items-center gap-4 p-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-canvas text-ink-soft"><Icon name="Lock" className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-brand-900">Password & sign-in</div>
          <div className="text-[9px] text-ink-mute">Password changes are managed by your university sign-in service. This prototype doesn't collect credentials.</div>
        </div>
        <button onClick={() => notify('Password changes are unavailable in this prototype.', 'info')} className="btn-ghost text-[10px] text-ink-mute">Password change unavailable <Icon name="ChevronRight" className="h-3.5 w-3.5" /></button>
      </section>
      <p className="mt-4 flex items-center gap-2 text-[9px] text-ink-mute"><Icon name="CircleHelp" className="h-3.5 w-3.5" /> Need to correct your name, department, or email? Contact the student records office.</p>
    </div>
  );
}
