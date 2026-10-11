import { PLATFORM_ROLE_LIST, USER_STATUS_LIST } from '@gcc/shared';

export async function up(knex) {
  await knex.schema.createTable('users', (t) => {
    t.string('id', 36).primary();
    t.string('username', 64).notNullable().unique();
    t.string('email', 254).notNullable().unique();
    t.string('password_hash', 100).notNullable();
    t.string('full_name', 120).notNullable();
    t.string('platform_role', 20).notNullable().defaultTo('student').checkIn(PLATFORM_ROLE_LIST);
    t.string('roll_number', 40);
    t.string('department', 120);
    t.integer('year_of_study');
    t.string('programme', 120);
    t.string('phone', 30);
    t.string('avatar_url', 500);
    t.string('email_verified_at', 30);
    t.boolean('must_change_password').notNullable().defaultTo(false);
    t.string('status', 12).notNullable().defaultTo('active').checkIn(USER_STATUS_LIST);
    t.string('last_login_at', 30);
    t.string('created_at', 30).notNullable();
    t.string('updated_at', 30).notNullable();
    // Case-insensitive uniqueness: values are stored lower-cased and the DB refuses anything else.
    t.check('?? = lower(??)', ['email', 'email'], 'users_email_lower');
    t.check('?? = lower(??)', ['username', 'username'], 'users_username_lower');
    t.check(
      '?? IS NULL OR (?? >= 1 AND ?? <= 6)',
      ['year_of_study', 'year_of_study', 'year_of_study'],
      'users_year_range',
    );
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('users');
}
