import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { publicApi } from '../api/client.js';
import { AuthLayout } from './AuthLayout.jsx';
import { Button } from '../components/ui/Button.jsx';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState(
    token ? { status: 'working' } : { status: 'error', message: 'This link is missing its token.' },
  );

  useEffect(() => {
    if (!token) return;
    publicApi('/auth/verify-email', { method: 'POST', body: { token } })
      .then(() => setState({ status: 'ok' }))
      .catch((err) => setState({ status: 'error', message: err.message }));
  }, [token]);

  return (
    <AuthLayout title="Verify your email">
      {state.status === 'working' && <p role="status">Verifying...</p>}
      {state.status === 'ok' && (
        <div className="notice notice-ok" role="status">
          Your email is verified. You can log in now.
        </div>
      )}
      {state.status === 'error' && (
        <div className="notice notice-bad" role="alert">
          {state.message}
        </div>
      )}
      <Button to="/login">Go to log in</Button>
    </AuthLayout>
  );
}
