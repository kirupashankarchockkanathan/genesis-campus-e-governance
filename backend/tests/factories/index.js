import bcrypt from 'bcryptjs';
import { newId } from '../../src/lib/ids.js';
import { toDb } from '../../src/db/helpers.js';

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
