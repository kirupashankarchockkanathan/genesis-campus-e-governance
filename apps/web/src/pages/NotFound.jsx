import { Link } from 'react-router-dom';
import AuthShell from '../components/AuthShell';

export default function NotFound() {
  return (
    <AuthShell>
      <div className="eyebrow">404</div>
      <h1 className="mt-2 text-4xl font-extrabold text-brand-900">That page wandered off.</h1>
      <p className="mt-2 text-sm text-ink-soft">The page you're looking for doesn't exist in this prototype.</p>
      <Link to="/" className="btn-primary mt-6 inline-flex">Back to start</Link>
    </AuthShell>
  );
}
