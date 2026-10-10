export async function up(knex) {
  await knex.schema.createTable('chat_messages', (t) => {
    t.string('id', 36).primary();
    t.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('club_id', 36).references('id').inTable('clubs');
    t.string('role', 10).notNullable().checkIn(['user', 'assistant']);
    t.text('content').notNullable();
    t.text('sources_json');
    t.string('created_at', 30).notNullable();
    t.index(['user_id', 'created_at']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('chat_messages');
}
