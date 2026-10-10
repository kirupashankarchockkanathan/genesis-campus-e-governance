// Event-request governance (club -> Events Section / OSA -> publish) and the student portal state.
// Entities are stored as JSON text documents so the same migration runs on SQLite and PostgreSQL;
// the columns the API filters or locks on (collection, id, club, user, event) are real columns.
export async function up(knex) {
  // One row per entity (request, promotion, club application, ...). `ord` keeps the list order.
  await knex.schema.createTable('gov_docs', (t) => {
    t.string('collection', 30).notNullable();
    t.string('id', 64).notNullable();
    t.integer('ord').notNullable().defaultTo(0);
    t.text('data').notNullable();
    t.string('updated_at', 30).notNullable();
    t.primary(['collection', 'id']);
    t.index(['collection', 'ord']);
  });

  // Counters, the demo clock and a row to lock while an action runs.
  await knex.schema.createTable('gov_meta', (t) => {
    t.string('key', 40).primary();
    t.text('value').notNullable();
  });

  // Which club a Club Authority account speaks for.
  await knex.schema.createTable('gov_club_authorities', (t) => {
    t.string('user_id', 36).primary().references('id').inTable('users').onDelete('CASCADE');
    t.string('club_id', 64).notNullable();
    t.index(['club_id']);
  });

  // Student registrations: the database is the source of truth for seats taken.
  await knex.schema.createTable('gov_registrations', (t) => {
    t.string('event_id', 64).notNullable();
    t.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('ref', 40).notNullable();
    t.string('status', 12).notNullable().defaultTo('confirmed').checkIn(['confirmed', 'cancelled']);
    t.string('registered_on', 10).notNullable();
    t.string('created_at', 30).notNullable();
    t.primary(['event_id', 'user_id']);
    t.index(['event_id', 'status']);
  });

  // Favourites, bookmarks, notifications, preferences and past-event history of one student.
  await knex.schema.createTable('gov_user_state', (t) => {
    t.string('user_id', 36).primary().references('id').inTable('users').onDelete('CASCADE');
    t.text('data').notNullable();
    t.string('updated_at', 30).notNullable();
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('gov_user_state');
  await knex.schema.dropTableIfExists('gov_registrations');
  await knex.schema.dropTableIfExists('gov_club_authorities');
  await knex.schema.dropTableIfExists('gov_meta');
  await knex.schema.dropTableIfExists('gov_docs');
}
