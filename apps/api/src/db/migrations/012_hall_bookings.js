import { BOOKING_STATUS_LIST } from '@ccp/shared';

export async function up(knex) {
  await knex.schema.createTable('hall_blocked_slots', (t) => {
    t.string('id', 36).primary();
    t.string('hall_id', 36).notNullable().references('id').inTable('halls').onDelete('CASCADE');
    t.string('starts_at', 30).notNullable();
    t.string('ends_at', 30).notNullable();
    t.string('reason', 300);
    t.string('created_by', 36).references('id').inTable('users');
    t.string('created_at', 30).notNullable();
    t.check('?? > ??', ['ends_at', 'starts_at'], 'blocked_end_after_start');
    t.index(['hall_id', 'starts_at']);
  });

  await knex.schema.createTable('hall_bookings', (t) => {
    t.string('id', 36).primary();
    t.string('hall_id', 36).notNullable().references('id').inTable('halls').onDelete('RESTRICT');
    t.string('event_id', 36).notNullable().references('id').inTable('events').onDelete('CASCADE');
    t.string('club_id', 36).notNullable().references('id').inTable('clubs').onDelete('RESTRICT');
    t.string('status', 12).notNullable().checkIn(BOOKING_STATUS_LIST);
    t.string('starts_at', 30).notNullable();
    t.string('ends_at', 30).notNullable();
    t.integer('expected_count');
    t.integer('registered_count');
    t.string('requested_by', 36).references('id').inTable('users');
    t.string('requested_at', 30);
    t.string('decided_by', 36).references('id').inTable('users');
    t.string('decided_at', 30);
    t.text('decision_note');
    t.string('expires_at', 30);
    t.string('created_at', 30).notNullable();
    t.string('updated_at', 30).notNullable();
    t.check('?? > ??', ['ends_at', 'starts_at'], 'booking_end_after_start');
    t.index(['hall_id', 'starts_at', 'ends_at']);
    t.index(['event_id']);
    t.index(['status']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('hall_bookings');
  await knex.schema.dropTableIfExists('hall_blocked_slots');
}
