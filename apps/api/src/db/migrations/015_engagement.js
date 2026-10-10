import { APPLICATION_STATUS_LIST, RECRUITMENT_STATUS_LIST } from '@ccp/shared';

// Phase 2: recruitment, discussions, waitlist switch.
export async function up(knex) {
  await knex.schema.createTable('recruitments', (t) => {
    t.string('id', 36).primary();
    t.string('club_id', 36).notNullable().references('id').inTable('clubs').onDelete('RESTRICT');
    t.string('title', 200).notNullable();
    t.text('description');
    t.string('deadline', 30).notNullable();
    t.string('status', 10).notNullable().defaultTo('draft').checkIn(RECRUITMENT_STATUS_LIST);
    t.boolean('auto_accept').notNullable().defaultTo(false);
    t.string('created_by', 36).references('id').inTable('users');
    t.string('created_at', 30).notNullable();
    t.string('updated_at', 30).notNullable();
    t.index(['club_id', 'status']);
  });

  await knex.schema.createTable('recruitment_positions', (t) => {
    t.string('id', 36).primary();
    t.string('recruitment_id', 36).notNullable().references('id').inTable('recruitments').onDelete('CASCADE');
    t.string('title', 200).notNullable();
    t.text('description');
    t.integer('openings').notNullable().defaultTo(1);
    t.check('?? >= 1', ['openings'], 'positions_openings_positive');
  });

  await knex.schema.createTable('applications', (t) => {
    t.string('id', 36).primary();
    t.string('recruitment_id', 36).notNullable().references('id').inTable('recruitments').onDelete('CASCADE');
    t.string('position_id', 36).references('id').inTable('recruitment_positions');
    t.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.string('form_response_id', 36).references('id').inTable('form_responses');
    t.string('status', 12).notNullable().defaultTo('submitted').checkIn(APPLICATION_STATUS_LIST);
    t.string('reviewed_by', 36).references('id').inTable('users');
    t.string('reviewed_at', 30);
    t.text('note');
    t.string('created_at', 30).notNullable();
    t.string('updated_at', 30).notNullable();
    t.unique(['recruitment_id', 'user_id']);
    t.index(['user_id']);
  });

  await knex.schema.createTable('discussions', (t) => {
    t.string('id', 36).primary();
    t.string('club_id', 36).notNullable().references('id').inTable('clubs').onDelete('RESTRICT');
    t.string('scope', 10).notNullable().checkIn(['internal', 'public']);
    t.string('title', 200).notNullable();
    t.string('created_by', 36).references('id').inTable('users');
    t.string('created_at', 30).notNullable();
    t.string('updated_at', 30).notNullable();
    t.unique(['club_id', 'scope']);
  });

  await knex.schema.createTable('discussion_messages', (t) => {
    t.string('id', 36).primary();
    t.string('discussion_id', 36).notNullable().references('id').inTable('discussions').onDelete('CASCADE');
    t.string('user_id', 36).notNullable().references('id').inTable('users');
    t.text('body').notNullable();
    t.string('deleted_at', 30);
    t.string('deleted_by', 36).references('id').inTable('users');
    t.integer('reported_count').notNullable().defaultTo(0);
    t.string('created_at', 30).notNullable();
    t.index(['discussion_id', 'created_at']);
  });

  // One report per user and message, so a single user cannot inflate reported_count.
  await knex.schema.createTable('message_reports', (t) => {
    t.string('message_id', 36)
      .notNullable()
      .references('id')
      .inTable('discussion_messages')
      .onDelete('CASCADE');
    t.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('reason', 300);
    t.string('created_at', 30).notNullable();
    t.primary(['message_id', 'user_id']);
  });

  // Waitlist is switched on per registration form (FR-REG-03, Phase 2).
  await knex.schema.alterTable('forms', (t) => {
    t.boolean('waitlist_enabled').notNullable().defaultTo(false);
  });
}

export async function down(knex) {
  await knex.schema.alterTable('forms', (t) => {
    t.dropColumn('waitlist_enabled');
  });
  await knex.schema.dropTableIfExists('message_reports');
  await knex.schema.dropTableIfExists('discussion_messages');
  await knex.schema.dropTableIfExists('discussions');
  await knex.schema.dropTableIfExists('applications');
  await knex.schema.dropTableIfExists('recruitment_positions');
  await knex.schema.dropTableIfExists('recruitments');
}
