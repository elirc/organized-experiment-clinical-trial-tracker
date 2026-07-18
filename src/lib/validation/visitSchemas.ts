/**
 * What this file does:
 * Validates visit completion commands.
 * What calls it:
 * `src/app/api/participants/[participantId]/visits/[visitId]/complete/route.ts`.
 * What it calls:
 * Zod only.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Letting clients submit arbitrary visit status values instead of a tightly controlled command.
 */
import { z } from "zod";

export const completeVisitSchema = z.object({
  completedAt: z.string().datetime(),
  notes: z.string().max(500).nullable().optional()
});

// ⚠️ SENIOR NOTE: Constraining the command shape prevents clients from inventing direct status
// transitions that bypass the service-layer state machine.
