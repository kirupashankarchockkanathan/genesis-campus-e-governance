import {
  ACTIONS,
  CLUB_APP_DOCS,
  REQUEST_DOCS,
  duplicateSummary,
  localDuplicateCheck,
  selectors,
  workflow,
} from '@ccp/shared/gov';
import { errors } from '../../lib/errors.js';
import { saveUpload } from '../../lib/storage.js';
import { loadState, lockState, saveState } from './state.js';
import { portalUser } from './portal.js';
import { viewFor } from './views.js';

const DOC_KEYS = new Set([...REQUEST_DOCS, ...CLUB_APP_DOCS].map((d) => d.key));
const MAX_TEXT = 6000;

/** Seats taken through the portal, per event id. */
export async function registrationCounts(db) {
  const rows = await db('gov_registrations')
    .where({ status: 'confirmed' })
    .select('event_id')
    .count({ n: '*' })
    .groupBy('event_id');
  return Object.fromEntries(rows.map((r) => [r.event_id, Number(r.n)]));
}

/** The state a given portal may see, with live seat counts. */
export async function buildView(db, state, portal, actor) {
  const full = { ...state, registrationCounts: await registrationCounts(db) };
  return viewFor(full, portal, { clubId: actor?.clubId });
}

export async function getView(db, user, portal) {
  const actor = await portalUser(db, user, portal);
  return buildView(db, await loadState(db), portal, actor);
}

// ---------- Input hygiene: the engine validates meaning; this bounds size and shape ----------

function bounded(value, depth = 0) {
  if (depth > 6) throw errors.validation('That request is too deeply nested.');
  if (typeof value === 'string') {
    if (value.length > MAX_TEXT) throw errors.validation('A text value is too long.');
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 60) throw errors.validation('A list is too long.');
    return value.map((v) => bounded(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length > 60) throw errors.validation('An object has too many fields.');
    return Object.fromEntries(keys.map((k) => [k, bounded(value[k], depth + 1)]));
  }
  return value;
}

const fileMeta = (f) =>
  f && typeof f === 'object'
    ? {
        name: String(f.name ?? 'file').slice(0, 200),
        size: Math.max(0, Math.min(Number(f.size) || 0, 50 * 1024 * 1024)),
        uploadedAt: typeof f.uploadedAt === 'string' ? f.uploadedAt.slice(0, 40) : undefined,
      }
    : null;

const cleanDocuments = (docs) =>
  Object.fromEntries(
    Object.entries(docs && typeof docs === 'object' ? docs : {})
      .filter(([k]) => DOC_KEYS.has(k))
      .map(([k, v]) => [k, fileMeta(v)]),
  );

const STORED = /^\/uploads\/[A-Za-z0-9_-]+\.(png|jpg|webp)$/;
const DATA_URL = /^data:image\/(?:png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/;

/** A poster arrives as a data URL from the form; it is stored as a real file and the URL is kept. */
async function storePoster(poster) {
  if (!poster) return null;
  const meta = fileMeta(poster);
  let dataUrl = null;
  if (typeof poster.dataUrl === 'string' && poster.dataUrl) {
    if (STORED.test(poster.dataUrl)) dataUrl = poster.dataUrl;
    else {
      const m = DATA_URL.exec(poster.dataUrl);
      if (!m) throw errors.validation('The poster must be a PNG, JPG or WebP image.');
      dataUrl = await saveUpload(Buffer.from(m[1], 'base64'), { imagesOnly: true });
    }
  }
  return { ...meta, dataUrl };
}

async function prepareArgs(name, rawArgs) {
  if (!Array.isArray(rawArgs) || rawArgs.length > 4)
    throw errors.validation('The action arguments are not valid.');
  // The poster is handled before the size check because a data URL is legitimately large.
  const args = rawArgs.map((a) => a);
  if (name === 'saveRequest' && args[0] && typeof args[0] === 'object') {
    const { poster, documents, ...rest } = args[0];
    args[0] = { ...bounded(rest), poster: await storePoster(poster), documents: cleanDocuments(documents) };
    args[1] = bounded(args[1] ?? {});
    return args;
  }
  if (name === 'createClubApplication' && args[0] && typeof args[0] === 'object') {
    const { documents, ...rest } = args[0];
    args[0] = { ...bounded(rest), documents: cleanDocuments(documents) };
    return args;
  }
  return args.map((a) => bounded(a));
}

/** The duplicate-club check is computed here from the stored clubs; whatever the browser sent is ignored. */
function duplicateCheckFor(state, applicationId) {
  const application = state.clubApplications.find((a) => a.id === applicationId);
  if (!application) return { matches: [], summary: '', source: 'local-mock' };
  const objectivesOf = (c) => (selectors.clubProfile(state, c.id).objectives ?? []).join(' ');
  const matches = localDuplicateCheck(application, selectors.allClubs(state), objectivesOf);
  return {
    source: 'local-mock',
    ranAt: new Date().toISOString(),
    matches,
    summary: duplicateSummary(matches),
  };
}

/**
 * Runs one workflow action as the signed-in person, on the stored state, inside a transaction.
 * The engine's own permission checks apply; the portal check here only stops obviously wrong callers early.
 */
export async function runAction(db, user, portal, name, rawArgs) {
  const allowed = Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : null;
  if (!allowed) throw errors.notFound('Unknown action.');
  const actor = await portalUser(db, user, portal);
  if (!allowed.includes(portal)) throw errors.forbidden('Your role is not permitted to do this.');
  const args = await prepareArgs(name, rawArgs);

  return db.transaction(async (trx) => {
    await lockState(trx);
    const state = await loadState(trx);
    const callArgs = name === 'saveAiCheck' ? [args[0], duplicateCheckFor(state, args[0])] : args;
    const result = workflow[name](state, actor, ...callArgs);
    if (result.ok) await saveState(trx, result.state);
    const { ok, error, state: next, ...extra } = result;
    return {
      ok,
      error: ok ? undefined : error,
      extra,
      state: await buildView(trx, ok ? next : state, portal, actor),
    };
  });
}
