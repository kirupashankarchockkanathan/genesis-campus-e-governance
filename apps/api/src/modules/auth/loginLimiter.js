import { LIMITS } from '@ccp/shared';
import { clock } from '../../lib/clock.js';

// Brute-force protection: 5 failed attempts per account+IP in 15 minutes (spec 11.2).
// In-memory store is fine for one API instance; move to the database/Redis when scaled out.
const failures = new Map();
const windowMs = LIMITS.LOGIN_WINDOW_MINUTES * 60 * 1000;

const recent = (key) => {
  const cutoff = clock.now().getTime() - windowMs;
  const list = (failures.get(key) ?? []).filter((t) => t > cutoff);
  failures.set(key, list);
  return list;
};

export const loginLimiter = {
  /** Returns seconds to wait, or 0 when allowed. */
  retryAfter(key) {
    const list = recent(key);
    if (list.length < LIMITS.LOGIN_MAX_FAILURES) return 0;
    return Math.max(1, Math.ceil((list[0] + windowMs - clock.now().getTime()) / 1000));
  },
  fail(key) {
    const list = recent(key);
    list.push(clock.now().getTime());
    failures.set(key, list);
    return list.length;
  },
  clear(key) {
    failures.delete(key);
  },
  reset() {
    failures.clear();
  },
};
