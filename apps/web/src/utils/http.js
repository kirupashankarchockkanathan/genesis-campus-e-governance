// Talks to the portal API (/api/v1). The access token lives in memory only; a page reload gets a new one from the
// httpOnly refresh cookie through /auth/refresh. Every portal call carries the portal the person signed in to.
const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let accessToken = null;
let portal = null;
let onSessionLost = () => {};
let refreshing = null;

export const setAccessToken = (t) => {
  accessToken = t;
};
export const getAccessToken = () => accessToken;
export const setPortal = (p) => {
  portal = p;
};
export const setSessionLostHandler = (fn) => {
  onSessionLost = fn;
};

async function rawFetch(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (portal) headers['X-Portal'] = portal;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const e = payload?.error ?? {};
    throw new ApiError(
      res.status,
      e.code ?? 'INTERNAL',
      e.message ?? 'Something went wrong. Please try again.',
      e.details,
    );
  }
  return payload;
}

/** Calls /auth/refresh once even if several requests fail at the same moment. */
export function refreshSession() {
  refreshing ??= rawFetch('/auth/refresh', { method: 'POST' })
    .then((res) => {
      accessToken = res.data.accessToken;
      return res.data;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Authenticated request returning `data`: adds the bearer token; on 401 refreshes once and retries, then signs out. */
export async function api(path, options = {}) {
  try {
    return (await rawFetch(path, { ...options, token: accessToken }))?.data ?? null;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401 || options.noRetry) throw err;
    try {
      await refreshSession();
    } catch {
      accessToken = null;
      onSessionLost();
      throw err;
    }
    return (await rawFetch(path, { ...options, token: accessToken }))?.data ?? null;
  }
}

export const publicApi = async (path, options = {}) => (await rawFetch(path, options))?.data ?? null;
