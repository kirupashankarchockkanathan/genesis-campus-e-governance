import pino from 'pino';
import { config } from '../config/index.js';

// NFR-04: never log passwords, tokens or answers.
export const logger = pino({
  level: config.NODE_ENV === 'test' ? 'silent' : config.LOG_LEVEL,
  redact: {
    paths: [
      'password',
      'newPassword',
      'currentPassword',
      'token',
      '*.password',
      '*.token',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[redacted]',
  },
});
