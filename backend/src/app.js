import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { getDb } from './db/knex.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { aiRouter, filesRouter, govRouter } from './modules/gov/gov.routes.js';

/**
 * Builds the Express app (used by server.js and by tests).
 * `extraRoutes(router)` lets tests mount probe routes under /api/v1.
 */
export function createApp({ db = getDb(), extraRoutes, llm } = {}) {
  const app = express();
  app.locals.db = db;
  if (llm !== undefined) app.locals.llm = llm; // tests inject a mocked model client
  app.disable('x-powered-by');
  app.set('trust proxy', config.isProd ? 1 : false);
  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.webOrigins.includes(origin)),
      credentials: true,
    }),
  );
  // Event requests carry a poster image as a data URL, so the governance routes accept a larger body.
  app.use('/api/v1/gov', express.json({ limit: '2mb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.get('/health', async (_req, res) => {
    try {
      await db.raw('select 1');
      res.json({ data: { status: 'ok', database: 'up' } });
    } catch {
      res.status(503).json({ data: { status: 'degraded', database: 'down' } });
    }
  });
  api.use('/auth', authRouter);
  api.use('/', usersRouter);
  api.use('/gov', govRouter);
  api.use('/ai', aiRouter);
  api.use('/files', filesRouter);
  if (extraRoutes) extraRoutes(api);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
