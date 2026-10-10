export async function up(knex) {
  await knex.schema.createTable('club_works', (t) => {
    t.string('id', 36).primary();
    t.string('club_id', 36).notNullable().references('id').inTable('clubs').onDelete('RESTRICT');
    t.string('title', 200).notNullable();
    t.text('description');
    t.string('link_url', 500);
    t.string('image_url', 500);
    t.string('happened_on', 10);
    t.string('created_by', 36).references('id').inTable('users');
    t.string('created_at', 30).notNullable();
    t.string('updated_at', 30).notNullable();
    t.index(['club_id']);
  });

  await knex.schema.createTable('announcements', (t) => {
    t.string('id', 36).primary();
    t.string('club_id', 36).notNullable().references('id').inTable('clubs').onDelete('RESTRICT');
    t.string('author_id', 36).notNullable().references('id').inTable('users');
    t.string('title', 200).notNullable();
    t.text('body').notNullable();
    t.string('image_url', 500);
    t.boolean('is_pinned').notNullable().defaultTo(false);
    t.string('deleted_at', 30);
    t.string('created_at', 30).notNullable();
    t.string('updated_at', 30).notNullable();
    t.index(['club_id', 'created_at']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('announcements');
  await knex.schema.dropTableIfExists('club_works');
}
