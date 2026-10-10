const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// The access token lives in memory only (spec 11.2). A page reload gets a new one via /auth/refresh.
let accessToken = null;
let onSessionLost = () => {};
let refreshing = null;

export const setAccessToken = (t) => {
  accessToken = t;
};
export const getAccessToken = () => accessToken;
export const setSessionLostHandler = (fn) => {
  onSessionLost = fn;
};

async function rawFetch(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
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
    throw new ApiError(res.status, e.code ?? 'INTERNAL', e.message ?? 'Something went wrong.', e.details);
  }
  return payload?.data ?? null;
}

/** Calls /auth/refresh once even if several requests fail at the same moment. */
export function refreshSession() {
  refreshing ??= rawFetch('/auth/refresh', { method: 'POST' })
    .then((data) => {
      accessToken = data.accessToken;
      return data;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Authenticated request: adds the bearer token, on 401 refreshes once and retries, then logs out. */
export async function api(path, options = {}) {
  try {
    return await rawFetch(path, { ...options, token: accessToken });
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401 || options.noRetry) throw err;
    try {
      await refreshSession();
    } catch {
      accessToken = null;
      onSessionLost();
      throw err;
    }
    return rawFetch(path, { ...options, token: accessToken });
  }
}

export const publicApi = (path, options = {}) => rawFetch(path, options);
