import { z } from 'zod';
import { EVENT_MODES, EVENT_TYPES } from '../constants.js';

/** ISO-8601 date-time with offset, normalised to UTC (API dates are always UTC, spec 10). */
export const isoDate = z
  .string()
  .datetime({ offset: true, message: 'Enter a valid date and time' })
  .transform((v) => new Date(v).toISOString());

const text = (max) => z.string().trim().max(max);
const agendaItem = z.object({ time: text(40).optional().default(''), title: text(200) });

const eventFields = {
  title: text(200).min(3, 'Give the event a title'),
  type: z.enum(EVENT_TYPES),
  summary: text(500).min(1, 'Add a short summary'),
  description: text(10000).optional(),
  objectives: text(5000).optional(),
  agenda: z.array(agendaItem).max(40).optional(),
  facultyCoordinator: text(120).optional(),
  mode: z.enum(EVENT_MODES),
  onlineLink: text(500).url().optional().or(z.literal('')),
  startsAt: isoDate,
  endsAt: isoDate,
  registrationDeadline: isoDate,
  expectedParticipants: z.coerce.number().int().min(1, 'Expect at least one participant').max(100000),
};

const dateRules = (d, ctx) => {
  if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End time must be after the start time' });
  }
  if (d.startsAt && d.registrationDeadline && d.registrationDeadline > d.startsAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['registrationDeadline'],
      message: 'Registration must close before the event starts',
    });
  }
};

export const eventCreateSchema = z.object(eventFields).superRefine(dateRules);
export const eventUpdateSchema = z.object(eventFields).partial().superRefine(dateRules);

export const eventSubmitSchema = z.object({ hallId: z.string().min(1).optional() });
export const eventCancelSchema = z.object({ reason: text(1000).min(3, 'Give a reason') });
export const osiDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'changes_requested']),
  note: text(2000).optional(),
  circulate: z.boolean().optional().default(true),
});
export const eventListQuery = z.object({
  club: z.string().max(60).optional(),
  type: z.enum(EVENT_TYPES).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  registered: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ---- Halls ----
export const hallSchema = z.object({
  name: text(120).min(2),
  building: text(120).optional(),
  floor: text(40).optional(),
  capacity: z.coerce.number().int().min(1, 'Capacity must be above zero').max(100000),
  facilities: z.array(text(80)).max(30).optional(),
  isActive: z.boolean().optional(),
});
export const hallUpdateSchema = hallSchema.partial();
export const blockedSlotSchema = z
  .object({ startsAt: isoDate, endsAt: isoDate, reason: text(300).optional() })
  .refine((d) => d.endsAt > d.startsAt, {
    path: ['endsAt'],
    message: 'End time must be after the start time',
  });
export const availabilityQuery = z
  .object({ from: isoDate, to: isoDate, minCapacity: z.coerce.number().int().min(0).optional().default(0) })
  .refine((d) => d.to > d.from, { path: ['to'], message: 'End time must be after the start time' });
export const hallRequestSchema = z.object({
  hallId: z.string().min(1).optional(),
  registeredCount: z.coerce.number().int().min(0).optional(),
});
export const hallDecisionSchema = z.object({
  decision: z.enum(['approve', 'deny']),
  hallId: z.string().min(1).optional(),
  note: text(2000).optional(),
});

// ---- Registration ----
export const registerSchema = z.object({ answers: z.record(z.any()).optional().default({}) });
export const publishRegistrationSchema = z.object({
  maxSeats: z.coerce.number().int().min(1).optional(),
  closesAt: isoDate.optional(),
});
export const checkinSchema = z.object({ qrToken: z.string().trim().min(8).max(100) });

// ---- Club content ----
export const announcementSchema = z.object({
  title: text(200).min(2, 'Add a title'),
  body: text(5000).min(1, 'Write the announcement'),
  imageUrl: text(500).optional(),
});
export const announcementUpdateSchema = announcementSchema
  .partial()
  .extend({ isPinned: z.boolean().optional() });
export const clubUpdateSchema = z
  .object({
    tagline: text(200),
    description: text(5000),
    whyJoin: text(3000),
    aim: text(3000),
    facultyCoordinator: text(120),
    meetingInfo: text(1000),
    contactEmail: z.string().trim().email().max(254),
    foundedYear: z.coerce.number().int().min(1800).max(2100),
    publicDiscussionEnabled: z.boolean(),
    category: text(60),
  })
  .partial();
export const workSchema = z.object({
  title: text(200).min(2),
  description: text(3000).optional(),
  linkUrl: text(500).url().optional().or(z.literal('')),
  imageUrl: text(500).optional(),
  happenedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export const notificationPrefsSchema = z.object({
  preferences: z.array(
    z.object({ category: z.string(), inApp: z.boolean(), email: z.boolean().optional().default(false) }),
  ),
});
export const adminUserCreateSchema = z.object({
  fullName: text(100).min(2),
  email: z.string().trim().email().max(254),
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_.]+$/),
  role: z.enum(['osi_admin', 'events_admin', 'super_admin']),
  temporaryPassword: z.string().min(8).max(128),
});
export const adminUserUpdateSchema = z.object({ status: z.enum(['active', 'suspended']) });
