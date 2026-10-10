import bcrypt from 'bcryptjs';
import { DEMO_USERS, createSeedState } from '@ccp/shared/gov';
import { config } from '../../config/index.js';
import { clock } from '../../lib/clock.js';
import { newId } from '../../lib/ids.js';
import { logger } from '../../lib/logger.js';
import { seedDemoStudent } from '../../modules/gov/student.service.js';
import { seedState } from '../../modules/gov/state.js';
import { toDb } from '../helpers.js';

/** Sample clubs, events, requests, promotions and club applications (the state the workflow starts from). */
export async function seedGovernance(knex) {
  const seeded = await seedState(knex, createSeedState());
  if (seeded) logger.info('Seeded the governance sample data');
}

const PLATFORM_ROLE = { student: 'student', club: 'student', osa: 'osi_admin', events: 'events_admin' };
const portalOf = (u) => (u.role === 'admin' ? u.adminType : u.role);

/** Demo sign-ins (STU2026001, CLUB001, OSA001, EVT001...). Local and test runs only; refused in production. */
export async function seedPortalUsers(knex) {
  if (!config.SEED_DEMO_PORTAL) return;
  if (config.isProd) {
    logger.warn('SEED_DEMO_PORTAL is ignored in production');
    return;
  }
  const now = toDb(clock.now());
  for (const u of DEMO_USERS) {
    const username = u.userId.toLowerCase();
    if (await knex('users').where({ username }).first()) continue;
    const id = newId();
    const portal = portalOf(u);
    await knex('users').insert({
      id,
      username,
      email: u.email.toLowerCase(),
      password_hash: await bcrypt.hash(u.password, config.BCRYPT_COST),
      full_name: u.name,
      platform_role: PLATFORM_ROLE[portal],
      roll_number: portal === 'student' ? u.userId : null,
      department: u.department,
      year_of_study: u.year ? Number.parseInt(u.year, 10) : null,
      programme: u.shortDept ?? null,
      email_verified_at: now,
      must_change_password: 0,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
    if (portal === 'club') await knex('gov_club_authorities').insert({ user_id: id, club_id: u.clubId });
    if (portal === 'student') await seedDemoStudent(knex, id);
  }
}
