import { Router } from 'express';
import {
  emailOnlySchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
} from '@gcc/shared';
import { config } from '../../config/index.js';
import { getDb } from '../../db/knex.js';
import { validate } from '../../middleware/validate.js';
import { ipRateLimit } from '../../middleware/rateLimit.js';
import * as auth from './auth.service.js';

export const REFRESH_COOKIE = 'refresh_token';

export function setRefreshCookie(res, refresh) {
  res.cookie(REFRESH_COOKIE, refresh.raw, {
    httpOnly: true,
    secure: config.isProd || config.cookieSameSite === 'none',
    sameSite: config.cookieSameSite,
    path: '/api/v1/auth',
    expires: refresh.expiresAt,
  });
}
export const clearRefreshCookie = (res) =>
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: config.isProd || config.cookieSameSite === 'none',
    sameSite: config.cookieSameSite,
    path: '/api/v1/auth',
  });

const meta = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const db = (req) => req.app.locals.db ?? getDb();

export const authRouter = Router();
const limited = ipRateLimit();

authRouter.post(
  '/signup',
  limited,
  validate({ body: signupSchema }),
  wrap(async (req, res) => {
    const user = await auth.signup(db(req), req.body);
    res.status(201).json({ data: { user, verificationRequired: !config.AUTO_VERIFY_EMAIL } });
  }),
);

authRouter.post(
  '/verify-email',
  validate({ body: verifyEmailSchema }),
  wrap(async (req, res) => {
    await auth.verifyEmail(db(req), req.body.token);
    res.json({ data: { verified: true } });
  }),
);

authRouter.post(
  '/resend-verification',
  limited,
  validate({ body: emailOnlySchema }),
  wrap(async (req, res) => {
    await auth.resendVerification(db(req), req.body.email);
    res.json({ data: { message: 'If that account needs verification, a new link has been sent.' } });
  }),
);

authRouter.post(
  '/login',
  validate({ body: loginSchema }),
  wrap(async (req, res) => {
    const result = await auth.login(db(req), req.body, meta(req));
    setRefreshCookie(res, result.refresh);
    res.json({ data: { accessToken: result.accessToken, user: result.user } });
  }),
);

authRouter.post(
  '/refresh',
  wrap(async (req, res) => {
    try {
      const result = await auth.refresh(db(req), req.cookies?.[REFRESH_COOKIE], meta(req));
      setRefreshCookie(res, result.refresh);
      res.json({ data: { accessToken: result.accessToken, user: result.user } });
    } catch (err) {
      clearRefreshCookie(res);
      throw err;
    }
  }),
);

// Works from the refresh cookie alone so an expired access token cannot trap a session open.
authRouter.post(
  '/logout',
  wrap(async (req, res) => {
    await auth.logout(db(req), req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res);
    res.json({ data: { loggedOut: true } });
  }),
);

authRouter.post(
  '/forgot-password',
  limited,
  validate({ body: emailOnlySchema }),
  wrap(async (req, res) => {
    await auth.forgotPassword(db(req), req.body.email);
    res.json({ data: { message: 'If that email is registered, a reset link has been sent.' } });
  }),
);

authRouter.post(
  '/reset-password',
  validate({ body: resetPasswordSchema }),
  wrap(async (req, res) => {
    await auth.resetPassword(db(req), req.body.token, req.body.password);
    res.json({ data: { reset: true } });
  }),
);
