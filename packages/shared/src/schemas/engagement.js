import { z } from 'zod';
import { PERMISSION_KEYS, LOCKED_PERMISSIONS } from '../permissions.js';
import { isoDate } from './events.js';
import { formFieldsSchema } from '../forms.js';
import { CLUB_ROLE_KEYS } from '../roles.js';

const text = (max) => z.string().trim().max(max);

export const positionSchema = z.object({
  title: text(200).min(2, 'Name the position'),
  description: text(1000).optional().default(''),
  openings: z.coerce.number().int().min(1, 'At least one opening').max(1000).default(1),
});

export const recruitmentSchema = z.object({
  title: text(200).min(3, 'Give the recruitment a title'),
  description: text(5000).optional().default(''),
  deadline: isoDate,
  autoAccept: z.boolean().optional().default(false),
  positions: z.array(positionSchema).min(1, 'Add at least one position').max(30),
  fields: formFieldsSchema.optional().default([]),
});
export const recruitmentUpdateSchema = recruitmentSchema.partial();

export const applySchema = z.object({
  positionId: z.string().min(1).optional(),
  answers: z.record(z.any()).optional().default({}),
});
export const applicationDecisionSchema = z.object({
  status: z.enum(['shortlisted', 'accepted', 'rejected']),
  roleKey: z.enum(CLUB_ROLE_KEYS).optional(),
  note: text(1000).optional(),
});

export const discussionMessageSchema = z.object({ body: text(2000).min(1, 'Write a message') });
export const reportMessageSchema = z.object({ reason: text(300).optional() });

// Custom club roles (Phase 2, role.manage). Locked permissions can never be granted (spec 3.5 rule 4).
export const customRoleSchema = z.object({
  name: text(60).min(2, 'Name the role'),
  permissions: z
    .array(z.enum(PERMISSION_KEYS))
    .max(PERMISSION_KEYS.length)
    .refine((p) => !p.some((k) => LOCKED_PERMISSIONS.includes(k)), {
      message: 'event.submit, leadership.transfer and role.manage are reserved for the Leader',
    }),
});
export const customRoleUpdateSchema = customRoleSchema.partial();
export const waitlistToggleSchema = z.object({ waitlist: z.boolean().optional() });
