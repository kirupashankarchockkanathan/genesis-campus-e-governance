import { z } from 'zod';

// Section 9.2: form field definitions and answer validation, shared by the API and the web app.
export const FIELD_TYPES = Object.freeze([
  'short_text',
  'long_text',
  'number',
  'email',
  'phone',
  'single_choice',
  'dropdown',
  'multi_choice',
  'date',
  'consent',
]);
export const CHOICE_TYPES = Object.freeze(['single_choice', 'dropdown', 'multi_choice']);
export const FIELD_TYPE_LABELS = Object.freeze({
  short_text: 'Short text',
  long_text: 'Long text',
  number: 'Number',
  email: 'Email',
  phone: 'Phone',
  single_choice: 'Single choice',
  dropdown: 'Dropdown',
  multi_choice: 'Multiple choice',
  date: 'Date',
  consent: 'Consent checkbox',
});

// FR-FORM-04: filled from the profile, shown read-only, never asked again.
export const PROFILE_FIELDS = Object.freeze([
  { key: 'fullName', label: 'Name' },
  { key: 'email', label: 'College email' },
  { key: 'rollNumber', label: 'Roll number' },
  { key: 'department', label: 'Department' },
  { key: 'yearOfStudy', label: 'Year' },
]);

export const formFieldSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9_]+$/, 'Use letters, numbers and underscores'),
  type: z.enum(FIELD_TYPES),
  label: z.string().trim().min(1, 'Label is required').max(200),
  help: z.string().trim().max(300).optional().default(''),
  required: z.boolean().optional().default(false),
  options: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  maxLength: z.number().int().positive().max(5000).optional(),
});

export const formFieldsSchema = z
  .array(formFieldSchema)
  .max(40)
  .superRefine((fields, ctx) => {
    const seen = new Set();
    fields.forEach((f, i) => {
      if (seen.has(f.id))
        ctx.addIssue({ code: 'custom', path: [i, 'id'], message: 'Field ids must be unique' });
      seen.add(f.id);
      if (CHOICE_TYPES.includes(f.type) && (f.options?.length ?? 0) < 2) {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'options'],
          message: 'Choice fields need at least two options',
        });
      }
    });
  });

export const formSaveSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().default(''),
  fields: formFieldsSchema,
});

const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * Validates answers against a form definition (FR-REG-01, TC-REG-02).
 * Returns { ok, errors: { [fieldId]: message }, value } where value only keeps known fields.
 */
export function validateAnswers(fields, answers = {}) {
  const errors = {};
  const value = {};
  for (const f of fields) {
    const v = answers[f.id];
    if (isEmpty(v) || (f.type === 'consent' && v === false)) {
      if (f.required)
        errors[f.id] = f.type === 'consent' ? 'You must agree to continue' : 'This field is required';
      continue;
    }
    switch (f.type) {
      case 'short_text':
      case 'long_text':
      case 'phone':
      case 'email': {
        if (typeof v !== 'string') {
          errors[f.id] = 'Enter text';
          break;
        }
        const limit = f.maxLength ?? (f.type === 'long_text' ? 2000 : 300);
        if (v.length > limit) errors[f.id] = `Use at most ${limit} characters`;
        else if (f.type === 'email' && !z.string().email().safeParse(v).success)
          errors[f.id] = 'Enter a valid email';
        else if (f.type === 'phone' && !/^[0-9+()\-\s]{7,20}$/.test(v))
          errors[f.id] = 'Enter a valid phone number';
        else value[f.id] = v.trim();
        break;
      }
      case 'number': {
        const n = typeof v === 'number' ? v : Number(v);
        if (!Number.isFinite(n)) errors[f.id] = 'Enter a number';
        else if (f.min !== undefined && n < f.min) errors[f.id] = `Must be at least ${f.min}`;
        else if (f.max !== undefined && n > f.max) errors[f.id] = `Must be at most ${f.max}`;
        else value[f.id] = n;
        break;
      }
      case 'single_choice':
      case 'dropdown':
        if (typeof v !== 'string' || !f.options?.includes(v))
          errors[f.id] = 'Choose one of the listed options';
        else value[f.id] = v;
        break;
      case 'multi_choice':
        if (!Array.isArray(v) || v.some((x) => !f.options?.includes(x)))
          errors[f.id] = 'Choose from the listed options';
        else value[f.id] = [...new Set(v)];
        break;
      case 'date':
        if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
          errors[f.id] = 'Enter a valid date';
        } else value[f.id] = v;
        break;
      case 'consent':
        value[f.id] = true;
        break;
      default:
        errors[f.id] = 'Unsupported field';
    }
  }
  return { ok: Object.keys(errors).length === 0, errors, value };
}
