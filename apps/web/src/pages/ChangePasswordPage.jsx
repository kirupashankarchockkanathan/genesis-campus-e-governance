import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema } from '@ccp/shared';
import { useAuth } from '../auth/AuthContext.jsx';
import { AuthLayout } from './AuthLayout.jsx';
import { FormField } from '../components/ui/FormField.jsx';
import { Button } from '../components/ui/Button.jsx';

/** Forced at first login for admin accounts (FR-AUTH-08). */
export function ChangePasswordPage() {
  const { mustChangePassword, changePassword } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(changePasswordSchema) });
  if (!mustChangePassword) return <Navigate to="/" replace />;
  const onSubmit = async (v) => {
    try {
      await changePassword(v.currentPassword, v.newPassword);
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(err.message);
    }
  };
  return (
    <AuthLayout title="Change your password" subtitle="You must set a new password before continuing.">
      <form className="stack" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && (
          <div className="notice notice-bad" role="alert">
            {serverError}
          </div>
        )}
        <FormField
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword && 'Enter your current password'}
          {...register('currentPassword')}
        />
        <FormField
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Button type="submit" disabled={isSubmitting}>
          Save new password
        </Button>
      </form>
    </AuthLayout>
  );
}
