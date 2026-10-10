import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { passwordSchema } from '@ccp/shared';
import { publicApi } from '../api/client.js';
import { AuthLayout } from './AuthLayout.jsx';
import { FormField } from '../components/ui/FormField.jsx';
import { Button } from '../components/ui/Button.jsx';

const schema = z.object({ password: passwordSchema });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });
  const onSubmit = async (v) => {
    try {
      await publicApi('/auth/reset-password', {
        method: 'POST',
        body: { token: params.get('token') ?? '', password: v.password },
      });
      setDone(true);
    } catch (err) {
      setServerError(err.message);
    }
  };
  return (
    <AuthLayout title="Choose a new password">
      {done ? (
        <>
          <div className="notice notice-ok" role="status">
            Password updated. Please log in.
          </div>
          <Button to="/login">Log in</Button>
        </>
      ) : (
        <form className="stack" onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverError && (
            <div className="notice notice-bad" role="alert">
              {serverError}
            </div>
          )}
          <FormField
            label="New password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" disabled={isSubmitting}>
            Update password
          </Button>
        </form>
      )}
      <p className="small">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
