import { FORM_STATUS_LIST, REGISTRATION_STATUS_LIST } from '@ccp/shared';

export async function up(knex) {
  await knex.schema.createTable('forms', (t) => {
    t.string('id', 36).primary();
    t.string('club_id', 36).notNullable().references('id').inTable('clubs').onDelete('RESTRICT');
    t.string('event_id', 36).references('id').inTable('events').onDelete('CASCADE').unique();
    // recruitment_id gets its foreign key in the Phase 2 recruitment migration.
    t.string('recruitment_id', 36).unique();
    t.string('purpose', 20).notNullable().checkIn(['event_registration', 'recruitment']);
    t.string('title', 200).notNullable();
    t.text('description');
    t.text('fields_json').notNullable();
    t.string('status', 12).notNullable().defaultTo('draft').checkIn(FORM_STATUS_LIST);
    t.string('opens_at', 30);
    t.string('closes_at', 30);
    t.string('published_at', 30);
    t.string('created_by', 36).references('id').inTable('users');
    t.string('created_at', 30).notNullable();
    t.string('updated_at', 30).notNullable();
    // Exactly one of event_id / recruitment_id is set (TC-DB-18).
    t.check(
      '(?? IS NOT NULL AND ?? IS NULL) OR (?? IS NULL AND ?? IS NOT NULL)',
      ['event_id', 'recruitment_id', 'event_id', 'recruitment_id'],
      'forms_exactly_one_owner',
    );
  });

  await knex.schema.createTable('form_responses', (t) => {
    t.string('id', 36).primary();
    t.string('form_id', 36).notNullable().references('id').inTable('forms').onDelete('CASCADE');
    t.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.text('answers_json').notNullable();
    t.string('submitted_at', 30).notNullable();
    t.unique(['form_id', 'user_id']);
  });

  await knex.schema.createTable('registrations', (t) => {
    t.string('id', 36).primary();
    t.string('event_id', 36).notNullable().references('id').inTable('events').onDelete('CASCADE');
    t.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.string('form_response_id', 36).references('id').inTable('form_responses');
    t.string('status', 12).notNullable().defaultTo('registered').checkIn(REGISTRATION_STATUS_LIST);
    t.string('qr_token', 64).notNullable().unique();
    t.string('checked_in_at', 30);
    t.string('checked_in_by', 36).references('id').inTable('users');
    t.string('cancelled_at', 30);
    t.string('created_at', 30).notNullable();
    t.string('updated_at', 30).notNullable();
    t.unique(['event_id', 'user_id']);
    t.index(['event_id']);
    t.index(['user_id']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('registrations');
  await knex.schema.dropTableIfExists('form_responses');
  await knex.schema.dropTableIfExists('forms');
}
