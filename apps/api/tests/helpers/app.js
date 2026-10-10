import request from 'supertest';
import { createApp } from '../../src/app.js';
import { requireAuth, requireClubPermission, requirePlatformRole } from '../../src/middleware/auth.js';
import { TEST_PASSWORD } from '../factories/index.js';

/** Test app with probe routes used by the RBAC suites. */
export function buildTestApp(db, { llm } = {}) {
  return createApp({
    db,
    llm,
    extraRoutes: (api) => {
      api.get(
        '/_probe/club/:clubId/:permission',
        requireAuth(),
        (req, res, next) => requireClubPermission(req.params.permission)(req, res, next),
        (req, res) => res.json({ data: { ok: true } }),
      );
      api.get('/_probe/osi', requireAuth(), requirePlatformRole('osi_admin'), (_req, res) =>
        res.json({ data: { ok: true } }),
      );
      api.get('/_probe/events-admin', requireAuth(), requirePlatformRole('events_admin'), (_req, res) =>
        res.json({ data: { ok: true } }),
      );
      api.get('/_probe/plain', requireAuth(), (_req, res) => res.json({ data: { ok: true } }));
    },
  });
}

/** Logs in via the API and returns the bearer token. */
export async function loginAs(app, user, password = TEST_PASSWORD) {
  const res = await request(app).post('/api/v1/auth/login').send({ identifier: user.username, password });
  if (res.status !== 200) throw new Error(`login failed ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.data.accessToken;
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });
