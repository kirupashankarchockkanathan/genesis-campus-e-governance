export async function up(knex) {
  await knex.schema.createTable('club_roles', (t) => {
    t.string('id', 36).primary();
    t.string('club_id', 36).notNullable().references('id').inTable('clubs').onDelete('RESTRICT');
    t.string('key', 40).notNullable();
    t.string('name', 80).notNullable();
    t.boolean('is_system').notNullable().defaultTo(true);
    t.string('created_at', 30).notNullable();
    t.string('updated_at', 30).notNullable();
    t.unique(['club_id', 'key']);
  });
  await knex.schema.createTable('club_role_permissions', (t) => {
    t.string('club_role_id', 36).notNullable().references('id').inTable('club_roles').onDelete('CASCADE');
    t.string('permission', 60).notNullable();
    t.primary(['club_role_id', 'permission']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('club_role_permissions');
  await knex.schema.dropTableIfExists('club_roles');
}
