/**
 * What this file does:
 * Validates protocol version creation and activation inputs.
 * What calls it:
 * `src/app/api/protocol-versions/route.ts` and `src/app/api/protocol-versions/[versionId]/activate/route.ts`.
 * What it calls:
 * Zod only.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Treating visit schedule definitions as untyped JSON and only discovering malformed rules at runtime.
 */
import { z } from "zod";

const visitTemplateSchema = z.object({
  visitCode: z.string().min(2).max(20),
  label: z.string().min(2).max(50),
  dayOffset: z.number().int().min(0).max(365),
  windowBeforeDays: z.number().int().min(0).max(30),
  windowAfterDays: z.number().int().min(0).max(30),
  required: z.boolean()
});

export const createProtocolVersionSchema = z.object({
  protocolCode: z.string().min(3).max(20),
  versionNumber: z.number().int().positive(),
  effectiveDate: z.string().datetime(),
  summary: z.string().min(10).max(300),
  visitTemplates: z.array(visitTemplateSchema).min(1)
});

export const activateProtocolVersionSchema = z.object({
  activatedAt: z.string().datetime()
});

// ⚠️ SENIOR NOTE: Schema-level validation is intentionally strict because malformed visit windows
// don't just fail one request; they silently generate a bad schedule for every future participant.
