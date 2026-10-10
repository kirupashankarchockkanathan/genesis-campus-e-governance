export async function up(knex) {
  await knex.schema.createTable('halls', (t) => {
    t.string('id', 36).primary();
    t.string('name', 120).notNullable().unique();
    t.string('building', 120);
    t.string('floor', 40);
    t.integer('capacity').notNullable();
    t.text('facilities_json');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.string('created_at', 30).notNullable();
    t.string('updated_at', 30).notNullable();
    t.check('?? > 0', ['capacity'], 'halls_capacity_positive');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('halls');
}
