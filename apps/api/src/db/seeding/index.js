import bcrypt from 'bcryptjs';
import { CLUB_ROLES, MEMBER_ADDED_VIA, PLATFORM_ROLES } from '@ccp/shared';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { newId } from '../../lib/ids.js';
import { clock } from '../../lib/clock.js';
import { toDb, jsonToDb } from '../helpers.js';
import { insertClub } from '../../modules/clubs/clubs.service.js';

// Appendix A: all names are made up.
export const SAMPLE_HALLS = [
  { name: 'Main Auditorium', building: 'Admin Block', floor: 'Ground', capacity: 800, facilities: ['Projector', 'Stage', 'PA system'] },
  { name: 'Mini Auditorium', building: 'Admin Block', floor: 'First', capacity: 350, facilities: ['Projector', 'PA system'] },
  { name: 'Seminar Hall A', building: 'Academic Block 1', floor: 'Second', capacity: 200, facilities: ['Projector', 'Air conditioning'] },
  { name: 'Seminar Hall B', building: 'Academic Block 1', floor: 'Second', capacity: 120, facilities: ['Projector'] },
  { name: 'Open Air Theatre', building: 'Central Lawn', floor: 'Ground', capacity: 1000, facilities: ['Stage', 'PA system'] },
  { name: 'Innovation Lab', building: 'Tech Park', floor: 'Third', capacity: 60, facilities: ['Workstations', 'Whiteboards', 'Wi-Fi'] },
];

export const SAMPLE_CLUBS = [
  { name: 'Robotics Club', category: 'Technology', tagline: 'Build, break, rebuild.', description: 'Sample club. We design and build robots and compete in national contests.', whyJoin: 'Hands-on engineering with real hardware.', aim: 'Make robotics accessible to every student.', meetingInfo: 'Fridays 5 pm, Innovation Lab' },
  { name: 'Code Forge', category: 'Technology', tagline: 'Code together.', description: 'Sample club. Weekly coding sessions and hackathons.', whyJoin: 'Grow your skills with peers.', aim: 'A strong programming culture on campus.', meetingInfo: 'Wednesdays 6 pm, Seminar Hall B' },
  { name: 'Music Club', category: 'Cultural', tagline: 'Every voice counts.', description: 'Sample club. Bands, choir and open-mic nights.', whyJoin: 'Perform and jam with others.', aim: 'Keep campus music alive.', meetingInfo: 'Tuesdays 5 pm, Mini Auditorium' },
  { name: 'Lens Photography Club', category: 'Arts', tagline: 'See differently.', description: 'Sample club. Photo walks, exhibitions and editing workshops.', whyJoin: 'Learn composition and storytelling.', aim: 'Document campus life beautifully.', meetingInfo: 'Saturdays 9 am, Central Lawn' },
  { name: 'Entrepreneurship Cell', category: 'Business', tagline: 'Ideas to ventures.', description: 'Sample club. Pitch events, mentoring and startup talks.', whyJoin: 'Meet founders and test ideas.', aim: 'Nurture student start-ups.', meetingInfo: 'Thursdays 4 pm, Seminar Hall A' },
  { name: 'Literary Society', category: 'Literature', tagline: 'Words that move.', description: 'Sample club. Debates, poetry slams and book circles.', whyJoin: 'Sharpen writing and speaking.', aim: 'Celebrate reading and writing.', meetingInfo: 'Mondays 5 pm, Library Hall' },
  { name: 'Rhythm Dance Club', category: 'Cultural', tagline: 'Move to the beat.', description: 'Sample club. Classical, folk and contemporary dance.', whyJoin: 'Stage experience and fitness.', aim: 'Showcase dance across styles.', meetingInfo: 'Wednesdays 5 pm, Open Air Theatre' },
  { name: 'Green Campus Club', category: 'Social impact', tagline: 'Small steps, big change.', description: 'Sample club. Tree drives, recycling and clean-ups.', whyJoin: 'Make a visible difference.', aim: 'A sustainable campus.', meetingInfo: 'Sundays 8 am, Main Gate' },
].map((c) => ({ ...c, contactEmail: `${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}@${config.allowedEmailDomains[0]}` }));

const hash = (pw) => bcrypt.hash(pw, config.BCRYPT_COST);

export async function seedHalls(knex) {
  const now = toDb(clock.now());
  for (const h of SAMPLE_HALLS) {
    const exists = await knex('halls').where({ name: h.name }).first();
    if (exists) continue;
    await knex('halls').insert({
      id: newId(), name: h.name, building: h.building, floor: h.floor, capacity: h.capacity,
      facilities_json: jsonToDb(h.facilities), is_active: 1, created_at: now, updated_at: now,
    });
  }
}

export async function seedClubs(knex) {
  for (const c of SAMPLE_CLUBS) {
    const exists = await knex('clubs').where({ name: c.name }).first();
    if (exists) continue;
    await knex.transaction((trx) => insertClub(trx, c));
  }
}

export async function seedAdmins(knex) {
  const admins = [
    { email: config.SEED_SUPER_ADMIN_EMAIL, password: config.SEED_SUPER_ADMIN_PASSWORD, role: PLATFORM_ROLES.SUPER_ADMIN, name: 'Super Admin', username: 'superadmin' },
    { email: config.SEED_OSI_EMAIL, password: config.SEED_OSI_PASSWORD, role: PLATFORM_ROLES.OSI_ADMIN, name: 'OSI Admin', username: 'osi_admin' },
    { email: config.SEED_EVENTS_EMAIL, password: config.SEED_EVENTS_PASSWORD, role: PLATFORM_ROLES.EVENTS_ADMIN, name: 'Events Authority Admin', username: 'events_admin' },
  ];
  const now = toDb(clock.now());
  for (const a of admins) {
    if (await knex('users').where({ email: a.email.toLowerCase() }).first()) continue;
    if (!a.password) {
      logger.warn({ email: a.email }, 'Skipping admin seed: password env var is empty');
      continue;
    }
    await knex('users').insert({
      id: newId(), username: a.username, email: a.email.toLowerCase(), password_hash: await hash(a.password),
      full_name: a.name, platform_role: a.role, email_verified_at: now, must_change_password: 1,
      status: 'active', created_at: now, updated_at: now,
    });
  }
}

const SAMPLE_PEOPLE = [
  { username: 'sample_leader', name: 'Sample Leader', role: CLUB_ROLES.LEADER },
  { username: 'sample_vice', name: 'Sample Vice Leader', role: CLUB_ROLES.VICE_LEADER },
  { username: 'sample_secretary', name: 'Sample Secretary', role: CLUB_ROLES.SECRETARY },
  { username: 'sample_coordinator', name: 'Sample Event Coordinator', role: CLUB_ROLES.EVENT_COORDINATOR },
  { username: 'sample_media', name: 'Sample Media Lead', role: CLUB_ROLES.MEDIA_LEAD },
  { username: 'sample_member', name: 'Sample Member', role: CLUB_ROLES.MEMBER },
  { username: 'sample_student', name: 'Sample Student', role: null },
];

/** Sample students and Robotics Club memberships. Runs only when SEED_SAMPLE=true (TC-DB-28). */
export async function seedSample(knex) {
  if (!config.SEED_SAMPLE) return;
  if (!config.SEED_SAMPLE_PASSWORD) {
    logger.warn('SEED_SAMPLE_PASSWORD is empty; skipping sample users');
    return;
  }
  const now = toDb(clock.now());
  const domain = config.allowedEmailDomains[0];
  const club = await knex('clubs').where({ name: 'Robotics Club' }).first();
  for (const p of SAMPLE_PEOPLE) {
    let user = await knex('users').where({ username: p.username }).first();
    if (!user) {
      const id = newId();
      await knex('users').insert({
        id, username: p.username, email: `${p.username}@${domain}`, password_hash: await hash(config.SEED_SAMPLE_PASSWORD),
        full_name: `${p.name} (sample)`, platform_role: 'student', roll_number: `SAMPLE-${p.username}`, department: 'Sample Dept',
        year_of_study: 2, email_verified_at: now, must_change_password: 0, status: 'active', created_at: now, updated_at: now,
      });
      user = { id };
    }
    if (!p.role || !club) continue;
    if (await knex('club_members').where({ club_id: club.id, user_id: user.id }).first()) continue;
    const role = await knex('club_roles').where({ club_id: club.id, key: p.role }).first();
    await knex('club_members').insert({
      id: newId(), club_id: club.id, user_id: user.id, club_role_id: role.id, status: 'active', joined_at: now,
      added_via: MEMBER_ADDED_VIA.OSI, created_at: now, updated_at: now,
    });
  }
}
