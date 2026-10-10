export async function up(knex) {
  await knex.schema.createTable('refresh_tokens', (t) => {
    t.string('id', 36).primary();
    t.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('token_hash', 64).notNullable().index();
    t.string('family_id', 36).notNullable().index();
    t.string('expires_at', 30).notNullable();
    t.string('revoked_at', 30);
    t.string('replaced_by_id', 36);
    t.string('user_agent', 300);
    t.string('ip', 64);
    t.string('created_at', 30).notNullable();
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('refresh_tokens');
}
