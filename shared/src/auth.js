import { z } from 'zod';
import { COMMON_PASSWORDS, LIMITS } from './constants.js';

export const PLATFORM_ROLES = Object.freeze({
  STUDENT: 'student',
  OSI_ADMIN: 'osi_admin',
  EVENTS_ADMIN: 'events_admin',
  SUPER_ADMIN: 'super_admin',
});
export const PLATFORM_ROLE_LIST = Object.freeze(Object.values(PLATFORM_ROLES));
export const USER_STATUS = Object.freeze({ ACTIVE: 'active', SUSPENDED: 'suspended' });
export const USER_STATUS_LIST = Object.freeze(Object.values(USER_STATUS));
export const AUTH_TOKEN_TYPE = Object.freeze({
  VERIFY_EMAIL: 'verify_email',
  RESET_PASSWORD: 'reset_password',
});
export const AUTH_TOKEN_TYPE_LIST = Object.freeze(Object.values(AUTH_TOKEN_TYPE));

const trimmed = (min, max) => z.string().trim().min(min).max(max);

export const passwordSchema = z
  .string()
  .min(LIMITS.PASSWORD_MIN, `Password must be at least ${LIMITS.PASSWORD_MIN} characters`)
  .max(LIMITS.PASSWORD_MAX)
  .refine((p) => !COMMON_PASSWORDS.includes(p.toLowerCase()), 'That password is too common');

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[A-Za-z0-9_.]+$/, 'Use letters, numbers, dot or underscore only')
  .transform((v) => v.toLowerCase());

export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());

export const signupSchema = z
  .object({
    fullName: trimmed(2, 100),
    email: emailSchema,
    username: usernameSchema,
    rollNumber: trimmed(1, 30),
    department: trimmed(2, 100),
    yearOfStudy: z.coerce.number().int().min(1).max(6),
    programme: z.string().trim().max(100).optional(),
    password: passwordSchema,
  })
  .refine((d) => !d.password.toLowerCase().includes(d.username), {
    message: 'Password must not contain your username',
    path: ['password'],
  });

export const verifyEmailSchema = z.object({ token: z.string().min(10).max(200) });
export const emailOnlySchema = z.object({ email: emailSchema });
export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1)
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(LIMITS.PASSWORD_MAX),
  // The entry path chosen on the first screens. When given, the account must belong to that portal.
  portal: z.enum(['student', 'club', 'osa', 'events']).optional(),
});
export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(LIMITS.PASSWORD_MAX),
  newPassword: passwordSchema,
});
export const profileUpdateSchema = z
  .object({
    fullName: trimmed(2, 100),
    rollNumber: trimmed(1, 30),
    department: trimmed(2, 100),
    yearOfStudy: z.coerce.number().int().min(1).max(6),
    phone: z.string().trim().max(20).nullable(),
  })
  .partial();
