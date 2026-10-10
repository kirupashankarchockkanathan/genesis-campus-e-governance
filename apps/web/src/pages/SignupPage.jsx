import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema } from '@ccp/shared';
import { publicApi } from '../api/client.js';
import { AuthLayout } from './AuthLayout.jsx';
import { FormField } from '../components/ui/FormField.jsx';
import { Button } from '../components/ui/Button.jsx';

export function SignupPage() {
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(signupSchema) });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      setDone(await publicApi('/auth/signup', { method: 'POST', body: values }));
    } catch (err) {
      setServerError(err.message);
    }
  };

  if (done) {
    return (
      <AuthLayout title="Account created">
        <div className="notice notice-ok" role="status">
          {done.verificationRequired
            ? 'Check your college email for a verification link, then log in.'
            : 'Your account is ready.'}
        </div>
        <Button to="/login?as=student">Go to log in</Button>
      </AuthLayout>
    );
  }

  const e = (name) => errors[name]?.message;
  return (
    <AuthLayout title="Create your account" subtitle="Students sign up with their college email.">
      <form className="stack" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && (
          <div className="notice notice-bad" role="alert">
            {serverError}
          </div>
        )}
        <FormField label="Full name" autoComplete="name" error={e('fullName')} {...register('fullName')} />
        <FormField
          label="College email"
          type="email"
          autoComplete="email"
          error={e('email')}
          {...register('email')}
        />
        <FormField
          label="Username"
          autoComplete="username"
          help="Letters, numbers, dot or underscore"
          error={e('username')}
          {...register('username')}
        />
        <FormField label="Roll number" error={e('rollNumber')} {...register('rollNumber')} />
        <FormField label="Department" error={e('department')} {...register('department')} />
        <FormField
          label="Year of study"
          as="select"
          error={e('yearOfStudy')}
          defaultValue=""
          {...register('yearOfStudy')}
        >
          <option value="" disabled>
            Select year
          </option>
          {[1, 2, 3, 4, 5, 6].map((y) => (
            <option key={y} value={y}>
              Year {y}
            </option>
          ))}
        </FormField>
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          help="At least 8 characters"
          error={e('password')}
          {...register('password')}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
      <p className="small">
        Already have an account? <Link to="/login?as=student">Log in</Link>
      </p>
    </AuthLayout>
  );
}
