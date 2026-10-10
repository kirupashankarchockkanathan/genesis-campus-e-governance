import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { login as apiLogin, logoutRequest, restoreSession } from '../utils/api';
import { setAccessToken, setPortal, setSessionLostHandler } from '../utils/http';
import { refreshAiStatus } from '../services/ai';

// Sign-in is checked by the server. The access token lives in memory; the refresh cookie (httpOnly) restores the
// session after a reload. Only the chosen portal name is kept in sessionStorage so the right screens come back.

const AuthContext = createContext(null);
const PORTAL_KEY = 'genesis.portal';

const readPortal = () => {
  try {
    return sessionStorage.getItem(PORTAL_KEY);
  } catch {
    return null;
  }
};
const writePortal = (p) => {
  try {
    if (p) sessionStorage.setItem(PORTAL_KEY, p);
    else sessionStorage.removeItem(PORTAL_KEY);
  } catch {
    /* storage unavailable — the session lives in memory only */
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(() => !!readPortal());

  useEffect(() => {
    let live = true;
    const portal = readPortal();
    if (!portal) return undefined;
    restoreSession(portal).then((s) => {
      if (!live) return;
      if (s) {
        setUser(s.user);
        refreshAiStatus();
      } else writePortal(null);
      setRestoring(false);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => {
      writePortal(null);
      setUser(null);
    });
  }, []);

  const login = useCallback(async (creds) => {
    const { portal, user: u } = await apiLogin(creds);
    writePortal(portal);
    setUser(u);
    refreshAiStatus();
    return u;
  }, []);

  const logout = useCallback(() => {
    logoutRequest();
    setAccessToken(null);
    setPortal(null);
    writePortal(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  if (restoring) return <Splash />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Shown while the session or the first data load is on its way. */
export function Splash({ label = 'Loading GENESIS Campus Connect…' }) {
  return (
    <div
      className="grid min-h-screen place-items-center bg-canvas text-ink-soft"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 text-sm font-semibold text-brand-800">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        {label}
      </div>
    </div>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export function homeFor(user) {
  if (!user) return '/';
  if (user.role === 'student') return '/student/dashboard';
  if (user.role === 'club') return '/club/dashboard';
  if (user.adminType === 'events') return '/admin/events/dashboard';
  return '/admin/osa/dashboard';
}
