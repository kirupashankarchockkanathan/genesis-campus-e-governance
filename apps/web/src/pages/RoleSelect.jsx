import { useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { Icon } from '../components/ui';
import { ROLES } from '../data/mockData';
import { useAuth, homeFor } from '../context/AuthContext';

export default function RoleSelect() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const choose = (id) => {
    if (id === 'admin') navigate('/admin-type');
    else navigate(`/login/${id}`);
  };

  return (
    <AuthShell step={1}>
      <div className="eyebrow">Welcome</div>
      <h1 className="mt-2 text-4xl font-extrabold text-brand-900">Who's signing in?</h1>
      <p className="mt-2 text-sm text-ink-soft">Choose your role to continue to the GENESIS portal.</p>

      {user && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-xs">
          <span className="text-brand-800">Signed in as <b>{user.name}</b></span>
          <span className="flex gap-2">
            <button onClick={() => navigate(homeFor(user))} className="font-bold text-brand-700 hover:underline">Continue</button>
            <button onClick={logout} className="font-bold text-ink-soft hover:underline">Sign out</button>
          </span>
        </div>
      )}

      <div className="mt-7 space-y-3">
        {ROLES.map((r) => (
          <button
            key={r.id}
            onClick={() => choose(r.id)}
            className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-white p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-pop"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-800 group-hover:text-white">
              <Icon name={r.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-extrabold text-brand-900">{r.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{r.desc}</span>
            </span>
            <Icon name="ArrowRight" className="h-5 w-5 text-ink-mute transition group-hover:translate-x-1 group-hover:text-brand-700" />
          </button>
        ))}
      </div>
      <p className="mt-6 text-center text-[11px] text-ink-mute">Demo build · sign-in is checked by the server.</p>
    </AuthShell>
  );
}
