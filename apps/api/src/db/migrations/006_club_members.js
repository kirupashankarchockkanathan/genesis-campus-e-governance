import { MEMBER_STATUS_LIST, MEMBER_ADDED_VIA_LIST } from '@ccp/shared';

export async function up(knex) {
  await knex.schema.createTable('club_members', (t) => {
    t.string('id', 36).primary();
    t.string('club_id', 36).notNullable().references('id').inTable('clubs').onDelete('RESTRICT');
    t.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.string('club_role_id', 36).notNullable().references('id').inTable('club_roles').onDelete('RESTRICT');
    t.string('status', 12).notNullable().defaultTo('active').checkIn(MEMBER_STATUS_LIST);
    t.string('joined_at', 30).notNullable();
    t.string('left_at', 30);
    t.string('added_via', 12).notNullable().defaultTo('direct').checkIn(MEMBER_ADDED_VIA_LIST);
    t.string('created_at', 30).notNullable();
    t.string('updated_at', 30).notNullable();
    t.unique(['club_id', 'user_id']);
    t.index(['user_id']);
    t.index(['club_id']);
  });
  await knex.schema.createTable('favorite_clubs', (t) => {
    t.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('club_id', 36).notNullable().references('id').inTable('clubs').onDelete('CASCADE');
    t.string('created_at', 30).notNullable();
    t.primary(['user_id', 'club_id']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('favorite_clubs');
  await knex.schema.dropTableIfExists('club_members');
}
