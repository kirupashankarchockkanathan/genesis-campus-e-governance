import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { Providers, makeQueryClient } from '../app/providers.jsx';
import { AppRoutes } from '../app/router.jsx';
import { setAccessToken } from '../api/client.js';

const json = (status, body) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

/** Stubs fetch. `routes` maps "METHOD /path" to a function returning [status, body]. */
export function mockApi(routes) {
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url, init = {}) => {
      const path = String(url).replace('/api/v1', '');
      const key = `${init.method ?? 'GET'} ${path.split('?')[0]}`;
      calls.push({ key, body: init.body ? JSON.parse(init.body) : undefined });
      const handler = routes[key];
      if (!handler) return json(404, { error: { code: 'NOT_FOUND', message: `no mock for ${key}` } });
      const result = handler(init);
      return result instanceof Promise ? result : json(...result);
    }),
  );
  return calls;
}

export const makeUser = (over = {}) => ({
  id: 'u1',
  username: 'asha',
  email: 'asha@campus.example',
  fullName: 'Asha Rao',
  platformRole: 'student',
  mustChangePassword: false,
  ...over,
});

/** Mocks a logged-in session: /auth/refresh succeeds and /me returns the given memberships. */
export function mockSession({ user = makeUser(), memberships = [], extra = {} } = {}) {
  return mockApi({
    'POST /auth/refresh': () => [200, { data: { accessToken: 'tok', user } }],
    'GET /me': () => [200, { data: { user, platformRole: user.platformRole, memberships } }],
    'POST /auth/logout': () => [200, { data: {} }],
    ...extra,
  });
}

export const membership = (clubId, roleKey, roleName, permissions) => ({
  club: { id: clubId, slug: clubId, name: `Club ${clubId}` },
  roleKey,
  roleName,
  permissions,
});

export function renderApp(path = '/') {
  setAccessToken(null);
  const Router = ({ children }) => (
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {children}
    </MemoryRouter>
  );
  return render(
    <Providers router={Router} client={makeQueryClient()}>
      <AppRoutes />
    </Providers>,
  );
}
