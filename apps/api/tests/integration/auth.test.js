import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestDb, cleanDb } from '../helpers/db.js';
import { buildTestApp, loginAs, bearer } from '../helpers/app.js';
import { createUser, TEST_PASSWORD } from '../factories/index.js';
import { outbox } from '../../src/lib/mailer.js';
import { clock } from '../../src/lib/clock.js';
import { config, overrideConfig } from '../../src/config/index.js';
import { loginLimiter } from '../../src/modules/auth/loginLimiter.js';
import { sha256 } from '../../src/lib/ids.js';

let knex;
let app;
const API = '/api/v1';
const signupBody = (o = {}) => ({
  fullName: 'Asha Rao',
  email: 'asha@campus.example',
  username: 'asha_r',
  rollNumber: '22CS001',
  department: 'CSE',
  yearOfStudy: 2,
  password: 'Str0ng-Pass!word',
  ...o,
});
const tokenFromMail = (mail) => new URL(mail.text.match(/https?:\/\/\S+/)[0]).searchParams.get('token');

beforeAll(async () => {
  knex = await createTestDb();
  app = buildTestApp(knex);
});
afterAll(async () => knex.destroy());
beforeEach(async () => {
  await cleanDb(knex);
  outbox.length = 0;
  loginLimiter.reset();
  overrideConfig({ AUTO_VERIFY_EMAIL: false });
});
afterEach(() => clock.reset());

describe('sign-up and verification', () => {
  it('TC-AUTH-01 sign up creates an unverified user, captures the mail, hides secrets', async () => {
    const res = await request(app).post(`${API}/auth/signup`).send(signupBody());
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/Str0ng-Pass|password_hash|passwordHash|\$2[aby]\$/);
    const row = await knex('users').where({ email: 'asha@campus.example' }).first();
    expect(row.email_verified_at).toBeNull();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe('asha@campus.example');
  });
  it('TC-AUTH-02 non-college email is rejected', async () => {
    const res = await request(app).post(`${API}/auth/signup`).send(signupBody({ email: 'asha@gmail.com' }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('TC-AUTH-03 existing email or username gives 409 CONFLICT', async () => {
    await request(app).post(`${API}/auth/signup`).send(signupBody());
    const sameEmail = await request(app).post(`${API}/auth/signup`).send(signupBody({ username: 'other_one' }));
    const sameUser = await request(app).post(`${API}/auth/signup`).send(signupBody({ email: 'other@campus.example' }));
    const caseEmail = await request(app).post(`${API}/auth/signup`).send(signupBody({ username: 'third_one', email: 'ASHA@campus.example' }));
    for (const r of [sameEmail, sameUser, caseEmail]) {
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe('CONFLICT');
    }
  });
  it('TC-AUTH-04 weak or common passwords are rejected', async () => {
    for (const password of ['short1', 'password123', 'xxasha_rxx99']) {
      const res = await request(app).post(`${API}/auth/signup`).send(signupBody({ password }));
      expect(res.status).toBe(400);
    }
  });
  it('TC-AUTH-05 login before verification is 403 with a clear message', async () => {
    await request(app).post(`${API}/auth/signup`).send(signupBody());
    const res = await request(app).post(`${API}/auth/login`).send({ identifier: 'asha_r', password: 'Str0ng-Pass!word' });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/verify your email/i);
  });
  it('TC-AUTH-06 verification token works once; reuse and expired tokens fail', async () => {
    await request(app).post(`${API}/auth/signup`).send(signupBody());
    const token = tokenFromMail(outbox[0]);
    expect((await request(app).post(`${API}/auth/verify-email`).send({ token })).status).toBe(200);
    expect((await request(app).post(`${API}/auth/verify-email`).send({ token })).status).toBe(400);
    const verified = await knex('users').where({ username: 'asha_r' }).first();
    expect(verified.email_verified_at).toBeTruthy();

    await request(app).post(`${API}/auth/signup`).send(signupBody({ email: 'b@campus.example', username: 'bee_b' }));
    const t2 = tokenFromMail(outbox[1]);
    clock.advance(25 * 3600 * 1000);
    expect((await request(app).post(`${API}/auth/verify-email`).send({ token: t2 })).status).toBe(400);
  });
  it('AUTO_VERIFY_EMAIL=true skips verification (FR-AUTH-02)', async () => {
    overrideConfig({ AUTO_VERIFY_EMAIL: true });
    await request(app).post(`${API}/auth/signup`).send(signupBody());
    expect(outbox).toHaveLength(0);
    const res = await request(app).post(`${API}/auth/login`).send({ identifier: 'asha_r', password: 'Str0ng-Pass!word' });
    expect(res.status).toBe(200);
  });
});

describe('login and sessions', () => {
  it('TC-AUTH-07 login works with username and with email; issues token and cookie', async () => {
    const u = await createUser(knex);
    for (const identifier of [u.username, u.email.toUpperCase()]) {
      const res = await request(app).post(`${API}/auth/login`).send({ identifier, password: TEST_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
      const cookie = res.headers['set-cookie'].join(';');
      expect(cookie).toMatch(/refresh_token=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
      expect(cookie).toMatch(/SameSite=Lax/i);
    }
  });
  it('TC-AUTH-08 wrong password and unknown user give the same generic error', async () => {
    const u = await createUser(knex);
    const a = await request(app).post(`${API}/auth/login`).send({ identifier: u.username, password: 'Wrong-Passw0rd!' });
    const b = await request(app).post(`${API}/auth/login`).send({ identifier: 'nobody_here', password: 'Wrong-Passw0rd!' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });
  it('TC-AUTH-09 sixth failed login in 15 minutes is 429, even with the right password', async () => {
    const u = await createUser(knex);
    for (let i = 0; i < 5; i++) {
      expect((await request(app).post(`${API}/auth/login`).send({ identifier: u.username, password: 'Nope-Nope-1!' })).status).toBe(401);
    }
    const blocked = await request(app).post(`${API}/auth/login`).send({ identifier: u.username, password: TEST_PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    clock.advance(16 * 60 * 1000);
    expect((await request(app).post(`${API}/auth/login`).send({ identifier: u.username, password: TEST_PASSWORD })).status).toBe(200);
  });
  it('TC-AUTH-10 refresh rotates the token; the old one stops working', async () => {
    const u = await createUser(knex);
    const agent = request.agent(app);
    const login = await agent.post(`${API}/auth/login`).send({ identifier: u.username, password: TEST_PASSWORD });
    const oldCookie = login.headers['set-cookie'][0].split(';')[0];
    const res = await agent.post(`${API}/auth/refresh`);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    const replay = await request(app).post(`${API}/auth/refresh`).set('Cookie', oldCookie);
    expect(replay.status).toBe(401);
  });
  it('TC-AUTH-11 reusing a rotated refresh token revokes the whole family', async () => {
    const u = await createUser(knex);
    const agent = request.agent(app);
    const login = await agent.post(`${API}/auth/login`).send({ identifier: u.username, password: TEST_PASSWORD });
    const oldCookie = login.headers['set-cookie'][0].split(';')[0];
    expect((await agent.post(`${API}/auth/refresh`)).status).toBe(200);
    expect((await request(app).post(`${API}/auth/refresh`).set('Cookie', oldCookie)).status).toBe(401);
    // The newest token (held by the agent) is now dead too.
    expect((await agent.post(`${API}/auth/refresh`)).status).toBe(401);
  });
  it('TC-AUTH-12 logout then refresh is 401', async () => {
    const u = await createUser(knex);
    const agent = request.agent(app);
    await agent.post(`${API}/auth/login`).send({ identifier: u.username, password: TEST_PASSWORD });
    expect((await agent.post(`${API}/auth/logout`)).status).toBe(200);
    expect((await agent.post(`${API}/auth/refresh`)).status).toBe(401);
  });
  it('TC-AUTH-13 tampered, expired and wrong-signature access tokens are 401', async () => {
    const u = await createUser(knex);
    const good = await loginAs(app, u);
    expect((await request(app).get(`${API}/me`).set(bearer(good))).status).toBe(200);
    const [h, p, s] = good.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: u.id, platformRole: 'super_admin' })).toString('base64url');
    const wrongSig = jwt.sign({ sub: u.id, platformRole: 'student' }, 'another-secret-another-secret-123456');
    const expired = jwt.sign({ sub: u.id, platformRole: 'student' }, config.JWT_SECRET, { expiresIn: -10 });
    for (const t of [`${h}.${forgedPayload}.${s}`, wrongSig, expired, 'garbage', `${h}.${p}.`]) {
      const res = await request(app).get(`${API}/me`).set(bearer(t));
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });
  it('TC-AUTH-17 suspended user cannot log in or use an existing token', async () => {
    const u = await createUser(knex);
    const token = await loginAs(app, u);
    await knex('users').where({ id: u.id }).update({ status: 'suspended' });
    expect((await request(app).get(`${API}/me`).set(bearer(token))).status).toBe(401);
    const login = await request(app).post(`${API}/auth/login`).send({ identifier: u.username, password: TEST_PASSWORD });
    expect(login.status).toBe(403);
  });
  it('TC-AUTH-18 admin with must_change_password is blocked until the password is changed', async () => {
    const admin = await createUser(knex, { platform_role: 'osi_admin', must_change_password: 1 });
    const token = await loginAs(app, admin);
    const blocked = await request(app).get(`${API}/me`).set(bearer(token));
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.details.reason).toBe('PASSWORD_CHANGE_REQUIRED');
    const changed = await request(app).post(`${API}/me/change-password`).set(bearer(token)).send({ currentPassword: TEST_PASSWORD, newPassword: 'Brand-New-Pass9!' });
    expect(changed.status).toBe(200);
    const after = await request(app).get(`${API}/me`).set(bearer(changed.body.data.accessToken));
    expect(after.status).toBe(200);
  });
  it('TC-AUTH-19 responses never contain password_hash or token hashes', async () => {
    const u = await createUser(knex);
    const token = await loginAs(app, u);
    const me = await request(app).get(`${API}/me`).set(bearer(token));
    const text = JSON.stringify(me.body);
    expect(text).not.toMatch(/password_hash|passwordHash|token_hash|\$2[aby]\$/);
    const login = await request(app).post(`${API}/auth/login`).send({ identifier: u.username, password: TEST_PASSWORD });
    expect(JSON.stringify(login.body)).not.toMatch(/password_hash|passwordHash|\$2[aby]\$/);
  });
});

describe('forgot, reset and change password', () => {
  it('TC-AUTH-14 forgot-password responds identically; mail only for existing accounts', async () => {
    const u = await createUser(knex);
    const a = await request(app).post(`${API}/auth/forgot-password`).send({ email: u.email });
    const b = await request(app).post(`${API}/auth/forgot-password`).send({ email: 'ghost@campus.example' });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body).toEqual(b.body);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(u.email);
  });
  it('TC-AUTH-15 reset works once, rejects reuse and expiry, and revokes all sessions', async () => {
    const u = await createUser(knex);
    const agent = request.agent(app);
    await agent.post(`${API}/auth/login`).send({ identifier: u.username, password: TEST_PASSWORD });
    await request(app).post(`${API}/auth/forgot-password`).send({ email: u.email });
    const token = tokenFromMail(outbox[0]);
    const ok = await request(app).post(`${API}/auth/reset-password`).send({ token, password: 'Fresh-Passw0rd-7' });
    expect(ok.status).toBe(200);
    expect((await request(app).post(`${API}/auth/reset-password`).send({ token, password: 'Fresh-Passw0rd-8' })).status).toBe(400);
    expect((await agent.post(`${API}/auth/refresh`)).status).toBe(401);
    expect((await request(app).post(`${API}/auth/login`).send({ identifier: u.username, password: 'Fresh-Passw0rd-7' })).status).toBe(200);

    await request(app).post(`${API}/auth/forgot-password`).send({ email: u.email });
    const t2 = tokenFromMail(outbox[1]);
    clock.advance(2 * 3600 * 1000);
    expect((await request(app).post(`${API}/auth/reset-password`).send({ token: t2, password: 'Fresh-Passw0rd-9' })).status).toBe(400);
  });
  it('TC-AUTH-16 change password needs the right current password and revokes other sessions', async () => {
    const u = await createUser(knex);
    const other = request.agent(app);
    await other.post(`${API}/auth/login`).send({ identifier: u.username, password: TEST_PASSWORD });
    const token = await loginAs(app, u);
    const bad = await request(app).post(`${API}/me/change-password`).set(bearer(token)).send({ currentPassword: 'Wrong-Passw0rd!', newPassword: 'Brand-New-Pass9!' });
    expect(bad.status).toBe(400);
    const good = await request(app).post(`${API}/me/change-password`).set(bearer(token)).send({ currentPassword: TEST_PASSWORD, newPassword: 'Brand-New-Pass9!' });
    expect(good.status).toBe(200);
    expect((await other.post(`${API}/auth/refresh`)).status).toBe(401);
    expect((await request(app).post(`${API}/auth/login`).send({ identifier: u.username, password: 'Brand-New-Pass9!' })).status).toBe(200);
  });
});

describe('token clean-up job', () => {
  it('TC-DB-25 deletes only expired, used or revoked tokens', async () => {
    const { tokenCleanup } = await import('../../src/jobs/tokenCleanup.js');
    const u = await createUser(knex);
    const mk = (id, over) => ({ id, user_id: u.id, type: 'verify_email', token_hash: sha256(id), expires_at: new Date(Date.now() + 3600e3).toISOString(), created_at: new Date().toISOString(), ...over });
    await knex('auth_tokens').insert([
      mk('valid'),
      mk('expired', { expires_at: new Date(Date.now() - 3600e3).toISOString() }),
      mk('used', { used_at: new Date().toISOString() }),
    ]);
    const rt = (id, over) => ({ id, user_id: u.id, token_hash: sha256(id), family_id: 'f', expires_at: new Date(Date.now() + 3600e3).toISOString(), created_at: new Date().toISOString(), ...over });
    await knex('refresh_tokens').insert([rt('r-valid'), rt('r-revoked', { revoked_at: new Date().toISOString() }), rt('r-expired', { expires_at: new Date(Date.now() - 3600e3).toISOString() })]);
    await tokenCleanup(knex);
    expect((await knex('auth_tokens').pluck('id')).sort()).toEqual(['valid']);
    expect((await knex('refresh_tokens').pluck('id')).sort()).toEqual(['r-valid']);
  });
});
