// Cross-database helpers (spec 7.2). Timestamps are stored as UTC ISO-8601 text on both
// SQLite and PostgreSQL so a round trip returns an identical value (TC-DB-13).
export const toDb = (value) => {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return d.toISOString();
};
export const fromDb = (value) => {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

// SQLite stores booleans as 0/1, PostgreSQL as true/false.
export const boolToDb = (v) => (v ? 1 : 0);
export const boolFromDb = (v) => v === true || v === 1 || v === '1' || v === 't';

// JSON is stored as text in *_json columns and parsed here (no PG JSON operators).
export const jsonToDb = (v) => (v === undefined || v === null ? null : JSON.stringify(v));
export const jsonFromDb = (v, fallback = null) => {
  if (v === null || v === undefined || v === '') return fallback;
  return typeof v === 'string' ? JSON.parse(v) : v;
};

export const isUniqueViolation = (err) =>
  err?.code === '23505' ||
  /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|SQLITE_CONSTRAINT_PRIMARYKEY/.test(err?.message ?? '');
