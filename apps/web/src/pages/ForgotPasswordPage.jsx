import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { emailOnlySchema } from '@ccp/shared';
import { publicApi } from '../api/client.js';
import { AuthLayout } from './AuthLayout.jsx';
import { FormField } from '../components/ui/FormField.jsx';
import { Button } from '../components/ui/Button.jsx';

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(emailOnlySchema) });
  const onSubmit = async (v) => {
    await publicApi('/auth/forgot-password', { method: 'POST', body: v }).catch(() => {});
    setSent(true); // Same message whether or not the email exists (FR-AUTH-05).
  };
  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your college email and we will send a reset link."
    >
      {sent ? (
        <div className="notice notice-ok" role="status">
          If that email is registered, a reset link is on its way.
        </div>
      ) : (
        <form className="stack" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField
            label="College email"
            type="email"
            autoComplete="email"
            error={errors.email && 'Enter a valid email'}
            {...register('email')}
          />
          <Button type="submit" disabled={isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="small">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
