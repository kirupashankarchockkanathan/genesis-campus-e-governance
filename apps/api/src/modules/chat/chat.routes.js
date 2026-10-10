import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/knex.js';
import { getLlm } from '../../lib/llm.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { MAX_MESSAGE_LENGTH, answerQuestion, history } from './chat.service.js';

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const db = (req) => req.app.locals.db ?? getDb();
const auth = requireAuth();

const chatSchema = z.object({
  message: z.string().trim().min(1, 'Ask a question').max(MAX_MESSAGE_LENGTH, 'That question is too long'),
  clubId: z.string().min(1).max(100).optional(),
});

export const chatRouter = Router();

// `app.locals.llm` lets tests inject a mocked model client; null means "answer from portal data only".
const llmFor = (req) => (req.app.locals.llm !== undefined ? req.app.locals.llm : getLlm());

chatRouter.post(
  '/chat',
  auth,
  validate({ body: chatSchema }),
  wrap(async (req, res) => {
    const result = await answerQuestion(db(req), req.user, req.body, { llm: llmFor(req) });
    res.json({ data: result });
  }),
);
chatRouter.get(
  '/chat/history',
  auth,
  wrap(async (req, res) =>
    res.json({
      data: await history(db(req), req.user.id, {
        clubId: req.query.clubId ? String(req.query.clubId) : undefined,
      }),
    }),
  ),
);
