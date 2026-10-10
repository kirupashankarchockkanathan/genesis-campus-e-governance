import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@ccp/shared';
import { useAuth } from '../auth/AuthContext.jsx';
import { landingPath } from '../utils/navigation.js';
import { AuthLayout } from './AuthLayout.jsx';
import { FormField } from '../components/ui/FormField.jsx';
import { Button } from '../components/ui/Button.jsx';

export function LoginPage() {
  const { login, status, platformRole, memberships, mustChangePassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

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

  const onSubmit = async (values) => {
    setServerError('');
    try {
      await login(values.identifier, values.password);
      // The redirect above sends the user to the right landing page once the session is loaded.
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <AuthLayout title="Log in" subtitle="Use your username or college email.">
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
      <p className="small">
        New here? <Link to="/signup">Create a student account</Link>
      </p>
    </AuthLayout>
  );
}
