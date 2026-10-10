import { ZodError } from 'zod';
import { ERROR_CODES } from '@ccp/shared';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function notFoundHandler(req, _res, next) {
  next(new AppError(ERROR_CODES.NOT_FOUND, 'Route not found.'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let e = err;
  if (err instanceof ZodError) {
    e = new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      'The request is not valid.',
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  } else if (err?.type === 'entity.too.large') {
    e = new AppError(ERROR_CODES.PAYLOAD_TOO_LARGE, 'The request is too large.');
  } else if (err?.type === 'entity.parse.failed') {
    e = new AppError(ERROR_CODES.VALIDATION_ERROR, 'The request body is not valid JSON.');
  } else if (!(err instanceof AppError)) {
    logger.error({ err, requestId: req.id }, 'unhandled error');
    e = new AppError(ERROR_CODES.INTERNAL, 'Something went wrong on our side.');
  }
  if (e.retryAfter) res.set('Retry-After', String(e.retryAfter));
  res.status(e.status).json({
    error: { code: e.code, message: e.message, ...(e.details === undefined ? {} : { details: e.details }) },
  });
}
