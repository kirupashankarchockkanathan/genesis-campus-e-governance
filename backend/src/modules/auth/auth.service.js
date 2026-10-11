import bcrypt from 'bcryptjs';
import { AUTH_TOKEN_TYPE, LIMITS, PLATFORM_ROLES, USER_STATUS } from '@gcc/shared';
import { config } from '../../config/index.js';
import { clock } from '../../lib/clock.js';
import { errors } from '../../lib/errors.js';
import { newId, randomToken, sha256 } from '../../lib/ids.js';
import { audit } from '../../lib/audit.js';
import { sendMail, verificationMail, resetMail } from '../../lib/mailer.js';
import { signAccessToken } from '../../lib/tokens.js';
import { isUniqueViolation, toDb } from '../../db/helpers.js';
import { loginLimiter } from './loginLimiter.js';
import { portalsOf } from '../gov/portal.js';

const hours = (n) => n * 3600 * 1000;
const days = (n) => n * 24 * 3600 * 1000;
const GENERIC_LOGIN_ERROR = 'Incorrect username or password.';
// Used to equalise timing when the account does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 4);

/** Public shape of a user. Never includes password_hash or token hashes (TC-AUTH-19). */
export const userDto = (u) => ({
  id: u.id,
  username: u.username,
  email: u.email,
  fullName: u.full_name,
  platformRole: u.platform_role,
  rollNumber: u.roll_number,
  department: u.department,
  yearOfStudy: u.year_of_study,
  programme: u.programme,
  phone: u.phone,
  avatarUrl: u.avatar_url,
  emailVerifiedAt: u.email_verified_at,
  mustChangePassword: Number(u.must_change_password) === 1,
  status: u.status,
});

const hashPassword = (pw) => bcrypt.hash(pw, config.BCRYPT_COST);

async function createAuthToken(db, userId, type, ttlMs) {
  const raw = randomToken();
  const now = clock.now();
  await db('auth_tokens').insert({
    id: newId(),
    user_id: userId,
    type,
    token_hash: sha256(raw),
    expires_at: toDb(new Date(now.getTime() + ttlMs)),
    created_at: toDb(now),
  });
  return raw;
}

/** Finds an unused, unexpired token and marks it used. Throws a generic validation error otherwise. */
async function consumeAuthToken(trx, raw, type) {
  const row = await trx('auth_tokens')
    .where({ token_hash: sha256(raw), type })
    .first();
  const now = clock.now();
  if (!row || row.used_at || new Date(row.expires_at) <= now) {
    throw errors.validation('This link is invalid or has expired.');
  }
  await trx('auth_tokens')
    .where({ id: row.id })
    .update({ used_at: toDb(now) });
  return row;
}

// ---------- Sign-up and verification ----------

export async function signup(db, input) {
  const domain = input.email.split('@')[1];
  if (!config.allowedEmailDomains.includes(domain)) {
    throw errors.validation('Please use your college email address.', [
      { path: 'email', message: 'Email domain is not allowed' },
    ]);
  }
  const clash = await db('users').where({ email: input.email }).orWhere({ username: input.username }).first();
  if (clash) throw errors.conflict('An account with that email or username already exists.');

  const now = clock.now();
  const id = newId();
  try {
    await db('users').insert({
      id,
      username: input.username,
      email: input.email,
      password_hash: await hashPassword(input.password),
      full_name: input.fullName,
      platform_role: PLATFORM_ROLES.STUDENT,
      roll_number: input.rollNumber,
      department: input.department,
      year_of_study: input.yearOfStudy,
      programme: input.programme ?? null,
      email_verified_at: config.AUTO_VERIFY_EMAIL ? toDb(now) : null,
      must_change_password: 0,
      status: USER_STATUS.ACTIVE,
      created_at: toDb(now),
      updated_at: toDb(now),
    });
  } catch (err) {
    if (isUniqueViolation(err))
      throw errors.conflict('An account with that email or username already exists.');
    throw err;
  }
  if (!config.AUTO_VERIFY_EMAIL) {
    const raw = await createAuthToken(db, id, AUTH_TOKEN_TYPE.VERIFY_EMAIL, hours(LIMITS.VERIFY_TOKEN_HOURS));
    await sendMail(verificationMail(input.email, raw));
  }
  return userDto(await db('users').where({ id }).first());
}

export async function verifyEmail(db, rawToken) {
  await db.transaction(async (trx) => {
    const row = await consumeAuthToken(trx, rawToken, AUTH_TOKEN_TYPE.VERIFY_EMAIL);
    await trx('users')
      .where({ id: row.user_id })
      .update({ email_verified_at: toDb(clock.now()), updated_at: toDb(clock.now()) });
  });
}

/** Always resolves the same way so callers cannot learn which emails exist. */
export async function resendVerification(db, email) {
  const user = await db('users').where({ email }).first();
  if (!user || user.email_verified_at || user.status !== USER_STATUS.ACTIVE) return;
  const raw = await createAuthToken(
    db,
    user.id,
    AUTH_TOKEN_TYPE.VERIFY_EMAIL,
    hours(LIMITS.VERIFY_TOKEN_HOURS),
  );
  await sendMail(verificationMail(user.email, raw));
}

// ---------- Sessions ----------

async function issueRefreshToken(db, userId, meta, familyId = newId()) {
  const raw = randomToken();
  const now = clock.now();
  const id = newId();
  const expiresAt = new Date(now.getTime() + days(config.REFRESH_TTL_DAYS));
  await db('refresh_tokens').insert({
    id,
    user_id: userId,
    token_hash: sha256(raw),
    family_id: familyId,
    expires_at: toDb(expiresAt),
    user_agent: (meta.userAgent ?? '').slice(0, 300) || null,
    ip: meta.ip ?? null,
    created_at: toDb(now),
  });
  return { id, raw, familyId, expiresAt };
}

export async function revokeFamily(db, familyId) {
  await db('refresh_tokens')
    .where({ family_id: familyId })
    .whereNull('revoked_at')
    .update({ revoked_at: toDb(clock.now()) });
}

export async function revokeAllSessions(db, userId) {
  await db('refresh_tokens')
    .where({ user_id: userId })
    .whereNull('revoked_at')
    .update({ revoked_at: toDb(clock.now()) });
}

export async function login(db, { identifier, password, portal }, meta = {}) {
  const key = `${identifier}|${meta.ip ?? ''}`;
  // With a portal the message names the role and is the same for a wrong password and a wrong door.
  const badLogin = portal ? 'Invalid User ID or password for the selected role.' : GENERIC_LOGIN_ERROR;
  const wait = loginLimiter.retryAfter(key);
  if (wait > 0) {
    const e = errors.rateLimited(
      `Too many failed attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`,
      { retryAfterSeconds: wait },
    );
    e.retryAfter = wait;
    throw e;
  }
  const user = await db('users').where({ email: identifier }).orWhere({ username: identifier }).first();
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) {
    const count = loginLimiter.fail(key);
    if (count >= LIMITS.LOGIN_MAX_FAILURES) {
      await audit(db, {
        actorId: user?.id ?? null,
        action: 'auth.login_locked',
        entityType: 'user',
        entityId: user?.id ?? null,
        meta: { identifier },
        ip: meta.ip,
      });
    }
    throw errors.unauthenticated(badLogin);
  }
  // Right password, wrong door (e.g. a student on the Administrator screen): same answer, and it counts as a failure.
  if (portal && !(await portalsOf(db, user)).includes(portal)) {
    loginLimiter.fail(key);
    throw errors.unauthenticated(badLogin);
  }
  if (user.status !== USER_STATUS.ACTIVE)
    throw errors.forbidden('This account has been suspended. Contact the administrators.');
  if (!user.email_verified_at)
    throw errors.forbidden('Please verify your email before logging in. Check your inbox for the link.');

  loginLimiter.clear(key);
  await db('users')
    .where({ id: user.id })
    .update({ last_login_at: toDb(clock.now()) });
  const refresh = await issueRefreshToken(db, user.id, meta);
  return { accessToken: signAccessToken(user), refresh, user: userDto(user) };
}

export async function refresh(db, rawToken, meta = {}) {
  if (!rawToken) throw errors.unauthenticated();
  const row = await db('refresh_tokens')
    .where({ token_hash: sha256(rawToken) })
    .first();
  if (!row) throw errors.unauthenticated();
  if (row.replaced_by_id) {
    // An already-rotated token is being reused: treat it as theft and revoke the whole family.
    await revokeFamily(db, row.family_id);
    await audit(db, {
      actorId: row.user_id,
      action: 'auth.refresh_reuse',
      entityType: 'user',
      entityId: row.user_id,
      ip: meta.ip,
    });
    throw errors.unauthenticated();
  }
  if (row.revoked_at || new Date(row.expires_at) <= clock.now()) throw errors.unauthenticated();
  const user = await db('users').where({ id: row.user_id }).first();
  if (!user || user.status !== USER_STATUS.ACTIVE) throw errors.unauthenticated();

  const next = await db.transaction(async (trx) => {
    const created = await issueRefreshToken(trx, user.id, meta, row.family_id);
    await trx('refresh_tokens')
      .where({ id: row.id })
      .update({ replaced_by_id: created.id, revoked_at: toDb(clock.now()) });
    return created;
  });
  return { accessToken: signAccessToken(user), refresh: next, user: userDto(user) };
}

export async function logout(db, rawToken) {
  if (!rawToken) return;
  const row = await db('refresh_tokens')
    .where({ token_hash: sha256(rawToken) })
    .first();
  if (row) await revokeFamily(db, row.family_id);
}

// ---------- Passwords ----------

export async function forgotPassword(db, email) {
  const user = await db('users').where({ email }).first();
  if (!user || user.status !== USER_STATUS.ACTIVE) return;
  const raw = await createAuthToken(
    db,
    user.id,
    AUTH_TOKEN_TYPE.RESET_PASSWORD,
    hours(LIMITS.RESET_TOKEN_HOURS),
  );
  await sendMail(resetMail(user.email, raw));
}

export async function resetPassword(db, rawToken, newPassword) {
  const hash = await hashPassword(newPassword);
  await db.transaction(async (trx) => {
    const row = await consumeAuthToken(trx, rawToken, AUTH_TOKEN_TYPE.RESET_PASSWORD);
    const now = toDb(clock.now());
    await trx('users')
      .where({ id: row.user_id })
      .update({ password_hash: hash, must_change_password: 0, updated_at: now });
    await trx('refresh_tokens')
      .where({ user_id: row.user_id })
      .whereNull('revoked_at')
      .update({ revoked_at: now });
    await audit(trx, {
      actorId: row.user_id,
      action: 'auth.password_reset',
      entityType: 'user',
      entityId: row.user_id,
    });
  });
}

/**
 * Changes the password, ends every other session and returns a fresh session for the caller
 * (the refresh cookie is path-scoped to /auth, so the current family is not known on /me routes).
 */
export async function changePassword(db, user, { currentPassword, newPassword }, meta = {}) {
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
    throw errors.validation('Your current password is incorrect.', [
      { path: 'currentPassword', message: 'Incorrect password' },
    ]);
  }
  if (newPassword.toLowerCase().includes(user.username)) {
    throw errors.validation('Password must not contain your username.', [
      { path: 'newPassword', message: 'Contains username' },
    ]);
  }
  const hash = await hashPassword(newPassword);
  await db('users')
    .where({ id: user.id })
    .update({ password_hash: hash, must_change_password: 0, updated_at: toDb(clock.now()) });
  await revokeAllSessions(db, user.id);
  await audit(db, {
    actorId: user.id,
    action: 'auth.password_changed',
    entityType: 'user',
    entityId: user.id,
    ip: meta.ip,
  });
  const fresh = await db('users').where({ id: user.id }).first();
  const refreshToken = await issueRefreshToken(db, user.id, meta);
  return { accessToken: signAccessToken(fresh), refresh: refreshToken, user: userDto(fresh) };
}
