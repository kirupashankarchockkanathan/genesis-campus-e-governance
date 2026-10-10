import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { Icon } from '../components/ui';
import { ADMIN_TYPES, DEMO_USERS, ROLES } from '../data/mockData';
import { useAuth, homeFor } from '../context/AuthContext';

export default function Login() {
  const { role, adminType } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const roleMeta = ROLES.find((r) => r.id === role);
  const adminMeta = ADMIN_TYPES.find((a) => a.id === adminType);

  if (!roleMeta) return <Navigate to="/" replace />;
  if (role === 'admin' && !adminMeta) return <Navigate to="/admin-type" replace />;

  const backTo = role === 'admin' ? '/admin-type' : '/';
  const title = role === 'admin' ? `${adminMeta.short} administrator` : roleMeta.title;
  const demo = DEMO_USERS.find((u) => u.role === role && (role !== 'admin' || u.adminType === adminType));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!userId.trim() || !password) {
      setError('Enter both your User ID and password.');
      return;
    }
    setBusy(true);
    try {
      const u = await login({ userId, password, role, adminType });
      navigate(homeFor(u), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const fill = () => {
    setUserId(demo.userId);
    setPassword(demo.password);
    setError('');
  };

  return (
    <AuthShell step={role === 'admin' ? 3 : 2} total={role === 'admin' ? 3 : 2}>
      <Link to={backTo} className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-900">
        <Icon name="ArrowLeft" className="h-3.5 w-3.5" /> Back
      </Link>
      <div className="eyebrow">Sign in · {title}</div>
      <h1 className="mt-2 text-4xl font-extrabold text-brand-900">Welcome back.</h1>
      <p className="mt-2 text-sm text-ink-soft">Use your university User ID and password.</p>

      <form onSubmit={submit} className="card mt-7 space-y-5 p-6" noValidate>
        <div>
          <label htmlFor="uid" className="mb-1.5 block text-xs font-bold text-brand-900">User ID</label>
          <div className="relative">
            <Icon name="IdCard" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
            <input
              id="uid"
              className="field pl-10"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g. STU2026001"
              autoComplete="username"
              autoCapitalize="characters"
            />
          </div>
        </div>
        <div>
          <label htmlFor="pw" className="mb-1.5 block text-xs font-bold text-brand-900">Password</label>
          <div className="relative">
            <Icon name="Lock" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
            <input
              id="pw"
              type={show ? 'text' : 'password'}
              className="field pl-10 pr-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-mute hover:bg-brand-50" aria-label={show ? 'Hide password' : 'Show password'}>
              <Icon name={show ? 'EyeOff' : 'Eye'} className="h-4 w-4" />
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-soft px-3.5 py-3 text-xs font-medium text-rose-ink">
            <Icon name="AlertCircle" className="mt-px h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-sm">
          {busy ? (<><Icon name="Loader2" className="h-4 w-4 animate-spin" /> Signing in…</>) : (<>Sign in <Icon name="ArrowRight" className="h-4 w-4" /></>)}
        </button>
      </form>

      {demo && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/60 p-4">
          <Icon name="KeyRound" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <div className="min-w-0 flex-1 text-[11px] leading-relaxed text-ink-soft">
            <b className="text-brand-900">Demo credentials</b> — User ID <code className="rounded bg-white px-1 font-bold text-brand-800">{demo.userId}</code>, password{' '}
            <code className="rounded bg-white px-1 font-bold text-brand-800">{demo.password}</code>.
            <div className="mt-1 text-ink-mute">Demo accounts for local runs. Sign-in is checked by the portal server.</div>
          </div>
          <button type="button" onClick={fill} className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-brand-700 shadow-card hover:bg-brand-100">Fill</button>
        </div>
      )}
    </AuthShell>
  );
}
