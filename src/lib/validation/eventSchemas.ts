/**
 * What this file does:
 * Validates adverse event and protocol deviation write commands.
 * What calls it:
 * Safety event routes under `src/app/api/participants/[participantId]`.
 * What it calls:
 * Zod only.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Mixing optional safety fields into a single loose schema and making the audit trail ambiguous.
 */
import { z } from "zod";

export const createAdverseEventSchema = z.object({
  reportedAt: z.string().datetime(),
  severity: z.enum(["MILD", "MODERATE", "SEVERE", "LIFE_THREATENING"]),
  description: z.string().min(10).max(500),
  outcome: z.string().min(5).max(500),
  isSerious: z.boolean(),
  requiresUnblinding: z.boolean()
});

export const createDeviationSchema = z.object({
  category: z.string().min(3).max(80),
  severity: z.enum(["MINOR", "MAJOR", "CRITICAL"]),
  description: z.string().min(10).max(500),
  occurredAt: z.string().datetime()
});

// ⚠️ SENIOR NOTE: Safety data has downstream regulatory impact, so allowing weakly typed
// payloads here creates cleanup work far beyond a simple UI bug.
