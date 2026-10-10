import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, InfoRow, SearchBox, Tabs } from '../../components/gov/Common';
import { ClubAppStatus } from '../../components/gov/Badges';
import FileField from '../../components/gov/FileField';
import { Field, Input, Select, Textarea } from '../../components/gov/Form';
import Modal from '../../components/gov/Modal';
import ReasonDialog from '../../components/gov/ReasonDialog';
import { Timeline } from '../../components/gov/Tracker';
import { usePortal } from '../../components/gov/PortalShell';
import { EmptyState, Icon, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useGov } from '../../context/GovContext';
import { CLUB_APP_DOCS } from '../../data/govData';
import { can, deniedReason } from '../../store/permissions';
import { clubProfile, fmtDateTime, fmtSize } from '../../store/selectors';
import { aiMode, detectDuplicateClubs } from '../../services/ai';
import { validateClubApplication } from '../../store/workflow';
import { useAdminBase } from './AdminLayout';

const CATS = ['Coding', 'Design', 'Robotics', 'Sports', 'Cultural', 'Social Impact', 'Entrepreneurship', 'Other'];

/* ------------------------------- list ------------------------------- */
export function ClubApplicationsList() {
  const base = useAdminBase();
  const { user } = useAuth();
  const gov = useGov();
  const [tab, setTab] = useState('submitted');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const apps = gov.state.clubApplications;
  const tabs = [['submitted', 'Awaiting decision'], ['correction_requested', 'Corrections'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([key, label]) => ({ key, label, count: apps.filter((a) => a.status === key).length }));
  const list = apps.filter((a) => a.status === tab && (!q.trim() || `${a.name} ${a.proposer.name}`.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <div>
      <PageHeader eyebrow="New clubs" title="Club applications" subtitle="Check documents, run the duplicate-club check, then OSA decides."
        action={can(user, 'clubApp.create') && <button onClick={() => setAdding(true)} className="btn-primary"><Icon name="Plus" className="h-4 w-4" /> Log application</button>} />
      <div className="mb-4"><Tabs tabs={tabs} value={tab} onChange={setTab} /></div>
      <div className="mb-4 flex"><SearchBox value={q} onChange={setQ} placeholder="Search by club or proposer" /></div>
      {list.length === 0 ? <EmptyState icon="UserPlus" title="No applications here" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((a) => {
            const top = a.aiCheck?.matches?.[0];
            return (
              <Link key={a.id} to={`${base}/club-applications/${a.id}`} className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><div className="truncate text-sm font-extrabold text-brand-900">{a.name}</div><div className="text-[10px] text-ink-mute">{a.id} · {a.category} · {a.proposer.name}</div></div>
                  <ClubAppStatus status={a.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] text-ink-soft">{a.objectives}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold">
                  <span className="rounded-full bg-[#eef1ef] px-2.5 py-1 text-ink-soft">{a.memberCount} founding members</span>
                  {a.aiCheck ? <span className={`rounded-full px-2.5 py-1 ${top && top.score >= 0.5 ? 'bg-rose-soft text-rose-ink' : 'bg-brand-50 text-brand-700'}`}>{top ? `Top match ${Math.round(top.score * 100)}%` : 'No similar clubs'}</span> : <span className="rounded-full bg-amber-soft px-2.5 py-1 text-amber-ink">Duplicate check not run</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {adding && <LogApplication onClose={() => setAdding(false)} />}
    </div>
  );
}

function LogApplication({ onClose }) {
  const gov = useGov();
  const nav = useNavigate();
  const base = useAdminBase();
  const { notify } = usePortal();
  const [f, setF] = useState({ name: '', category: '', objectives: '', description: '', proposerName: '', proposerRoll: '', proposerDept: '', proposerEmail: '', advisor: '', memberCount: '', documents: {} });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = () => {
    const errs = validateClubApplication(f);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const res = gov.createClubApplication(f);
    if (res.ok) { notify('Application logged.'); onClose(); nav(`${base}/club-applications/${res.id}`); } else notify(res.error, 'info');
  };
  return (
    <Modal title="Log a club application" subtitle="Record an application received from students." size="lg" onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit}>Log application</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Proposed club name" htmlFor="la-name" required error={errors.name}><Input id="la-name" value={f.name} onChange={set('name')} error={errors.name} /></Field>
        <Field label="Category" htmlFor="la-cat" required error={errors.category}><Select id="la-cat" value={f.category} onChange={set('category')} error={errors.category}><option value="">Choose…</option>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field className="sm:col-span-2" label="Objectives" htmlFor="la-obj" required error={errors.objectives}><Textarea id="la-obj" rows={3} value={f.objectives} onChange={set('objectives')} error={errors.objectives} /></Field>
        <Field label="Proposer name" htmlFor="la-pn" required error={errors.proposerName}><Input id="la-pn" value={f.proposerName} onChange={set('proposerName')} error={errors.proposerName} /></Field>
        <Field label="Proposer email" htmlFor="la-pe" required error={errors.proposerEmail}><Input id="la-pe" type="email" value={f.proposerEmail} onChange={set('proposerEmail')} error={errors.proposerEmail} /></Field>
        <Field label="Roll number" htmlFor="la-pr"><Input id="la-pr" value={f.proposerRoll} onChange={set('proposerRoll')} /></Field>
        <Field label="Department" htmlFor="la-pd"><Input id="la-pd" value={f.proposerDept} onChange={set('proposerDept')} /></Field>
        <Field label="Faculty advisor" htmlFor="la-ad" required error={errors.advisor}><Input id="la-ad" value={f.advisor} onChange={set('advisor')} error={errors.advisor} /></Field>
        <Field label="Founding members" htmlFor="la-mc" required error={errors.memberCount}><Input id="la-mc" type="number" min="1" value={f.memberCount} onChange={set('memberCount')} error={errors.memberCount} /></Field>
      </div>
      <div className="mt-4 space-y-2">
        {CLUB_APP_DOCS.map((d) => <FileField key={d.key} label={d.label} required={d.required} value={f.documents[d.key]} onChange={(v) => setF({ ...f, documents: { ...f.documents, [d.key]: v } })} />)}
      </div>
    </Modal>
  );
}

/* ------------------------------ detail ------------------------------ */
export function ClubApplicationDetail() {
  const { id } = useParams();
  const base = useAdminBase();
  const { user } = useAuth();
  const gov = useGov();
  const { notify } = usePortal();
  const a = gov.state.clubApplications.find((x) => x.id === id);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [ack, setAck] = useState(false);
  const objectivesOf = useMemo(() => (club) => clubProfile(gov.state, club.id).objectives.join(' '), [gov.state]);

  if (!a) return <EmptyState icon="SearchX" title="Application not found" action={<Link to={`${base}/club-applications`} className="btn-primary">Back</Link>} />;
  const canDecide = can(user, 'clubApp.decide');
  const canAi = can(user, 'clubApp.aiCheck');
  const missing = CLUB_APP_DOCS.filter((d) => d.required && !a.documents?.[d.key]);
  const top = a.aiCheck?.matches?.[0];
  const highOverlap = top && top.score >= 0.5;

  const runCheck = async () => {
    setBusy(true);
    try {
      const result = await detectDuplicateClubs(a, gov.clubs, objectivesOf);
      const res = gov.saveAiCheck(a.id, result);
      notify(res.ok ? 'Duplicate check complete.' : res.error, res.ok ? 'success' : 'info');
    } finally { setBusy(false); }
  };
  const approve = () => {
    const res = gov.decideClubApplication(a.id, { decision: 'approve', note: '', acknowledgeDuplicate: ack });
    notify(res.ok ? `${a.name} is now a campus club.` : res.error, res.ok ? 'success' : 'info');
  };
  const decide = (decision, note) => {
    const res = gov.decideClubApplication(a.id, { decision, note });
    if (res.ok) { notify(decision === 'reject' ? 'Application rejected.' : 'Corrections requested.'); setDialog(null); } else notify(res.error, 'info');
  };
  const reopen = () => { const res = gov.decideClubApplication(a.id, { decision: 'reopen' }); notify(res.ok ? 'Application reopened for review.' : res.error, res.ok ? 'success' : 'info'); };

  return (
    <div>
      <Link to={`${base}/club-applications`} className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-ink-soft hover:text-brand-800"><Icon name="ArrowLeft" className="h-3.5 w-3.5" /> Club applications</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div><div className="eyebrow">{a.id} · {a.category}</div><h1 className="mt-2 text-3xl font-extrabold text-brand-900">{a.name}</h1><p className="mt-1 text-sm text-ink-soft">Received {fmtDateTime(a.submittedAt)}</p></div>
        <ClubAppStatus status={a.status} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <Card title="Application"><p className="text-xs leading-relaxed text-ink-soft">{a.objectives}</p>
            <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
              <InfoRow icon="User" label="Proposer">{a.proposer.name}{a.proposer.rollNo ? ` · ${a.proposer.rollNo}` : ''}</InfoRow>
              <InfoRow icon="Mail" label="Email">{a.proposer.email}</InfoRow>
              <InfoRow icon="GraduationCap" label="Faculty advisor">{a.advisor || 'Not provided'}</InfoRow>
              <InfoRow icon="Users" label="Founding members">{a.memberCount}{a.memberCount < 10 && <span className="ml-2 text-rose-ink">below minimum of 10</span>}</InfoRow>
            </div>
          </Card>
          <Card title="Documents">
            <ul className="divide-y divide-line">
              {CLUB_APP_DOCS.map((d) => { const f = a.documents?.[d.key]; return (
                <li key={d.key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Icon name={f ? 'FileCheck2' : 'FileWarning'} className={`h-4 w-4 ${f ? 'text-brand-500' : 'text-rose-ink'}`} />
                  <div className="min-w-0 flex-1 text-xs"><b className="text-brand-900">{d.label}</b><div className="truncate text-[10px] text-ink-mute">{f ? `${f.name} · ${fmtSize(f.size)}` : 'Missing'}</div></div>
                </li>); })}
            </ul>
          </Card>
          {a.decisionNote && <Card title="Decision note"><p className="text-xs text-ink-soft">{a.decisionNote}</p></Card>}
          <Card title="History"><Timeline entries={a.history} /></Card>
        </div>

        <div className="space-y-6">
          <Card title="AI duplicate-club check" subtitle={aiMode()} action={canAi && a.status === 'submitted' && <button disabled={busy} onClick={runCheck} className="btn-ghost px-3 py-1.5 text-[11px] disabled:opacity-50"><Icon name={busy ? 'Loader2' : 'Sparkles'} className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> {a.aiCheck ? 'Re-run' : 'Run check'}</button>}>
            {!a.aiCheck ? <p className="text-[11px] text-ink-soft">Compares the name and objectives with existing clubs. Advisory only; OSA makes the decision.</p> : (
              <>
                <p className="mb-3 text-[11px] text-ink-soft">{a.aiCheck.summary}</p>
                <ul className="space-y-2">
                  {a.aiCheck.matches.length === 0 && <li className="rounded-xl bg-brand-50 px-3 py-2 text-[11px] text-brand-800">No similar clubs found.</li>}
                  {a.aiCheck.matches.map((m) => (
                    <li key={m.clubId} className="rounded-xl border border-line p-3">
                      <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-brand-900">{m.name}</span><span className={`pill ${m.score >= 0.5 ? 'bg-rose-soft text-rose-ink' : 'bg-amber-soft text-amber-ink'}`}>{Math.round(m.score * 100)}% similar</span></div>
                      <p className="mt-1 text-[10px] text-ink-mute">{m.reasons.join(' · ')}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] text-ink-mute">Source: {a.aiCheck.source === 'ai-service' ? 'AI service' : 'Local mock fallback (token similarity)'} · {fmtDateTime(a.aiCheck.ranAt || a.submittedAt)}</p>
              </>
            )}
          </Card>

          <Card title="Decision">
            {a.status === 'approved' && <p className="text-xs text-brand-800">Approved. The club now appears in the Club Directory and the Student Dashboard.</p>}
            {a.status === 'rejected' && <p className="text-xs text-rose-ink">This application was rejected.</p>}
            {a.status === 'correction_requested' && (
              <>
                <p className="text-xs text-amber-ink">Waiting for the applicant to send corrections.</p>
                {canDecide && <button onClick={reopen} className="btn-ghost mt-3"><Icon name="RotateCcw" className="h-4 w-4" /> Corrections received — reopen</button>}
              </>
            )}
            {a.status === 'submitted' && (canDecide ? (
              <>
                {(missing.length > 0 || a.memberCount < 10 || !a.aiCheck) && <ul className="mb-3 list-disc pl-4 text-[11px] text-amber-ink">
                  {missing.length > 0 && <li>Missing: {missing.map((m) => m.label).join(', ')}</li>}
                  {a.memberCount < 10 && <li>Fewer than 10 founding members</li>}
                  {!a.aiCheck && <li>Run the duplicate-club check first</li>}
                </ul>}
                {highOverlap && (
                  <label className="mb-3 flex items-start gap-2 rounded-xl bg-rose-soft px-3 py-2.5 text-[11px] text-rose-ink">
                    <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
                    I have reviewed the overlap with “{top.name}” and still want to approve.
                  </label>
                )}
                <div className="flex flex-wrap gap-2">
                  <button onClick={approve} className="btn-primary"><Icon name="Check" className="h-4 w-4" /> Approve club</button>
                  <button onClick={() => setDialog('correction')} className="btn-ghost">Request corrections</button>
                  <button onClick={() => setDialog('reject')} className="btn-ghost text-rose-ink">Reject</button>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-2 rounded-xl bg-canvas px-3 py-2.5 text-[11px] text-ink-soft"><Icon name="Lock" className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {deniedReason('clubApp.decide')}</div>
            ))}
          </Card>
        </div>
      </div>
      {dialog && (
        <ReasonDialog title={dialog === 'reject' ? 'Reject application' : 'Request corrections'} tone={dialog === 'reject' ? 'danger' : 'warn'} requireNote noteLabel="Reason shared with the applicant" confirmLabel={dialog === 'reject' ? 'Reject' : 'Send'}
          reasons={dialog === 'reject' ? ['Duplicate of an existing club', 'Does not meet requirements', 'Insufficient members'] : ['Missing documents', 'Need more founding members', 'Objectives unclear']}
          onClose={() => setDialog(null)} onConfirm={(reasons, note) => decide(dialog, [reasons.join('; '), note].filter(Boolean).join(' — '))} />
      )}
    </div>
  );
}
