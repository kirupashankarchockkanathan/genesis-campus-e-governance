import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, publicApi, refreshSession, setAccessToken, setSessionLostHandler } from '../api/client.js';

const AuthContext = createContext(null);

const EMPTY = {
  status: 'loading',
  user: null,
  platformRole: null,
  memberships: [],
  mustChangePassword: false,
};
const ANON = { ...EMPTY, status: 'anonymous' };

const fromMe = (me) => ({
  status: 'authenticated',
  user: me.user,
  platformRole: me.platformRole,
  memberships: me.memberships,
  mustChangePassword: false,
});
// While a forced password change is pending only the login payload is available (spec 11.3).
const fromLoginUser = (user) => ({
  status: 'authenticated',
  user,
  platformRole: user.platformRole,
  memberships: [],
  mustChangePassword: user.mustChangePassword,
});

export function AuthProvider({ children }) {
  const [state, setState] = useState(EMPTY);

  const load = useCallback(async (loginUser) => {
    if (loginUser?.mustChangePassword) return setState(fromLoginUser(loginUser));
    setState(fromMe(await api('/me')));
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => setState(ANON));
    let cancelled = false;
    (async () => {
      try {
        const data = await refreshSession();
        if (!cancelled) await load(data.user);
      } catch {
        if (!cancelled) setState(ANON);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  /**
   * `accept(me)` lets a login portal refuse an account that does not belong there (for example a student on the
   * Administrator login). When it returns a message the session is ended again and nothing is shown to the user.
   */
  const login = useCallback(async (identifier, password, accept) => {
    const data = await publicApi('/auth/login', { method: 'POST', body: { identifier, password } });
    setAccessToken(data.accessToken);
    const me = data.user.mustChangePassword
      ? { user: data.user, platformRole: data.user.platformRole, memberships: [] }
      : await api('/me');
    const refusal = accept?.(me);
    if (refusal) {
      await publicApi('/auth/logout', { method: 'POST' }).catch(() => {});
      setAccessToken(null);
      throw new Error(refusal);
    }
    setState(data.user.mustChangePassword ? fromLoginUser(data.user) : fromMe(me));
    return me;
  }, []);

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      const data = await api('/me/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
        noRetry: true,
      });
      setAccessToken(data.accessToken);
      await load(data.user);
    },
    [load],
  );

  const logout = useCallback(async () => {
    try {
      await publicApi('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      setState(ANON);
    }
  }, []);

  const value = useMemo(() => {
    const membershipFor = (clubId) =>
      state.memberships.find((m) => m.club.id === clubId || m.club.slug === clubId);
    return {
      ...state,
      login,
      logout,
      changePassword,
      reload: () => load(),
      isAuthenticated: state.status === 'authenticated',
      /** UI-only check; the server always decides (spec 0, rule 4). */
      can: (permission, clubId) => Boolean(membershipFor(clubId)?.permissions.includes(permission)),
      hasPlatformRole: (...roles) => roles.includes(state.platformRole),
      membershipFor,
    };
  }, [state, login, logout, changePassword, load]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
