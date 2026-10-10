import bcrypt from 'bcryptjs';
import { CLUB_ROLES } from '@ccp/shared';
import { newId } from '../../src/lib/ids.js';
import { toDb } from '../../src/db/helpers.js';
import { insertClub } from '../../src/modules/clubs/clubs.service.js';

let counter = 0;
const uniq = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;
export const TEST_PASSWORD = 'Test-Passw0rd!';

export async function createUser(knex, overrides = {}) {
  const n = uniq();
  const now = toDb(new Date());
  const row = {
    id: newId(),
    username: `user_${n}`,
    email: `user_${n}@campus.example`,
    password_hash: await bcrypt.hash(overrides.password ?? TEST_PASSWORD, 4),
    full_name: `Test User ${n}`,
    platform_role: 'student',
    roll_number: `R${n}`,
    department: 'CSE',
    year_of_study: 2,
    email_verified_at: now,
    must_change_password: 0,
    status: 'active',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
  delete row.password;
  await knex('users').insert(row);
  return { ...row, password: overrides.password ?? TEST_PASSWORD };
}

export async function createClub(knex, { leader, name } = {}) {
  const n = uniq();
  const leaderUser = leader ?? (await createUser(knex));
  const result = await knex.transaction((trx) =>
    insertClub(trx, { name: name ?? `Club ${n}`, category: 'Technology', description: 'test club' }, { leaderUserId: leaderUser.id }),
  );
  return { ...result, leader: leaderUser };
}

/** Adds a user to a club with the given club role key. */
export async function addMemberWithRole(knex, club, roleKey, userOverrides = {}) {
  const user = await createUser(knex, userOverrides);
  const role = await knex('club_roles').where({ club_id: club.id, key: roleKey }).first();
  const now = toDb(new Date());
  await knex('club_members').insert({
    id: newId(), club_id: club.id, user_id: user.id, club_role_id: role.id, status: 'active',
    joined_at: now, added_via: 'direct', created_at: now, updated_at: now,
  });
  return user;
}

export { CLUB_ROLES };
