import { CLUB_STATUS_LIST } from '@ccp/shared';

export async function up(knex) {
  await knex.schema.createTable('clubs', (t) => {
    t.string('id', 36).primary();
    t.string('slug', 120).notNullable().unique();
    t.string('name', 120).notNullable().unique();
    t.string('category', 60).notNullable();
    t.string('tagline', 200);
    t.text('description');
    t.text('why_join');
    t.text('aim');
    t.string('faculty_coordinator', 120);
    t.integer('founded_year');
    t.text('meeting_info');
    t.string('contact_email', 254);
    t.string('logo_url', 500);
    t.string('cover_url', 500);
    t.boolean('public_discussion_enabled').notNullable().defaultTo(true);
    t.string('status', 12).notNullable().defaultTo('active').checkIn(CLUB_STATUS_LIST);
    t.string('created_by', 36).references('id').inTable('users');
    t.string('created_at', 30).notNullable();
    t.string('updated_at', 30).notNullable();
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('clubs');
}
