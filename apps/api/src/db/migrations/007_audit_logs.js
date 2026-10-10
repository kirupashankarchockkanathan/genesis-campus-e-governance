export async function up(knex) {
  await knex.schema.createTable('audit_logs', (t) => {
    t.string('id', 36).primary();
    t.string('actor_id', 36).references('id').inTable('users');
    t.string('action', 80).notNullable();
    t.string('entity_type', 60);
    t.string('entity_id', 64);
    t.text('meta_json');
    t.string('ip', 64);
    t.string('created_at', 30).notNullable();
    t.index(['entity_type', 'entity_id']);
    t.index(['actor_id', 'created_at']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('audit_logs');
}
