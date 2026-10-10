import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { Icon } from '../components/ui';
import { ADMIN_TYPES } from '../data/mockData';

export default function AdminTypeSelect() {
  const navigate = useNavigate();
  return (
    <AuthShell step={2}>
      <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-900">
        <Icon name="ArrowLeft" className="h-3.5 w-3.5" /> Back to roles
      </Link>
      <div className="eyebrow">Administrator</div>
      <h1 className="mt-2 text-4xl font-extrabold text-brand-900">Which office are you with?</h1>
      <p className="mt-2 text-sm text-ink-soft">Select your administrative section so we can show the right tools.</p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {ADMIN_TYPES.map((a) => (
          <button
            key={a.id}
            onClick={() => navigate(`/login/admin/${a.id}`)}
            className="group flex flex-col rounded-2xl border border-line bg-white p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-pop"
          >
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-800 group-hover:text-white">
              <Icon name={a.icon} className="h-5 w-5" />
            </span>
            <span className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">{a.short}</span>
            <span className="mt-1 text-base font-extrabold text-brand-900">{a.title}</span>
            <span className="mt-1 text-xs leading-relaxed text-ink-soft">{a.desc}</span>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-brand-700">
              Continue <Icon name="ArrowRight" className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
            </span>
          </button>
        ))}
      </div>
    </AuthShell>
  );
}
