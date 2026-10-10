import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CATEGORY_LABELS, changePasswordSchema } from '@ccp/shared';
import { useAuth } from '../../auth/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useAction, useGet } from '../../api/hooks.js';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FormField } from '../../components/ui/FormField.jsx';
import { QueryState, MutationError } from '../../components/ui/QueryState.jsx';
import { applyTheme } from '../../components/layout/ThemeToggle.jsx';

function Theme() {
  const read = () => {
    try {
      return localStorage.getItem('ccp:theme') ?? 'system';
    } catch {
      return 'system';
    }
  };
  const [theme, setTheme] = useState(read);
  const choose = (t) => {
    setTheme(t);
    applyTheme(t);
    try {
      localStorage.setItem('ccp:theme', t);
    } catch {
      /* ignore */
    }
  };
  return (
    <Card>
      <fieldset className="stack-sm">
        <legend>
          <h2>Theme</h2>
        </legend>
        {['light', 'dark', 'system'].map((t) => (
          <label key={t} className="check">
            <input type="radio" name="theme" checked={theme === t} onChange={() => choose(t)} />{' '}
            {t[0].toUpperCase() + t.slice(1)}
          </label>
        ))}
      </fieldset>
    </Card>
  );
}

function Password() {
  const { changePassword } = useAuth();
  const [state, setState] = useState({ done: false, error: '' });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(changePasswordSchema) });
  const onSubmit = async (v) => {
    setState({ done: false, error: '' });
    try {
      await changePassword(v.currentPassword, v.newPassword);
      reset();
      setState({ done: true, error: '' });
    } catch (err) {
      setState({ done: false, error: err.message });
    }
  };
  return (
    <Card>
      <h2>Change password</h2>
      <form className="stack" onSubmit={handleSubmit(onSubmit)} noValidate>
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
          Update password
        </Button>
        {state.done && (
          <p className="notice notice-ok" role="status">
            Password changed. Your other sessions were signed out.
          </p>
        )}
        {state.error && (
          <p className="notice notice-bad" role="alert">
            {state.error}
          </p>
        )}
      </form>
    </Card>
  );
}

function Preferences() {
  const q = useGet(['prefs'], '/me/notification-preferences');
  const save = useAction({ invalidate: [['prefs']] });
  const toggle = (prefs, category, field, value) =>
    save.mutate({
      method: 'PUT',
      path: '/me/notification-preferences',
      body: {
        preferences: prefs
          .map((p) => (p.category === category ? { ...p, [field]: value } : p))
          .map(({ category: c, inApp, email }) => ({ category: c, inApp, email })),
      },
    });
  return (
    <Card>
      <h2>Notifications</h2>
      <QueryState query={q}>
        {(prefs) => (
          <table className="table">
            <caption className="visually-hidden">Notification categories</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">In the app</th>
                <th scope="col">By email</th>
              </tr>
            </thead>
            <tbody>
              {prefs.map((p) => (
                <tr key={p.category}>
                  <th scope="row">{CATEGORY_LABELS[p.category]}</th>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${CATEGORY_LABELS[p.category]} in the app`}
                      checked={p.inApp}
                      disabled={p.mandatory}
                      onChange={(e) => toggle(prefs, p.category, 'inApp', e.target.checked)}
                    />
                    {p.mandatory && <span className="muted small"> always on</span>}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${CATEGORY_LABELS[p.category]} by email`}
                      checked={p.email}
                      onChange={(e) => toggle(prefs, p.category, 'email', e.target.checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </QueryState>
      <MutationError mutation={save} />
    </Card>
  );
}

function CalendarFeed() {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const get = async () => {
    try {
      setUrl((await api('/me/calendar-feed')).url);
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Card>
      <h2>Calendar feed</h2>
      <p className="muted">
        Subscribe to your registered events and your clubs in Google Calendar, Outlook or Apple Calendar. Keep
        this link private.
      </p>
      {url ? (
        <input
          className="input"
          readOnly
          value={url}
          aria-label="Calendar feed link"
          onFocus={(e) => e.target.select()}
        />
      ) : (
        <Button variant="secondary" onClick={get}>
          Show my feed link
        </Button>
      )}
      {err && (
        <p className="notice notice-bad" role="alert">
          {err}
        </p>
      )}
    </Card>
  );
}

export function SettingsPage() {
  const { platformRole } = useAuth();
  return (
    <>
      <PageBanner title="Settings" description="Password, notifications and theme." />
      <div className="stack">
        <Password />
        <Preferences />
        <Theme />
        {platformRole === 'student' && <CalendarFeed />}
      </div>
    </>
  );
}
