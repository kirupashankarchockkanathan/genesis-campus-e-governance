// PostgreSQL only (spec 9.4): a second line of defence against double booking. The service layer
// already checks overlaps inside a transaction; this makes the database refuse any overlap even for
// direct SQL. Timestamps are ISO text, so a trigger keeps a native tstzrange column in step.
// NOTE: written to spec but not yet exercised against a live PostgreSQL (see README "Known gaps").
const isPg = (knex) => knex.client.config.client === 'pg';

export async function up(knex) {
  if (!isPg(knex)) return;
  await knex.raw('CREATE EXTENSION IF NOT EXISTS btree_gist');
  await knex.raw('ALTER TABLE hall_bookings ADD COLUMN time_range tstzrange');
  await knex.raw(`
    CREATE OR REPLACE FUNCTION hall_bookings_set_range() RETURNS trigger AS $$
    BEGIN
      NEW.time_range := tstzrange(NEW.starts_at::timestamptz, NEW.ends_at::timestamptz, '[)');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);
  await knex.raw(`
    CREATE TRIGGER hall_bookings_range_trg BEFORE INSERT OR UPDATE OF starts_at, ends_at
    ON hall_bookings FOR EACH ROW EXECUTE FUNCTION hall_bookings_set_range()
  `);
  await knex.raw(`
    ALTER TABLE hall_bookings ADD CONSTRAINT hall_bookings_no_overlap
    EXCLUDE USING gist (hall_id WITH =, time_range WITH &&)
    WHERE (status IN ('tentative', 'requested', 'confirmed'))
  `);
}

export async function down(knex) {
  if (!isPg(knex)) return;
  await knex.raw('ALTER TABLE hall_bookings DROP CONSTRAINT IF EXISTS hall_bookings_no_overlap');
  await knex.raw('DROP TRIGGER IF EXISTS hall_bookings_range_trg ON hall_bookings');
  await knex.raw('DROP FUNCTION IF EXISTS hall_bookings_set_range()');
  await knex.raw('ALTER TABLE hall_bookings DROP COLUMN IF EXISTS time_range');
}
