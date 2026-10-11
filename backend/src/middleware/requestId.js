import { newId } from '../lib/ids.js';

export function requestId(req, res, next) {
  req.id = newId();
  res.set('X-Request-Id', req.id);
  next();
}
