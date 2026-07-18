/**
 * What this file does:
 * Defines the API validation boundary for participant creation and enrollment commands.
 * What calls it:
 * Participant route handlers in `src/app/api/participants/**`.
 * What it calls:
 * Zod only.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Trusting form inputs and letting invalid state reach the service layer.
 */
import { z } from "zod";

export const createParticipantSchema = z.object({
  screeningNumber: z.string().min(4).max(30),
  siteId: z.string().min(4),
  initials: z.string().min(2).max(5),
  dateOfBirth: z.string().datetime(),
  screenedAt: z.string().datetime()
});

export const enrollParticipantSchema = z.object({
  protocolVersionId: z.string().min(1),
  enrolledAt: z.string().datetime(),
  studySubjectId: z.string().min(4).max(30),
  blindedRandomizationCode: z.string().min(4).max(20),
  actualTreatmentArm: z.string().min(3).max(80)
});

export const completeStudySchema = z.object({
  completedAt: z.string().datetime()
});

// ⚠️ SENIOR NOTE: `studySubjectId` is validated here before persistence because duplicate
// subject identifiers become reconciliation incidents during downstream data exports.
