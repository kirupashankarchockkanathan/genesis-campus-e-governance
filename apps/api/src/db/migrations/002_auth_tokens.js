import { AUTH_TOKEN_TYPE_LIST } from '@ccp/shared';

export async function up(knex) {
  await knex.schema.createTable('auth_tokens', (t) => {
    t.string('id', 36).primary();
    t.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('type', 20).notNullable().checkIn(AUTH_TOKEN_TYPE_LIST);
    t.string('token_hash', 64).notNullable().index();
    t.string('expires_at', 30).notNullable();
    t.string('used_at', 30);
    t.string('created_at', 30).notNullable();
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('auth_tokens');
}
