import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_KEYS,
  LOCKED_PERMISSIONS,
  CLUB_ROLE_KEYS,
  PERMISSIONS,
  signupSchema,
  canTransitionEvent,
  ERROR_CODES,
  ERROR_HTTP_STATUS,
} from './index.js';

describe('permission matrix (spec 3.4)', () => {
  it('defines all six roles', () =>
    expect(Object.keys(DEFAULT_ROLE_PERMISSIONS).sort()).toEqual([...CLUB_ROLE_KEYS].sort()));
  it('only uses known permission keys', () => {
    for (const perms of Object.values(DEFAULT_ROLE_PERMISSIONS))
      for (const p of perms) expect(PERMISSION_KEYS).toContain(p);
  });
  it('Leader has everything', () => expect(DEFAULT_ROLE_PERMISSIONS.LEADER).toEqual(PERMISSION_KEYS));
  it('locked permissions belong to Leader only', () => {
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS))
      if (role !== 'LEADER') for (const l of LOCKED_PERMISSIONS) expect(perms).not.toContain(l);
  });
  it('only the Leader can submit events', () => {
    const who = Object.entries(DEFAULT_ROLE_PERMISSIONS)
      .filter(([, p]) => p.includes(PERMISSIONS.EVENT_SUBMIT))
      .map(([r]) => r);
    expect(who).toEqual(['LEADER']);
  });
  it('Member has no permissions', () => expect(DEFAULT_ROLE_PERMISSIONS.MEMBER).toEqual([]));
});

describe('error codes', () => {
  it('every code has an HTTP status', () => {
    for (const c of Object.values(ERROR_CODES)) expect(ERROR_HTTP_STATUS[c]).toBeTypeOf('number');
  });
});

describe('event transitions (spec 5.1)', () => {
  it('allows draft->submitted, blocks draft->approved', () => {
    expect(canTransitionEvent('draft', 'submitted')).toBe(true);
    expect(canTransitionEvent('draft', 'approved')).toBe(false);
    expect(canTransitionEvent('approved', 'approved')).toBe(false);
  });
});

describe('signupSchema', () => {
  const ok = {
    fullName: 'Asha Rao',
    email: 'ASHA@campus.example',
    username: 'Asha_R',
    rollNumber: '22CS001',
    department: 'CSE',
    yearOfStudy: '2',
    password: 'Str0ng-Pass!',
  };
  it('normalises case', () => {
    const r = signupSchema.parse(ok);
    expect(r.email).toBe('asha@campus.example');
    expect(r.username).toBe('asha_r');
  });
  it('rejects common and username-containing passwords', () => {
    expect(signupSchema.safeParse({ ...ok, password: 'password123' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...ok, password: 'xxasha_rxx9' }).success).toBe(false);
  });
});
