import { STATE_VERSION } from '@gcc/shared/gov/seed';
import { toDb } from '../../db/helpers.js';
import { clock } from '../../lib/clock.js';

// The governance state is the same plain object the workflow engine works on. It is stored as one JSON row per
// entity in gov_docs (ordered by `ord`), plus counters and the demo clock in gov_meta.

const LISTS = {
  requests: 'requests',
  promotions: 'promotions',
  clubApplications: 'clubApplications',
  newClubs: 'newClubs',
  broadcasts: 'broadcasts',
  activity: 'activity',
};
const CATALOG = { clubs: 'catalogClubs', events: 'catalogEvents', calendar: 'catalogCalendar' };
const OVERRIDES = 'clubOverrides';

const parse = (text) => JSON.parse(text);

export async function isSeeded(db) {
  return !!(await db('gov_meta').where({ key: 'clock' }).first());
}

/** Locks the single meta row so two actions never run on the same state at once (a no-op on SQLite). */
export async function lockState(trx) {
  const q = trx('gov_meta').where({ key: 'clock' });
  if (trx.client.config.client === 'pg') q.forUpdate();
  await q.first();
}

export async function loadState(db) {
  const rows = await db('gov_docs')
    .select('collection', 'id', 'ord', 'data')
    .orderBy('collection')
    .orderBy('ord');
  const by = {};
  for (const r of rows) (by[r.collection] ??= []).push({ id: r.id, data: parse(r.data) });
  const meta = Object.fromEntries((await db('gov_meta').select()).map((m) => [m.key, m.value]));
  const list = (name) => (by[name] ?? []).map((r) => r.data);
  const state = {
    version: STATE_VERSION,
    clock: meta.clock,
    counters: parse(meta.counters ?? '{}'),
    clubOverrides: Object.fromEntries((by[OVERRIDES] ?? []).map((r) => [r.id, r.data])),
    catalog: {
      clubs: list(CATALOG.clubs),
      events: list(CATALOG.events),
      calendar: list(CATALOG.calendar),
    },
  };
  for (const [key, name] of Object.entries(LISTS)) state[key] = list(name);
  return state;
}

async function syncCollection(db, collection, items, now) {
  const existing = new Map(
    (await db('gov_docs').where({ collection }).select('id', 'ord', 'data')).map((r) => [r.id, r]),
  );
  const keep = new Set();
  for (const [ord, { id, data }] of items.entries()) {
    keep.add(id);
    const json = JSON.stringify(data);
    const prev = existing.get(id);
    if (prev && prev.data === json && Number(prev.ord) === ord) continue;
    await db('gov_docs')
      .insert({ collection, id, ord, data: json, updated_at: now })
      .onConflict(['collection', 'id'])
      .merge();
  }
  const gone = [...existing.keys()].filter((id) => !keep.has(id));
  if (gone.length) await db('gov_docs').where({ collection }).whereIn('id', gone).del();
}

/** Writes only what changed. Must run inside the same transaction that loaded the state. */
export async function saveState(db, state) {
  const now = toDb(clock.now());
  const asItems = (arr) => arr.map((data) => ({ id: data.id, data }));
  for (const [key, name] of Object.entries(LISTS)) await syncCollection(db, name, asItems(state[key]), now);
  for (const [key, name] of Object.entries(CATALOG))
    await syncCollection(db, name, asItems(state.catalog[key]), now);
  await syncCollection(
    db,
    OVERRIDES,
    Object.entries(state.clubOverrides).map(([id, data]) => ({ id, data })),
    now,
  );
  await db('gov_meta').where({ key: 'clock' }).update({ value: state.clock });
  await db('gov_meta')
    .where({ key: 'counters' })
    .update({ value: JSON.stringify(state.counters) });
}

/** First start: write the sample state (db:seed). Safe to run twice. */
export async function seedState(db, seed) {
  if (await isSeeded(db)) return false;
  await db('gov_meta').insert([
    { key: 'clock', value: seed.clock },
    { key: 'counters', value: JSON.stringify(seed.counters) },
  ]);
  await saveState(db, seed);
  return true;
}
