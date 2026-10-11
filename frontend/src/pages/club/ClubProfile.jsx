import { useState } from 'react';
import { Card } from '../../components/gov/Common';
import { Field, Input, Textarea } from '../../components/gov/Form';
import { usePortal } from '../../components/gov/PortalShell';
import { Icon, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useGov } from '../../context/GovContext';
import { clubProfile, getClubFrom } from '../../store/selectors';

export default function ClubProfile() {
  const { user } = useAuth();
  const gov = useGov();
  const { notify } = usePortal();
  const club = getClubFrom(gov.state, user.clubId);
  const p = clubProfile(gov.state, user.clubId);
  const init = { description: p.description, tagline: p.tagline, contactEmail: p.contactEmail, meeting: p.meeting, location: p.location, social: p.social, objectives: p.objectives.length ? p.objectives : [''] };
  const [f, setF] = useState(init);
  const [errors, setErrors] = useState({});
  const dirty = JSON.stringify(f) !== JSON.stringify(init);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setObj = (i, v) => setF({ ...f, objectives: f.objectives.map((o, j) => (j === i ? v : o)) });

  const save = (e) => {
    e.preventDefault();
    const errs = {};
    if (f.description.trim().length < 20) errs.description = 'Write at least 20 characters.';
    if (f.contactEmail && !/^\S+@\S+\.\S+$/.test(f.contactEmail)) errs.contactEmail = 'Enter a valid email address.';
    if (!f.objectives.some((o) => o.trim())) errs.objectives = 'Add at least one objective.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const res = gov.updateClubProfile(user.clubId, f);
    notify(res.ok ? 'Club details updated. Students see the new description.' : res.error, res.ok ? 'success' : 'info');
  };

  return (
    <div>
      <PageHeader eyebrow="Your club" title={club?.name || 'Club profile'} subtitle="Edit your club’s public details. Only your own club can be edited here." />
      <form onSubmit={save} className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2" label="Description" htmlFor="cp-desc" required error={errors.description} hint="Shown to students in the club directory."><Textarea id="cp-desc" rows={4} value={f.description} onChange={set('description')} error={errors.description} /></Field>
            <Field className="sm:col-span-2" label="Tagline" htmlFor="cp-tag"><Input id="cp-tag" value={f.tagline} onChange={set('tagline')} maxLength={80} /></Field>
            <Field label="Contact email" htmlFor="cp-mail" error={errors.contactEmail}><Input id="cp-mail" type="email" value={f.contactEmail} onChange={set('contactEmail')} error={errors.contactEmail} /></Field>
            <Field label="Social handle" htmlFor="cp-soc"><Input id="cp-soc" value={f.social} onChange={set('social')} placeholder="@yourclub" /></Field>
            <Field label="Regular meeting time" htmlFor="cp-meet"><Input id="cp-meet" value={f.meeting} onChange={set('meeting')} /></Field>
            <Field label="Meeting location" htmlFor="cp-loc"><Input id="cp-loc" value={f.location} onChange={set('location')} /></Field>
          </div>
          <div className="mt-5">
            <div className="mb-1.5 text-xs font-bold text-brand-900">Objectives <span className="text-rose-ink">*</span></div>
            <div className="space-y-2">
              {f.objectives.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input className="field" aria-label={`Objective ${i + 1}`} value={o} onChange={(e) => setObj(i, e.target.value)} />
                  <button type="button" disabled={f.objectives.length === 1} onClick={() => setF({ ...f, objectives: f.objectives.filter((_, j) => j !== i) })} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line text-ink-soft hover:bg-rose-soft hover:text-rose-ink disabled:opacity-40" aria-label={`Remove objective ${i + 1}`}><Icon name="Trash2" className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            {errors.objectives && <p role="alert" className="mt-1 text-[11px] text-rose-ink">{errors.objectives}</p>}
            <button type="button" onClick={() => setF({ ...f, objectives: [...f.objectives, ''] })} className="btn-ghost mt-3"><Icon name="Plus" className="h-3.5 w-3.5" /> Add objective</button>
          </div>
          <div className="mt-6 flex gap-2">
            <button type="submit" disabled={!dirty} className="btn-primary disabled:opacity-40"><Icon name="Check" className="h-4 w-4" /> Save changes</button>
            <button type="button" disabled={!dirty} onClick={() => { setF(init); setErrors({}); }} className="btn-ghost disabled:opacity-40">Discard</button>
          </div>
        </Card>
        <Card title="Club authorities" subtitle="Managed by the Office of Student Affairs">
          <ul className="space-y-3">{p.authorities.map((a) => <li key={a.role + a.name} className="rounded-xl border border-line p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-ink-mute">{a.role}</div><div className="text-xs font-extrabold text-brand-900">{a.name}</div><div className="text-[10px] text-ink-soft">{a.email || '—'}</div></li>)}</ul>
          <p className="mt-3 text-[10px] text-ink-mute">To change office bearers, contact OSA.</p>
        </Card>
      </form>
    </div>
  );
}
