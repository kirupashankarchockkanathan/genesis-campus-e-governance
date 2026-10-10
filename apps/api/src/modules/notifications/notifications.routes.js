import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { notificationPrefsSchema } from '@ccp/shared';
import { config } from '../../config/index.js';
import { getDb } from '../../db/knex.js';
import { errors } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { subscribe } from './hub.js';
import * as svc from './notifications.service.js';

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const db = (req) => req.app.locals.db ?? getDb();

export const notificationsRouter = Router();

// Stream tokens are short-lived and single use because EventSource cannot send an Authorization header.
const usedStreamTokens = new Map();
const STREAM_TTL_SECONDS = 60;

export const _resetStreamTokens = () => usedStreamTokens.clear();

notificationsRouter.get(
  '/notifications/stream',
  wrap(async (req, res) => {
    let payload;
    try {
      payload = jwt.verify(String(req.query.token ?? ''), config.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      throw errors.unauthenticated('The stream token is invalid or has expired.');
    }
    if (payload.purpose !== 'stream' || usedStreamTokens.has(payload.jti)) {
      throw errors.unauthenticated('The stream token is invalid or has expired.');
    }
    usedStreamTokens.set(payload.jti, Date.now());
    for (const [k, t] of usedStreamTokens) if (Date.now() - t > 5 * 60 * 1000) usedStreamTokens.delete(k);

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    res.flushHeaders();
    res.write(': connected\n\n');
    const send = (n) => res.write(`event: notification\ndata: ${JSON.stringify(n)}\n\n`);
    const unsubscribe = subscribe(payload.sub, send);
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }),
);

const auth = requireAuth();

notificationsRouter.post(
  '/notifications/stream-token',
  auth,
  wrap(async (req, res) => {
    const token = jwt.sign({ sub: req.user.id, purpose: 'stream', jti: newId() }, config.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: STREAM_TTL_SECONDS,
    });
    res.json({ data: { token, expiresInSeconds: STREAM_TTL_SECONDS } });
  }),
);

notificationsRouter.get(
  '/notifications',
  auth,
  wrap(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const result = await svc.listNotifications(db(req), req.user.id, { page });
    res.json({ data: result.items, meta: result.meta });
  }),
);
notificationsRouter.get(
  '/notifications/unread-count',
  auth,
  wrap(async (req, res) => res.json({ data: { count: await svc.unreadCount(db(req), req.user.id) } })),
);
notificationsRouter.post(
  '/notifications/read-all',
  auth,
  wrap(async (req, res) => {
    await svc.markAllRead(db(req), req.user.id);
    res.json({ data: { ok: true } });
  }),
);
notificationsRouter.post(
  '/notifications/:id/read',
  auth,
  wrap(async (req, res) => {
    await svc.markRead(db(req), req.user.id, req.params.id);
    res.json({ data: { ok: true } });
  }),
);

notificationsRouter.get(
  '/me/notification-preferences',
  auth,
  wrap(async (req, res) => res.json({ data: await svc.getPreferences(db(req), req.user.id) })),
);
notificationsRouter.put(
  '/me/notification-preferences',
  auth,
  validate({ body: notificationPrefsSchema }),
  wrap(async (req, res) =>
    res.json({ data: await svc.setPreferences(db(req), req.user.id, req.body.preferences) }),
  ),
);
