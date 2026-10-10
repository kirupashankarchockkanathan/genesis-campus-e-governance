import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { APP_NAME, loginSchema } from '@ccp/shared';
import { useAuth } from '../auth/AuthContext.jsx';
import { landingPath } from '../utils/navigation.js';
import { PORTALS, portalFromParam, portalLanding, portalRefusal } from '../utils/portals.js';
import { rememberPortal } from '../utils/navigation.js';
import { AuthLayout } from './AuthLayout.jsx';
import { FormField } from '../components/ui/FormField.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Icon } from '../components/layout/Icon.jsx';

/** The start screen: exactly three buttons, one per kind of user. */
function PortalChooser() {
  return (
    <main className="portal-page">
      <header className="portal-hero">
        <span className="brand-mark brand-mark-lg" aria-hidden="true">
          C
        </span>
        <h1>{APP_NAME}</h1>
        <p>Every club, event and announcement on campus, in one place. Choose how you want to continue.</p>
      </header>
      <nav className="portal-grid" aria-label="Choose how to sign in">
        {Object.values(PORTALS).map((p) => (
          <Link key={p.id} to={`/login?as=${p.id}`} className="portal-card">
            <span className="portal-icon" aria-hidden="true">
              <Icon name={p.icon} size={44} />
            </span>
            <span className="portal-title">{p.title}</span>
            <span className="portal-tag">{p.tagline}</span>
            <ul className="portal-bullets">
              {p.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <span className="portal-cta">Continue as {p.title} →</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}

function PortalLogin({ portal }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const info = PORTALS[portal];
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const me = await login(values.identifier, values.password, (m) => portalRefusal(portal, m));
      rememberPortal(portal);
      if (me.user.mustChangePassword) return navigate('/change-password', { replace: true });
      let last = null;
      try {
        last = localStorage.getItem('ccp:lastClub');
      } catch {
        /* storage may be unavailable */
      }
      navigate(location.state?.from ?? portalLanding(portal, me, last), { replace: true });
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <AuthLayout title={`${info.title} login`} subtitle={info.tagline}>
      <form className="stack" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && (
          <div className="notice notice-bad" role="alert">
            {serverError}
          </div>
        )}
        <FormField
          label="Username or email"
          autoComplete="username"
          error={errors.identifier && 'Enter your username or email'}
          {...register('identifier')}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password && 'Enter your password'}
          {...register('password')}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Log in'}
        </Button>
      </form>
      <p className="small">
        <Link to="/forgot-password">Forgot your password?</Link>
      </p>
      {portal === 'student' && (
        <p className="small">
          New here? <Link to="/signup">Create a student account</Link>
        </p>
      )}
      {portal === 'member' && (
        <p className="small muted">
          Club roles are given by your club. Not a member yet? Use the Student login.
        </p>
      )}
      <p className="small">
        <Link to="/login">← Choose a different login</Link>
      </p>
    </AuthLayout>
  );
}

export function LoginPage() {
  const { status, platformRole, memberships, mustChangePassword } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  const portal = portalFromParam(params.get('as'));

  if (status === 'authenticated') {
    return (
      <Navigate
        to={
          mustChangePassword
            ? '/change-password'
            : (location.state?.from ?? landingPath({ platformRole, memberships }))
        }
        replace
      />
    );
  }
  return portal ? <PortalLogin portal={portal} /> : <PortalChooser />;
}
