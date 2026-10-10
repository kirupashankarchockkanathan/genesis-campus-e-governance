import { ERROR_CODES, ERROR_HTTP_STATUS } from '@ccp/shared';

export class AppError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.status = ERROR_HTTP_STATUS[code] ?? 500;
    this.details = details;
  }
}

export const errors = {
  validation: (message = 'The request is not valid.', details) =>
    new AppError(ERROR_CODES.VALIDATION_ERROR, message, details),
  unauthenticated: (message = 'Please log in to continue.') =>
    new AppError(ERROR_CODES.UNAUTHENTICATED, message),
  forbidden: (message = 'You do not have permission to do this.', details) =>
    new AppError(ERROR_CODES.FORBIDDEN, message, details),
  notFound: (message = 'We could not find that.') => new AppError(ERROR_CODES.NOT_FOUND, message),
  conflict: (message = 'That already exists.', details) =>
    new AppError(ERROR_CODES.CONFLICT, message, details),
  invalidState: (message = 'That is not allowed in the current state.') =>
    new AppError(ERROR_CODES.INVALID_STATE, message),
  rateLimited: (message = 'Too many attempts. Please try again later.', details) =>
    new AppError(ERROR_CODES.RATE_LIMITED, message, details),
};
