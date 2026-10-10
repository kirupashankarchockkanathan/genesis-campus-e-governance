import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '@ccp/shared';
import { config } from '../config/index.js';

/** IP-based limiter for sign-up and forgot-password (spec 11.2). */
export const ipRateLimit = ({ windowMs = 60 * 60 * 1000, max = config.RATE_LIMIT_MAX } = {}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        error: { code: ERROR_CODES.RATE_LIMITED, message: 'Too many requests. Please try again later.' },
      }),
  });
