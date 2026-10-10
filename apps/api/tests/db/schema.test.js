import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { CLUB_ROLE_KEYS, DEFAULT_ROLE_PERMISSIONS, CLUB_ROLES } from '@ccp/shared';
import { createTestDb, cleanDb } from '../helpers/db.js';
import { createUser, createClub, addMemberWithRole } from '../factories/index.js';
import { toDb, fromDb, jsonToDb, jsonFromDb } from '../../src/db/helpers.js';
import { overrideConfig } from '../../src/config/index.js';
import { transferLeadership, addMember } from '../../src/modules/members/members.service.js';
import { seedHalls, seedClubs, seedAdmins, seedSample, SAMPLE_CLUBS } from '../../src/db/seeding/index.js';
import { seedSampleContent } from '../../src/db/seeding/sampleContent.js';
import { newId } from '../../src/lib/ids.js';

let knex;
beforeAll(async () => {
  knex = await createTestDb();
});
afterAll(async () => {
  await knex.destroy();
});
beforeEach(async () => {
  await cleanDb(knex);
});

const tables = async () =>
  knex.client.config.client === 'pg'
    ? (await knex.raw("select tablename as name from pg_tables where schemaname='public'")).rows.map(
        (r) => r.name,
      )
    : (await knex.raw("select name from sqlite_master where type='table' and name not like 'sqlite_%'")).map(
        (r) => r.name,
      );

describe('migrations', () => {
  it('TC-DB-01 all Phase 0 tables exist', async () => {
    const t = await tables();
    for (const name of [
      'users',
      'auth_tokens',
      'refresh_tokens',
      'clubs',
      'club_roles',
      'club_role_permissions',
      'club_members',
      'favorite_clubs',
      'audit_logs',
      'halls',
    ])
      expect(t).toContain(name);
  });

  it('TC-DB-02 rollback leaves an empty schema and migrates again', async () => {
    await knex.migrate.rollback(undefined, true);
    expect((await tables()).filter((n) => !n.startsWith('knex_'))).toEqual([]);
    await knex.migrate.latest();
    expect(await knex.schema.hasTable('users')).toBe(true);
  }, 30000);
});

describe('users constraints', () => {
  it('TC-DB-03 same email in different letter case fails', async () => {
    const a = await createUser(knex, { email: 'dup@campus.example' });
    expect(a.id).toBeTruthy();
    await expect(createUser(knex, { email: 'DUP@campus.example' })).rejects.toThrow();
    await expect(createUser(knex, { email: 'dup@campus.example' })).rejects.toThrow();
  });
  it('TC-DB-04 duplicate username fails', async () => {
    await createUser(knex, { username: 'same_name' });
    await expect(createUser(knex, { username: 'same_name' })).rejects.toThrow();
  });
  it("TC-DB-05 platform_role 'teacher' fails", async () => {
    await expect(createUser(knex, { platform_role: 'teacher' })).rejects.toThrow();
  });
  it('TC-DB-06 invalid status values fail (users, clubs, club_members)', async () => {
    await expect(createUser(knex, { status: 'banned' })).rejects.toThrow();
    const u = await createUser(knex);
    await expect(
      knex('clubs').insert({
        id: newId(),
        slug: 'x',
        name: 'X',
        category: 'c',
        status: 'weird',
        created_at: 't',
        updated_at: 't',
      }),
    ).rejects.toThrow();
    const club = await createClub(knex, { leader: u });
    await expect(
      knex('club_members').where({ club_id: club.id }).update({ status: 'weird' }),
    ).rejects.toThrow();
  });
});

describe('foreign keys and uniqueness', () => {
  it('TC-DB-07 membership for a non-existent user or club fails', async () => {
    const club = await createClub(knex);
    const role = await knex('club_roles').where({ club_id: club.id, key: 'MEMBER' }).first();
    const base = {
      id: newId(),
      club_role_id: role.id,
      status: 'active',
      joined_at: 't',
      added_via: 'direct',
      created_at: 't',
      updated_at: 't',
    };
    await expect(
      knex('club_members').insert({ ...base, club_id: club.id, user_id: 'nope' }),
    ).rejects.toThrow();
    const u = await createUser(knex);
    await expect(
      knex('club_members').insert({ ...base, id: newId(), club_id: 'nope', user_id: u.id }),
    ).rejects.toThrow();
  });
  it('TC-DB-08 two memberships for the same club and user fail', async () => {
    const club = await createClub(knex);
    const u = await addMemberWithRole(knex, club, 'MEMBER');
    const role = await knex('club_roles').where({ club_id: club.id, key: 'MEMBER' }).first();
    await expect(
      knex('club_members').insert({
        id: newId(),
        club_id: club.id,
        user_id: u.id,
        club_role_id: role.id,
        status: 'active',
        joined_at: 't',
        added_via: 'direct',
        created_at: 't',
        updated_at: 't',
      }),
    ).rejects.toThrow();
  });
  it('TC-DB-11 favouriting the same club twice fails', async () => {
    const club = await createClub(knex);
    const u = await createUser(knex);
    await knex('favorite_clubs').insert({ user_id: u.id, club_id: club.id, created_at: 't' });
    await expect(
      knex('favorite_clubs').insert({ user_id: u.id, club_id: club.id, created_at: 't' }),
    ).rejects.toThrow();
  });
  it('TC-DB-15 hall with capacity 0 or duplicate name fails', async () => {
    const h = { building: 'b', is_active: 1, created_at: 't', updated_at: 't' };
    await expect(knex('halls').insert({ id: newId(), name: 'Zero', capacity: 0, ...h })).rejects.toThrow();
    await knex('halls').insert({ id: newId(), name: 'Hall', capacity: 10, ...h });
    await expect(knex('halls').insert({ id: newId(), name: 'Hall', capacity: 10, ...h })).rejects.toThrow();
  });
  it('TC-DB-26 deleting a role cascades permissions; deleting a club with roles is restricted', async () => {
    const club = await createClub(knex);
    const role = await knex('club_roles').where({ club_id: club.id, key: 'SECRETARY' }).first();
    await knex('club_members').where({ club_role_id: role.id }).del();
    await knex('club_roles').where({ id: role.id }).del();
    expect(await knex('club_role_permissions').where({ club_role_id: role.id })).toHaveLength(0);
    await expect(knex('clubs').where({ id: club.id }).del()).rejects.toThrow();
  });
});

describe('helpers', () => {
  it('TC-DB-13 timestamps with milliseconds round-trip identically', async () => {
    const iso = '2026-11-03T09:30:00.123Z';
    const u = await createUser(knex, { last_login_at: toDb(new Date(iso)) });
    const row = await knex('users').where({ id: u.id }).first();
    expect(fromDb(row.last_login_at)).toBe(iso);
  });
  it('TC-DB-14 JSON text round trip keeps nested data and unicode', () => {
    const data = { a: [1, { b: 'नमस्ते 🎓' }], c: null };
    expect(jsonFromDb(jsonToDb(data))).toEqual(data);
  });
});

describe('roles and permissions', () => {
  it('TC-DB-17 club role permissions match the shared matrix exactly', async () => {
    const club = await createClub(knex);
    const roles = await knex('club_roles').where({ club_id: club.id });
    expect(roles.map((r) => r.key).sort()).toEqual([...CLUB_ROLE_KEYS].sort());
    for (const r of roles) {
      const perms = (await knex('club_role_permissions').where({ club_role_id: r.id }))
        .map((p) => p.permission)
        .sort();
      expect(perms).toEqual([...DEFAULT_ROLE_PERMISSIONS[r.key]].sort());
    }
  });

  it('TC-DB-27 exactly one active Leader; transfer swaps atomically; second Leader rejected', async () => {
    const club = await createClub(knex);
    const vice = await addMemberWithRole(knex, club, 'VICE_LEADER');
    const leaderRole = await knex('club_roles').where({ club_id: club.id, key: 'LEADER' }).first();
    const countLeaders = async () =>
      Number(
        (
          await knex('club_members')
            .where({ club_id: club.id, club_role_id: leaderRole.id, status: 'active' })
            .count('* as c')
            .first()
        ).c,
      );
    expect(await countLeaders()).toBe(1);

    await expect(
      addMember(knex, { id: club.leader.id }, club.id, { email: vice.email, roleKey: CLUB_ROLES.LEADER }),
    ).rejects.toThrow();
    expect(await countLeaders()).toBe(1);

    await transferLeadership(knex, { id: club.leader.id }, club.id, vice.id);
    expect(await countLeaders()).toBe(1);
    const nowLeader = await knex('club_members')
      .where({ club_id: club.id, club_role_id: leaderRole.id })
      .first();
    expect(nowLeader.user_id).toBe(vice.id);
    const oldRole = await knex('club_members as m')
      .join('club_roles as r', 'r.id', 'm.club_role_id')
      .where({ 'm.user_id': club.leader.id })
      .select('r.key')
      .first();
    expect(oldRole.key).toBe('VICE_LEADER');
  });
});

describe('seeds', () => {
  const seedAll = async () => {
    await seedHalls(knex);
    await seedClubs(knex);
    await seedAdmins(knex);
    await seedSample(knex);
    await seedSampleContent(knex);
  };
  const counts = async () => ({
    halls: Number((await knex('halls').count('* as c').first()).c),
    clubs: Number((await knex('clubs').count('* as c').first()).c),
    roles: Number((await knex('club_roles').count('* as c').first()).c),
    users: Number((await knex('users').count('* as c').first()).c),
    members: Number((await knex('club_members').count('* as c').first()).c),
    events: Number((await knex('events').count('* as c').first()).c),
    registrations: Number((await knex('registrations').count('* as c').first()).c),
    recruitments: Number((await knex('recruitments').count('* as c').first()).c),
  });

  it('TC-DB-16 running all seeds twice creates no duplicates', async () => {
    overrideConfig({
      SEED_SAMPLE: true,
      SEED_SAMPLE_PASSWORD: 'Sample-Pass-1!',
      SEED_SUPER_ADMIN_PASSWORD: 'Admin-Pass-1!',
      SEED_OSI_PASSWORD: 'Admin-Pass-2!',
      SEED_EVENTS_PASSWORD: 'Admin-Pass-3!',
    });
    await seedAll();
    const first = await counts();
    await seedAll();
    expect(await counts()).toEqual(first);
    expect(first.halls).toBe(6);
    expect(first.clubs).toBe(SAMPLE_CLUBS.length);
    expect(first.roles).toBe(SAMPLE_CLUBS.length * 6);
    expect(first.users).toBe(3 + 7);
    expect(first.members).toBe(6);
    // Appendix A: an event in each of the seven statuses, a recruitment and registrations.
    expect(first.events).toBe(7);
    expect(first.recruitments).toBe(1);
    expect(first.registrations).toBe(2);
    expect((await knex('events').distinct('status').pluck('status')).sort()).toEqual([
      'approved',
      'cancelled',
      'changes_requested',
      'completed',
      'draft',
      'rejected',
      'submitted',
    ]);
    const admin = await knex('users').where({ platform_role: 'osi_admin' }).first();
    expect(Number(admin.must_change_password)).toBe(1);
  });

  it('TC-DB-28 SEED_SAMPLE=false creates no sample students', async () => {
    overrideConfig({
      SEED_SAMPLE: false,
      SEED_SAMPLE_PASSWORD: 'Sample-Pass-1!',
      SEED_SUPER_ADMIN_PASSWORD: '',
      SEED_OSI_PASSWORD: '',
      SEED_EVENTS_PASSWORD: '',
    });
    await seedAll();
    const c = await counts();
    expect(c.users).toBe(0);
    expect(c.members).toBe(0);
    expect(c.events).toBe(0);
  });
});
