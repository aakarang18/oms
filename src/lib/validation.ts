import { z } from 'zod';

const mobile = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, ''))
  .refine((s) => /^(\+91)?[6-9]\d{9}$/.test(s), 'Enter a valid 10-digit Indian mobile number');

const text = (label: string, max = 120) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

export const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export const KIDS_TSHIRT_SIZES = ['Kids S', 'Kids M', 'Kids L', 'Kids XL'] as const;
export const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'] as const;

export const registrationSchema = z
  .object({
    race_id: z.string().uuid('Please choose a race'),
    full_name: text('Full name'),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your date of birth'),
    gender: z.enum(GENDERS, { errorMap: () => ({ message: 'Please choose an option' }) }),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    mobile,
    city: text('City', 80),
    tshirt_size: z.enum([...TSHIRT_SIZES, ...KIDS_TSHIRT_SIZES], { errorMap: () => ({ message: 'Choose a T-shirt size' }) }),
    running_club: z.string().trim().max(120).optional().default(''),
    emergency_name: text('Emergency contact name'),
    emergency_mobile: mobile,
    medical_info: z.string().trim().max(1000).optional().default(''),
    medical_consent: z.boolean().optional().default(false),
    guardian_name: z.string().trim().max(120).optional().default(''),
    guardian_relation: z.string().trim().max(40).optional().default(''),
    accepted_terms: z.literal(true, { errorMap: () => ({ message: 'Please accept the terms' }) }),
    accepted_waiver: z.literal(true, { errorMap: () => ({ message: 'Please accept the waiver' }) }),
    accepted_privacy: z.literal(true, { errorMap: () => ({ message: 'Please accept the privacy and refund policy' }) }),
    guardian_consent: z.boolean().optional().default(false),
    photo_consent: z.boolean().optional().default(false),
    whatsapp_opt_in: z.boolean().optional().default(false),
    website: z.string().optional().default('') // honeypot — real people leave this empty
  })
  .refine((d) => !d.medical_info || d.medical_consent, {
    path: ['medical_consent'],
    message: 'Please consent to the medical team using this information, or leave it blank'
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const contactSchema = z.object({
  topic: z.enum(['Race question', 'My registration', 'Volunteering', 'Media', 'Something else']),
  name: text('Name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  mobile: z.string().trim().max(20).optional().default(''),
  reg_code: z.string().trim().max(40).optional().default(''),
  message: text('Message', 3000),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please agree so we can reply to you' }) }),
  website: z.string().optional().default('')
});

export const partnerSchema = z.object({
  org_type: z.enum(['Business', 'Running club', 'School / college', 'Institution / NGO', 'Other']),
  org_name: text('Organisation name'),
  contact_name: text('Your name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  mobile: z.string().trim().max(20).optional().default(''),
  interests: z.array(z.string().max(60)).max(10).optional().default([]),
  message: z.string().trim().max(3000).optional().default(''),
  website: z.string().optional().default('')
});

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please tick the box to agree' }) }),
  source: z.string().max(40).optional().default('website')
});

/** Turns zod issues into { field: message } for showing next to form fields. */
export function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
