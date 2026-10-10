import { NOTIFICATION_CATEGORIES } from '@ccp/shared';

export async function up(knex) {
  await knex.schema.createTable('notifications', (t) => {
    t.string('id', 36).primary();
    t.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('category', 20).notNullable().checkIn(NOTIFICATION_CATEGORIES);
    t.string('type', 40).notNullable();
    t.string('title', 200).notNullable();
    t.text('body');
    t.text('data_json');
    t.string('dedupe_key', 120);
    t.string('read_at', 30);
    t.string('created_at', 30).notNullable();
    // Rows with a NULL dedupe_key are unaffected (TC-DB-23).
    t.unique(['user_id', 'dedupe_key']);
    t.index(['user_id', 'read_at', 'created_at']);
  });

  await knex.schema.createTable('notification_preferences', (t) => {
    t.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('category', 20).notNullable().checkIn(NOTIFICATION_CATEGORIES);
    t.boolean('in_app').notNullable().defaultTo(true);
    t.boolean('email').notNullable().defaultTo(false);
    t.primary(['user_id', 'category']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('notification_preferences');
  await knex.schema.dropTableIfExists('notifications');
}
