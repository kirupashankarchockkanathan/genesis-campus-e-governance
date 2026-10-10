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

/** One network call. `formData` sends multipart; `blob` returns the raw body (CSV export). */
async function rawFetch(path, { method = 'GET', body, formData, token, blob = false } = {}) {
  const headers = { Accept: blob ? '*/*' : 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
    credentials: 'include',
  });
  if (res.ok && blob) return res.blob();
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
  return payload; // { data, meta? }
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

async function authed(path, options) {
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

/** Authenticated request returning `data`: adds the bearer token, on 401 refreshes once and retries, then logs out. */
export async function api(path, options = {}) {
  return (await authed(path, options))?.data ?? null;
}

/** Same as `api` but also returns `meta` (pagination). */
export const apiWithMeta = (path, options = {}) => authed(path, options);

/** Multipart upload, e.g. a poster. */
export const apiUpload = (path, formData) => api(path, { method: 'POST', formData });

/** Download a file (CSV export) with the bearer token. */
export const apiBlob = (path) => authed(path, { blob: true });

export const publicApi = async (path, options = {}) => (await rawFetch(path, options))?.data ?? null;
