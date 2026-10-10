import { EVENT_MODES, EVENT_STATUS_LIST, EVENT_TYPES } from '@ccp/shared';

export async function up(knex) {
  await knex.schema.createTable('events', (t) => {
    t.string('id', 36).primary();
    t.string('club_id', 36).notNullable().references('id').inTable('clubs').onDelete('RESTRICT');
    t.string('title', 200).notNullable();
    t.string('type', 30).notNullable().checkIn(EVENT_TYPES);
    t.text('summary');
    t.text('description');
    t.text('objectives');
    t.text('agenda_json');
    t.string('faculty_coordinator', 120);
    t.string('mode', 10).notNullable().checkIn(EVENT_MODES);
    t.string('online_link', 500);
    t.string('starts_at', 30).notNullable();
    t.string('ends_at', 30).notNullable();
    t.string('registration_deadline', 30).notNullable();
    t.integer('expected_participants').notNullable();
    t.integer('max_seats');
    t.string('poster_url', 500);
    t.string('status', 20).notNullable().defaultTo('draft').checkIn(EVENT_STATUS_LIST);
    t.string('submitted_by', 36).references('id').inTable('users');
    t.string('submitted_at', 30);
    t.string('circulated_at', 30);
    t.string('hall_id', 36).references('id').inTable('halls');
    t.text('cancelled_reason');
    t.string('created_by', 36).references('id').inTable('users');
    t.string('created_at', 30).notNullable();
    t.string('updated_at', 30).notNullable();
    t.check('?? > ??', ['ends_at', 'starts_at'], 'events_end_after_start');
    t.check('?? <= ??', ['registration_deadline', 'starts_at'], 'events_deadline_before_start');
    t.check('?? >= 1', ['expected_participants'], 'events_expected_positive');
    t.index(['status', 'starts_at']);
    t.index(['club_id', 'starts_at']);
  });

  await knex.schema.createTable('event_reviews', (t) => {
    t.string('id', 36).primary();
    t.string('event_id', 36).notNullable().references('id').inTable('events').onDelete('CASCADE');
    t.string('reviewer_id', 36).notNullable().references('id').inTable('users');
    t.string('decision', 20).notNullable().checkIn(['approved', 'rejected', 'changes_requested']);
    t.text('note');
    t.string('created_at', 30).notNullable();
    t.index(['event_id']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('event_reviews');
  await knex.schema.dropTableIfExists('events');
}
