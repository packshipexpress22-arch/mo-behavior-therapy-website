import { z } from "zod";

// Shared across the conversational widget, the quick modal form, and the
// full /contact page form — one schema, three entry points.
export const leadSchema = z.object({
  contactName: z.string().trim().min(1).max(120),
  clientFirstName: z.string().trim().max(80).optional(),
  relationship: z.string().trim().max(60).optional(),
  clientAge: z.string().trim().max(20).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[\d\s()+.-]{7,20}$/, "invalid_phone"),
  email: z.string().trim().email("invalid_email"),
  city: z.string().trim().max(80).optional(),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "invalid_zip")
    .optional()
    .or(z.literal("")),
  county: z.string().trim().max(80).optional(),
  preferredLanguage: z.string().trim().max(20).optional(),
  setting: z.string().trim().max(40).optional(),
  insurance: z.string().trim().max(80).optional(),
  previousAba: z.string().trim().max(20).optional(),
  hasReferral: z.string().trim().max(20).optional(),
  hasEvaluation: z.string().trim().max(20).optional(),
  hasIep: z.string().trim().max(20).optional(),
  contactMethod: z.string().trim().max(20).optional(),
  contactTime: z.string().trim().max(40).optional(),
  howHeard: z.string().trim().max(80).optional(),
  message: z.string().trim().max(2000).optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: "consent_required" }),
  }),
  consentTextVersion: z.string().default("2026-09-v1"),
  sourcePage: z.string().max(300).optional(),
  utm: z.record(z.string()).optional(),
  referrer: z.string().max(500).optional(),
  // Honeypot field — real users never fill this in; bots frequently do.
  companyWebsite: z.string().max(0).optional(),
});
export type LeadInput = z.infer<typeof leadSchema>;

export const referralSchema = z.object({
  professionalName: z.string().trim().min(1).max(120),
  organization: z.string().trim().max(160).optional(),
  role: z.string().trim().max(80).optional(),
  phone: z.string().trim().min(7).max(20),
  email: z.string().trim().email(),
  clientFirstName: z.string().trim().max(80).optional(),
  clientCity: z.string().trim().max(80).optional(),
  clientZip: z
    .string()
    .trim()
    .regex(/^\d{5}$/)
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(1000).optional(),
  consent: z.literal(true),
  companyWebsite: z.string().max(0).optional(),
});
export type ReferralInput = z.infer<typeof referralSchema>;

export const careersSchema = z.object({
  applicantName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(7).max(20),
  email: z.string().trim().email(),
  positionAppliedFor: z.string().trim().max(120),
  message: z.string().trim().max(2000).optional(),
  companyWebsite: z.string().max(0).optional(),
});
export type CareersInput = z.infer<typeof careersSchema>;
