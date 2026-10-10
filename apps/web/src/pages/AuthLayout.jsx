import { APP_NAME } from '@ccp/shared';

/** Shared frame for the public auth screens. */
export function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-page">
      <section className="auth-hero" aria-label={APP_NAME}>
        <h1>{APP_NAME}</h1>
        <p>Every club, event and announcement on campus, in one place.</p>
      </section>
      <main className="auth-panel">
        <div className="auth-card">
          <div className="stack-sm">
            <h2>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
